/**
 * Scraper status check — is the background lead scraper actually running?
 *
 * Read-only. Prints the latest ScraperProgress cycle (when it last ran, how
 * far through the UK city list it is, leads found/saved) plus how many
 * LocksmithLead rows landed in the last 2h / 24h. If `lastRunAt` is within
 * ~2 hours, the Vercel cron (/api/cron/scraper, schedule 0 *​/2 * * *) is alive.
 *
 * Usage:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json scripts/check-scraper-status.ts
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

function ago(date: Date | null | undefined): string {
  if (!date) return "never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function main() {
  console.log("\n=== LockSafe Scraper Status ===\n");

  // ── Latest scraper-progress cycles ──────────────────────────────────────
  try {
    const cycles = await prisma.scraperProgress.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (!cycles.length) {
      console.log("ScraperProgress: NO records found — the cron has never completed a run.\n");
    } else {
      const latest = cycles[0];
      const lastRun = latest.lastRunAt ?? latest.updatedAt ?? latest.createdAt;
      const fresh = lastRun && Date.now() - new Date(lastRun).getTime() < 2.5 * 60 * 60 * 1000;

      console.log(`Latest cycle:`);
      console.log(`  started:        ${new Date(latest.createdAt).toISOString()} (${ago(latest.createdAt)})`);
      console.log(`  last run:       ${lastRun ? new Date(lastRun).toISOString() : "—"} (${ago(lastRun)})`);
      console.log(`  cities done:    ${(latest.completedCities?.length ?? 0)}`);
      console.log(`  leads found:    ${latest.totalLeadsFound ?? 0}`);
      console.log(`  leads saved:    ${latest.totalLeadsSaved ?? 0}`);
      console.log(`  cycle complete: ${latest.isComplete ? "yes" : "no"}`);
      console.log(`\n  >> ${fresh ? "✅ ALIVE — ran within the last 2.5h" : "⚠️  STALE — no run in the last 2.5h (cron may be off or erroring)"}\n`);

      if (cycles.length > 1) {
        console.log("  Recent cycles:");
        for (const c of cycles) {
          console.log(
            `    ${new Date(c.createdAt).toISOString().slice(0, 16)}  ` +
              `cities=${c.completedCities?.length ?? 0}  found=${c.totalLeadsFound ?? 0}  ` +
              `saved=${c.totalLeadsSaved ?? 0}  complete=${c.isComplete ? "Y" : "N"}`,
          );
        }
        console.log("");
      }
    }
  } catch (e) {
    console.log(`ScraperProgress query failed: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // ── Lead volume ─────────────────────────────────────────────────────────
  try {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since2h = new Date(now - 2 * 60 * 60 * 1000);

    const [total, last24h, last2h] = await Promise.all([
      prisma.locksmithLead.count(),
      prisma.locksmithLead.count({ where: { createdAt: { gte: since24h } } }),
      prisma.locksmithLead.count({ where: { createdAt: { gte: since2h } } }),
    ]);

    console.log("LocksmithLead volume:");
    console.log(`  total leads:        ${total}`);
    console.log(`  added last 24h:     ${last24h}`);
    console.log(`  added last 2h:      ${last2h}`);
    console.log(`\n  >> ${last24h > 0 ? "✅ leads are flowing in" : "⚠️  no new leads in 24h"}\n`);
  } catch (e) {
    console.log(`LocksmithLead query failed: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // ── Lead status breakdown (best-effort) ─────────────────────────────────
  try {
    const byStatus = await prisma.locksmithLead.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    if (byStatus?.length) {
      console.log("Leads by status:");
      for (const row of byStatus) {
        console.log(`  ${String(row.status ?? "—").padEnd(14)} ${row._count._all}`);
      }
      console.log("");
    }
  } catch {
    // status field/groupBy unsupported — skip silently
  }
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
