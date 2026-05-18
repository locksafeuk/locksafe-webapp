/**
 * Agent OS soak-report
 *
 * Compares two equal-length time windows of agent activity to validate the
 * Phase 1–6 hardening (heartbeat tiering, dedupe windows, telegram rate-limit,
 * concurrency cap, local-LLM-first policy). Reads from the AgentExecution
 * collection, which is the immutable per-action audit trail.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/agents-soak-report.ts
 *   # windows are by default `--hours 24` (compare last 24h vs the 24h before)
 *   npx tsx … scripts/agents-soak-report.ts --hours 168   # 7d vs prior 7d
 *
 * Cost model:
 *   - Hermes/Ollama executions are treated as $0 if `model` starts with
 *     "hermes" / "llama" / "ollama" (case-insensitive). Otherwise the stored
 *     `costUsd` is summed as-is.
 *
 * Telegram volume:
 *   - Counted as the number of AgentExecution rows whose `actionName` matches
 *     /telegram|sendAdminAlert/i.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(): { hours: number } {
  const args = process.argv.slice(2);
  const i = args.indexOf("--hours");
  if (i >= 0 && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (Number.isFinite(n) && n > 0) return { hours: n };
  }
  return { hours: 24 };
}

interface Bucket {
  rows: number;
  totalTokens: number;
  totalCostUsd: number;
  byAgent: Map<string, { rows: number; tokens: number; cost: number; failures: number }>;
  byModel: Map<string, { rows: number; tokens: number; cost: number }>;
  byAction: Map<string, number>;
  telegramSends: number;
  failures: number;
  durationsMs: number[];
}

function emptyBucket(): Bucket {
  return {
    rows: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    byAgent: new Map(),
    byModel: new Map(),
    byAction: new Map(),
    telegramSends: 0,
    failures: 0,
    durationsMs: [],
  };
}

const TELEGRAM_PATTERN = /telegram|sendAdminAlert/i;
const LOCAL_MODEL_PATTERN = /^(hermes|llama|ollama|qwen|mistral)/i;

function modelKey(model: string | null | undefined): string {
  if (!model) return "(unspecified)";
  return LOCAL_MODEL_PATTERN.test(model) ? `local:${model}` : `remote:${model}`;
}

function costFor(model: string | null | undefined, stored: number | null | undefined): number {
  const s = typeof stored === "number" ? stored : 0;
  // Locally-served models cost $0 regardless of any incidentally stored value.
  if (model && LOCAL_MODEL_PATTERN.test(model)) return 0;
  return s;
}

async function collect(from: Date, to: Date): Promise<Bucket> {
  const b = emptyBucket();

  // Resolve agent IDs → names once for readable grouping.
  const agents = await prisma.agent.findMany({ select: { id: true, name: true } });
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  const rows = await prisma.agentExecution.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: {
      agentId: true,
      actionType: true,
      actionName: true,
      status: true,
      tokensUsed: true,
      costUsd: true,
      model: true,
      durationMs: true,
    },
  });

  for (const r of rows) {
    b.rows += 1;
    b.totalTokens += r.tokensUsed ?? 0;
    const c = costFor(r.model, r.costUsd);
    b.totalCostUsd += c;

    const agentName = agentNameById.get(r.agentId) ?? `unknown:${r.agentId}`;
    const a = b.byAgent.get(agentName) ?? { rows: 0, tokens: 0, cost: 0, failures: 0 };
    a.rows += 1;
    a.tokens += r.tokensUsed ?? 0;
    a.cost += c;
    if (r.status === "failed") a.failures += 1;
    b.byAgent.set(agentName, a);

    const mk = modelKey(r.model);
    const m = b.byModel.get(mk) ?? { rows: 0, tokens: 0, cost: 0 };
    m.rows += 1;
    m.tokens += r.tokensUsed ?? 0;
    m.cost += c;
    b.byModel.set(mk, m);

    const actKey = `${r.actionType}:${r.actionName}`;
    b.byAction.set(actKey, (b.byAction.get(actKey) ?? 0) + 1);

    if (TELEGRAM_PATTERN.test(r.actionName)) b.telegramSends += 1;
    if (r.status === "failed") b.failures += 1;
    if (typeof r.durationMs === "number") b.durationsMs.push(r.durationMs);
  }

  return b;
}

function pct(prev: number, curr: number): string {
  if (prev === 0 && curr === 0) return " 0.0%";
  if (prev === 0) return "  +∞%";
  const d = ((curr - prev) / prev) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

function p95(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(4)}`;
}

function printReport(prev: Bucket, curr: Bucket, hours: number, now: Date) {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(72));
  lines.push(`Agent OS — soak report (window: ${hours}h)`);
  lines.push(`Now:    ${now.toISOString()}`);
  lines.push(`Curr:   [now-${hours}h .. now]`);
  lines.push(`Prev:   [now-${hours * 2}h .. now-${hours}h]`);
  lines.push("=".repeat(72));

  lines.push("\nHeadline");
  lines.push("--------");
  lines.push(`Executions:        prev ${prev.rows}  →  curr ${curr.rows}  (${pct(prev.rows, curr.rows)})`);
  lines.push(`Failures:          prev ${prev.failures}  →  curr ${curr.failures}  (${pct(prev.failures, curr.failures)})`);
  lines.push(`Tokens:            prev ${prev.totalTokens}  →  curr ${curr.totalTokens}  (${pct(prev.totalTokens, curr.totalTokens)})`);
  lines.push(`Cost:              prev ${fmtMoney(prev.totalCostUsd)}  →  curr ${fmtMoney(curr.totalCostUsd)}  (${pct(prev.totalCostUsd, curr.totalCostUsd)})`);
  lines.push(`Telegram alerts:   prev ${prev.telegramSends}  →  curr ${curr.telegramSends}  (${pct(prev.telegramSends, curr.telegramSends)})`);
  lines.push(`p95 duration ms:   prev ${p95(prev.durationsMs)}  →  curr ${p95(curr.durationsMs)}`);

  lines.push("\nPer-agent (curr window)");
  lines.push("-----------------------");
  const agents = new Set<string>([...prev.byAgent.keys(), ...curr.byAgent.keys()]);
  const aRows = [...agents].map((name) => {
    const p = prev.byAgent.get(name) ?? { rows: 0, tokens: 0, cost: 0, failures: 0 };
    const c = curr.byAgent.get(name) ?? { rows: 0, tokens: 0, cost: 0, failures: 0 };
    return { name, p, c };
  });
  aRows.sort((x, y) => y.c.rows - x.c.rows);
  lines.push(`  ${"agent".padEnd(20)} ${"rows".padStart(8)} ${"Δ".padStart(8)} ${"tokens".padStart(10)} ${"cost".padStart(10)} ${"fails".padStart(7)}`);
  for (const r of aRows) {
    lines.push(
      `  ${r.name.padEnd(20)} ${String(r.c.rows).padStart(8)} ${pct(r.p.rows, r.c.rows).padStart(8)} ${String(r.c.tokens).padStart(10)} ${fmtMoney(r.c.cost).padStart(10)} ${String(r.c.failures).padStart(7)}`,
    );
  }

  lines.push("\nModel mix (curr window)");
  lines.push("-----------------------");
  const mRows = [...curr.byModel.entries()].sort((a, b) => b[1].rows - a[1].rows);
  for (const [m, v] of mRows) {
    const share = curr.rows === 0 ? 0 : (v.rows / curr.rows) * 100;
    lines.push(`  ${m.padEnd(30)} rows=${String(v.rows).padStart(6)} (${share.toFixed(1)}%)  tokens=${v.tokens}  cost=${fmtMoney(v.cost)}`);
  }
  // Local-vs-remote summary for the local-first policy validation:
  const local = mRows.filter(([k]) => k.startsWith("local:")).reduce((a, [, v]) => a + v.rows, 0);
  const remote = mRows.filter(([k]) => k.startsWith("remote:")).reduce((a, [, v]) => a + v.rows, 0);
  const total = local + remote;
  lines.push(
    `  → local share: ${total === 0 ? "n/a" : `${((local / total) * 100).toFixed(1)}%`}  remote share: ${total === 0 ? "n/a" : `${((remote / total) * 100).toFixed(1)}%`}`,
  );

  lines.push("\nTop actions (curr window)");
  lines.push("-------------------------");
  const actRows = [...curr.byAction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [k, n] of actRows) lines.push(`  ${String(n).padStart(6)}  ${k}`);

  lines.push("");
  console.log(lines.join("\n"));
}

async function main() {
  const { hours } = parseArgs();
  const now = new Date();
  const currFrom = new Date(now.getTime() - hours * 3600 * 1000);
  const prevFrom = new Date(now.getTime() - 2 * hours * 3600 * 1000);

  const [prev, curr] = await Promise.all([collect(prevFrom, currFrom), collect(currFrom, now)]);

  printReport(prev, curr, hours, now);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
