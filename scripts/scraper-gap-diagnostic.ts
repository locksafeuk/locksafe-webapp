/**
 * Scraper gap diagnostic — READ ONLY.
 *
 * Quantifies WHERE the lead funnel is losing volume so we can calibrate the
 * scraper. Prints:
 *   - Lead volume + new-lead rate over time (is inflow decaying? = saturation)
 *   - Status breakdown (new / contacted / replied / onboarded / not_interested)
 *   - Email gate impact: how many NEW leads have a phone but NO email
 *     (these are currently un-contactable by the email-only outreach path)
 *   - Coverage queue health: covered cities vs uncovered UK cities
 *
 * Usage:
 *   npm run scraper:diagnose
 *   (or) node_modules/.bin/ts-node -r tsconfig-paths/register \
 *          --project tsconfig.scripts.json scripts/scraper-gap-diagnostic.ts
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

function pct(n: number, d: number): string {
  if (!d) return "0%";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

async function main() {
  console.log("\n=== LockSafe Scraper Gap Diagnostic (read-only) ===\n");

  const now = Date.now();
  const d = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);

  // ── 1. Lead volume + inflow trend ───────────────────────────────────────
  const [total, n1, n7, n14, n30, n60] = await Promise.all([
    prisma.locksmithLead.count(),
    prisma.locksmithLead.count({ where: { createdAt: { gte: d(1) } } }),
    prisma.locksmithLead.count({ where: { createdAt: { gte: d(7) } } }),
    prisma.locksmithLead.count({ where: { createdAt: { gte: d(14) } } }),
    prisma.locksmithLead.count({ where: { createdAt: { gte: d(30) } } }),
    prisma.locksmithLead.count({ where: { createdAt: { gte: d(60) } } }),
  ]);
  console.log("Lead inflow (net-new leads captured):");
  console.log(`  total leads ever:   ${total}`);
  console.log(`  last 24h:           ${n1}`);
  console.log(`  last 7d:            ${n7}`);
  console.log(`  prev 7d (8-14d):    ${n14 - n7}`);
  console.log(`  last 30d:           ${n30}`);
  console.log(`  prev 30d (31-60d):  ${n60 - n30}`);
  const decaying = n7 < (n14 - n7);
  console.log(`  >> ${decaying ? "⚠️  inflow is DECAYING (saturation/self-starvation likely)" : "inflow steady/up"}\n`);

  // ── 2. Status breakdown ─────────────────────────────────────────────────
  const statuses = ["new", "contacted", "replied", "onboarded", "not_interested"];
  const counts = await Promise.all(
    statuses.map((s) => prisma.locksmithLead.count({ where: { status: s } })),
  );
  console.log("Status breakdown:");
  statuses.forEach((s, i) => console.log(`  ${s.padEnd(15)} ${counts[i]}`));
  console.log("");

  // ── 3. EMAIL GATE impact (the suspected main throttle) ──────────────────
  const [newTotal, newWithEmail, newWithPhone, newPhoneNoEmail, newNoContact, withWebsiteNoEmail] =
    await Promise.all([
      prisma.locksmithLead.count({ where: { status: "new" } }),
      prisma.locksmithLead.count({ where: { status: "new", email: { not: null } } }),
      prisma.locksmithLead.count({ where: { status: "new", phone: { not: null } } }),
      prisma.locksmithLead.count({ where: { status: "new", email: null, phone: { not: null } } }),
      prisma.locksmithLead.count({ where: { status: "new", email: null, phone: null } }),
      prisma.locksmithLead.count({ where: { email: null, website: { not: null } } }),
    ]);
  console.log("Email gate impact (status = new):");
  console.log(`  new leads:                       ${newTotal}`);
  console.log(`  ...with email (contactable):     ${newWithEmail}  (${pct(newWithEmail, newTotal)})`);
  console.log(`  ...with phone:                   ${newWithPhone}`);
  console.log(`  ...phone but NO email (stuck):   ${newPhoneNoEmail}  (${pct(newPhoneNoEmail, newTotal)})`);
  console.log(`  ...no email AND no phone:        ${newNoContact}`);
  console.log(`  leads w/ website but no email:   ${withWebsiteNoEmail}  (enrichment backlog)`);
  console.log(`  >> ${newPhoneNoEmail > newWithEmail ? "⚠️  more phone-only leads are STUCK than are contactable — email gate is the main throttle" : "email coverage is reasonable"}\n`);

  // ── 4. Coverage queue health ────────────────────────────────────────────
  try {
    const covered = await prisma.locksmithCoverage.findMany({
      where: { isPaused: false, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    });
    const recruit = await prisma.googleAdsOpportunity.count({
      where: { kind: "RECRUIT", locksmithCount: 0 },
    });
    console.log("Coverage queue:");
    console.log(`  distinct covered cities:  ${covered.length}`);
    console.log(`  RECRUIT target cities:    ${recruit}`);
    console.log("  (gap-only mode scrapes only uncovered + recruit cities; a shrinking gap queue starves inflow)\n");
  } catch (e) {
    console.log(`Coverage query skipped: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // ── 5. Scraper cycle freshness ──────────────────────────────────────────
  try {
    const latest = await prisma.scraperProgress.findFirst({ orderBy: { createdAt: "desc" } });
    if (latest) {
      const last = latest.lastRunAt ?? latest.updatedAt ?? latest.createdAt;
      const mins = Math.floor((now - new Date(last).getTime()) / 60000);
      console.log("Latest scraper cycle:");
      console.log(`  last run:       ${new Date(last).toISOString()} (${mins} min ago)`);
      console.log(`  cities done:    ${(latest.completedCities?.length ?? 0)}`);
      console.log(`  leads found:    ${latest.totalLeadsFound ?? 0}`);
      console.log(`  leads saved:    ${latest.totalLeadsSaved ?? 0}`);
      console.log(`  complete:       ${latest.isComplete ? "yes" : "no"}`);
      console.log(`  >> ${mins < 150 ? "✅ cron is alive" : "⚠️  no run in 2.5h — cron may be off"}\n`);
    }
  } catch (e) {
    console.log(`ScraperProgress query skipped: ${e instanceof Error ? e.message : String(e)}\n`);
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
