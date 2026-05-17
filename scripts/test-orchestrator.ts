/**
 * Full Orchestrator Test Script
 *
 * Runs a complete end-to-end test of the LockSafe AI agent system:
 *   1. Pre-flight checks (Ollama, DB)
 *   2. Initialize all agents in DB
 *   3. Register all tools
 *   4. Run CEO + COO heartbeats (Hermes3 tool-calling loop)
 *   5. Print every LLM call, tool dispatch, and result
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-orchestrator.ts
 */

import 'dotenv/config'; // picks up .env.local automatically with tsx
import * as fs from 'fs';
import * as path from 'path';

// ─── ANSI colours ────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
};

function banner(text: string) {
  const line = '─'.repeat(60);
  console.log(`\n${C.bold}${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${text}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${line}${C.reset}\n`);
}

function step(label: string, value?: string) {
  const tick = `${C.green}✓${C.reset}`;
  const txt  = value ? `${C.bold}${label}${C.reset}  ${C.dim}${value}${C.reset}` : `${C.bold}${label}${C.reset}`;
  console.log(`  ${tick}  ${txt}`);
}

function warn(label: string) {
  console.log(`  ${C.yellow}⚠${C.reset}  ${C.yellow}${label}${C.reset}`);
}

function fail(label: string) {
  console.log(`  ${C.red}✗${C.reset}  ${C.red}${label}${C.reset}`);
}

function info(label: string) {
  console.log(`  ${C.blue}ℹ${C.reset}  ${label}`);
}

function toolCall(name: string, args: Record<string, unknown>) {
  console.log(`\n  ${C.magenta}▶ TOOL CALL${C.reset}  ${C.bold}${name}${C.reset}`);
  console.log(`    ${C.dim}args: ${JSON.stringify(args, null, 2).replace(/\n/g, '\n    ')}${C.reset}`);
}

function toolResult(name: string, ok: boolean, data: unknown) {
  const icon = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  console.log(`  ${icon}  ${C.bold}${name}${C.reset} returned:`);
  const str = JSON.stringify(data, null, 2);
  const truncated = str.length > 800 ? str.slice(0, 800) + '\n    ...truncated' : str;
  console.log(`    ${C.dim}${truncated.replace(/\n/g, '\n    ')}${C.reset}`);
}

function llmResponse(agentName: string, content: string) {
  console.log(`\n  ${C.cyan}🤖 ${agentName.toUpperCase()} says:${C.reset}`);
  const lines = content.trim().split('\n');
  for (const line of lines) {
    console.log(`    ${C.dim}${line}${C.reset}`);
  }
}

// ─── Pre-flight: Ollama ───────────────────────────────────────────────────────
async function checkOllama(): Promise<boolean> {
  const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  try {
    const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    const data = await r.json() as { models: Array<{ name: string }> };
    const models = data.models.map((m) => m.name);
    const hasHermes = models.some((n) => n.startsWith('hermes3'));
    step('Ollama reachable', base);
    if (hasHermes) {
      step('hermes3 present', models.find((n) => n.startsWith('hermes3')));
    } else {
      warn('hermes3 NOT found — run: ollama pull hermes3');
      return false;
    }
    return true;
  } catch {
    fail(`Ollama unreachable at ${base}`);
    return false;
  }
}

// ─── Pre-flight: DB ───────────────────────────────────────────────────────────
async function checkDB(): Promise<boolean> {
  try {
    const { default: prisma } = await import('@/lib/db');
    const count = await prisma.agent.count();
    step('Database connected', `${count} agents in DB`);
    return true;
  } catch (err) {
    fail(`Database connection failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Print agent table from DB ────────────────────────────────────────────────
async function printAgentTable() {
  const { default: prisma } = await import('@/lib/db');
  const agents = await prisma.agent.findMany({
    select: { name: true, displayName: true, status: true, lastHeartbeat: true, budgetUsedUsd: true, monthlyBudgetUsd: true },
    orderBy: { name: 'asc' },
  });

  if (agents.length === 0) {
    warn('No agents in DB yet');
    return;
  }

  console.log(`\n  ${'Name'.padEnd(18)} ${'Status'.padEnd(10)} ${'Budget Used'.padEnd(14)} ${'Last Heartbeat'}`);
  console.log(`  ${'─'.repeat(65)}`);
  for (const a of agents) {
    const budget = `$${a.budgetUsedUsd.toFixed(3)} / $${a.monthlyBudgetUsd}`;
    const hb = a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleTimeString() : 'never';
    const statusColour = a.status === 'active' ? C.green : C.yellow;
    console.log(`  ${C.bold}${a.name.padEnd(18)}${C.reset} ${statusColour}${a.status.padEnd(10)}${C.reset} ${budget.padEnd(14)} ${C.dim}${hb}${C.reset}`);
  }
  console.log('');
}

// ─── Instrument the orchestrator to print verbose output ─────────────────────
// We monkey-patch chat() to intercept every LLM call and executeTool() to
// intercept every tool dispatch, printing them in real time.
let currentAgent = '';

async function runHeartbeatVerbose(agentName: string) {
  currentAgent = agentName;

  // Dynamic imports so env is loaded before module-level code runs
  const { chat, Models } = await import('@/lib/llm-router');
  const toolsModule         = await import('@/agents/tools/index');
  const orchestratorModule  = await import('@/agents/core/orchestrator');

  // ── Patch chat() to print calls ──────────────────────────────────────────
  // We wrap the real chat call inside the orchestrator by intercepting at
  // the Ollama HTTP layer — instead, we hook at the script level by
  // temporarily replacing the module's export.
  const originalChat = chat;
  const patchedChat: typeof chat = async (model, messages, opts) => {
    console.log(`\n  ${C.cyan}→ LLM CALL${C.reset}  model=${C.bold}${model}${C.reset}  messages=${messages.length}  tools=${opts?.tools?.length ?? 0}`);
    const t0 = Date.now();
    const resp = await originalChat(model, messages, opts);
    const ms = Date.now() - t0;
    console.log(`  ${C.green}← LLM DONE${C.reset}  ${ms}ms  toolCalls=${resp.toolCalls?.length ?? 0}  usedFallback=${resp.usedFallback}`);
    if (resp.content?.trim()) {
      llmResponse(agentName, resp.content);
    }
    if (resp.toolCalls?.length) {
      for (const tc of resp.toolCalls) {
        toolCall(tc.name, tc.arguments);
      }
    }
    return resp;
  };

  // ── Patch executeTool() to print results ─────────────────────────────────
  const originalExecTool = toolsModule.executeTool;
  const patchedExecTool: typeof originalExecTool = async (name, params, ctx) => {
    const result = await originalExecTool(name, params, ctx);
    toolResult(name, result.success, result.success ? result.data : result.error);
    return result;
  };

  // ── Initialize in-memory state ────────────────────────────────────────────
  await orchestratorModule.initializeAgentState(agentName);

  // ── Temporarily swap the imports used by orchestrator ────────────────────
  // Because Node module cache is shared, we need to run our own loop
  // that mirrors executeHeartbeat but using our patched functions.
  // This is the cleanest approach without ejecting the full module system.

  const { default: prisma } = await import('@/lib/db');

  const dbAgent = await prisma.agent.findUnique({ where: { name: agentName } });
  if (!dbAgent) {
    fail(`Agent "${agentName}" not found in DB — did initialization run?`);
    return { actionsExecuted: 0, costUsd: 0 };
  }

  const budgetRemaining = dbAgent.monthlyBudgetUsd - dbAgent.budgetUsedUsd;

  // Read SKILL.md
  let systemPrompt = `You are the ${dbAgent.displayName} for LockSafe UK. ${dbAgent.role}. Use your tools to analyse the platform and take action.`;
  try {
    const skillPath = path.join(process.cwd(), 'src', 'agents', dbAgent.skillsPath);
    systemPrompt = fs.readFileSync(skillPath, 'utf-8');
    step('SKILL.md loaded', dbAgent.skillsPath);
  } catch {
    warn(`Could not read SKILL.md (${dbAgent.skillsPath}) — using DB role string`);
  }

  // Init tools
  toolsModule.initializeTools();
  const toolDefs = toolsModule.generateFunctionDefinitions(dbAgent.permissions);
  step('Tools registered', `${toolDefs.length} available for ${agentName}`);

  const agentCtx = {
    agentId:         dbAgent.id,
    agentName:       dbAgent.displayName,
    permissions:     dbAgent.permissions,
    budgetRemaining,
  };

  const contextMsg =
    `Scheduled heartbeat. Time: ${new Date().toISOString()}. ` +
    `Budget remaining: $${budgetRemaining.toFixed(2)}. ` +
    `Use getDashboardStats to check the platform, then decide if any action is needed. ` +
    `End with a brief sendTelegramAlert summary if there is anything notable.`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: contextMsg },
  ];

  info(`Starting reasoning loop (max 5 iterations) …`);

  let actionsExecuted = 0;
  let totalCost = 0;
  const MAX_ITER = 5;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    console.log(`\n  ${C.bold}${C.white}── Iteration ${iter + 1} ──${C.reset}`);

    const resp = await patchedChat(Models.HERMES, messages as Parameters<typeof chat>[1], {
      tools:       toolDefs as Parameters<typeof chat>[2]['tools'],
      temperature: 0.2,
      timeoutMs:   120_000,
    });

    messages.push({ role: 'assistant', content: resp.content ?? '' });

    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      info('No tool calls — agent is done');
      break;
    }

    for (const call of resp.toolCalls) {
      const result = await patchedExecTool(call.name, call.arguments, agentCtx);
      actionsExecuted++;
      totalCost += 0.001;
      messages.push({
        role: 'user',
        content: `Tool "${call.name}" returned: ${JSON.stringify(result.success ? result.data : { error: result.error })}`,
      });
    }
  }

  // Persist to DB
  await prisma.agent.update({
    where: { id: dbAgent.id },
    data: {
      lastHeartbeat: new Date(),
      budgetUsedUsd: { increment: totalCost },
    },
  });

  return { actionsExecuted, costUsd: totalCost };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  banner('LockSafe AI Orchestrator — Full End-to-End Test');
  console.log(`  ${C.dim}${new Date().toISOString()}${C.reset}\n`);

  // ── 1. Pre-flight ──────────────────────────────────────────────────────────
  banner('1 / 5  Pre-flight Checks');
  const ollamaOk = await checkOllama();
  const dbOk     = await checkDB();

  if (!dbOk) {
    fail('Cannot continue — database unreachable. Is DATABASE_URL set?');
    process.exit(1);
  }
  if (!ollamaOk) {
    fail('Cannot continue — hermes3 not available. Run: ollama pull hermes3');
    process.exit(1);
  }

  // ── 2. Initialize agents ───────────────────────────────────────────────────
  banner('2 / 5  Initialize Agents in DB');
  const { initializeCEOAgent } = await import('@/agents/ceo/agent');
  const { initializeCOOAgent } = await import('@/agents/coo/agent');
  const { initializeCMOAgent } = await import('@/agents/cmo/agent');
  const { initializeCTOAgent } = await import('@/agents/cto/agent');

  await initializeCEOAgent(); step('CEO agent ready');
  await initializeCOOAgent(); step('COO agent ready');
  await initializeCMOAgent(); step('CMO agent ready');
  await initializeCTOAgent(); step('CTO agent ready');

  // ── 3. DB state before ─────────────────────────────────────────────────────
  banner('3 / 5  Agent State Before Heartbeat');
  await printAgentTable();

  // ── 4. Run heartbeats ──────────────────────────────────────────────────────
  const agentsToRun = ['coo', 'ceo'];

  for (const agentName of agentsToRun) {
    banner(`4 / 5  Running ${agentName.toUpperCase()} Heartbeat`);
    const t0 = Date.now();
    const result = await runHeartbeatVerbose(agentName);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('');
    step(`${agentName.toUpperCase()} heartbeat complete`, `${result.actionsExecuted} tool calls  |  $${result.costUsd.toFixed(4)} cost  |  ${elapsed}s`);
  }

  // ── 5. DB state after ──────────────────────────────────────────────────────
  banner('5 / 5  Agent State After Heartbeat');
  await printAgentTable();

  // ── Memories written ───────────────────────────────────────────────────────
  const { default: prisma } = await import('@/lib/db');
  try {
    const memories = await prisma.agentMemory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { content: true, memoryType: true, createdAt: true },
    });
    if (memories.length) {
      banner('Latest Agent Memories');
      for (const m of memories) {
        console.log(`  ${C.dim}[${m.memoryType}]${C.reset} ${m.content.slice(0, 120)}`);
      }
    }
  } catch {
    // AgentMemory may not exist yet
  }

  banner('Test Complete ✓');
  console.log(`  All agents initialized and heartbeat loop executed successfully.`);
  console.log(`  Check your Telegram channel for any agent alerts.\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n${C.red}${C.bold}FATAL:${C.reset}`, err);
  process.exit(1);
});
