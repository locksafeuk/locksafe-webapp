/**
 * Live Agent Task Test
 *
 * Injects real-world business scenarios into each agent and runs their
 * full reasoning loop (Hermes tool-calling). Shows every LLM call,
 * tool dispatch, decision, and cost.
 *
 * Usage:
 *   source .env.local && AGENTS_ENABLED=true \
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-agents-live.ts
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { chat, Models } from '@/lib/llm-router';

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
  white: '\x1b[37m', orange: '\x1b[38;5;214m',
};

const banner  = (t: string) => { const l = '─'.repeat(64); console.log(`\n${C.bold}${C.cyan}${l}\n  ${t}\n${l}${C.reset}\n`); };
const step    = (l: string, v?: string) => console.log(`  ${C.green}✓${C.reset}  ${C.bold}${l}${C.reset}${v ? `  ${C.dim}${v}${C.reset}` : ''}`);
const fail    = (l: string) => console.log(`  ${C.red}✗${C.reset}  ${C.red}${l}${C.reset}`);
const info    = (l: string) => console.log(`  ${C.blue}ℹ${C.reset}  ${l}`);
const warn    = (l: string) => console.log(`  ${C.yellow}⚠${C.reset}  ${C.yellow}${l}${C.reset}`);

function printTool(name: string, args: Record<string, unknown>) {
  console.log(`\n  ${C.magenta}▶ TOOL${C.reset}  ${C.bold}${name}${C.reset}`);
  const s = JSON.stringify(args, null, 2);
  console.log(`    ${C.dim}${(s.length > 400 ? s.slice(0, 400) + '…' : s).replace(/\n/g, '\n    ')}${C.reset}`);
}

function printResult(name: string, ok: boolean, data: unknown) {
  const icon = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  console.log(`  ${icon}  ${C.bold}${name}${C.reset} →`);
  const s = JSON.stringify(data, null, 2);
  console.log(`    ${C.dim}${(s.length > 600 ? s.slice(0, 600) + '\n    …truncated' : s).replace(/\n/g, '\n    ')}${C.reset}`);
}

function printAgentSays(name: string, content: string) {
  console.log(`\n  ${C.cyan}🤖 ${name.toUpperCase()} says:${C.reset}`);
  for (const line of content.trim().split('\n')) {
    console.log(`    ${C.dim}${line}${C.reset}`);
  }
}

// ─── Real-world task scenarios ─────────────────────────────────────────────────

const TASKS: Record<string, string> = {
  coo: `DISPATCH REQUIRED — 17 May 2026 19:30 UTC

There are pending jobs with no locksmith assigned.

Per your HEARTBEAT WORKFLOW:
1. Call getJobStats() to confirm pending count
2. If pending > 0: call autoDispatch() — jobId is OPTIONAL, omit it to auto-select the oldest pending job
3. Repeat autoDispatch() for any remaining pending jobs
4. If autoDispatch fails with "no locksmiths", call sendTelegramAlert() with priority=high
5. FINAL STEP (mandatory): call sendTelegramAlert() summarising what was dispatched

Budget remaining: $38.00.`,

  cmo: `MARKETING TASK — 17 May 2026

We have 3 fully verified locksmiths active in SE1 (Southwark/Borough/London Bridge area).
We are NOT yet active in: NW10, HA0, UB areas — do NOT target those postcodes.

Your tasks:
1. Call getMarketingStats to check current campaign performance
2. Create a Google Ads campaign specifically targeting:
   - "emergency locksmith Southwark"
   - "locksmith Borough London"
   - "locked out SE1"
   Budget: £15/day, use createGoogleAdsDraft
3. Check if any existing campaigns have CTR < 0.5% and pause them
4. Send a Telegram summary: what campaigns are running, what was created, spend today

Be precise about geo-targeting — only active locksmith coverage areas.

FINAL STEP (mandatory): call sendTelegramAlert() with a summary of what campaigns exist, what was created, and today's spend. You MUST call the tool — do not write the summary in text.`,

  cto: `TECHNICAL AUDIT TASK — 17 May 2026

Reports from the last 2 hours:
  • 3 customers complained the quote form is slow on mobile (>4s load)
  • 1 locksmith reported the app crashed when accepting a job
  • Sentry may have error logs

Your tasks:
1. Call getDashboardStats to get current platform health
2. Investigate error rates and any patterns
3. Create a prioritised list of technical fixes (most impactful first)
4. For each fix: estimate effort (hours), severity (P1/P2/P3), and affected users
5. FINAL STEP (mandatory): call sendTelegramAlert() with your P1/P2/P3 findings. You MUST call the tool — do not write the alert in text.
6. Log your recommendations as an agent decision

Budget remaining: $78.00.`,

  ceo: `STRATEGIC DECISION TASK — 17 May 2026

Weekly performance snapshot (you must verify with tools):
  • Job acceptance rate may be below target
  • CMO is running new campaigns targeting SE1
  • COO has been handling dispatches
  • Budget across all agents: ~$0.01 used of $325 total (very healthy)

Your tasks:
1. Call getDashboardStats to verify actual numbers
2. Assess: are we on track for this week's revenue target?
3. Make a strategic decision on one of:
   a) Should we increase COO's auto-dispatch radius to cover more postcodes?
   b) Should we activate the CMO's new SE1 campaign immediately?
   c) Is there a locksmith quality issue needing CTO attention?
4. Delegate a specific task to one subagent using available tools
5. FINAL STEP (mandatory): call sendTelegramAlert() with your executive decision and rationale. You MUST call the tool — do not write the Telegram message in text.

You have full authority. Make a call.`,
};

// ─── Run one agent ─────────────────────────────────────────────────────────────

async function runAgent(agentName: string, taskContext: string): Promise<{
  actionsExecuted: number;
  costUsd: number;
  success: boolean;
}> {
  banner(`Agent: ${agentName.toUpperCase()}`);

  const toolsModule     = await import('@/agents/tools/index');
  const orchestratorModule = await import('@/agents/core/orchestrator');
  const { default: prisma } = await import('@/lib/db');

  const dbAgent = await prisma.agent.findUnique({ where: { name: agentName } });
  if (!dbAgent) {
    fail(`Agent "${agentName}" not found in DB`);
    return { actionsExecuted: 0, costUsd: 0, success: false };
  }

  step(`Agent found`, `${dbAgent.displayName} — status: ${dbAgent.status} — budget: $${dbAgent.budgetUsedUsd.toFixed(3)}/$${dbAgent.monthlyBudgetUsd}`);

  if (dbAgent.status !== 'active') {
    warn(`Agent is ${dbAgent.status}, skipping`);
    return { actionsExecuted: 0, costUsd: 0, success: false };
  }

  // Load SKILL.md
  let systemPrompt = `You are the ${dbAgent.displayName} for LockSafe UK. ${dbAgent.role}. Use your tools to take action.`;
  try {
    const skillPath = path.join(process.cwd(), 'src', 'agents', dbAgent.skillsPath);
    systemPrompt = fs.readFileSync(skillPath, 'utf-8');
    step(`SKILL.md loaded`, dbAgent.skillsPath);
  } catch {
    warn(`SKILL.md not found — using DB role string`);
  }

  // Init tools
  toolsModule.initializeTools();
  const toolDefs = toolsModule.generateFunctionDefinitions(dbAgent.permissions);
  step(`Tools available`, `${toolDefs.length} tools for ${agentName}`);

  await orchestratorModule.initializeAgentState(agentName);

  const agentCtx = {
    agentId:         dbAgent.id,
    agentName:       dbAgent.displayName,
    permissions:     dbAgent.permissions,
    budgetRemaining: dbAgent.monthlyBudgetUsd - dbAgent.budgetUsedUsd,
  };

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: taskContext },
  ];

  info(`Starting reasoning loop (max 6 iterations) …\n`);

  let actionsExecuted = 0;
  let totalCost = 0;
  let usedFallback = false;
  const MAX_ITER = 6;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    console.log(`  ${C.bold}${C.white}── Iteration ${iter + 1} / ${MAX_ITER} ──${C.reset}`);

    const t0 = Date.now();
    const resp = await chat(Models.HERMES, messages as Parameters<typeof chat>[1], {
      tools:       toolDefs as NonNullable<Parameters<typeof chat>[2]>['tools'],
      temperature: 0.3,
      timeoutMs:   90_000,
    });
    const ms = Date.now() - t0;

    console.log(`  ${C.green}← LLM${C.reset}  ${ms}ms  toolCalls=${resp.toolCalls?.length ?? 0}  fallback=${resp.usedFallback}`);

    if (resp.usedFallback) {
      warn(`Hermes unreachable — fell back to OpenAI (gpt-4o-mini)`);
      usedFallback = true;
    }

    messages.push({ role: 'assistant', content: resp.content ?? '' });

    if (resp.content?.trim()) {
      printAgentSays(agentName, resp.content);
    }

    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      // If agent described a tool call in text without executing it, give one nudge
      const content = resp.content ?? '';
      const mentionedTool = content.match(/(?:call|calling|use|execute)\s+`?(\w+)\(\)`?/i)?.[1];
      if (mentionedTool && iter < MAX_ITER - 1) {
        warn(`Agent described "${mentionedTool}" but didn't call it — nudging`);
        messages.push({
          role: 'user',
          content: `You described calling ${mentionedTool}() but did not execute it. Call the tool NOW — emit a tool call, do not write more text.`,
        });
        continue;
      }
      info(`Agent finished — no more tool calls`);
      break;
    }

    for (const call of resp.toolCalls) {
      printTool(call.name, call.arguments as Record<string, unknown>);
      const result = await toolsModule.executeTool(call.name, call.arguments, agentCtx);
      printResult(call.name, result.success, result.success ? result.data : result.error);
      actionsExecuted++;
      totalCost += 0.001;
      messages.push({
        role: 'user',
        content: `Tool "${call.name}" result: ${JSON.stringify(result.success ? result.data : { error: result.error })}`,
      });
    }
  }

  // Persist heartbeat + cost
  await prisma.agent.update({
    where: { id: dbAgent.id },
    data: {
      lastHeartbeat: new Date(),
      budgetUsedUsd: { increment: totalCost },
    },
  });

  return { actionsExecuted, costUsd: totalCost, success: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  banner('LockSafe AI — Live Agent Task Test  🚀');
  console.log(`  ${C.dim}${new Date().toISOString()}${C.reset}`);
  console.log(`  ${C.dim}Testing: COO (dispatch), CMO (ads), CTO (audit), CEO (strategy)${C.reset}\n`);

  // Pre-flight
  banner('Pre-flight');
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    if (!r.ok) throw new Error('non-200');
    const d = await r.json() as { models: Array<{ name: string }> };
    const names = d.models.map(m => m.name);
    step('Ollama reachable', `${names.length} models loaded`);
    if (names.some(n => n.includes('hermes3'))) {
      step('hermes3 present', names.find(n => n.includes('hermes3'))!);
    } else {
      fail('hermes3 NOT found — run: ollama pull hermes3');
      process.exit(1);
    }
  } catch {
    fail('Ollama not reachable at localhost:11434');
    process.exit(1);
  }

  // Run agents
  const agentsToTest: Array<[string, string]> = [
    ['coo', TASKS.coo],
    ['cmo', TASKS.cmo],
    ['cto', TASKS.cto],
    ['ceo', TASKS.ceo],
  ];

  const results: Array<{ name: string; actionsExecuted: number; costUsd: number; success: boolean }> = [];

  for (const [agentName, task] of agentsToTest) {
    try {
      const r = await runAgent(agentName, task);
      results.push({ name: agentName, ...r });
    } catch (err) {
      fail(`${agentName} crashed: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ name: agentName, actionsExecuted: 0, costUsd: 0, success: false });
    }
  }

  // Summary
  banner('Test Summary');
  console.log(`  ${'Agent'.padEnd(16)} ${'Status'.padEnd(10)} ${'Actions'.padEnd(10)} ${'Cost'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(50)}`);

  let totalActions = 0;
  let totalCost = 0;
  for (const r of results) {
    const status = r.success ? `${C.green}✅ PASS${C.reset}` : `${C.red}❌ FAIL${C.reset}`;
    console.log(`  ${r.name.padEnd(16)} ${status.padEnd(18)} ${String(r.actionsExecuted).padEnd(10)} $${r.costUsd.toFixed(4)}`);
    totalActions += r.actionsExecuted;
    totalCost += r.costUsd;
  }
  console.log(`\n  ${C.bold}Total: ${totalActions} actions · $${totalCost.toFixed(4)} cost · ${results.filter(r => r.success).length}/${results.length} agents passed${C.reset}`);
  console.log(`\n  ${C.dim}LLM: Hermes3 local (Ollama) — $0 API cost${C.reset}`);
  console.log(`  ${C.dim}Note: createGoogleAdsDraft + generateAdCopy require OPENAI_API_KEY (set in Vercel, not needed locally for Hermes tests)${C.reset}`);

  console.log(`\n${C.bold}${C.green}  Done ✓${C.reset}\n`);
}

main().catch(err => {
  console.error(`\n${C.red}Fatal:${C.reset}`, err);
  process.exit(1);
});
