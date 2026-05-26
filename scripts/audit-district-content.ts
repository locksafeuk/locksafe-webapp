/**
 * Content audit for DistrictLandingPage rows.
 *
 * Scans every row for the canary checks from the launch playbook:
 *   1. No accreditation leakage  — copy must not mention MLA /
 *      Master Locksmiths / Which? / Checkatrade. We don't hold those
 *      accreditations yet, so this is a legal-honesty fix.
 *   2. Engineer never named     — featuredEngineerName must be null
 *      AND no content field may contain a "[Name] is your local
 *      engineer" / "Meet [Name]" / "I'm [Name]" / "your engineer X"
 *      pattern. LockSafe + anchor town are the only voice.
 *   3. Anchor town surfaced     — anchorTown set AND mentioned in
 *      heroHeadline or introParagraph.
 *   4. Nearby outcodes named    — coverageNarrative must mention at
 *      least 2 of the nearbyOutcodes verbatim.
 *   5. District-specific FAQs   — faqs has >= 3 entries and each
 *      question references the district code OR anchorTown.
 *   6. Sentence rhythm          — stdev of sentence-length-in-words
 *      across intro/coverage/whyChooseUs >= 3.0; warns if the LLM
 *      slipped into a monotone cadence.
 *
 * Each check prints [PASS]/[FAIL]/[WARN] with the offending snippet
 * (truncated) so the operator can decide whether to manually fix the
 * row or regenerate via Ollama.
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Configurable banned phrases ──────────────────────────────────────────────
// Word-boundary regex so "MLA" doesn't match "claim" etc. Each entry is
// [regex, friendly label] so failures print something readable.
const BANNED_PHRASES: Array<[RegExp, string]> = [
  [/\bMLA\b/i,                              "MLA"],
  [/\bMaster\s+Locksmiths?\b/i,             "Master Locksmith(s)"],
  [/\bMaster\s+Locksmiths?\s+Association\b/i, "Master Locksmiths Association"],
  [/\bWhich\?/i,                            "Which?"],
  [/\bCheckatrade\b/i,                      "Checkatrade"],
  [/\bTrustATrader\b/i,                     "TrustATrader"],
  [/\bRated\s+People\b/i,                   "Rated People"],
];

// Patterns that suggest the copy has named an individual engineer.
//
// Pattern #2 (Capitalized + "engineer/locksmith") needs a stop-word filter —
// otherwise it false-positives on sentence-leading adjectives ("Fast, local
// engineer dispatched", "Our local engineer covers…"). The captured token
// must look like a UK first name, not a common English word.
const ENGINEER_NAMED_PATTERNS: RegExp[] = [
  /\b(meet|hi,?\s*I'?m|I'?m|my name is|this is)\s+([A-Z][a-z]{2,15})\b/,
  /\b([A-Z][a-z]{2,15}),?\s+(is\s+)?(your\s+)?(local\s+)?(engineer|locksmith)\b/,
  /\b(engineer|locksmith)\s+([A-Z][a-z]{2,15})\s+(covers|serves|operates)\b/,
];

// Common capitalized English words that match the name-shaped pattern but
// are NOT names. Any captured token in this set is ignored as a false
// positive. Compared lowercase, so add lowercase entries.
const NAME_PATTERN_STOPWORDS = new Set([
  // Sentence-leading adjectives that commonly precede "engineer/locksmith"
  "fast", "quick", "local", "national", "regional", "trusted", "verified",
  "professional", "friendly", "reliable", "skilled", "expert", "experienced",
  "qualified", "certified", "insured", "approved", "vetted", "available",
  "emergency", "mobile", "independent", "established", "responsive",
  // Determiners / pronouns
  "our", "your", "their", "the", "this", "that", "every", "any", "all",
  "some", "many", "most", "each", "another",
  // Time/manner adverbs that sometimes get capitalized at sentence start
  "today", "tonight", "always", "often", "usually", "typically",
  // Brand-y / structural words that come up in our copy
  "locksafe", "uk", "british", "london", "manchester", "leeds", "bristol",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string | null, n = 80): string {
  if (!s) return "(none)";
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n) + "…" : oneLine;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /\w/.test(w)).length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

interface FaqEntry { question?: string; answer?: string }

// ── Per-row checks ──────────────────────────────────────────────────────────

interface CheckResult {
  status:  "PASS" | "FAIL" | "WARN";
  check:   string;
  detail?: string;
}

interface AuditRow {
  district:           string;
  slug:               string;
  isPublished:        boolean;
  anchorTown:         string | null;
  nearbyOutcodes:     string[];
  featuredEngineerName: string | null;
  heroHeadline:       string | null;
  heroSubcopy:        string | null;
  introParagraph:     string | null;
  coverageNarrative:  string | null;
  whyChooseUs:        string | null;
  faqs:               unknown;
  localTrustAnchors:  string[];
}

function checkBannedPhrases(row: AuditRow): CheckResult {
  const fields: Array<[string, string | null]> = [
    ["heroHeadline",      row.heroHeadline],
    ["heroSubcopy",       row.heroSubcopy],
    ["introParagraph",    row.introParagraph],
    ["coverageNarrative", row.coverageNarrative],
    ["whyChooseUs",       row.whyChooseUs],
  ];
  // Also walk the trust-strip bullets and FAQ q/a.
  for (const bullet of row.localTrustAnchors) fields.push(["localTrustAnchors", bullet]);
  const faqs = Array.isArray(row.faqs) ? (row.faqs as FaqEntry[]) : [];
  for (const f of faqs) {
    if (f.question) fields.push(["faq.question", f.question]);
    if (f.answer)   fields.push(["faq.answer",   f.answer]);
  }

  const hits: string[] = [];
  for (const [name, val] of fields) {
    if (!val) continue;
    for (const [re, label] of BANNED_PHRASES) {
      if (re.test(val)) hits.push(`${label} in ${name}: "${truncate(val, 60)}"`);
    }
  }
  return hits.length === 0
    ? { status: "PASS", check: "no accreditation leakage" }
    : { status: "FAIL", check: "no accreditation leakage", detail: hits.join(" | ") };
}

function checkEngineerNotNamed(row: AuditRow): CheckResult {
  const issues: string[] = [];
  if (row.featuredEngineerName) {
    issues.push(`featuredEngineerName="${row.featuredEngineerName}" (must be null)`);
  }
  const corpus: Array<[string, string | null]> = [
    ["heroHeadline",      row.heroHeadline],
    ["heroSubcopy",       row.heroSubcopy],
    ["introParagraph",    row.introParagraph],
    ["coverageNarrative", row.coverageNarrative],
    ["whyChooseUs",       row.whyChooseUs],
  ];
  for (const [name, val] of corpus) {
    if (!val) continue;
    for (const pat of ENGINEER_NAMED_PATTERNS) {
      const m = val.match(pat);
      if (!m) continue;
      // Captured group differs across patterns: #1 captures in [2], #2 in
      // [1], #3 in [2]. Try both — whichever looks name-shaped.
      const candidates = [m[2], m[1]].filter((s): s is string => !!s);
      const captured = candidates.find((c) => /^[A-Z][a-z]{1,14}$/.test(c)) ?? "";
      if (!captured) continue;
      const lower = captured.toLowerCase();
      // Skip false positives: anchorTown, stop-words, or anything that
      // doesn't look like a UK first name.
      if (row.anchorTown && lower === row.anchorTown.toLowerCase()) continue;
      if (NAME_PATTERN_STOPWORDS.has(lower)) continue;
      issues.push(`${name}: "${truncate(val, 70)}" → matched "${captured}"`);
      break;
    }
  }
  return issues.length === 0
    ? { status: "PASS", check: "engineer never named" }
    : { status: "FAIL", check: "engineer never named", detail: issues.join(" | ") };
}

function checkAnchorTownSurfaced(row: AuditRow): CheckResult {
  if (!row.anchorTown) {
    return { status: "FAIL", check: "anchorTown surfaced", detail: "anchorTown is null" };
  }
  const town = row.anchorTown;
  const re = new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const inHero  = row.heroHeadline   ? re.test(row.heroHeadline)   : false;
  const inIntro = row.introParagraph ? re.test(row.introParagraph) : false;
  if (inHero || inIntro) return { status: "PASS", check: "anchorTown surfaced" };
  return {
    status: "FAIL",
    check:  "anchorTown surfaced",
    detail: `"${town}" not present in heroHeadline or introParagraph`,
  };
}

function checkNearbyOutcodesNamed(row: AuditRow): CheckResult {
  if (!row.coverageNarrative) {
    return { status: "FAIL", check: "≥2 nearby outcodes named", detail: "coverageNarrative is null" };
  }
  if (row.nearbyOutcodes.length === 0) {
    return { status: "WARN", check: "≥2 nearby outcodes named", detail: "nearbyOutcodes list is empty" };
  }
  const mentioned = row.nearbyOutcodes.filter((oc) =>
    new RegExp(`\\b${oc}\\b`, "i").test(row.coverageNarrative!),
  );
  if (mentioned.length >= 2) {
    return { status: "PASS", check: "≥2 nearby outcodes named", detail: mentioned.join(", ") };
  }
  return {
    status: "FAIL",
    check:  "≥2 nearby outcodes named",
    detail: `mentioned ${mentioned.length}/${row.nearbyOutcodes.length}: ${mentioned.join(", ") || "(none)"}`,
  };
}

function checkFaqsDistrictSpecific(row: AuditRow): CheckResult {
  const faqs: FaqEntry[] = Array.isArray(row.faqs) ? (row.faqs as FaqEntry[]) : [];
  if (faqs.length < 3) {
    return { status: "FAIL", check: "≥3 district-specific FAQs", detail: `only ${faqs.length} FAQs` };
  }
  const districtRe = new RegExp(`\\b${row.district}\\b`, "i");
  const townRe = row.anchorTown
    ? new RegExp(`\\b${row.anchorTown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    : null;

  // Pass when EITHER the question OR the answer references the district
  // code or anchor town. An FAQ pair is district-specific if either side
  // grounds it — a generic question ("how fast can you get here?") with
  // a grounded answer ("within 30 min anywhere in RG1") still works.
  const generic: number[] = [];
  faqs.forEach((f, i) => {
    const q = f.question ?? "";
    const a = f.answer ?? "";
    const combined = q + " " + a;
    const mentionsDistrict = districtRe.test(combined);
    const mentionsTown = townRe ? townRe.test(combined) : false;
    if (!mentionsDistrict && !mentionsTown) generic.push(i);
  });
  if (generic.length === 0) {
    return { status: "PASS", check: "≥3 district-specific FAQs", detail: `${faqs.length} FAQs` };
  }
  return {
    status: "FAIL",
    check:  "≥3 district-specific FAQs",
    detail: `${generic.length}/${faqs.length} questions lack district or town reference`,
  };
}

function checkSentenceRhythm(row: AuditRow): CheckResult {
  const blob = [row.introParagraph, row.coverageNarrative, row.whyChooseUs]
    .filter((s): s is string => !!s)
    .join(" ");
  if (!blob) {
    return { status: "WARN", check: "varied sentence rhythm", detail: "no prose blocks to analyse" };
  }
  const lens = splitSentences(blob).map(wordCount).filter((n) => n > 0);
  if (lens.length < 4) {
    return { status: "WARN", check: "varied sentence rhythm", detail: `only ${lens.length} sentences` };
  }
  const s = stdev(lens);
  if (s >= 3.0) {
    return { status: "PASS", check: "varied sentence rhythm", detail: `stdev=${s.toFixed(2)} over ${lens.length} sentences` };
  }
  return {
    status: "WARN",
    check:  "varied sentence rhythm",
    detail: `stdev=${s.toFixed(2)} over ${lens.length} sentences (monotone cadence — consider regen)`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rows: AuditRow[] = await prisma.districtLandingPage.findMany({
    select: {
      district: true, slug: true, isPublished: true,
      anchorTown: true, nearbyOutcodes: true,
      featuredEngineerName: true,
      heroHeadline: true, heroSubcopy: true, introParagraph: true,
      coverageNarrative: true, whyChooseUs: true,
      faqs: true, localTrustAnchors: true,
    },
    orderBy: { district: "asc" },
  });

  if (rows.length === 0) {
    console.log("(no DistrictLandingPage rows exist — nothing to audit)");
    return;
  }

  let totalChecks = 0;
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  const failingDistricts = new Set<string>();

  for (const row of rows) {
    const header = `▶ ${row.district}  (slug=${row.slug}, published=${row.isPublished}, anchorTown=${row.anchorTown ?? "?"})`;
    console.log("");
    console.log(header);
    console.log("  " + "─".repeat(Math.min(header.length - 2, 70)));

    const checks: CheckResult[] = [
      checkBannedPhrases(row),
      checkEngineerNotNamed(row),
      checkAnchorTownSurfaced(row),
      checkNearbyOutcodesNamed(row),
      checkFaqsDistrictSpecific(row),
      checkSentenceRhythm(row),
    ];

    for (const c of checks) {
      totalChecks++;
      if (c.status === "PASS") passCount++;
      else if (c.status === "FAIL") { failCount++; failingDistricts.add(row.district); }
      else warnCount++;

      const tag = c.status === "PASS" ? "✓ PASS" : c.status === "FAIL" ? "✗ FAIL" : "⚠ WARN";
      console.log(`  [${tag}] ${c.check}${c.detail ? "  — " + c.detail : ""}`);
    }
  }

  console.log("");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Summary: ${rows.length} rows, ${totalChecks} checks`);
  console.log(`  ✓ PASS:  ${passCount}`);
  console.log(`  ✗ FAIL:  ${failCount}  ${failingDistricts.size ? "(" + Array.from(failingDistricts).join(", ") + ")" : ""}`);
  console.log(`  ⚠ WARN:  ${warnCount}`);
  console.log("");
  if (failCount > 0) {
    console.log("Action: rows with FAIL need regeneration via Ollama or a manual override edit.");
  } else if (warnCount > 0) {
    console.log("Action: warnings are advisory — review at your discretion.");
  } else {
    console.log("All districts pass the canary checks.");
  }
}

main()
  .catch((err) => {
    console.error("✗ Failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
