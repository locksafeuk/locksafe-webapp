/**
 * Launch Discovery Campaigns — opening-batch runner.
 *
 * Run with (from project root):
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project scripts/tsconfig.scripts.json \
 *     scripts/launch-discovery-campaigns.ts          # dry-run
 *
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project scripts/tsconfig.scripts.json \
 *     scripts/launch-discovery-campaigns.ts --live   # actually write
 *
 * Reads from MongoDB (KeywordSeed bank, GoogleAdsAccount) and writes
 * GoogleAdsCampaignDraft rows with status PENDING_APPROVAL — a human
 * still clicks Publish in the admin UI.
 */

import * as path from "path";
// Load .env BEFORE anything else so the phone number, DB URL, etc. are
// available to imported modules.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { generateDiscoveryDrafts } from "../src/lib/discovery-campaign-orchestrator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const LIVE = process.argv.includes("--live");

// ── Helpers ────────────────────────────────────────────────────────────────

interface Col { label: string; value: string; width: number }

function fmtRow(cols: Col[]): string {
  return cols.map((c) => c.value.padEnd(c.width)).join(" │ ");
}

function header(cols: Col[]): string {
  const top = cols.map((c) => c.label.padEnd(c.width)).join(" │ ");
  const sep = cols.map((c) => "─".repeat(c.width)).join("─┼─");
  return `${top}\n${sep}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log(`▶ Discovery Campaign Launcher — ${LIVE ? "LIVE WRITE" : "DRY-RUN"}`);
  console.log("");

  const account = await prisma.googleAdsAccount.findFirst({
    where:   { isActive: true },
    select:  { id: true, customerId: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    console.error("✗ No active GoogleAdsAccount found.");
    console.error("  Connect your Google Ads account at /admin/integrations first.");
    process.exit(1);
  }

  console.log(`  Account: ${account.name} (customerId=${account.customerId}, id=${account.id})`);

  // Phone number resolution order:
  //   1. LOCKSAFE_WEBSITE_PHONE — explicit override for testing
  //   2. RETELL_PHONE_NUMBER    — the live Zadarma → Retell number, our
  //                                shared website phone (set in .env)
  //   3. fallback placeholder   — only seen when both vars are unset,
  //                                signals misconfiguration on the LIVE run
  const phone =
    process.env["LOCKSAFE_WEBSITE_PHONE"] ??
    process.env["RETELL_PHONE_NUMBER"]    ??
    "+441234567890";
  const phoneSource =
    process.env["LOCKSAFE_WEBSITE_PHONE"] ? "LOCKSAFE_WEBSITE_PHONE env"
    : process.env["RETELL_PHONE_NUMBER"]  ? "RETELL_PHONE_NUMBER env (.env)"
    : "DEFAULT PLACEHOLDER — misconfigured";
  console.log(`  Phone:   ${phone}  (source: ${phoneSource})`);
  if (phone === "+441234567890" && LIVE) {
    console.error("");
    console.error("✗ Refusing to LIVE-write campaigns with the placeholder phone.");
    console.error("  Set RETELL_PHONE_NUMBER in .env (it should already be there) ");
    console.error("  or pass LOCKSAFE_WEBSITE_PHONE in the environment.");
    process.exit(1);
  }
  console.log("");

  const seedCount = await prisma.keywordSeed.count({ where: { isActive: true } });
  console.log(`  Active KeywordSeeds in bank: ${seedCount}`);
  if (seedCount === 0) {
    console.error("");
    console.error("✗ No active KeywordSeed rows.");
    console.error("  Populate the seed bank first by running `seed-keyword-bank.command`.");
    process.exit(1);
  }
  console.log("");

  const result = await generateDiscoveryDrafts({
    accountId:        account.id,
    websitePhoneE164: phone,
    dryRun:           !LIVE,
    agentId:          "scripts:launch-discovery-campaigns",
  });

  console.log("Run summary:");
  console.log(`  • seeds considered : ${result.consideredSeeds}`);
  console.log(`  • saturated dropped: ${result.saturatedDropped}`);
  console.log(`  • quota filtered   : ${result.quotaFiltered}`);
  if (LIVE) {
    console.log(`  • drafts created   : ${result.draftsCreated}`);
    console.log(`  • drafts skipped   : ${result.draftsSkipped} (name already exists)`);
  } else {
    console.log(`  • drafts proposed  : ${result.drafts.length}`);
  }
  if (result.errors.length > 0) {
    console.log(`  • errors           : ${result.errors.length}`);
    for (const e of result.errors) console.log(`      - ${e}`);
  }
  console.log("");

  if (result.drafts.length > 0) {
    console.log(LIVE ? "Drafts created (status=PENDING_APPROVAL):" : "Proposed drafts:");
    console.log("");
    const cols = (d: typeof result.drafts[number]): Col[] => [
      { label: "Family",          value: d.family,                             width: 18 },
      { label: "District",        value: d.district ?? "—",                    width: 8  },
      { label: "Keyword",         value: d.keyword,                            width: 38 },
      { label: "Intent",          value: `${d.phoneLeadIntent}`,               width: 6  },
      { label: "£/day",           value: `${d.dailyBudget.toFixed(2)}`,        width: 6  },
      { label: "Name",            value: d.name,                               width: 32 },
      { label: "Note",            value: d.error ?? d.skippedReason ?? "",     width: 14 },
    ];
    if (result.drafts[0]) console.log(header(cols(result.drafts[0])));
    for (const d of result.drafts) console.log(fmtRow(cols(d)));
    console.log("");
  }

  if (!LIVE) {
    console.log("This was a DRY RUN. Nothing was written.");
    console.log("");
    console.log("If the proposed drafts look right, run `launch-discovery-campaigns-LIVE.command`.");
  } else {
    console.log(`✓ ${result.draftsCreated} draft(s) created.`);
    console.log("  Review them at /admin/integrations/google-ads/drafts");
    console.log("  Each draft sits in PENDING_APPROVAL — click Publish to push live.");
  }
}

main()
  .catch((err) => {
    console.error("");
    console.error("✗ Launch failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
