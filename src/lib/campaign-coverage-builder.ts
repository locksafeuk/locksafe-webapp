/**
 * Campaign Coverage Builder — calibrates Google Ads geo targeting to
 * actual locksmith coverage.
 *
 * THE PROBLEM (2026-06-06 incident)
 * ─────────────────────────────────
 * The Liverpool Test campaign spent £82.52 / 14 clicks / 0 conversions
 * before being paused. £165.85 last 7 days, 26 clicks, 0 conversions
 * account-wide. Last 30 days: 7 jobs flagged `noLocksmithAvailable` —
 * customers landed, tried to book, no locksmith could reach them.
 *
 * Google Ads was serving ads to postcodes where no locksmith could
 * physically attend. Every such click = guaranteed waste. No amount of
 * conversion tracking or bid optimisation can rescue a click that
 * structurally cannot convert.
 *
 * THE FIX (playbook §15 calibration)
 * ──────────────────────────────────
 * Restrict each campaign's `geoTargets` to UK cities where we have
 * actual coverage. A city qualifies only when at least
 * `MIN_LOCKSMITHS_PER_GEO` (default 2) ACTIVE locksmiths are within
 * `RADIUS_MILES` (default 10) of the city centroid.
 *
 * Two locksmiths is the floor for single-point-of-failure protection:
 * if one goes on holiday or pauses, the campaign still has coverage.
 * Cities with only one locksmith are deliberately excluded — too
 * fragile to spend on.
 *
 * THE COUPLING
 * ────────────
 * This module is the SOURCE end of the per-campaign drift detection
 * (playbook §15). The publish-verifier already catches drift between
 * live Google geo and `publishedSnapshot.geoTargets`. This module
 * ensures `geoTargets` is calibrated against reality at draft time.
 * Together the chain is: locksmith coverage → coverage builder →
 * draft.geoTargets → publishedSnapshot → drift verifier.
 *
 * Daily cron (`/api/cron/coverage-drift-check`) rebuilds coverage for
 * every PUBLISHED campaign. If a locksmith pauses/leaves and the
 * campaign's coverage now falls below MIN_LOCKSMITHS_PER_GEO for one
 * of its targets, that target is flagged for admin review (NOT
 * auto-mutated — admin makes the call).
 *
 * USER CHOICES locked in 2026-06-06:
 *   - Hard 10 miles for everyone (no per-locksmith override)
 *   - Exclude cities with <2 locksmith coverage
 *   - Pause first, rebuild, then unpause
 */

import {
  haversineMiles,
  UK_CITY_CENTROIDS,
  UK_GEO_IDS,
} from "@/lib/google-ads-locations";
import { prisma as _prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ─── Constants — locked by user choice 2026-06-06 ─────────────────────────

/**
 * Hard radius around each locksmith's base location, in miles. User
 * chose this as a single constant rather than per-locksmith
 * `coverageRadius` because the per-locksmith field is self-reported
 * during onboarding and untrusted. 10 miles is the conservative floor.
 */
export const RADIUS_MILES = 10 as const;

/**
 * Minimum number of distinct active locksmiths within RADIUS_MILES of
 * a city centroid for that city to qualify as a campaign geo target.
 * Two = single-point-of-failure protection (if one pauses, campaign
 * still has reach).
 */
export const MIN_LOCKSMITHS_PER_GEO = 2 as const;

// ─── Types ────────────────────────────────────────────────────────────────

export interface LocksmithCoveragePoint {
  /** Locksmith.id — used for audit + admin "who covers this city". */
  id: string;
  /** Display name for the admin UI. */
  name: string;
  /** Base location latitude — required (null = excluded from coverage). */
  baseLat: number;
  /** Base location longitude — required. */
  baseLng: number;
}

export interface CityCoverageEntry {
  /** Google Ads GeoTargetConstant ID, e.g. "1006514" for Manchester. */
  geoId: string;
  /** Human-readable city name from UK_GEO_IDS (lowercase). */
  cityName: string;
  /** City centroid lat/lng — used for distance from each locksmith. */
  centroid: { lat: number; lng: number };
  /** Number of active locksmiths within RADIUS_MILES of centroid. */
  locksmithCount: number;
  /** The locksmiths that cover this city. Length === locksmithCount. */
  covering: LocksmithCoveragePoint[];
  /** Whether this city is included in the eligible geoTargets list. */
  eligible: boolean;
  /** Reason if excluded — for admin visibility. */
  excludedReason?: "below_min_coverage" | "no_locksmiths";
}

export interface CoverageMap {
  /**
   * Geo IDs that pass the MIN_LOCKSMITHS_PER_GEO threshold. This is the
   * list to push into `draft.geoTargets` when creating a campaign.
   */
  eligibleGeoIds: string[];
  /** Every UK city we know about, eligible or not, with diagnostics. */
  entries: CityCoverageEntry[];
  /** Total ACTIVE locksmiths considered (with non-null coords). */
  activeLocksmithCount: number;
  /** Total ACTIVE locksmiths skipped due to missing coords. */
  skippedLocksmithCount: number;
  /** When the coverage was computed. */
  computedAt: Date;
}

// ─── Locksmith fetch ──────────────────────────────────────────────────────

/**
 * Active locksmiths with a usable base location. "Active" means
 * `isActive: true` — we deliberately ignore `isAvailable` because that
 * toggles minute-to-minute. A locksmith who's offline at 3am is still
 * coverage if they'll be on tomorrow.
 *
 * Onboarding-incomplete locksmiths are excluded (`onboardingCompleted`
 * may be false even when isActive is true — those can't take jobs).
 *
 * Returns ONLY the fields needed for coverage math, no PII.
 */
async function fetchActiveLocksmithsWithCoords(): Promise<LocksmithCoveragePoint[]> {
  const rows = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      onboardingCompleted: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      name: true,
      baseLat: true,
      baseLng: true,
    },
  });
  return rows
    .filter((r: { baseLat: number | null; baseLng: number | null }) =>
      typeof r.baseLat === "number" && typeof r.baseLng === "number"
    )
    .map((r: { id: string; name: string; baseLat: number; baseLng: number }) => ({
      id: r.id,
      name: r.name,
      baseLat: r.baseLat,
      baseLng: r.baseLng,
    }));
}

/**
 * Locksmiths who are isActive + onboardingCompleted but are MISSING
 * baseLat/baseLng — they'd potentially qualify for coverage if their
 * base location were set. Surfaces the recruitment+chase opportunity.
 *
 * Returns ONLY the fields needed for the admin "chase to set base
 * location" workflow.
 */
export interface MissingBaseLocationLocksmith {
  id: string;
  name: string;
  companyName: string | null;
  baseAddress: string | null;
  email: string;
  phone: string;
  totalJobs: number;
}

export async function fetchLocksmithsMissingBaseLocation(): Promise<
  Array<MissingBaseLocationLocksmith & {
    onboardingCompleted: boolean;
    isActive: boolean;
    hasAddressButNoCoords: boolean;
  }>
> {
  // Cast wider net: any isActive locksmith (regardless of onboarding state)
  // who lacks baseLat or baseLng. Surfaces both:
  //   • Fully onboarded but never set base location
  //   • In-onboarding locksmiths still to set base location
  //   • Locksmiths with a baseAddress but missing geocoded lat/lng
  //     (= address was entered but geocoding never resolved)
  const rows = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      OR: [
        { baseLat: null },
        { baseLng: null },
      ],
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      email: true,
      phone: true,
      totalJobs: true,
      onboardingCompleted: true,
      isActive: true,
    },
    orderBy: [{ onboardingCompleted: "desc" }, { totalJobs: "desc" }],
  });
  return rows.map((r: MissingBaseLocationLocksmith & {
    baseLat: number | null;
    baseLng: number | null;
    onboardingCompleted: boolean;
    isActive: boolean;
  }) => ({
    id: r.id,
    name: r.name,
    companyName: r.companyName ?? null,
    baseAddress: r.baseAddress ?? null,
    email: r.email,
    phone: r.phone,
    totalJobs: r.totalJobs ?? 0,
    onboardingCompleted: r.onboardingCompleted,
    isActive: r.isActive,
    // Geocoding failure signal: they entered an address but coords didn't
    // resolve. Distinct from "never set base location at all".
    hasAddressButNoCoords: !!r.baseAddress && (r.baseLat == null || r.baseLng == null),
  }));
}

// ─── Core builder ─────────────────────────────────────────────────────────

/**
 * Compute the coverage map for the entire UK city allowlist.
 *
 * Iterates every (cityName, geoId) pair in UK_GEO_IDS that has a
 * matching centroid in UK_CITY_CENTROIDS, counts how many active
 * locksmiths are within RADIUS_MILES of the centroid, and filters to
 * those above MIN_LOCKSMITHS_PER_GEO.
 *
 * No I/O caching — call directly from the cron or admin endpoint.
 * Locksmith count is small (<200 expected), city count is <60, so
 * the full computation is microseconds after the one DB read.
 */
export async function computeCoverageMap(opts: {
  /** Override locksmith fetch for tests. Production passes nothing. */
  locksmiths?: LocksmithCoveragePoint[];
  /** Override radius (default 10mi). Useful for "what-if" sims. */
  radiusMiles?: number;
  /** Override floor (default 2). Useful for "what-if" sims. */
  minLocksmithsPerGeo?: number;
} = {}): Promise<CoverageMap> {
  const computedAt = new Date();
  const radius = opts.radiusMiles ?? RADIUS_MILES;
  const floor = opts.minLocksmithsPerGeo ?? MIN_LOCKSMITHS_PER_GEO;

  const allLocksmiths = opts.locksmiths ?? (await fetchActiveLocksmithsWithCoords());
  const usable = allLocksmiths.filter(
    (l) => typeof l.baseLat === "number" && typeof l.baseLng === "number",
  );

  const entries: CityCoverageEntry[] = [];

  for (const [cityName, geoId] of Object.entries(UK_GEO_IDS)) {
    const centroid = UK_CITY_CENTROIDS[cityName];
    if (!centroid) {
      // City has a geo ID but no centroid — skip silently. Not every UK_GEO_IDS
      // entry has centroid coverage (boroughs, postcode districts).
      continue;
    }

    const covering = usable.filter(
      (l) => haversineMiles(centroid, { lat: l.baseLat, lng: l.baseLng }) <= radius,
    );
    const locksmithCount = covering.length;
    const eligible = locksmithCount >= floor;
    entries.push({
      geoId,
      cityName,
      centroid,
      locksmithCount,
      covering,
      eligible,
      excludedReason: eligible
        ? undefined
        : locksmithCount === 0
          ? "no_locksmiths"
          : "below_min_coverage",
    });
  }

  const eligibleGeoIds = entries.filter((e) => e.eligible).map((e) => e.geoId);

  return {
    eligibleGeoIds,
    entries,
    activeLocksmithCount: usable.length,
    skippedLocksmithCount: allLocksmiths.length - usable.length,
    computedAt,
  };
}

/**
 * Convenience: given a single requested geoId, return true if it's
 * currently eligible (coverage >= floor). Used by enforceDraftGuardrails
 * to reject draft.geoTargets containing uncovered cities.
 *
 * Returns null if the geoId is not in our city allowlist at all
 * (e.g. a borough or postcode-district ID we don't model coverage for).
 * Caller decides whether to treat null as "allow" or "reject".
 */
export async function isGeoIdCoveredByLocksmiths(
  geoId: string,
  opts: Parameters<typeof computeCoverageMap>[0] = {},
): Promise<boolean | null> {
  const map = await computeCoverageMap(opts);
  const entry = map.entries.find((e) => e.geoId === geoId);
  if (!entry) return null;
  return entry.eligible;
}

/**
 * Convenience: get the eligible geo IDs intersected with a requested
 * region. Used by Coverage Campaign and Opportunity Scout entrypoints
 * to pre-fill `draft.geoTargets`.
 *
 * `requestedCityNames` is a list of lowercase city names (matching
 * UK_GEO_IDS keys). Returns only the geo IDs for cities that are
 * BOTH in the request AND currently eligible.
 */
export async function coveredGeoIdsForCities(
  requestedCityNames: string[],
  opts: Parameters<typeof computeCoverageMap>[0] = {},
): Promise<{ included: string[]; excluded: string[] }> {
  const map = await computeCoverageMap(opts);
  const want = new Set(requestedCityNames.map((c) => c.toLowerCase().trim()));
  const included: string[] = [];
  const excluded: string[] = [];
  for (const entry of map.entries) {
    if (!want.has(entry.cityName)) continue;
    if (entry.eligible) included.push(entry.geoId);
    else excluded.push(entry.geoId);
  }
  return { included, excluded };
}
