/**
 * Enhanced Agent Orchestrator
 *
 * Manages heartbeats, task delegation, agent state coordination,
 * parallel execution, dependency tracking, and DB synchronization.
 */

import type {
  HeartbeatResult,
  AgentStatusMessage,
  TaskCreateRequest,
  AgentRuntimeState,
  AgentStatus,
  AgentContext,
} from './types';
import {
  sendMessage,
  sendStatusUpdate,
  broadcastMessage,
  getMessages,
} from './message-bus';
import { chat, Models } from '@/lib/llm-router';
import type { LLMMessage } from '@/lib/llm-router';
import { sendAdminAlert } from '@/lib/telegram';
import {
  getOperationalPolicy,
  isGuardianAgent,
  shouldEmitAlert,
  GUARDIAN_AGENT_NAMES,
} from './operational-policy';

export { GUARDIAN_AGENT_NAMES };

// ─── In-Memory Agent State Store ──────────────────────────────────────────────

const agentStates = new Map<string, AgentRuntimeState>();

// Agent dependency graph: agentId -> agents it depends on
const agentDependencies = new Map<string, string[]>();

// Agent priority levels (higher = runs first)
const agentPriorities = new Map<string, number>();

// Incident dedupe map: signature -> last sent timestamp
const incidentDedupe = new Map<string, number>();

// Dedupe and rate-limit values are env-configurable so we can tune Telegram
// noise without a redeploy. Defaults preserve previous behaviour for guardian
// alerts, with a longer window for non-workflow agents.
const INCIDENT_DEDUPE_WINDOW_MS =
  Math.max(1, Number(process.env.AGENT_DEDUPE_WINDOW_MIN ?? '15')) * 60 * 1000;
const NON_WORKFLOW_DEDUPE_WINDOW_MS =
  Math.max(1, Number(process.env.NON_WORKFLOW_DEDUPE_WINDOW_MIN ?? '60')) * 60 * 1000;

// Telegram rate limiting
let lastTelegramMessage = 0;
const TELEGRAM_RATE_LIMIT_MS = Math.max(
  500,
  Number(process.env.AGENT_TELEGRAM_RATE_LIMIT_MS ?? '3000'),
);

// ─── Telegram Rate Limiting ──────────────────────────────────────────────────

export function canSendTelegramMessage(): boolean {
  return Date.now() - lastTelegramMessage > TELEGRAM_RATE_LIMIT_MS;
}

export function recordTelegramMessage(): void {
  lastTelegramMessage = Date.now();
}

function shouldEscalateIncident(signature: string, windowMs: number): boolean {
  const now = Date.now();
  const previous = incidentDedupe.get(signature);
  if (previous && now - previous < windowMs) {
    return false;
  }
  incidentDedupe.set(signature, now);
  return true;
}

function extractInvalidSchemaToolNames(schemaErrors: string[]): string[] {
  const toolNames = new Set<string>();
  for (const err of schemaErrors) {
    const match = err.match(/Tool\s+([^\s]+)\s+has\s+invalid\s+array\s+schema/i);
    if (match?.[1]) {
      toolNames.add(match[1]);
    }
  }
  return Array.from(toolNames);
}

/**
 * Execute a tool with bounded exponential-backoff retry for transient failures.
 * Only retries on network/DB-shaped errors; permanent errors return on the
 * first attempt.
 */
type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function isTransientToolError(err: string | undefined): boolean {
  if (!err) return false;
  const lower = err.toLowerCase();
  return (
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('socket hang up') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('rate limit') ||
    lower.includes('503') ||
    lower.includes('502')
  );
}

async function executeToolWithRetry(
  executeTool: ToolExecutor,
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
  maxAttempts = 3,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let lastResult: { success: boolean; data?: unknown; error?: string } = {
    success: false,
    error: 'unknown',
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      lastResult = await executeTool(name, args, ctx);
    } catch (err) {
      lastResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (lastResult.success) return lastResult;
    if (!isTransientToolError(lastResult.error)) return lastResult;
    if (attempt < maxAttempts) {
      const delayMs = Math.min(2000, 200 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return lastResult;
}

async function escalateHeartbeatIncident(params: {
  incidentKey: string;
  sourceAgentName: string;
  sourceAgentDbId: string;
  title: string;
  message: string;
  taskDescription: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}): Promise<void> {
  const guardian = isGuardianAgent(params.sourceAgentName);
  const severity = params.severity ?? (guardian ? 'error' : 'warning');
  const dedupeWindow = guardian
    ? INCIDENT_DEDUPE_WINDOW_MS
    : NON_WORKFLOW_DEDUPE_WINDOW_MS;

  if (!shouldEscalateIncident(params.incidentKey, dedupeWindow)) {
    return;
  }

  const policy = await getOperationalPolicy();
  const emitAlert = shouldEmitAlert(
    params.sourceAgentName,
    severity,
    policy.alertSensitivity,
  );

  const targetAgent = params.sourceAgentName === 'cto' ? 'ceo' : 'cto';

  const tasks: Promise<unknown>[] = [
    delegateTask(params.sourceAgentDbId, targetAgent, {
      title: `[Repair] ${params.title}`,
      description: params.taskDescription,
      priority: 9,
    }),
  ];

  if (emitAlert) {
    const telegramSeverity: 'info' | 'warning' | 'error' =
      severity === 'critical' ? 'error' : severity;
    tasks.push(
      sendAdminAlert({
        title: params.title,
        message: params.message,
        severity: telegramSeverity,
      }),
    );
  } else {
    console.log(
      `[Orchestrator] Suppressing Telegram alert for ${params.sourceAgentName} ` +
      `(${severity}) under sensitivity=${policy.alertSensitivity}`,
    );
  }

  await Promise.allSettled(tasks);
}

// ─── DB Sync ─────────────────────────────────────────────────────────────────

/**
 * Sync in-memory agent state with database
 */
export async function syncAgentStateWithDB(agentId: string): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const dbAgent = await prisma.agent.findUnique({ where: { name: agentId } });
    if (!dbAgent) return;

    const state = agentStates.get(agentId);
    if (state) {
      // Push in-memory state to DB
      await prisma.agent.update({
        where: { name: agentId },
        data: {
          status: state.status,
          lastHeartbeat: state.lastHeartbeat,
          nextHeartbeat: state.nextHeartbeat,
        },
      });
    } else {
      // Pull DB state into memory
      const newState: AgentRuntimeState = {
        agentId,
        status: dbAgent.status as AgentStatus,
        lastHeartbeat: dbAgent.lastHeartbeat,
        nextHeartbeat: dbAgent.nextHeartbeat || new Date(Date.now() + 3600000),
      };
      agentStates.set(agentId, newState);
    }
  } catch {
    // DB sync is best-effort
  }
}

/**
 * Sync all agents from database into memory
 */
export async function syncAllAgentsFromDB(): Promise<number> {
  let synced = 0;
  try {
    const { prisma } = await import('@/lib/prisma');
    const agents = await prisma.agent.findMany();
    for (const dbAgent of agents) {
      const state: AgentRuntimeState = {
        agentId: dbAgent.name,
        status: dbAgent.status as AgentStatus,
        lastHeartbeat: dbAgent.lastHeartbeat,
        nextHeartbeat: dbAgent.nextHeartbeat || new Date(Date.now() + 3600000),
      };
      agentStates.set(dbAgent.name, state);
      synced++;
    }
    console.log(`[Orchestrator] Synced ${synced} agents from database`);
  } catch {
    console.log('[Orchestrator] DB sync unavailable, using in-memory state');
  }
  return synced;
}

// ─── Heartbeat System ────────────────────────────────────────────────────────

/**
 * Execute heartbeats for all registered agents (with parallel execution)
 */
export async function runAllHeartbeats(): Promise<HeartbeatResult[]> {
  // Sort agents by priority (higher first)
  const sortedAgents = [...agentStates.entries()].sort((a, b) => {
    const priA = agentPriorities.get(a[0]) || 5;
    const priB = agentPriorities.get(b[0]) || 5;
    return priB - priA;
  });

  // Group agents by dependency level for parallel execution
  const independentAgents: string[] = [];
  const dependentAgents: string[] = [];

  for (const [agentId] of sortedAgents) {
    const deps = agentDependencies.get(agentId);
    if (!deps || deps.length === 0) {
      independentAgents.push(agentId);
    } else {
      dependentAgents.push(agentId);
    }
  }

  // Run independent agents in parallel
  const independentResults = await Promise.allSettled(
    independentAgents.map((id) => executeHeartbeat(id))
  );

  const results: HeartbeatResult[] = independentResults.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      success: false,
      agentName: independentAgents[i],
      actionsExecuted: 0,
      costUsd: 0,
      errors: [r.reason instanceof Error ? r.reason.message : 'Unknown error'],
      nextHeartbeat: new Date(Date.now() + 3600000),
    };
  });

  // Then run dependent agents sequentially
  for (const agentId of dependentAgents) {
    try {
      const result = await executeHeartbeat(agentId);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        agentName: agentId,
        actionsExecuted: 0,
        costUsd: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        nextHeartbeat: new Date(Date.now() + 3600000),
      });
    }
  }

  return results;
}

/**
 * Execute a single agent's heartbeat with LLM reasoning loop.
 *
 * Flow:
 *  1. Load agent config + budget from DB
 *  2. Read SKILL.md for system prompt (falls back to DB role string)
 *  3. Build initial context (time, budget, pending tasks)
 *  4. Run Hermes3 tool-calling loop (max 5 iterations)
 *  5. Execute each tool call via registry
 *  6. Persist decisions, update lastHeartbeat + budget in DB
 */
export async function executeHeartbeat(agentId: string): Promise<HeartbeatResult> {
  const state = agentStates.get(agentId);
  const now = new Date();

  let actionsExecuted = 0;
  let totalCost = 0;
  const errors: string[] = [];

  try {
    // ── 1. Load agent from DB ────────────────────────────────────────────────
    const { prisma } = await import('@/lib/prisma');
    const dbAgent = await prisma.agent.findUnique({ where: { name: agentId } });
    if (!dbAgent) {
      return {
        success: false,
        agentName: agentId,
        actionsExecuted: 0,
        costUsd: 0,
        errors: [`Agent ${agentId} not found in database`],
        nextHeartbeat: new Date(now.getTime() + 3_600_000),
      };
    }

    const dbStatus = String(dbAgent.status ?? '').toLowerCase();
    const runtimeStatus = state ? String(state.status).toLowerCase() : '';

    // DB is source of truth; reconcile in-memory drift when possible.
    if (state && dbStatus && runtimeStatus && dbStatus !== runtimeStatus) {
      state.status = dbStatus as AgentStatus;
    }

    const effectiveStatus = dbStatus || runtimeStatus || 'active';
    if (effectiveStatus !== 'active') {
      return {
        success: true,
        agentName: agentId,
        actionsExecuted: 0,
        costUsd: 0,
        errors: [],
        nextHeartbeat: dbAgent.nextHeartbeat || state?.nextHeartbeat || new Date(now.getTime() + 3_600_000),
      };
    }

    const budgetRemaining = dbAgent.monthlyBudgetUsd - dbAgent.budgetUsedUsd;
    if (budgetRemaining <= 0) {
      console.warn(`[Orchestrator] Agent ${agentId} budget exhausted`);
      return {
        success: false,
        agentName: agentId,
        actionsExecuted: 0,
        costUsd: 0,
        errors: ['Monthly budget exhausted'],
        nextHeartbeat: new Date(now.getTime() + 3_600_000),
      };
    }

    // ── 2. Load SKILL.md system prompt ──────────────────────────────────────
    let systemPrompt = `You are the ${dbAgent.displayName} for LockSafe UK.\n${dbAgent.role}\n\nAnalyze the platform state and use your available tools to take appropriate actions.`;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const skillPath = path.join(process.cwd(), 'src', 'agents', dbAgent.skillsPath);
      systemPrompt = await fs.readFile(skillPath, 'utf-8');
    } catch {
      // Fall back to DB role string — acceptable on Vercel if SKILL.md not bundled
    }

    // ── 3. Initialize tools ──────────────────────────────────────────────────
    const {
      initializeTools,
      generateFunctionDefinitions,
      validateFunctionDefinitions,
      executeTool,
    } = await import('@/agents/tools/index');
    initializeTools();

    const agentCtx: AgentContext = {
      agentId:         dbAgent.id,
      agentName:       dbAgent.displayName,
      permissions:     dbAgent.permissions,
      budgetRemaining,
    };

    const functionDefs = generateFunctionDefinitions(dbAgent.permissions);
    const schemaErrors = validateFunctionDefinitions(functionDefs);
    const invalidSchemaTools = extractInvalidSchemaToolNames(schemaErrors);

    const activeFunctionDefs =
      invalidSchemaTools.length > 0
        ? functionDefs.filter((def) => !invalidSchemaTools.includes(def.function.name))
        : functionDefs;

    if (schemaErrors.length > 0) {
      errors.push(`Schema validation issues detected: ${schemaErrors.join('; ')}`);

      await escalateHeartbeatIncident({
        incidentKey: `schema:${agentId}:${invalidSchemaTools.sort().join(',') || 'unknown'}`,
        sourceAgentName: agentId,
        sourceAgentDbId: dbAgent.id,
        title: `Agent tool schema issue isolated (${agentId})`,
        message:
          `Detected invalid tool schema during heartbeat for ${agentId}. ` +
          `${invalidSchemaTools.length > 0 ? `Isolated tools: ${invalidSchemaTools.join(', ')}` : 'Tool names not parsed from validator output.'}`,
        taskDescription:
          `Heartbeat schema preflight failed for ${agentId}.\n` +
          `Errors:\n- ${schemaErrors.join('\n- ')}\n\n` +
          `Isolated tools: ${invalidSchemaTools.join(', ') || 'none detected'}.\n` +
          `Investigate tool parameter definitions and registry schema generation.`,
      });
    }

    if (activeFunctionDefs.length === 0) {
      throw new Error('No valid tools available after schema isolation.');
    }

    // Cast to OllamaTool[] — the shape is identical; registry returns OpenAI-compatible format
    const toolDefs = activeFunctionDefs as import('@/lib/llm-router').OllamaTool[];

    // ── 4. Build initial context ─────────────────────────────────────────────
    const contextParts: string[] = [
      `Current UTC time: ${now.toISOString()}`,
      `Budget remaining this month: $${budgetRemaining.toFixed(2)} of $${dbAgent.monthlyBudgetUsd}`,
    ];

    if (invalidSchemaTools.length > 0) {
      contextParts.push(
        `Safety mode: these tools were isolated due to invalid schema and must not be used until fixed: ${invalidSchemaTools.join(', ')}`
      );
    }

    try {
      const pendingTasks = await prisma.agentTask.findMany({
        where: { agentId: dbAgent.id, status: { in: ['pending', 'in_progress'] } },
        take: 5,
        orderBy: { priority: 'desc' },
      });
      if (pendingTasks.length > 0) {
        contextParts.push(
          `Pending tasks (${pendingTasks.length}): ${pendingTasks.map(t => t.title).join(' | ')}`
        );
      }
    } catch {
      // non-critical
    }

    // ── 5. Run Hermes3 tool-calling reasoning loop ───────────────────────────
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          `Scheduled heartbeat. ${contextParts.join('. ')}. ` +
          `Use your tools to check the platform, identify issues, and take action. ` +
          `When done, call sendTelegramAlert with a brief summary if there are notable findings.`,
      },
    ];

    const MAX_ITERATIONS = 5;
    // In-heartbeat memoization for idempotent read-only tools. Avoids the LLM
    // re-fetching the same data within a single heartbeat reasoning loop.
    const toolCallCache = new Map<string, unknown>();
    const READ_ONLY_TOOL_PREFIXES = ['get', 'list', 'check', 'fetch', 'read', 'query'];
    const isReadOnlyTool = (name: string): boolean =>
      READ_ONLY_TOOL_PREFIXES.some((p) => name.toLowerCase().startsWith(p));

    // Trace id groups every AgentExecution row from this single heartbeat together
    const traceId = `hb_${dbAgent.id}_${now.getTime()}`;
    let lastLlmModel = '';
    let lastLlmUsedFallback = false;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // Iteration-level budget guard — stop the loop if budget exhausted.
      if (totalCost >= budgetRemaining) {
        console.warn(
          `[Orchestrator:${agentId}] Budget guard tripped at iter ${iter} ` +
          `(spent $${totalCost.toFixed(4)} of $${budgetRemaining.toFixed(2)})`,
        );
        break;
      }

      const llmStart = Date.now();
      const response = await chat(Models.HERMES, messages, {
        tools: toolDefs,
        temperature: 0.2,
        timeoutMs: 120_000,
        allowOpenAIFallback: true,
        fallbackSeverity: 'critical',
      });
      lastLlmModel = response.model;
      lastLlmUsedFallback = response.usedFallback;
      totalPromptTokens     += response.promptTokens     ?? 0;
      totalCompletionTokens += response.completionTokens ?? 0;

      // Persist the reasoning step so we can audit Hermes activity from the DB.
      try {
        await prisma.agentExecution.create({
          data: {
            agentId:     dbAgent.id,
            traceId,
            actionType:  'decision',
            actionName:  `llm_iteration_${iter}`,
            input:       JSON.stringify({ iter, messageCount: messages.length }),
            output:      JSON.stringify({
              content:    (response.content ?? '').slice(0, 1500),
              toolCalls:  response.toolCalls?.map((c) => c.name) ?? [],
              usedFallback: response.usedFallback,
            }),
            status:      'success',
            tokensUsed:  (response.promptTokens ?? 0) + (response.completionTokens ?? 0),
            costUsd:     0,
            model:       response.model,
            startedAt:   new Date(llmStart),
            completedAt: new Date(),
            durationMs:  Date.now() - llmStart,
          },
        });
      } catch (logErr) {
        console.warn(`[Orchestrator:${agentId}] failed to log LLM iter:`, logErr);
      }

      // Append assistant turn to conversation history
      messages.push({ role: 'assistant', content: response.content ?? '' });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // No more tool calls — agent has finished reasoning
        break;
      }

      // Execute each tool call and feed result back into conversation
      for (const call of response.toolCalls) {
        console.log(`[Orchestrator:${agentId}] Tool call → ${call.name}`, call.arguments);

        const cacheKey = `${call.name}:${JSON.stringify(call.arguments ?? {})}`;
        let resultPayload: { success: boolean; data?: unknown; error?: string };
        const toolStart = Date.now();
        let fromCache = false;

        if (isReadOnlyTool(call.name) && toolCallCache.has(cacheKey)) {
          resultPayload = toolCallCache.get(cacheKey) as typeof resultPayload;
          fromCache = true;
          console.log(`[Orchestrator:${agentId}] Cache hit → ${call.name}`);
        } else {
          // Retry with exponential backoff for transient failures (network/DB).
          resultPayload = await executeToolWithRetry(
            executeTool,
            call.name,
            call.arguments,
            agentCtx,
          );
          if (isReadOnlyTool(call.name) && resultPayload.success) {
            toolCallCache.set(cacheKey, resultPayload);
          }
        }

        actionsExecuted++;
        // Nominal cost tracking ($0 for local Ollama, but tracked for auditing)
        totalCost += 0.001;

        // Persist the tool call so we have a verifiable audit trail.
        try {
          await prisma.agentExecution.create({
            data: {
              agentId:     dbAgent.id,
              traceId,
              actionType:  'tool_call',
              actionName:  call.name,
              input:       JSON.stringify(call.arguments ?? {}).slice(0, 2000),
              output:      JSON.stringify(
                resultPayload.success
                  ? { ok: true, data: resultPayload.data, cached: fromCache }
                  : { ok: false, error: resultPayload.error, cached: fromCache },
              ).slice(0, 4000),
              status:      resultPayload.success ? 'success' : 'failed',
              tokensUsed:  0,
              costUsd:     0.001,
              model:       response.model,
              startedAt:   new Date(toolStart),
              completedAt: new Date(),
              durationMs:  Date.now() - toolStart,
            },
          });
        } catch (logErr) {
          console.warn(`[Orchestrator:${agentId}] failed to log tool call:`, logErr);
        }

        messages.push({
          role: 'user',
          content: `Tool "${call.name}" returned: ${JSON.stringify(
            resultPayload.success ? resultPayload.data : { error: resultPayload.error }
          )}`,
        });
      }
    }

    // ── 6. Persist results to DB ─────────────────────────────────────────────
    await prisma.agent.update({
      where: { id: dbAgent.id },
      data: {
        lastHeartbeat: now,
        budgetUsedUsd: { increment: totalCost },
        totalExecutions: { increment: actionsExecuted },
      },
    });

    // Always store a heartbeat memory entry so we have an audit trail even when
    // Hermes returns an empty assistant message (common when tool_calls are emitted).
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const summary =
      (lastAssistantMsg?.content && lastAssistantMsg.content.trim()) ||
      `Heartbeat completed via ${lastLlmModel || 'hermes3'}${lastLlmUsedFallback ? ' (OpenAI fallback)' : ''}. ` +
      `${actionsExecuted} tool calls, ${totalPromptTokens}/${totalCompletionTokens} tokens, $${totalCost.toFixed(4)} cost.`;
    try {
      const { storeDecision } = await import('@/agents/core/memory');
      await storeDecision(
        dbAgent.id,
        `Heartbeat ${now.toISOString()}`,
        summary.slice(0, 500),
        'completed'
      );
    } catch (memErr) {
      console.warn(`[Orchestrator:${agentId}] failed to store heartbeat memory:`, memErr);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error(`[Orchestrator] Heartbeat error for ${agentId}:`, err);
  }

  // ── Update in-memory state ──────────────────────────────────────────────
  if (state) {
    state.lastHeartbeat = now;
    state.nextHeartbeat = new Date(now.getTime() + 3_600_000);
  }

  await syncAgentStateWithDB(agentId);

  // Notify CEO if this is a sub-executive
  if (['cmo', 'coo', 'cto'].includes(agentId)) {
    await sendStatusUpdate(
      agentId,
      'ceo',
      'completed',
      `Heartbeat completed: ${actionsExecuted} actions, $${totalCost.toFixed(4)} cost`,
      { actionsExecuted, cost: totalCost }
    );
  }

  return {
    success: errors.length === 0,
    agentName: agentId,
    actionsExecuted,
    costUsd: totalCost,
    errors,
    nextHeartbeat: new Date(now.getTime() + 3_600_000),
  };
}

// ─── Agent Status ────────────────────────────────────────────────────────────

export async function getAgentStatusSummary(): Promise<{
  total: number;
  active: number;
  paused: number;
  agents: AgentStatusMessage[];
}> {
  const agents: AgentStatusMessage[] = [];
  let active = 0;
  let paused = 0;

  for (const [, state] of agentStates) {
    // Try to get pending tasks from DB
    let pendingTasks = 0;
    let budgetUsed = 0;
    let budgetTotal = 50;
    let displayName = state.agentId;

    try {
      const { prisma } = await import('@/lib/prisma');
      const dbAgent = await prisma.agent.findUnique({ where: { name: state.agentId } });
      if (dbAgent) {
        displayName = dbAgent.displayName;
        budgetUsed = dbAgent.budgetUsedUsd;
        budgetTotal = dbAgent.monthlyBudgetUsd;
        const tasks = await prisma.agentTask.count({
          where: { agent: { name: state.agentId }, status: 'pending' },
        });
        pendingTasks = tasks;
      }
    } catch {
      // Fall back to in-memory defaults
    }

    const statusMsg: AgentStatusMessage = {
      name: state.agentId,
      agentName: state.agentId,
      displayName,
      status: state.status,
      lastHeartbeat: state.lastHeartbeat,
      pendingTasks,
      budgetUsed,
      budgetTotal,
    };
    agents.push(statusMsg);
    if (state.status === 'active') active++;
    if (state.status === 'paused') paused++;
  }

  return { total: agents.length, active, paused, agents };
}

// ─── Task Delegation ─────────────────────────────────────────────────────────

/**
 * Delegate a task from one agent to another (with DB persistence)
 */
export async function delegateTask(
  fromAgentId: string,
  toAgent: string,
  task: TaskCreateRequest
): Promise<string | null> {
  console.log(`[Orchestrator] Task delegated: ${fromAgentId} → ${toAgent}: ${task.title}`);

  let taskId: string | null = null;

  // Persist to database
  try {
    const { prisma } = await import('@/lib/prisma');
    const targetAgent = await prisma.agent.findUnique({ where: { name: toAgent } });
    if (targetAgent) {
      const dbTask = await prisma.agentTask.create({
        data: {
          agentId: targetAgent.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: 'pending',
          delegatedFrom: fromAgentId,
          delegatedTo: toAgent,
          deadline: task.deadline,
        },
      });
      taskId = dbTask.id;
    }
  } catch {
    console.log('[Orchestrator] DB persistence unavailable for task delegation');
  }

  // Send message notification via message bus
  await sendMessage(fromAgentId, toAgent, 'TASK_DELEGATION', `Task: ${task.title}`, task.description, {
    priority: task.priority >= 8 ? 'critical' : task.priority >= 5 ? 'high' : 'normal',
    metadata: {
      taskId,
      priority: task.priority,
      deadline: task.deadline,
    },
  });

  return taskId;
}

/**
 * Complete a delegated task
 */
export async function completeTask(
  taskId: string,
  agentId: string,
  result: string,
  summary: string
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result,
        resultSummary: summary,
      },
    });

    // Notify the delegating agent
    const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
    if (task?.delegatedFrom) {
      await sendStatusUpdate(
        agentId,
        task.delegatedFrom,
        'completed',
        `Task completed: ${task.title} - ${summary}`
      );
    }
  } catch {
    console.log('[Orchestrator] DB unavailable for task completion');
  }
}

// ─── Agent State Management ──────────────────────────────────────────────────

export async function initializeAgentState(agentId: string): Promise<AgentRuntimeState> {
  const state: AgentRuntimeState = {
    agentId,
    status: 'active',
    lastHeartbeat: null,
    nextHeartbeat: new Date(Date.now() + 3600000),
  };
  agentStates.set(agentId, state);
  return state;
}

export async function getAgentsDueForHeartbeat(): Promise<string[]> {
  const now = Date.now();
  const due: string[] = [];
  for (const [agentId, state] of agentStates) {
    if (state.status === 'active' && state.nextHeartbeat.getTime() <= now) {
      due.push(agentId);
    }
  }
  return due;
}

/**
 * Set agent dependencies (for execution ordering)
 */
export function setAgentDependencies(agentId: string, dependencies: string[]): void {
  agentDependencies.set(agentId, dependencies);
}

/**
 * Set agent priority (higher = runs first during heartbeats)
 */
export function setAgentPriority(agentId: string, priority: number): void {
  agentPriorities.set(agentId, priority);
}

/**
 * Pause an agent
 */
export async function pauseAgent(agentId: string): Promise<boolean> {
  const state = agentStates.get(agentId);
  if (!state) return false;
  state.status = 'paused';
  await syncAgentStateWithDB(agentId);
  await broadcastMessage(agentId, 'STATUS_UPDATE', `Agent ${agentId} paused`, 'Agent has been paused by orchestrator.');
  return true;
}

/**
 * Resume a paused agent
 */
export async function resumeAgent(agentId: string): Promise<boolean> {
  const state = agentStates.get(agentId);
  if (!state) return false;
  state.status = 'active';
  state.nextHeartbeat = new Date(Date.now() + 60000); // Schedule immediate heartbeat
  await syncAgentStateWithDB(agentId);
  return true;
}

/**
 * Get the full agent state map (for internal use)
 */
export function getAgentStates(): Map<string, AgentRuntimeState> {
  return agentStates;
}

// ─── Orchestration Coordination ──────────────────────────────────────────────

/**
 * Run a coordinated task across multiple agents
 */
export async function coordinateTask(
  initiatorAgentId: string,
  taskTitle: string,
  taskDescription: string,
  involvedAgents: string[],
  priority: number = 5
): Promise<{ taskIds: string[]; correlationId: string }> {
  const correlationId = `coord_${Date.now()}`;
  const taskIds: string[] = [];

  for (const agentId of involvedAgents) {
    const taskId = await delegateTask(initiatorAgentId, agentId, {
      title: `[Coordinated] ${taskTitle}`,
      description: `${taskDescription}\n\nCorrelation: ${correlationId}\nInvolved agents: ${involvedAgents.join(', ')}`,
      priority,
    });
    if (taskId) taskIds.push(taskId);
  }

  console.log(
    `[Orchestrator] Coordinated task "${taskTitle}" created for ${involvedAgents.length} agents (${correlationId})`
  );

  return { taskIds, correlationId };
}
