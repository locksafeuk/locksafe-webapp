/**
 * Coverage Universe — the set of UK cities/boroughs eligible for the
 * Opportunity Scout to evaluate.
 *
 * A city enters the universe when at least one fully-onboarded, admin-verified,
 * Stripe-Connect-ready locksmith can service it. Eligibility is computed two
 * ways and unioned:
 *
 *   1. **Home city** — the city the locksmith's `baseAddress` (or
 *      `baseLat/baseLng` fallback) resolves to via `resolveLocksmithGeo()`.
 *   2. **Radius expansion** — every entry in `UK_CITY_CENTROIDS` within
 *      `coverageRadius` miles (default 30) of the locksmith's home centroid.
 *      Boroughs without coords are excluded from radius checks (their home-
 *      city locksmiths still anchor them via step 1).
 *
 * The result powers both the Opportunity Scout (which geos to call the
 * Google Keyword Planner against) and the Recruit-Here report (geos with
 * high opportunity score and `locksmithCount === 0`).
 */

import prisma from "@/lib/db";
import {
  UK_GEO_IDS,
  UK_CITY_CENTROIDS,
  type UKGeoKey,
  haversineMiles,
  resolveLocksmithGeo,
} from "@/lib/google-ads-locations";

export interface CoverageUniverseEntry {
  /** Google Ads GeoTargetConstant numeric ID. */
  geoId: string;
  /** UK_GEO_IDS key (lowercase). */
  cityKey: UKGeoKey;
  /** Display label (Title Case). */
  label: string;
  /** Number of eligible locksmiths whose home city resolves here OR who cover it via radius. */
  locksmithCount: number;
  /** Number of those locksmiths whose HOME city this is (the "anchor" cohort). */
  homeLocksmithCount: number;
  /** Ids of all locksmiths in this geo's coverage cohort. */
  locksmithIds: string[];
  /** Sum of totalJobs across the cohort. */
  totalJobs: number;
  /** Average rating across the cohort (0 when cohort has no rated locksmiths). */
  avgRating: number;
}

export interface CoverageUniverse {
  /** Geos with at least one eligible locksmith. */
  entries: CoverageUniverseEntry[];
  /** UK_CITY_CENTROIDS keys with ZERO eligible locksmiths — input for the recruit-here report. */
  uncoveredCityKeys: UKGeoKey[];
  /** Total eligible locksmiths considered. */
  eligibleLocksmithCount: number;
}

const DEFAULT_RADIUS_MILES = 30;

interface LocksmithCohortRow {
  id: string;
  baseAddress: string | null;
  baseLat: number | null;
  baseLng: number | null;
  coverageRadius: number | null;
  totalJobs: number | null;
  rating: number | null;
}

/**
 * Build the coverage universe. Pulls every active+verified+onboarded+Stripe-
 * Connect locksmith once and joins them to geos via home-city resolution +
 * radius expansion.
 *
 * `radiusOverrideMiles` lets callers force a uniform radius (useful for tests
 * or when a locksmith hasn't set `coverageRadius`). Otherwise each locksmith's
 * own `coverageRadius` is used, falling back to `DEFAULT_RADIUS_MILES`.
 */
export async function getCoverageUniverse(opts?: {
  radiusOverrideMiles?: number;
}): Promise<CoverageUniverse> {
  const locksmiths = (await prisma.locksmith.findMany({
    where: {
      isActive: true,
      isVerified: true,
      onboardingCompleted: true,
      stripeConnectVerified: true,
    },
    select: {
      id: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
      totalJobs: true,
      rating: true,
    },
  })) as LocksmithCohortRow[];

  // Per-geo accumulator: union of locksmith IDs reachable via home-city OR radius.
  const byGeo = new Map<
    string,
    {
      cityKey: UKGeoKey;
      locksmithIds: Set<string>;
      homeLocksmithIds: Set<string>;
      totalJobs: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  const ensure = (cityKey: UKGeoKey) => {
    const geoId = UK_GEO_IDS[cityKey];
    let bucket = byGeo.get(geoId);
    if (!bucket) {
      bucket = {
        cityKey,
        locksmithIds: new Set(),
        homeLocksmithIds: new Set(),
        totalJobs: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      byGeo.set(geoId, bucket);
    }
    return bucket;
  };

  for (const ls of locksmiths) {
    const resolved = resolveLocksmithGeo({
      baseAddress: ls.baseAddress,
      baseLat: ls.baseLat,
      baseLng: ls.baseLng,
    });
    if (!resolved) continue;

    // Step 1 — anchor the locksmith at their home city.
    const home = ensure(resolved.cityKey);
    home.homeLocksmithIds.add(ls.id);
    home.locksmithIds.add(ls.id);
    home.totalJobs += ls.totalJobs ?? 0;
    if (typeof ls.rating === "number" && ls.rating > 0) {
      home.ratingSum += ls.rating;
      home.ratingCount += 1;
    }

    // Step 2 — radius expansion over UK_CITY_CENTROIDS.
    const radiusMiles = Math.max(
      1,
      opts?.radiusOverrideMiles ?? ls.coverageRadius ?? DEFAULT_RADIUS_MILES,
    );
    const anchorCoords = UK_CITY_CENTROIDS[resolved.cityKey] ??
      (typeof ls.baseLat === "number" && typeof ls.baseLng === "number"
        ? { lat: ls.baseLat, lng: ls.baseLng }
        : null);
    if (!anchorCoords) continue;

    for (const [otherKey, otherCoords] of Object.entries(UK_CITY_CENTROIDS)) {
      if (otherKey === resolved.cityKey) continue;
      if (!(otherKey in UK_GEO_IDS)) continue;
      const miles = haversineMiles(anchorCoords, otherCoords);
      if (miles > radiusMiles) continue;
      const bucket = ensure(otherKey as UKGeoKey);
      // Don't double-count rating/jobs — only the home city counts those.
      bucket.locksmithIds.add(ls.id);
    }
  }

  const entries: CoverageUniverseEntry[] = Array.from(byGeo.entries())
    .map(([geoId, b]) => ({
      geoId,
      cityKey: b.cityKey,
      label: titleCase(b.cityKey),
      locksmithCount: b.locksmithIds.size,
      homeLocksmithCount: b.homeLocksmithIds.size,
      locksmithIds: Array.from(b.locksmithIds),
      totalJobs: b.totalJobs,
      avgRating: b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0,
    }))
    .sort((a, b) => b.locksmithCount - a.locksmithCount);

  const coveredKeys = new Set(entries.map((e) => e.cityKey));
  const uncoveredCityKeys = (Object.keys(UK_CITY_CENTROIDS) as UKGeoKey[])
    .filter((k) => k in UK_GEO_IDS && !coveredKeys.has(k));

  return {
    entries,
    uncoveredCityKeys,
    eligibleLocksmithCount: locksmiths.length,
  };
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
