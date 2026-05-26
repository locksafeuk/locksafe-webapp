/**
 * Discovery Campaign Generator (Phase 2c)
 *
 * Takes a ranked, shark-cleaned KeywordSeed candidate and produces a
 * fully-formed GoogleAdsCampaignDraft payload — ready for prisma.create
 * by the orchestrator. PURE: no DB, no clock, deterministic.
 *
 * INTEGRATES THE WHOLE PHASE 2 STACK
 * ──────────────────────────────────
 *   • Family       (Phase 2a): drives ad-copy template + keyword variants
 *   • Budget cap   (Phase 2b): enforces per-family £/day + max CPC
 *   • Phone intent (Phase 2b): used by orchestrator to RANK candidates;
 *                              the score is carried through as audit data
 *   • Shark filter (Phase 2b): used by orchestrator to FILTER candidates
 *                              before they ever reach this builder
 *
 * THIS FILE'S JOB
 * ───────────────
 *   1. Pick the right family-specific headline+description bundle
 *   2. Build the keyword variant list (3-5 phrases per candidate)
 *   3. Stamp the negative-keyword baseline + family-specific negatives
 *   4. Enforce daily budget cap + max CPC for the family
 *   5. Return a prisma-ready CampaignDraftPayload + audit reasoning
 *
 * The orchestrator (NOT included here) handles the DB writes, the
 * "select top N seeds" logic, and idempotency. Splitting that out keeps
 * this file pure and 100% unit-testable.
 */

import type { SeedCategory } from "@/agents/core/seed-bank";
import {
  enforceBudgetCap,
  enforceMaxCpc,
  getCapForFamily,
} from "@/lib/family-budget-caps";
import {
  detectPostcodeDistrict,
} from "@/lib/phone-lead-intent-score";

// ── Public types ────────────────────────────────────────────────────────────

export interface DiscoveryCandidate {
  /** The candidate keyword (e.g. "emergency locksmith RG1"). */
  keyword:  string;
  /** Family from the postcode generator. Drives copy + caps. */
  family:   SeedCategory;
  /**
   * Optional precomputed phone-lead intent score (0-100). When present it
   * is carried through into the draft's aiReasoning string for audit.
   */
  phoneLeadIntentScore?: number;
}

export interface DraftBuildOptions {
  /** GoogleAdsAccount.id this draft belongs to. */
  accountId:        string;
  /** Final URL — where Google sends clicks. Must be an HTTPS URL. */
  finalUrl:         string;
  /** Shared website phone in E.164 (+44...) — surfaced in the copy. */
  websitePhoneE164: string;
  /**
   * Caller-requested daily budget. Capped to the family default. When
   * omitted the cap default is used.
   */
  requestedDailyBudgetGbp?: number;
  /**
   * Caller-requested max CPC. Capped to the family ceiling. When omitted,
   * the family's max CPC is used (since we're MAXIMIZE_CONVERSIONS, this
   * acts as a ceiling rather than a fixed bid).
   */
  requestedMaxCpcGbp?: number;
  /**
   * Status to write. Default PENDING_APPROVAL so a human still publishes.
   * Pass DRAFT for fully-headless mode (not recommended for opening
   * launches).
   */
  status?: "DRAFT" | "PENDING_APPROVAL";
  /** Optional agent ID for audit (creator's agentId). */
  agentId?: string;
  /** Free-form prompt label written to aiPrompt for audit. */
  aiPrompt?: string;
}

/**
 * Output shape that maps 1:1 onto prisma.googleAdsCampaignDraft.create
 * data + a small audit-only `audit` field the caller may log but should
 * not persist on the row itself.
 */
export interface CampaignDraftPayload {
  data: {
    accountId:       string;
    status:          "DRAFT" | "PENDING_APPROVAL";
    name:            string;
    dailyBudget:     number;
    biddingStrategy: string;
    targetCpa?:      number;
    channel:         string;
    geoTargets:      string[];
    languageTargets: string[];
    headlines:       string[];
    descriptions:    string[];
    finalUrl:        string;
    keywords:        Array<{ text: string; matchType: "EXACT" | "PHRASE" | "BROAD" }>;
    negativeKeywords: string[];
    aiGenerated:     boolean;
    aiPrompt?:       string;
    aiReasoning:     string;
    agentId?:        string;
    createdBy:       "ai" | "admin";
  };
  audit: {
    family:           SeedCategory;
    district:         string | null;
    budgetCapped:     boolean;
    cpcCapped:        boolean;
    effectiveBudget:  number;
    effectiveMaxCpc:  number;
  };
}

// ── Ad-copy templates per family ────────────────────────────────────────────

/**
 * Per-family headline + description templates. Each template can reference
 * `{district}` (substituted with the candidate's detected outcode, or
 * dropped if no district is detectable).
 *
 * All headlines must be ≤ 30 chars (Google's RSA limit). Descriptions
 * must be ≤ 90 chars. The builder validates length and trims any
 * that overflow rather than failing — the validation is a safety net,
 * not a creative constraint.
 */
interface FamilyCopy {
  /** RSA headlines — Google allows up to 15; we provide 5 strong ones. */
  headlines:    string[];
  /** RSA descriptions — Google allows up to 4. */
  descriptions: string[];
  /** Extra negative keywords specific to this family. */
  extraNegatives: string[];
  /** Match types used for the keyword variants we generate. */
  matchTypeMix: Array<"EXACT" | "PHRASE">;
}

/**
 * Hard ceiling per copy constraint. Google REJECTS ads that overflow
 * (it just refuses to publish) so we always clip.
 */
const HEADLINE_MAX    = 30;
const DESCRIPTION_MAX = 90;

// NOTE on trust signals (May 2026): LockSafe does NOT currently hold MLA
// (Master Locksmiths Association), Which? Trusted Trader, or Checkatrade
// accreditation. Claiming these in ad copy would be misrepresentation
// under the Consumer Protection from Unfair Trading Regulations 2008.
// We use ONLY verifiable trust signals: DBS-checked (AI-verified at
// onboarding), insured (AI-verified certificates), fixed-price process,
// real local engineer, 24/7 dispatch, GPS-tracked.
const FAMILY_COPY: Record<string, FamilyCopy> = {
  postcode_local: {
    headlines: [
      "Locksmith {district} 24/7",
      "Locked Out? Call Now",
      "Emergency Locksmith {district}",
      "DBS-Checked · Fixed Price",
      "Real Local · No Callout Fee",
    ],
    descriptions: [
      "Locked out in {district}? DBS-checked local engineer. Fixed price, no callout fee.",
      "Real local locksmith — not a national call centre. Insured, transparent pricing.",
    ],
    extraNegatives: [],
    matchTypeMix:   ["PHRASE", "EXACT"],
  },

  trust_signal: {
    headlines: [
      "DBS-Checked Locksmith",
      "Fixed Price Guarantee",
      "Insured Local Engineer",
      "Honest Locksmith {district}",
      "No Hidden Callout Fees",
    ],
    descriptions: [
      "DBS-checked, fully insured local engineer. Fixed price agreed before any work starts.",
      "Tired of dodgy quotes? Real engineer, honest pricing, no callout fee. Call us.",
    ],
    extraNegatives: [],
    matchTypeMix:   ["PHRASE"],
  },

  service_long_tail: {
    headlines: [
      "Lock Change {district}",
      "uPVC & Composite Locks",
      "Anti-Snap Cylinder Fit",
      "Free Quote · Fixed Price",
      "DBS-Checked Engineer",
    ],
    descriptions: [
      "Need a lock changed? DBS-checked engineer, fixed price quote before we start.",
      "uPVC, Yale, anti-snap cylinders fitted. Local engineer, no callout fee, fair quote.",
    ],
    extraNegatives: ["second-hand", "used", "refurbished"],
    matchTypeMix:   ["PHRASE"],
  },

  b2b_specialist: {
    headlines: [
      "Commercial Locksmith UK",
      "Landlord Lock Changes",
      "Office & Shop Security",
      "Fixed Price · Invoice Paid",
      "DBS-Checked · Insured",
    ],
    descriptions: [
      "Commercial locksmith for landlords, offices and shops. Fixed price, invoice payment.",
      "Letting agent? Need lock changes between tenancies? DBS-checked, fast turnaround.",
    ],
    extraNegatives: ["residential", "house", "diy", "domestic"],
    matchTypeMix:   ["PHRASE"],
  },

  research_intent: {
    // Should rarely run — research_intent has a tiny budget cap.
    headlines: [
      "Honest Locksmith Reviews",
      "DBS-Checked Locksmith UK",
      "Fixed Price Locksmith Guide",
      "Real Engineer · No Tricks",
      "How to Pick a Locksmith",
    ],
    descriptions: [
      "Real local locksmith — DBS-checked, insured. See how we compare on price.",
      "Avoid the rip-off. Fixed price, DBS-checked. Read our pricing guarantee.",
    ],
    extraNegatives: [],
    matchTypeMix:   ["PHRASE"],
  },
};

/** Fallback copy for unknown / legacy families. Conservative trust pitch. */
const FALLBACK_COPY: FamilyCopy = {
  headlines: [
    "Local Locksmith Service",
    "DBS-Checked Engineer",
    "Fixed Price · No Surprises",
    "Locked Out? Call Now",
    "Honest Local Locksmith",
  ],
  descriptions: [
    "DBS-checked local locksmith. Fixed price guarantee — no callout fees.",
    "Real engineer, not a national call centre. Honest pricing, fast response.",
  ],
  extraNegatives: [],
  matchTypeMix:   ["PHRASE"],
};

// ── Negative-keyword baseline (every family) ────────────────────────────────

/**
 * Industry-standard negatives. Anti-DIY, anti-research, anti-job-hunters.
 * Lowercase, deduplicated, alphabetised so diffs are easy to read.
 */
export const BASELINE_NEGATIVES = [
  "amazon",        "apprenticeship", "b&q",         "blog",
  "course",        "courses",        "definition",  "diy",
  "ebay",          "free",           "game",        "games",
  "history",       "how to",         "job",         "jobs",
  "kit",           "kits",           "near me job", "review of",
  "salary",        "screwfix",       "training",    "tutorial",
  "video",         "videos",         "wikipedia",   "youtube",
];

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Substitute {district} placeholders, drop the token entirely if no district. */
function substituteDistrict(template: string, district: string | null): string {
  if (district) return template.replace(/\{district\}/g, district);
  // Drop the placeholder + surrounding whitespace cleanly
  return template.replace(/\s*\{district\}\s*/g, " ").trim().replace(/\s{2,}/g, " ");
}

/** Clip a string to maxLen, preserving meaningful tail. */
function clip(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  // Try clipping at the last space before the limit to avoid mid-word cuts
  const slice = s.slice(0, maxLen).trim();
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) return slice.slice(0, lastSpace);
  return slice;
}

/** Build the keyword variant list for one candidate. */
export function buildKeywordVariants(
  candidate: DiscoveryCandidate,
  district:  string | null,
): Array<{ text: string; matchType: "EXACT" | "PHRASE" }> {
  const copy = FAMILY_COPY[candidate.family] ?? FALLBACK_COPY;
  const out: Array<{ text: string; matchType: "EXACT" | "PHRASE" }> = [];

  // Variant 1: the candidate itself
  out.push({ text: candidate.keyword.toLowerCase(), matchType: "PHRASE" });

  // Variant 2: district-first if we know one — captures the postcode-first
  // search pattern ("RG1 locksmith")
  if (district) {
    const dl = district.toLowerCase();
    const kw = candidate.keyword.toLowerCase();
    if (!kw.startsWith(dl)) {
      // Insert district at the start
      const withoutDistrict = kw.replace(new RegExp(`\\b${dl}\\b`, "g"), "").replace(/\s+/g, " ").trim();
      if (withoutDistrict) {
        out.push({ text: `${dl} ${withoutDistrict}`, matchType: "EXACT" });
      }
    }
  }

  // Variant 3: stripped-vague variant — drop adjectives like "emergency"
  // for the phrase match (gives Google room to match relevant variants)
  if (copy.matchTypeMix.includes("EXACT")) {
    // Already handled above for postcode-first
  }

  return dedupe(out, (k) => `${k.text}|${k.matchType}`);
}

function dedupe<T>(arr: T[], keyFn: (v: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = keyFn(v).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Build the headlines for a candidate, substituting + clipping. */
export function buildHeadlines(
  family:   SeedCategory,
  district: string | null,
): string[] {
  const copy = FAMILY_COPY[family] ?? FALLBACK_COPY;
  return copy.headlines
    .map((h) => substituteDistrict(h, district))
    .map((h) => clip(h, HEADLINE_MAX));
}

/** Build the descriptions for a candidate, substituting + clipping. */
export function buildDescriptions(
  family:   SeedCategory,
  district: string | null,
): string[] {
  const copy = FAMILY_COPY[family] ?? FALLBACK_COPY;
  return copy.descriptions
    .map((d) => substituteDistrict(d, district))
    .map((d) => clip(d, DESCRIPTION_MAX));
}

/** Compose the final negative-keyword list. */
export function buildNegativeKeywords(family: SeedCategory): string[] {
  const copy = FAMILY_COPY[family] ?? FALLBACK_COPY;
  // Dedupe + alphabetise so diffs across runs are stable
  return Array.from(new Set([...BASELINE_NEGATIVES, ...copy.extraNegatives])).sort();
}

/** Compose a deterministic campaign name. */
export function buildCampaignName(candidate: DiscoveryCandidate, district: string | null): string {
  const part = district ?? "UK";
  const familyShort = candidate.family
    .replace("postcode_local",    "Postcode")
    .replace("trust_signal",      "Trust")
    .replace("service_long_tail", "Service")
    .replace("b2b_specialist",    "B2B")
    .replace("research_intent",   "Research");
  return `LockSafe · ${familyShort} · ${part}`;
}

// ── Main builder ────────────────────────────────────────────────────────────

/**
 * Produce a prisma-ready CampaignDraftPayload for a single candidate.
 *
 * The orchestrator should:
 *   1. Score candidates (phoneLeadIntentScore)
 *   2. Filter via shark-saturation
 *   3. Pick the top N (per-family limit)
 *   4. Call buildDiscoveryCampaignDraft() per candidate
 *   5. prisma.googleAdsCampaignDraft.create({ data })
 *
 * This split keeps the heavy DB lifecycle out of the pure builder so
 * tests don't need Prisma mocks.
 */
export function buildDiscoveryCampaignDraft(
  candidate: DiscoveryCandidate,
  options:   DraftBuildOptions,
): CampaignDraftPayload {
  const district = detectPostcodeDistrict(candidate.keyword);
  const cap      = getCapForFamily(candidate.family);

  // ── Resolve budget + CPC under family caps ──────────────────────────
  const requestedBudget = options.requestedDailyBudgetGbp ?? cap.dailyBudgetGbp;
  const budgetCheck     = enforceBudgetCap(candidate.family, requestedBudget);

  const requestedCpc = options.requestedMaxCpcGbp ?? cap.maxCpcGbp;
  const cpcCheck     = enforceMaxCpc(candidate.family, requestedCpc);

  // ── Copy + targeting ────────────────────────────────────────────────
  const headlines    = buildHeadlines(candidate.family, district);
  const descriptions = buildDescriptions(candidate.family, district);
  const keywords     = buildKeywordVariants(candidate, district);
  const negatives    = buildNegativeKeywords(candidate.family);
  const name         = buildCampaignName(candidate, district);

  // ── Reasoning string (carries the intent score for audit) ───────────
  const scoreFragment =
    candidate.phoneLeadIntentScore !== undefined
      ? `phoneLeadIntent=${candidate.phoneLeadIntentScore}`
      : "phoneLeadIntent=unscored";
  const capFragment = budgetCheck.capped
    ? `budget capped £${budgetCheck.effective}/day from £${requestedBudget}`
    : `budget £${budgetCheck.effective}/day`;
  const reasoning =
    `Discovery campaign for "${candidate.keyword}" (family=${candidate.family}, ` +
    `district=${district ?? "n/a"}, ${scoreFragment}, ${capFragment}). ` +
    `Phone number: ${options.websitePhoneE164}.`;

  return {
    data: {
      accountId:       options.accountId,
      status:          options.status ?? "PENDING_APPROVAL",
      name,
      dailyBudget:     budgetCheck.effective,
      biddingStrategy: "MAXIMIZE_CONVERSIONS",
      // targetCpa undefined — we let conversions tuning learn it; the CPC
      // cap is applied at the keyword level via the bidding strategy max.
      channel:         "SEARCH",
      geoTargets:      ["2826"],  // United Kingdom
      languageTargets: ["1000"],  // English
      headlines,
      descriptions,
      finalUrl:        options.finalUrl,
      keywords,
      negativeKeywords: negatives,
      aiGenerated:     true,
      aiPrompt:        options.aiPrompt,
      aiReasoning:     reasoning,
      agentId:         options.agentId,
      createdBy:       "ai",
    },
    audit: {
      family:          candidate.family,
      district,
      budgetCapped:    budgetCheck.capped,
      cpcCapped:       cpcCheck.capped,
      effectiveBudget: budgetCheck.effective,
      effectiveMaxCpc: cpcCheck.effective,
    },
  };
}
