/**
 * §28 — Per-region CPC bid-ceiling matrix.
 *
 * Why this exists (added 2026-06-17, GODMODE plan)
 * ──────────────────────────────────────────────────
 * The flat £6 CPC ceiling that powered all 5 published campaigns since
 * 2026-06-09 was buying the bottom of every UK locksmith auction. External
 * research (SwiftLead, CPS Media, Heavyweight Digital, 2026) puts the
 * realistic clearing CPCs at:
 *   • Town / market town       £6  (where £6 already works)
 *   • Regional (Liverpool, Newcastle, Bristol, Bradford)  £12–15
 *   • Metro    (London, Manchester, Birmingham)           £18–22
 *
 * The Liverpool L1 v2 result (£648 spent / 0 conversions / 105 clicks at
 * 8.15% CTR) confirmed it: a 105-click sample with zero conversions has a
 * 95% upper-bound conversion rate of 2.81% (rule of three) — well below
 * the 7-16% emergency-services floor. We were winning a thin slice of
 * cheap, low-intent traffic and burning through it.
 *
 * This module returns the CPC-bid-ceiling (GBP) for a region tier and the
 * tier lookup keyed by city slug used in our draft naming convention.
 *
 * Used by:
 *   • google-ads-draft-enforcement.ts (PLAYBOOK_GUARDRAILS keeps the
 *     legacy flat 6 for the floor; per-region resolution happens here)
 *   • google-ads-publish.ts (passes region-derived ceiling to
 *     `target_spend.cpc_bid_ceiling_micros` when MAXIMIZE_CLICKS)
 *
 * Default: unknown region → `town` tier → £6 (the safe floor). New cities
 * must be classified explicitly to qualify for a higher ceiling.
 */

export type RegionTier = "town" | "regional" | "metro";

/** CPC bid ceiling in GBP for each tier. Midpoints of the research bands. */
export const CPC_CEILING_GBP_BY_TIER: Record<RegionTier, number> = {
  town:     6,
  regional: 14, // £12–£15 midpoint
  metro:    20, // £18–£22 midpoint
} as const;

/**
 * Authoritative slug → tier map. Slugs are case-insensitive when looking up
 * (we normalise before reading). New cities default to `town` until a
 * deliberate playbook revision moves them.
 *
 * Why these specific assignments
 * ──────────────────────────────
 *   • metro  — London, Manchester, Birmingham:    £18–22 research band, top
 *              competitive auctions where Banham / Keytek / Barry Bros
 *              clear consistently.
 *   • regional — Liverpool, Newcastle, Bristol, Bradford:  £12–18 research
 *                band, second-tier cities with serious paid presence but
 *                without the London-style premium.
 *   • town    — everything else.
 */
const CITY_TIER_TABLE: Record<string, RegionTier> = {
  // Metros
  london:     "metro",
  manchester: "metro",
  birmingham: "metro",

  // Regional
  liverpool:  "regional",
  newcastle:  "regional",
  bristol:    "regional",
  bradford:   "regional",
};

/**
 * Normalise a city/region label to the slug form we key on.
 * Drops anything past a hyphen (so "Newcastle-Upon-Tyne" → "newcastle"),
 * trims, lowercases. Returns "" for empty input.
 */
export function citySlugFromLabel(label: string | undefined | null): string {
  if (!label) return "";
  const t = String(label).trim().toLowerCase();
  if (!t) return "";
  // Strip postcode suffixes (e.g. "Liverpool L1" → "liverpool"), trailing
  // qualifiers ("v2", "test"), and anything past the first whitespace
  // boundary that isn't part of the city name. We keep the city name as
  // its first whitespace-separated token unless it matches a known
  // multi-word city — none currently.
  // Examples handled:
  //   "Liverpool L1 v2"        → "liverpool"
  //   "London E15 — Newham"    → "london"
  //   "London"                 → "london"
  //   "newcastle ne1"          → "newcastle"
  const firstToken = t.split(/[\s\-—–]/).filter(Boolean)[0] ?? "";
  return firstToken;
}

/**
 * Resolve the region tier from any label-ish input (e.g. campaign name,
 * city slug, draft.name). Unknown → `town`.
 */
export function regionTierFromLabel(label: string | undefined | null): RegionTier {
  const slug = citySlugFromLabel(label);
  if (!slug) return "town";
  return CITY_TIER_TABLE[slug] ?? "town";
}

/**
 * CPC bid-ceiling lookup. Returns the GBP ceiling for the given tier.
 * Defaults to `regional` (£14) when called without a tier argument — used
 * by the publish path as a conservative middle position when an existing
 * draft doesn't carry an explicit tier. The flat £6 floor is now ONLY
 * applied to drafts whose slug resolves to `town`.
 *
 *   getCpcCeilingGbp("metro")    → 20
 *   getCpcCeilingGbp("regional") → 14
 *   getCpcCeilingGbp("town")     → 6
 *   getCpcCeilingGbp()           → 14  (regional default, see above)
 *   getCpcCeilingGbp("xyz" as RegionTier) → 14 (defensive)
 */
export function getCpcCeilingGbp(tier?: RegionTier): number {
  if (!tier) return CPC_CEILING_GBP_BY_TIER.regional;
  return CPC_CEILING_GBP_BY_TIER[tier] ?? CPC_CEILING_GBP_BY_TIER.regional;
}

/**
 * Convenience: resolve tier from a label AND return its CPC ceiling.
 * Used by publish.ts where we have draft.name but no explicit tier.
 *
 *   resolveCpcCeilingFromLabel("Liverpool L1 v2") → 14
 *   resolveCpcCeilingFromLabel("London E15")      → 20
 *   resolveCpcCeilingFromLabel("Newham E15")      → 6   (unknown → town)
 *   resolveCpcCeilingFromLabel(undefined)         → 6   (unknown → town)
 */
export function resolveCpcCeilingFromLabel(
  label: string | undefined | null,
): number {
  const tier = regionTierFromLabel(label);
  return CPC_CEILING_GBP_BY_TIER[tier];
}

/**
 * For tests + admin diagnostics — expose the full table without letting
 * callers mutate it.
 */
export function getRegionTierTable(): Readonly<Record<string, RegionTier>> {
  return { ...CITY_TIER_TABLE };
}
