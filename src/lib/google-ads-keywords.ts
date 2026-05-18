/**
 * LockSafe UK — Google Ads keyword baselines.
 *
 * These lists are the NON-NEGOTIABLE foundation of every campaign draft.
 * They are merged with whatever the LLM generates; the LLM is instructed
 * to ADD to them, never to replace them.
 *
 * Rationale
 * ---------
 * Relying on the LLM alone for keywords means a single hallucination or
 * omission burns real money. The baseline gives us:
 *   • Guaranteed coverage of every proven high-intent locksmith query.
 *   • A comprehensive negative list that blocks the biggest budget-wasters
 *     before a single penny is spent — jobs/training seekers, DIY searchers,
 *     wrong product types, aggregator-only traffic, etc.
 *
 * Maintenance
 * -----------
 * Update BASELINE_NEGATIVE_KEYWORDS whenever the search-terms report
 * surfaces new recurring zero-conversion patterns (the ads-specialist
 * agent does this automatically in its keyword-expansion loop).
 */

import type { GoogleKeyword } from "./openai-google-ads";

// =========================================================================
// HIGH-INTENT BASELINE KEYWORDS
// Always included in every campaign draft. The LLM adds on top of these.
// =========================================================================

/** Exact-match terms — highest intent, most controlled spend. */
const EXACT_BASELINE: GoogleKeyword[] = [
  { text: "emergency locksmith",           matchType: "EXACT" },
  { text: "locksmith near me",             matchType: "EXACT" },
  { text: "24 hour locksmith",             matchType: "EXACT" },
  { text: "24/7 locksmith",                matchType: "EXACT" },
  { text: "locked out of house",           matchType: "EXACT" },
  { text: "locked out of my house",        matchType: "EXACT" },
  { text: "lock out service",              matchType: "EXACT" },
  { text: "house lockout",                 matchType: "EXACT" },
  { text: "flat lockout",                  matchType: "EXACT" },
  { text: "broken lock repair",            matchType: "EXACT" },
  { text: "lock replacement",              matchType: "EXACT" },
  { text: "door lock replacement",         matchType: "EXACT" },
  { text: "lock change after burglary",    matchType: "EXACT" },
  { text: "verified locksmith",            matchType: "EXACT" },
  { text: "anti fraud locksmith",          matchType: "EXACT" },  // LockSafe's unique differentiator
];

/** Phrase-match terms — catch city/area suffixes automatically. */
const PHRASE_BASELINE: GoogleKeyword[] = [
  { text: "emergency locksmith",           matchType: "PHRASE" },
  { text: "locksmith near me",             matchType: "PHRASE" },
  { text: "24 hour locksmith",             matchType: "PHRASE" },
  { text: "locked out",                    matchType: "PHRASE" },
  { text: "lock change",                   matchType: "PHRASE" },
  { text: "lock replacement",              matchType: "PHRASE" },
  { text: "broken lock",                   matchType: "PHRASE" },
  { text: "upvc lock repair",              matchType: "PHRASE" },
  { text: "upvc lock replacement",         matchType: "PHRASE" },
  { text: "anti snap lock",                matchType: "PHRASE" },
  { text: "burglary locksmith",            matchType: "PHRASE" },
  { text: "key stuck in lock",             matchType: "PHRASE" },
  { text: "lost house keys",               matchType: "PHRASE" },
  { text: "trusted locksmith",             matchType: "PHRASE" },
  { text: "guaranteed locksmith",          matchType: "PHRASE" },
  { text: "locksmith price guarantee",     matchType: "PHRASE" },
  { text: "door lock repair",              matchType: "PHRASE" },
  { text: "flat locked out",               matchType: "PHRASE" },
];

/** Broad-match — discovery only. Keep this list small; add from search-terms data later. */
const BROAD_BASELINE: GoogleKeyword[] = [
  { text: "verified locksmith uk",         matchType: "BROAD" },
  { text: "anti scam locksmith",           matchType: "BROAD" },
];

export const BASELINE_LOCKSMITH_KEYWORDS: GoogleKeyword[] = [
  ...EXACT_BASELINE,
  ...PHRASE_BASELINE,
  ...BROAD_BASELINE,
];

// =========================================================================
// COMPREHENSIVE NEGATIVE KEYWORD BASELINE
// These are ALWAYS added to every draft — the LLM adds on top of these.
// Never trim this list without a data-backed reason.
// =========================================================================

export const BASELINE_NEGATIVE_KEYWORDS: string[] = [
  // ── Jobs / Careers / Business (biggest waste category) ──────────────────
  "locksmith job",
  "locksmith jobs",
  "locksmith vacancy",
  "locksmith vacancies",
  "locksmith apprenticeship",
  "locksmith apprentice",
  "locksmith salary",
  "locksmith wages",
  "locksmith career",
  "locksmith careers",
  "locksmith employment",
  "become a locksmith",
  "how to become a locksmith",
  "locksmith franchise",
  "start locksmith business",
  "locksmith business for sale",
  "locksmith software",
  "locksmith management software",
  "locksmith crm",
  "locksmith insurance",           // tradesperson insurance, not a customer
  "locksmith liability insurance",
  "locksmith van insurance",
  "locksmith supplies",
  "locksmith equipment",
  "locksmith tools",
  "locksmith tools for sale",

  // ── Training / Courses / DIY ─────────────────────────────────────────────
  "locksmith training",
  "locksmith course",
  "locksmith courses",
  "locksmith qualification",
  "locksmith certificate",
  "locksmith certification",
  "locksmith school",
  "locksmith college",
  "master locksmith",               // usually a credential search, not a service
  "locksmith tutorial",
  "locksmith guide",
  "how to pick a lock",
  "how to open a lock without key",
  "lock picking",
  "lockpicking",
  "pick a lock",
  "lock pick set",
  "lock pick kit",
  "lock picks",
  "lockpick",
  "bump key",
  "lock bumping",
  "lock picking tool",
  "lock picking tools",
  "how to unlock a door",
  "how to break into",              // broad catch-all for DIY break-in queries
  "diy lock change",
  "change lock yourself",
  "fit lock yourself",

  // ── Wrong product type (not a locksmith service) ─────────────────────────
  "padlock",
  "combination lock",
  "bike lock",
  "bicycle lock",
  "motorbike lock",
  "motorcycle lock",
  "storage unit lock",
  "locker lock",
  "shed lock",
  "gate lock",                      // usually sold in hardware stores
  "gun lock",
  "gun safe",
  "firearm lock",
  "steering wheel lock",
  "wheel clamp",
  "car immobiliser",

  // ── Alarm / CCTV / unrelated security (different trade) ─────────────────
  "alarm system",
  "alarm installation",
  "burglar alarm",
  "home alarm",
  "security alarm",
  "cctv installation",
  "cctv camera",
  "security camera",
  "door bell camera",
  "ring doorbell",
  "smart doorbell",
  "window sensor",
  "motion detector",

  // ── Review / comparison / forum (research, not buying) ───────────────────
  "locksmith review",
  "locksmith reviews",
  "locksmith scam",                 // they're researching scams, not booking
  "locksmith scams",
  "locksmith complaints",
  "locksmiths forum",
  "locksmith association",
  "master locksmiths association",
  "checkatrade locksmith",          // aggregator-committed traffic
  "rated people locksmith",
  "trustatrader locksmith",
  "which locksmith",
  "best locksmith uk",              // comparison/editorial, low-intent
  "locksmith directory",

  // ── Free / generic "near me" solo (low quality score, wrong match) ───────
  "free locksmith",
  "locksmith for free",
  "near me",                        // alone it matches everything; block it

  // ── Property/rental context (not emergency, low conversion) ──────────────
  "landlord locksmith",             // usually bulk/long lead time work
  "property management locksmith",

  // ── Key cutting only (no lockout, no job) ────────────────────────────────
  "key cutting",
  "key cut",
  "key copy",
  "spare key",
  "duplicate key",
  "replacement key fob",            // car dealership territory
  "car key programming",
  "car key replacement",            // mostly dealerships / auto specialists
  "transponder key",
];

// =========================================================================
// UK ROGUE LOCKSMITH COMPETITOR BRAND NEGATIVES
// These aggregators/directories often host unvetted locksmiths. Blocking
// them prevents wasting impressions on users brand-searching competitors.
// Add to competitorBrands in the draft request; they'll be merged here.
// =========================================================================

export const COMPETITOR_BRAND_NEGATIVES: string[] = [
  "locksmith direct",
  "emergency locksmith direct",
  "uk locksmith",               // generic but often a branded directory
  "lockforce",
  "local heroes locksmith",     // Kingfisher service
  "fantastic locksmiths",
  "brighthouse locksmith",
  "kwikset",                    // US hardware brand, not a UK locksmith
  "yale locksmith",             // brand searches for hardware
  "ingersoll locksmith",
  "banham locksmith",           // premium London brand, different market
];

// =========================================================================
// Merge helpers
// =========================================================================

/**
 * Merge the baseline keywords with LLM-generated keywords, deduplicating on
 * {text+matchType}. Baseline keywords come first (preserved order).
 */
export function mergeKeywords(
  baseline: GoogleKeyword[],
  llmGenerated: GoogleKeyword[],
): GoogleKeyword[] {
  const seen = new Set<string>();
  const result: GoogleKeyword[] = [];
  for (const kw of [...baseline, ...llmGenerated]) {
    const key = `${kw.matchType}:${kw.text.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(kw);
    }
  }
  return result;
}

/**
 * Merge the baseline negative keywords with LLM-generated and any competitor
 * brand names, deduplicating (lowercase).
 */
export function mergeNegativeKeywords(
  ...sources: string[][]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of sources) {
    for (const kw of list) {
      const k = kw.toLowerCase().trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        result.push(k);
      }
    }
  }
  return result;
}
