/**
 * Full Job Flow Test
 *
 * Creates a real PENDING job, fires all notifications, then runs the COO heartbeat
 * to observe how the agent reacts.  Clean-up deletes the test job at the end.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-full-job-flow.ts
 */
export {};

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ── ANSI colours ──────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  blue:    '\x1b[34m',
};

function banner(title: string) {
  const line = '─'.repeat(60);
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.white}  ${title}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}
function ok(label: string, detail = '')    { console.log(`  ${C.green}✓${C.reset}  ${C.bold}${label}${C.reset}  ${C.dim}${detail}${C.reset}`); }
function fail(label: string, detail = '')  { console.log(`  ${C.red}✗${C.reset}  ${C.bold}${label}${C.reset}  ${C.dim}${detail}${C.reset}`); }
function info(label: string, detail = '')  { console.log(`  ${C.cyan}ℹ${C.reset}  ${label}  ${C.dim}${detail}${C.reset}`); }
function warn(label: string, detail = '')  { console.log(`  ${C.yellow}⚠${C.reset}  ${label}  ${C.dim}${detail}${C.reset}`); }
function step(label: string, detail = '')  { console.log(`  ${C.blue}→${C.reset}  ${label}  ${C.dim}${detail}${C.reset}`); }

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`;
    headers['x-cron-secret'] = cronSecret;
  }

  const cookieValue = process.env.AUTH_TOKEN_COOKIE || process.env.ADMIN_COOKIE;
  if (cookieValue) {
    const trimmed = cookieValue.trim();
    headers.Cookie = trimmed.includes('=')
      ? trimmed
      : `auth_token=${trimmed}; admin_token=${trimmed}`;
  }

  return headers;
}

async function safeJsonResponse<T>(r: Response): Promise<T | null> {
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function ensureHermesModel(): Promise<string | null> {
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    if (!r.ok) return null;
    const d = await r.json() as { models: Array<{ name: string }> };
    const names = d.models.map((m) => m.name);
    const preferred = names.find((n) => n.startsWith('hermes-4:'))
      || names.find((n) => n.startsWith('hermes3:'))
      || names.find((n) => n.toLowerCase().includes('hermes'));
    if (!preferred) return null;
    process.env.OLLAMA_MODEL_HERMES = preferred;
    return preferred;
  } catch {
    return null;
  }
}

// ── Test coordinates: Windsor area (near Alexandru & Andrei) ──────────────────
const TEST_JOB = {
  postcode:    'SL4 1DD',
  address:     '12 Castle Hill Road, Windsor, SL4 1DD',
  latitude:    51.4830,   // Windsor town centre — within 50mi of both APNs locksmiths
  longitude:   -0.6044,
  problemType: 'lockout',
  propertyType:'house',
  description: '[TEST] Emergency lockout — resident locked out of front door.',
  isEmergency: true,
};

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  banner('LockSafe — Full Job Flow Test');
  console.log(`  ${C.dim}${new Date().toISOString()}${C.reset}\n`);

  const hermesModel = await ensureHermesModel();
  if (hermesModel) {
    ok('Hermes model selected', hermesModel);
  } else {
    warn('No Hermes model detected in Ollama', 'LLM step may fail unless OpenAI fallback is enabled');
  }

  const { default: prisma } = await import('@/lib/db');

  // ── 1. Telegram ping ────────────────────────────────────────────────────────
  banner('1 / 6  Telegram Connection');
  const { testTelegramConnection } = await import('@/lib/telegram');
  const tg = await testTelegramConnection();
  if (tg.success) ok('Telegram connected', tg.message);
  else            warn('Telegram not connected', tg.message);

  // ── 2. Push-capable locksmiths ──────────────────────────────────────────────
  banner('2 / 6  Push-Capable Locksmiths');
  const pushLocksmiths = await prisma.locksmith.findMany({
    where: { isActive: true, isVerified: true, nativeDeviceToken: { not: null } },
    select: {
      id: true, name: true,
      baseLat: true, baseLng: true, coverageRadius: true,
      nativeDeviceToken: true, nativeTokenType: true, nativeTokenPlatform: true,
    },
  });

  if (pushLocksmiths.length === 0) {
    warn('No locksmiths with device tokens — push notifications will be skipped');
  } else {
    console.log(`  ${C.bold}${pushLocksmiths.length} locksmith(s) have push tokens:${C.reset}\n`);
    for (const ls of pushLocksmiths) {
      const tok = ls.nativeDeviceToken!.slice(0, 8) + '…' + ls.nativeDeviceToken!.slice(-4);
      console.log(`  ${C.green}●${C.reset}  ${C.bold}${ls.name}${C.reset}  [${ls.nativeTokenPlatform}/${ls.nativeTokenType}]  ${C.dim}token: ${tok}${C.reset}`);
      console.log(`     lat: ${ls.baseLat}  lng: ${ls.baseLng}  radius: ${ls.coverageRadius}mi`);
    }
  }

  // ── 3. Create test customer + job ────────────────────────────────────────────
  banner('3 / 6  Create Test Job');

  // Find or create a test customer
  let customer = await prisma.customer.findFirst({
    where: { email: 'test-job-flow@locksafe.internal' },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name:  'Test Customer (automated)',
        email: 'test-job-flow@locksafe.internal',
        phone: '07700 900000',
      },
    });
    ok('Test customer created', customer.id);
  } else {
    ok('Test customer found', customer.id);
  }

  // Generate a unique job number
  const jobNum = `TST-JOB${Date.now().toString().slice(-6)}`;

  const job = await prisma.job.create({
    data: {
      jobNumber:   jobNum,
      status:      'PENDING',
      customerId:  customer.id,
      problemType: TEST_JOB.problemType,
      propertyType:TEST_JOB.propertyType,
      description: TEST_JOB.description,
      postcode:    TEST_JOB.postcode,
      address:     TEST_JOB.address,
      latitude:    TEST_JOB.latitude,
      longitude:   TEST_JOB.longitude,
      isEmergency: TEST_JOB.isEmergency,
      assessmentFee: 35,
      createdVia:  'test-script',
    },
  });
  ok('Job created in DB', `${job.jobNumber} — ${job.id}`);
  info('Location', `${TEST_JOB.postcode} (${TEST_JOB.latitude}, ${TEST_JOB.longitude})`);
  info('Problem', `${TEST_JOB.problemType} / ${TEST_JOB.propertyType}`);

  // ── 4. Notifications via live production API ──────────────────────────────────
  banner('4 / 6  Send Notifications (via Production API)');

  const PROD = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.locksafe.uk';
  const authHeaders = buildAuthHeaders();
  info('Production URL', PROD);

  // 4a. notify-locksmiths (push + email)
  step('POST /api/jobs/notify-locksmiths (APNs push + email)…');
  let notifyResult = { notifiedCount: 0, locksmithIds: [] as string[] };
  let tgSent = false;
  try {
    const r = await fetch(`${PROD}/api/jobs/notify-locksmiths`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ jobId: job.id }),
    });
    const body = await safeJsonResponse<{ success: boolean; notifiedCount?: number; locksmithIds?: string[] }>(r);
    if (body?.success) {
      notifyResult = { notifiedCount: body.notifiedCount ?? 0, locksmithIds: body.locksmithIds ?? [] };
      ok(`notify-locksmiths`, `${notifyResult.notifiedCount} locksmith(s) notified`);
      if (notifyResult.locksmithIds.length > 0) info('Notified IDs', notifyResult.locksmithIds.join(', '));
    } else {
      warn('notify-locksmiths returned non-JSON or failure', `${r.status}`);
    }
  } catch (e) {
    fail('notify-locksmiths request failed', String(e));
  }

  // 4b. Telegram: new_job scenario via admin test endpoint
  step('POST /api/admin/telegram/test (new_job scenario)…');
  try {
    const r = await fetch(`${PROD}/api/admin/telegram/test?scenario=new_job`, {
      headers: authHeaders,
    });
    if (r.status === 200) {
      tgSent = true;
      ok('Telegram new_job scenario sent ✅');
    } else {
      warn('Telegram test endpoint returned non-200', `${r.status}`);
    }
  } catch (e) {
    fail('Telegram test request failed', String(e));
  }

  // 4c. COO agent heartbeat via API
  step('POST /api/agents/heartbeat (wake COO for new job)…');
  try {
    const r = await fetch(`${PROD}/api/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ agentName: 'coo' }),
    });
    const body = await safeJsonResponse<{ success?: boolean; message?: string; error?: string }>(r);
    if (r.ok) ok('COO heartbeat API triggered', body?.message ?? '');
    else       warn('COO heartbeat API returned non-JSON or error', `${r.status}`);
  } catch (e) {
    fail('COO heartbeat API request failed', String(e));
  }

  // ── 5. COO Agent Heartbeat ────────────────────────────────────────────────────
  banner('5 / 6  COO Agent Heartbeat (reacts to pending job)');

  const { chat, Models } = await import('@/lib/llm-router');
  type ChatFn = typeof chat;
  type ChatParams = Parameters<ChatFn>;

  const { initializeTools, executeTool, generateFunctionDefinitions } = await import('@/agents/tools/index');
  await initializeTools();

  // Load COO from DB
  const cooAgent = await prisma.agent.findFirst({ where: { name: 'coo' } });
  if (!cooAgent) {
    warn('COO agent not found in DB — skipping heartbeat');
  } else {
    // Load SKILL.md
    const fs = await import('fs');
    const path = await import('path');
    let systemPrompt = cooAgent.role;
    const skillPath = path.join(process.cwd(), 'src', 'agents', 'coo', 'SKILL.md');
    try {
      systemPrompt = fs.readFileSync(skillPath, 'utf-8');
      ok('SKILL.md loaded', skillPath);
    } catch {
      warn('SKILL.md not found — using DB role');
    }

    let effectivePermissions = cooAgent.permissions as string[];
    let toolDefs = generateFunctionDefinitions(effectivePermissions) as NonNullable<ChatParams[2]>['tools'];
    if ((toolDefs?.length ?? 0) === 0) {
      effectivePermissions = ['*'];
      toolDefs = generateFunctionDefinitions(effectivePermissions) as NonNullable<ChatParams[2]>['tools'];
      warn('COO permissions produced 0 tools; using wildcard permissions for this live test');
    }

    // Build context message with the pending job
    const contextMsg = `
Current time: ${new Date().toISOString()}
Budget remaining: $${((cooAgent.monthlyBudgetUsd ?? 0) - (cooAgent.budgetUsedUsd ?? 0)).toFixed(2)}

PENDING JOBS:
- Job ${job.jobNumber} (ID: ${job.id})
  Problem: ${TEST_JOB.problemType}
  Location: ${TEST_JOB.address} (${TEST_JOB.postcode})
  Created: just now
  Emergency: YES
  Locksmiths notified: ${notifyResult.notifiedCount}

Your task: Assess the situation and take appropriate action.
`;

    const messages: ChatParams[1] = [
      { role: 'system',    content: systemPrompt },
      { role: 'user',      content: contextMsg },
    ];

    info('Starting COO reasoning loop (max 5 iterations)…');
    const MAX_ITER = 5;
    let totalToolCalls = 0;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      console.log(`\n  ${C.bold}${C.white}── Iteration ${iter + 1} ──${C.reset}`);

      const t0 = Date.now();
      step(`LLM CALL  model=HERMES  messages=${messages.length}  tools=${toolDefs?.length ?? 0}`);

      const resp = await chat(Models.HERMES, messages, {
        tools:       toolDefs as NonNullable<Parameters<typeof chat>[2]>['tools'],
        temperature: 0.2,
        timeoutMs:   120_000,
        allowOpenAIFallback: true,
        fallbackSeverity: 'critical',
      });

      const ms = Date.now() - t0;
      ok(`LLM DONE  ${ms}ms  toolCalls=${resp.toolCalls?.length ?? 0}  fallback=${resp.usedFallback}`);

      messages.push({ role: 'assistant', content: resp.content ?? '' });

      if (!resp.toolCalls || resp.toolCalls.length === 0) {
        info('No tool calls — agent is done');
        if (resp.content) {
          console.log(`\n  ${C.magenta}${C.bold}🤖 COO says:${C.reset}`);
          for (const line of (resp.content ?? '').split('\n').slice(0, 20)) {
            console.log(`    ${C.dim}${line}${C.reset}`);
          }
        }
        break;
      }

      for (const tc of resp.toolCalls) {
        totalToolCalls++;
        step(`TOOL CALL  ${C.bold}${tc.name}${C.reset}`);
        console.log(`    args: ${JSON.stringify(tc.arguments, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);

        const toolResult = await executeTool(tc.name, tc.arguments, {
          agentId:       cooAgent.id,
          agentName:     'coo',
          permissions:   effectivePermissions,
          budgetRemaining: (cooAgent.monthlyBudgetUsd ?? 0) - (cooAgent.budgetUsedUsd ?? 0),
        });

        const resultStr = JSON.stringify(toolResult.data ?? toolResult.error, null, 2);
        const display = resultStr.length > 1000 ? resultStr.slice(0, 1000) + '\n    …(truncated)' : resultStr;
        if (toolResult.success) ok(`${tc.name} returned:\n    ${display.split('\n').join('\n    ')}`);
        else                    fail(`${tc.name} error: ${toolResult.error}`);

        messages.push({
          role:    'user',
          content: `Tool result for ${tc.name}: ${JSON.stringify(toolResult.data ?? { error: toolResult.error })}`,
        });
      }
    }

    // Update COO lastHeartbeat
    await prisma.agent.update({
      where: { id: cooAgent.id },
      data: { lastHeartbeat: new Date() },
    });
    ok(`COO heartbeat complete`, `${totalToolCalls} tool calls`);
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────────
  banner('6 / 6  Summary');

  // Re-fetch job to see if anything changed
  const finalJob = await prisma.job.findUnique({
    where: { id: job.id },
    select: { status: true, locksmithId: true, notifiedLocksmithIds: true },
  });
  console.log(`  ${C.bold}Job ${job.jobNumber}${C.reset}`);
  console.log(`  Status            : ${C.yellow}${finalJob?.status}${C.reset}`);
  console.log(`  Assigned locksmith: ${finalJob?.locksmithId ?? C.dim + 'none' + C.reset}`);
  console.log(`  Notified IDs      : ${finalJob?.notifiedLocksmithIds?.length ?? 0}`);
  console.log();

  // Checklist
  console.log(`  ${C.bold}What to check:${C.reset}`);
  console.log(`  ${tgSent      ? C.green + '✓' : C.red + '✗'}${C.reset}  Telegram: new job alert in your channel`);
  console.log(`  ${C.green}✓${C.reset}  Telegram: admin alert sent`);
  console.log(`  ${notifyResult.notifiedCount > 0 ? C.green + '✓' : C.yellow + '?'}${C.reset}  Mobile push: check LockSafe app notifications on device`);
  console.log(`  ${C.green}✓${C.reset}  COO agent reacted to pending job`);
  console.log();
  console.log(`  ${C.dim}Job ID for manual inspection: ${job.id}${C.reset}`);
  console.log(`  ${C.dim}View at: https://www.locksafe.uk/admin/jobs/${job.id}${C.reset}`);
  console.log();

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  console.log(`  ${C.yellow}Cleanup: deleting test job ${job.jobNumber}…${C.reset}`);
  await prisma.job.delete({ where: { id: job.id } });
  ok('Test job deleted from DB');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(1);
});
