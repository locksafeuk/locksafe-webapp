/**
 * Synthetic test: confirm §41 per-ad-group enforcement rejects drafts
 * that ship with empty ad groups (the original #32 bug — draft generator
 * left 3/5 ad groups empty).
 *
 * Run with: npx tsx scripts/preflight-synthetic-test.ts
 *
 * Exits 0 if enforcement caught the bug. Non-zero otherwise.
 */

import { enforceDraftGuardrails } from "../src/lib/google-ads-draft-enforcement";

const fourteenHeadlines = [
  "Bristol Locksmith 24/7", "Locked Out? Get a Locksmith",
  "Emergency Lock Repair", "Expert Locksmiths Bristol",
  "Lockout? Call Bristol Pros", "Trusted Bristol Locksmith Team",
  "Emergency Bristol Locksmith", "Same-Day Lock Repair",
  "Reliable Locksmith Bristol", "Bristol Lockout Help",
  "Local Bristol Locksmith", "Locksmith Service Bristol",
  "Bristol Lock & Key", "Bristol Emergency Locksmith",
];
const fourDescriptions = [
  "Fast, vetted Bristol locksmiths — average 25 min arrival. Card payments accepted.",
  "Emergency lockouts, lock changes, and burglary repairs across BS1–BS16. 5★ rated.",
  "DBS-checked engineers serving Bristol 24/7. Upfront, transparent pricing.",
  "Local Bristol locksmiths covering BS1 to BS48 with full guarantee on every job.",
];

// Reasonable per-ad-group keywords (10 each = playbook floor)
const goodKeywords = [
  { text: "bristol locksmith",      matchType: "PHRASE" },
  { text: "emergency locksmith bristol", matchType: "PHRASE" },
  { text: "locksmith near me bristol", matchType: "PHRASE" },
  { text: "24 hour locksmith bristol", matchType: "PHRASE" },
  { text: "locksmith bs1",           matchType: "PHRASE" },
  { text: "locksmith bristol bs1",   matchType: "PHRASE" },
  { text: "locksmith city centre bristol", matchType: "PHRASE" },
  { text: "lock change bristol",     matchType: "PHRASE" },
  { text: "locked out bristol",      matchType: "PHRASE" },
  { text: "emergency locksmith bs1", matchType: "PHRASE" },
];

interface AdGroup {
  name:        string;
  keywords:    Array<{ text: string; matchType: string }>;
  headlines?:  string[];
  descriptions?: string[];
}

// THE BAD DRAFT — 5 ad groups, only 2 have keywords. This mirrors the #32 bug.
const badAdGroups: AdGroup[] = [
  { name: "Emergency",        keywords: goodKeywords },
  { name: "Lockout",          keywords: goodKeywords },
  { name: "Lock Change",      keywords: [] },        // EMPTY
  { name: "Burglary Repair",  keywords: [] },        // EMPTY
  { name: "Trust & USP",      keywords: [] },        // EMPTY
];

// Wrap 1968 negatives to satisfy the negatives floor.
const stubNegatives = Array.from({ length: 200 }, (_, i) => `neg_${i}`);

// 100 keywords total so the draft-level floor passes — we want the
// per-ad-group enforcement to be what fires.
const flatKeywords = Array.from({ length: 100 }, (_, i) => ({
  text: `bristol locksmith query ${i}`,
  matchType: "PHRASE",
}));

const synthetic = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accountId: "synthetic-account" as any,
  name:      "Synthetic — empty ad groups",
  dailyBudget: 60,
  biddingStrategy: "MAXIMIZE_CLICKS",
  finalUrl: "https://www.locksafe.uk/locksmith-in/bs1",
  headlines: fourteenHeadlines,
  descriptions: fourDescriptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keywords:        flatKeywords as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  negativeKeywords: stubNegatives as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adGroups:        badAdGroups as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assets: [{ type: "CALL", phoneNumber: "+442045771989" }] as any,
  geoTargets: ["1006808"], // Bristol geo ID
};

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = enforceDraftGuardrails(synthetic as any);

  if (result.ok) {
    console.error("❌ FAIL: enforcer accepted a draft with 3/5 empty ad groups.");
    console.error("Returned:", JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const adGroupKwViolations = result.violations.filter(
    (v) => /ad group/i.test(v.field) || /per ad group/i.test(v.expected ?? "") || /adGroup/i.test(v.field),
  );

  if (adGroupKwViolations.length === 0) {
    console.error("❌ FAIL: enforcer rejected the draft, but NOT because of empty ad groups:");
    console.error(JSON.stringify(result.violations, null, 2));
    process.exit(2);
  }

  console.log("✅ PASS: enforcer caught the empty-ad-group bug.");
  console.log(`Violations (${adGroupKwViolations.length} ad-group, ${result.violations.length} total):`);
  for (const v of adGroupKwViolations) {
    console.log(`  - ${v.field}: ${v.actual} (expected ${v.expected})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Test threw:", err);
  process.exit(99);
});
