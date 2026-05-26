/**
 * Recompose Discovery Drafts — delete the auto-picked opening 6 and
 * replace them with a curated, diverse set.
 *
 * Why: the orchestrator's first pick gave 4 near-identical postcode_local
 * campaigns (same template, different districts) because intent scores
 * tied. For the opening real-money test we want WIDER coverage of the
 * Phase 2 surface — emergency + locked-out + 24-hour + MLA + fixed-price
 * + commercial — so we can see which families convert best.
 *
 * Safety:
 *   • Only touches drafts with aiPrompt = "discovery-orchestrator:phase2c"
 *     (NEVER touches anything hand-created in the admin UI)
 *   • Only deletes PENDING_APPROVAL / DRAFT — refuses to touch PUBLISHED
 *     / PUBLISHING / PAUSED (anything that might be spending money)
 *   • Dry-run is default; --live required to actually delete + create
 *   • New drafts are tagged aiPrompt = "discovery-orchestrator:phase2c-recompose-v1"
 *     so future runs of this script can find them too
 *
 * Run with (from project root):
 *   ./recompose-discovery-drafts.command
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { buildDiscoveryCampaignDraft } from "../src/lib/discovery-campaign-generator";
import { scorePhoneLeadIntent, detectPostcodeDistrict } from "../src/lib/phone-lead-intent-score";
import { ensureOrSkip, districtSlug }   from "../src/lib/district-landing/ensure-landing";
import { SITE_URL }                      from "../src/lib/config";
import type { SeedCategory } from "../src/agents/core/seed-bank";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const LIVE = process.argv.includes("--live");

// ── The curated opening lineup ─────────────────────────────────────────────

interface Candidate {
  keyword: string;
  family:  SeedCategory;
  note:    string;   // human reason for this pick
}

// Curated lineup v2 — May 2026. Changes from v1:
//   • dropped "mla locksmith leeds" — LockSafe does not hold MLA
//     accreditation; bidding on the phrase is misrepresentation
//   • replaced city-only keywords (leeds/manchester/bristol) with
//     outcode-grounded ones so each draft has a real district to
//     pair with /locksmith/{district} landing pages
//   • added "honest" + "no callout fee" variants which match real
//     verifiable claims
const CURATED: Candidate[] = [
  { keyword: "emergency locksmith RG1",       family: "postcode_local",  note: "Reading commuter belt — postcode + emergency = peak phone intent" },
  { keyword: "locked out KT13",               family: "postcode_local",  note: "Weybridge — high-income postcode, peak distress intent" },
  { keyword: "24 hour locksmith SK4",         family: "postcode_local",  note: "Stockport — North-West coverage test, 24h after-hours intent" },
  { keyword: "honest locksmith LS1",          family: "trust_signal",    note: "Leeds central — anti-shark trust cluster, real claim" },
  { keyword: "fixed price locksmith M1",      family: "trust_signal",    note: "Manchester central — process truth, verifiable claim" },
  { keyword: "commercial locksmith BS1",      family: "b2b_specialist",  note: "Bristol central — B2B, higher LTV, SW England" },
];

const RECOMPOSE_TAG = "discovery-orchestrator:phase2c-recompose-v2";
/**
 * Tags this script considers safe to delete. The widening v1 → v2 was
 * driven by:
 *   • the original `phase2c` lineup had MLA copy + /request URLs
 *   • the v1 recompose still bypassed ensureDistrictLandingPage so
 *     the /locksmith/{district} URLs were never set
 *   • v2 (this script) calls ensureOrSkip per district AND uses the
 *     correct landing-page URL
 *
 * The deletion filter matches any past orchestrator tag so stale
 * drafts from earlier runs get cleaned up regardless of version.
 */
const DELETABLE_AI_PROMPTS = [
  "discovery-orchestrator:phase2c",
  "discovery-orchestrator:phase2c-recompose-v1",
];

// ── Helpers ────────────────────────────────────────────────────────────────

interface Col { label: string; value: string; width: number }
const fmtRow = (cs: Col[]) => cs.map((c) => c.value.padEnd(c.width)).join(" │ ");
const header = (cs: Col[]) => {
  const top = cs.map((c) => c.label.padEnd(c.width)).join(" │ ");
  const sep = cs.map((c) => "─".repeat(c.width)).join("─┼─");
  return `${top}\n${sep}`;
};

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log(`▶ Recompose Discovery Drafts — ${LIVE ? "LIVE" : "DRY-RUN"}`);
  console.log("");

  const account = await prisma.googleAdsAccount.findFirst({
    where:   { isActive: true },
    select:  { id: true, customerId: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    console.error("✗ No active GoogleAdsAccount found.");
    process.exit(1);
  }
  console.log(`  Account: ${account.name} (customerId=${account.customerId})`);
  const phone = process.env["LOCKSAFE_WEBSITE_PHONE"]
    ?? process.env["RETELL_PHONE_NUMBER"]
    ?? "+441234567890";
  console.log(`  Phone:   ${phone}`);
  if (phone === "+441234567890" && LIVE) {
    console.error("✗ Refusing to LIVE-write with placeholder phone.");
    process.exit(1);
  }
  console.log("");

  // ── Step 1: find drafts created by the orchestrator (safe to delete) ────
  console.log("▶ Step 1 — Finding orchestrator-created drafts that are safe to delete");
  console.log(`  (touches aiPrompt in [${DELETABLE_AI_PROMPTS.map((s) => `"${s}"`).join(", ")}]`);
  console.log("   AND status in [DRAFT, PENDING_APPROVAL] — never touches");
  console.log("   PUBLISHED / PUBLISHING / PAUSED drafts)");
  console.log("");

  const existing = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      accountId: account.id,
      aiPrompt:  { in: DELETABLE_AI_PROMPTS },
      status:    { in: ["DRAFT", "PENDING_APPROVAL"] },
    },
    select: {
      id: true, name: true, status: true, dailyBudget: true, createdAt: true, aiPrompt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing.length === 0) {
    console.log("  No matching drafts to delete. Skipping deletion step.");
  } else {
    console.log(`  Found ${existing.length} draft(s) to delete:`);
    console.log("");
    const dCols = (d: typeof existing[number]): Col[] => [
      { label: "Status",       value: d.status,                       width: 18 },
      { label: "Name",         value: d.name,                         width: 32 },
      { label: "£/day",        value: d.dailyBudget.toFixed(2),       width: 6  },
      { label: "Tag",          value: (d.aiPrompt ?? "").replace("discovery-orchestrator:", ""), width: 22 },
      { label: "Created",      value: d.createdAt.toISOString().slice(0, 16), width: 16 },
    ];
    console.log(header(dCols(existing[0])));
    for (const d of existing) console.log(fmtRow(dCols(d)));
    console.log("");
  }

  // ── Step 2: preview the new curated set ─────────────────────────────────
  console.log("▶ Step 2 — Curated replacement set (6 drafts):");
  console.log("");

  // For the dry-run we compute the EXPECTED finalUrl assuming the
  // landing page WOULD generate — we do NOT call ensureOrSkip yet
  // (that hits Ollama + writes to DB; gated behind LIVE).
  const previews = CURATED.map((c) => {
    const intent = scorePhoneLeadIntent({ keyword: c.keyword, category: c.family });
    const district = detectPostcodeDistrict(c.keyword);
    const expectedFinalUrl = district
      ? `${SITE_URL}/locksmith-in/${districtSlug(district)}`
      : `${SITE_URL}/request`;
    const payload = buildDiscoveryCampaignDraft(
      { keyword: c.keyword, family: c.family, phoneLeadIntentScore: intent.score },
      {
        accountId:        account.id,
        finalUrl:         expectedFinalUrl,
        websitePhoneE164: phone,
        aiPrompt:         RECOMPOSE_TAG,
        status:           "PENDING_APPROVAL",
      },
    );
    return { candidate: c, intent, payload, district, expectedFinalUrl };
  });

  const cols = (p: typeof previews[number]): Col[] => [
    { label: "Family",       value: p.candidate.family,                          width: 18 },
    { label: "Keyword",      value: p.candidate.keyword,                         width: 36 },
    { label: "Intent",       value: `${p.intent.score}`,                         width: 6  },
    { label: "£/day",        value: p.payload.data.dailyBudget.toFixed(2),       width: 6  },
    { label: "Landing URL",  value: p.expectedFinalUrl.replace(SITE_URL, ""),    width: 24 },
    { label: "Name",         value: p.payload.data.name,                         width: 32 },
  ];
  if (previews[0]) console.log(header(cols(previews[0])));
  for (const p of previews) console.log(fmtRow(cols(p)));
  console.log("");

  console.log("Why each pick:");
  for (const p of previews) console.log(`  ${p.candidate.keyword} — ${p.candidate.note}`);
  console.log("");

  if (!LIVE) {
    console.log("This was a DRY RUN. Nothing was deleted or created.");
    console.log("");
    console.log("If the new lineup looks right, re-run with --live:");
    console.log("  ./recompose-discovery-drafts.command -- --live");
    return;
  }

  // ── Step 3: delete the old drafts ───────────────────────────────────────
  if (existing.length > 0) {
    console.log("▶ Step 3 — Deleting existing drafts");
    const deletions = await prisma.googleAdsCampaignDraft.deleteMany({
      where: {
        accountId: account.id,
        aiPrompt:  { in: DELETABLE_AI_PROMPTS },
        status:    { in: ["DRAFT", "PENDING_APPROVAL"] },
      },
    });
    console.log(`  ✓ Deleted ${deletions.count} draft(s)`);
    console.log("");
  }

  // ── Step 4: ensure landing pages + create drafts ───────────────────────
  console.log("▶ Step 4 — Ensuring landing pages + creating drafts");
  console.log("  (each district triggers an Ollama call on first generation —");
  console.log("   expect ~10-20s per district)");
  console.log("");
  let created = 0;
  let skipped = 0;
  let errored = 0;

  for (const p of previews) {
    let finalUrl = p.expectedFinalUrl;

    // For districted keywords, ensure the landing page exists first.
    // If coverage is missing or LLM generation fails, skip the draft
    // entirely rather than ship a campaign with no page.
    if (p.district) {
      console.log(`  ▸ Ensuring /locksmith-in/${districtSlug(p.district)} ...`);
      try {
        const ensured = await ensureOrSkip(p.district);
        if (!ensured.ok) {
          console.log(`    ⊘ ${p.candidate.keyword}: ${ensured.skipReason}`);
          skipped++;
          continue;
        }
        finalUrl = `${SITE_URL}/locksmith-in/${ensured.result!.slug}`;
        console.log(
          `    ✓ ${ensured.result!.action} (${ensured.result!.modelUsed ?? "?"})`
          + (ensured.result!.reason ? ` — ${ensured.result!.reason}` : ""),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    ✗ ${p.candidate.keyword}: landing-page generation failed — ${msg}`);
        errored++;
        continue;
      }
    }

    // Idempotency: skip if a draft with this name already exists
    const conflict = await prisma.googleAdsCampaignDraft.findFirst({
      where: { accountId: account.id, name: p.payload.data.name },
      select: { id: true },
    });
    if (conflict) {
      console.log(`  ⊘ Skipped (name exists): ${p.payload.data.name}`);
      skipped++;
      continue;
    }

    // Rebuild the payload with the resolved finalUrl (the dry-run
    // payload used the expected URL; the live URL may have a different
    // slug if ensureOrSkip normalised the district casing).
    const livePayload = buildDiscoveryCampaignDraft(
      {
        keyword:              p.candidate.keyword,
        family:               p.candidate.family,
        phoneLeadIntentScore: p.intent.score,
      },
      {
        accountId:        account.id,
        finalUrl,
        websitePhoneE164: phone,
        aiPrompt:         RECOMPOSE_TAG,
        status:           "PENDING_APPROVAL",
      },
    );

    await prisma.googleAdsCampaignDraft.create({ data: livePayload.data });
    console.log(`  ✓ Created draft: ${livePayload.data.name}  →  ${finalUrl}`);
    created++;
  }
  console.log("");
  console.log(`Done — created ${created}, skipped ${skipped}, errored ${errored}.`);
  console.log("");
  console.log("Review at /admin/integrations/google-ads/drafts");
  console.log("Each draft is PENDING_APPROVAL — Publish to push live.");
}

main()
  .catch((err) => {
    console.error("");
    console.error("✗ Recompose failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
