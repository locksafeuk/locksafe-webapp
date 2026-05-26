/**
 * Locksmith Recruitment Recommender
 *
 * Identifies UK postcode outcodes where LockSafe should aim to recruit
 * (or extend an existing locksmith's radius into). Reads:
 *
 *   • UK_OUTCODES                — curated reference set (~80 outcodes)
 *   • currentCoverage[]          — outcodes our locksmiths already serve
 *   • currentLocksmithLocations  — lat/lng of every active locksmith,
 *                                  used to detect "close enough that an
 *                                  existing locksmith could extend radius
 *                                  rather than us hiring fresh"
 *   • sharkSignal (optional)     — map of outcode → shark CPC density,
 *                                  surfaced from competitor-intel scans
 *
 * Produces a ranked list with audit-friendly recommendation reasons.
 * PURE — no DB, no clock. The runner script handles I/O.
 *
 * SCORE COMPOSITION (max 100)
 * ───────────────────────────
 *   demandScore        0-40   ln(population) bucketed
 *   sharkPressureBoost 0-25   high shark CPC density = LockSafe wins by
 *                              undercutting on honesty
 *   regionBoost        0-20   commuter_belt + london get +20, second
 *                              tier cities +10, rural Wales / NI +0
 *   coverageGapPenalty  -15   covered districts get -100 (excluded)
 *   nearExisting       -10    if an existing locksmith is < 8 miles,
 *                              suggest RADIUS-EXTEND, not new hire
 *
 * The score isn't a probability — it's a stable ranking. Use the top
 * 10-20 as a recruitment shortlist.
 */

import {
  UK_OUTCODES,
  UK_OUTCODES_BY_CODE,
  haversineMiles,
  type OutcodeReference,
  type UkRegion,
} from "@/lib/uk-outcodes-reference";

// ── Public types ────────────────────────────────────────────────────────────

export interface ExistingLocksmithLocation {
  /** Locksmith.id — surfaced in recommendations so ops can DM them. */
  id:        string;
  /** Display name — for the recommendation row. */
  name:      string;
  /** Centroid of their service area. */
  lat:       number;
  lng:       number;
  /** Current coverage radius in MILES (from LocksmithCoverage). */
  radiusMi:  number;
}

export interface SharkPressureSignal {
  /** Outcode in uppercase. */
  outcode:        string;
  /** Mean shark-flag confidence across competitors observed bidding here. */
  meanShark:      number;          // 0-1
  /** Highest observed CPC for an emergency-locksmith term here (GBP). */
  topCpcGbp:      number | null;
}

export interface RecommenderOptions {
  /** Outcodes we ALREADY cover (LocksmithCoverage). Lowercased internally. */
  coveredOutcodes:           string[];
  /** Active locksmiths' centroids + radii. Empty array = none. */
  existingLocksmithLocations?: ExistingLocksmithLocation[];
  /** Shark-pressure signal map. Optional — recommender works without it. */
  sharkSignals?:             SharkPressureSignal[];
  /**
   * Restrict recommendation to outcodes in these regions. Useful for
   * "we just opened in the Midlands, prioritise those for the next hire".
   * When omitted, ALL regions are considered.
   */
  regionFilter?:             UkRegion[];
  /** Max items to return. Default 20. */
  limit?:                    number;
}

export interface RecommendationKind {
  /** What action the recommender suggests. */
  action:   "new_hire" | "radius_extend";
  /** When action=radius_extend, which existing locksmith to ask. */
  locksmithId?:   string;
  locksmithName?: string;
  distanceMi?:    number;
}

export interface Recommendation {
  outcode:           string;
  primaryCity:       string;
  region:            UkRegion;
  populationEst:     number;

  score:             number;       // 0-100 composite
  components: {
    demandScore:        number;
    sharkPressureBoost: number;
    regionBoost:        number;
  };

  recommendation:    RecommendationKind;
  /** Bullet list of human-readable reasons for the audit log. */
  reasons:           string[];
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Population → demand score (0-40). Uses a log curve so a town of 50k
 * isn't 10× a town of 5k — diminishing returns reflect how locksmith
 * demand scales sub-linearly with population.
 */
export function populationToDemandScore(population: number): number {
  if (population <= 0) return 0;
  // ln(1k) ≈ 6.9, ln(100k) ≈ 11.5
  const ln = Math.log(Math.max(1000, population));
  // Map ln(1k)=6.9 → 5 points, ln(50k)=10.8 → ~30 points
  const raw = (ln - 6.5) * 7;
  return Math.max(0, Math.min(40, raw));
}

/**
 * Region → strategic-fit boost. Commuter_belt + london get the most
 * because the anti-shark thesis lands hardest where customers are
 * high-income, sceptical of dodgy quotes, and call instead of DIY.
 */
export function regionToBoost(region: UkRegion): number {
  switch (region) {
    case "commuter_belt":     return 20;
    case "london":            return 18;
    case "north_west":        return 14;
    case "south_east":        return 14;
    case "midlands":          return 12;
    case "scotland":          return 12;
    case "north_east":        return 10;
    case "south_west":        return 10;
    case "wales":             return  6;
    case "northern_ireland":  return  4;
    default:                  return  0;
  }
}

/**
 * Shark mean confidence + top CPC → pressure boost (0-25).
 * High shark density on high CPC = great opportunity for LockSafe to
 * undercut on honesty. No signal at all = neutral (0).
 */
export function sharkSignalToBoost(signal?: SharkPressureSignal): number {
  if (!signal) return 0;
  // Density 0-1 contributes up to 15
  const density = Math.max(0, Math.min(1, signal.meanShark)) * 15;
  // Top CPC > £4 = +10 (sharks are paying premium for clicks here)
  const cpcBoost = signal.topCpcGbp !== null && signal.topCpcGbp >= 4 ? 10
                  : signal.topCpcGbp !== null && signal.topCpcGbp >= 2.5 ?  5
                  : 0;
  return Math.min(25, density + cpcBoost);
}

/**
 * Find the closest existing locksmith to a given outcode centroid.
 * Returns the locksmith + miles if any are within `maxMiles` of the
 * outcode centroid; otherwise null.
 *
 * Used to flip a recommendation from "new_hire" to "radius_extend" when
 * an existing locksmith is close enough to expand their service area.
 */
export function findNearestLocksmith(
  outcode:      OutcodeReference,
  locksmiths:   ExistingLocksmithLocation[],
  maxMiles:     number,
): { locksmith: ExistingLocksmithLocation; distanceMi: number } | null {
  let best: { locksmith: ExistingLocksmithLocation; distanceMi: number } | null = null;
  for (const ls of locksmiths) {
    const d = haversineMiles(outcode.lat, outcode.lng, ls.lat, ls.lng);
    if (d > maxMiles) continue;
    if (!best || d < best.distanceMi) best = { locksmith: ls, distanceMi: d };
  }
  return best;
}

// ── Main scorer ─────────────────────────────────────────────────────────────

/** Threshold below which we suggest radius-extend rather than new-hire. */
const RADIUS_EXTEND_MAX_MI = 12;

export function recommendRecruitmentTargets(options: RecommenderOptions): Recommendation[] {
  const covered = new Set(
    options.coveredOutcodes.map((c) => c.toUpperCase()),
  );
  const locksmiths   = options.existingLocksmithLocations ?? [];
  const sharkSignals = new Map(
    (options.sharkSignals ?? []).map((s) => [s.outcode.toUpperCase(), s]),
  );
  const regionFilter = options.regionFilter
    ? new Set(options.regionFilter)
    : null;
  const limit = options.limit ?? 20;

  const candidates: Recommendation[] = [];

  for (const outcode of UK_OUTCODES) {
    // Already covered → skip entirely (the point of the recommender)
    if (covered.has(outcode.outcode.toUpperCase())) continue;
    // Region filter
    if (regionFilter && !regionFilter.has(outcode.region)) continue;

    const demandScore        = populationToDemandScore(outcode.populationEst);
    const sharkPressureBoost = sharkSignalToBoost(sharkSignals.get(outcode.outcode.toUpperCase()));
    const regionBoost        = regionToBoost(outcode.region);

    // Identify nearest existing locksmith (informs action + reason text)
    const nearest = findNearestLocksmith(outcode, locksmiths, RADIUS_EXTEND_MAX_MI);

    let recommendation: RecommendationKind;
    let nearExistingAdjust = 0;
    if (nearest) {
      // Existing locksmith within 12mi → suggest radius extend, not new hire.
      // Small score penalty so brand-new-territory recommendations rank
      // above radius-extends (radius-extends are easier wins ops can
      // handle in minutes, but they're "free" so they don't need the
      // higher score to bubble up).
      nearExistingAdjust = -5;
      recommendation = {
        action:        "radius_extend",
        locksmithId:   nearest.locksmith.id,
        locksmithName: nearest.locksmith.name,
        distanceMi:    Math.round(nearest.distanceMi * 10) / 10,
      };
    } else {
      recommendation = { action: "new_hire" };
    }

    const score = Math.max(0, Math.min(100,
      demandScore + sharkPressureBoost + regionBoost + nearExistingAdjust,
    ));

    const reasons: string[] = [];
    reasons.push(`pop≈${outcode.populationEst.toLocaleString()} → demand ${demandScore.toFixed(1)}`);
    reasons.push(`region=${outcode.region} → boost +${regionBoost}`);
    if (sharkPressureBoost > 0) {
      const sig = sharkSignals.get(outcode.outcode.toUpperCase());
      const sharkDesc = sig
        ? `shark density ${(sig.meanShark * 100).toFixed(0)}%${sig.topCpcGbp ? `, top CPC £${sig.topCpcGbp}` : ""}`
        : "shark signal present";
      reasons.push(`${sharkDesc} → boost +${sharkPressureBoost.toFixed(1)}`);
    }
    if (nearest) {
      reasons.push(
        `${recommendation.locksmithName} is ${recommendation.distanceMi}mi away — try radius extend first`,
      );
    } else {
      reasons.push("no existing locksmith within commute distance — new hire needed");
    }

    candidates.push({
      outcode:       outcode.outcode,
      primaryCity:   outcode.primaryCity,
      region:        outcode.region,
      populationEst: outcode.populationEst,
      score:         Math.round(score * 10) / 10,
      components: { demandScore, sharkPressureBoost, regionBoost },
      recommendation,
      reasons,
    });
  }

  // Sort by score desc; stable on outcode for determinism
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.outcode.localeCompare(b.outcode);
  });

  return candidates.slice(0, limit);
}

// ── Convenience: partition into new-hire vs radius-extend ───────────────────

export function partitionRecommendations(
  recs: Recommendation[],
): { newHires: Recommendation[]; radiusExtends: Recommendation[] } {
  const newHires:      Recommendation[] = [];
  const radiusExtends: Recommendation[] = [];
  for (const r of recs) {
    (r.recommendation.action === "new_hire" ? newHires : radiusExtends).push(r);
  }
  return { newHires, radiusExtends };
}

// Re-export so consumers don't need to dig into the reference module
export { UK_OUTCODES, UK_OUTCODES_BY_CODE };
