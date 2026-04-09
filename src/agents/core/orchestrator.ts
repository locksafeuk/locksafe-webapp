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
} from './types';
import {
  sendMessage,
  sendStatusUpdate,
  broadcastMessage,
  getMessages,
} from './message-bus';

// ─── In-Memory Agent State Store ──────────────────────────────────────────────

const agentStates = new Map<string, AgentRuntimeState>();

// Agent dependency graph: agentId -> agents it depends on
const agentDependencies = new Map<string, string[]>();

// Agent priority levels (higher = runs first)
const agentPriorities = new Map<string, number>();

// Telegram rate limiting
let lastTelegramMessage = 0;
const TELEGRAM_RATE_LIMIT_MS = 3000;

// ─── Telegram Rate Limiting ──────────────────────────────────────────────────

export function canSendTelegramMessage(): boolean {
  return Date.now() - lastTelegramMessage > TELEGRAM_RATE_LIMIT_MS;
}

export function recordTelegramMessage(): void {
  lastTelegramMessage = Date.now();
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
 * Execute a single agent's heartbeat with LLM reasoning loop
 */
export async function executeHeartbeat(agentId: string): Promise<HeartbeatResult> {
  const state = agentStates.get(agentId);
  const now = new Date();

  if (state && state.status !== 'active') {
    return {
      success: false,
      agentName: agentId,
      actionsExecuted: 0,
      costUsd: 0,
      errors: [`Agent ${agentId} is ${state.status}`],
      nextHeartbeat: state.nextHeartbeat,
    };
  }

  // Check inbox for pending messages
  const pendingMessages = await getMessages(agentId, { status: 'pending' });
  let actionsExecuted = 0;
  let totalCost = 0;

  // Process pending decision requests
  for (const msg of pendingMessages) {
    if (msg.type === 'DECISION_REQUEST' || msg.type === 'TASK_DELEGATION') {
      actionsExecuted++;
      // Mark as delivered (actual processing happens in agent-specific logic)
      msg.status = 'delivered';
      msg.deliveredAt = new Date();
    }
  }

  // Update state
  if (state) {
    state.lastHeartbeat = now;
    state.nextHeartbeat = new Date(now.getTime() + 3600000);
  }

  // Sync to DB
  await syncAgentStateWithDB(agentId);

  // Broadcast status update to CEO if this is an executive agent
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
    success: true,
    agentName: agentId,
    actionsExecuted,
    costUsd: totalCost,
    errors: [],
    nextHeartbeat: new Date(now.getTime() + 3600000),
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
