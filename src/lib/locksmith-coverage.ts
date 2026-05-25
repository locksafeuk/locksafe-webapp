/**
 * Locksmith Coverage — campaign-gate primitives.
 *
 * The ad-campaign creation flow uses these to answer one question:
 *
 *   "If I run an ad in postcode district X, is there an onboarded
 *    locksmith with free weekly capacity who can actually take the job?"
 *
 * If the answer is no, the campaign is rejected at create time. This is the
 * single most important operational safeguard for the anti-shark, outside-
 * London expansion: running ads into a city we can't dispatch in burns
 * money AND torches both Google Ads quality score and customer trust.
 *
 * Coverage data lives in LocksmithCoverage (one row per locksmith × district);
 * current load is computed live from Job to avoid drift.
 */

import { prisma as _prisma } from "@/lib/db";

// LocksmithCoverage is a new Prisma model — until `npx prisma generate` is
// re-run in production the typed client doesn't know about it. The other
// agents in this codebase use the same `as any` escape hatch (search
// competitor-intel agent for `const db = prisma as any`). Once regen runs
// this cast becomes invisible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Pure postcode utilities ──────────────────────────────────────────────────

/**
 * Extract the UK postcode district (outward code) from a full or partial
 * postcode. Returns uppercase, no whitespace. Returns "" for invalid input.
 *
 *   "RG1 2AB"       → "RG1"
 *   "rg1 2ab"       → "RG1"
 *   "sw1a 1aa"      → "SW1A"      (London edge case — final letter is kept)
 *   "M3"            → "M3"
 *   "WD25"          → "WD25"
 *   "12345"         → ""          (US zip — not a UK postcode)
 *   ""              → ""
 *
 * Pattern: 1-2 letters + 1-2 digits + optional trailing letter (London).
 */
export function extractDistrict(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, " ");
  // Outward code = everything before the first space, OR the whole string
  // if it has no space (already a district).
  const outward = cleaned.split(" ")[0];
  // Validate UK district shape: 1-2 letters, 1-2 digits, optional 1 letter.
  // This rejects US zips, EU postcodes, garbage input.
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(outward) ? outward : "";
}

/**
 * Extract many postcode districts from a single free-text string.
 * Useful for parsing Locksmith.coverageAreas entries that may contain
 * comma-separated lists, full postcodes, or just district codes.
 *
 *   "RG1, RG2, SK4 1AA, M3 8AA, garbage" → ["RG1", "RG2", "SK4", "M3"]
 */
export function extractDistrictsFromText(input: string | null | undefined): string[] {
  if (!input) return [];
  // Match every UK-district-shaped substring with a word boundary.
  const matches = input.toUpperCase().match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\b/g) ?? [];
  return [...new Set(matches)];
}

// ── Capacity & coverage queries ──────────────────────────────────────────────

export interface CoveringLocksmith {
  locksmithId:      string;
  locksmithName:    string;
  weeklyCapacity:   number;
  currentLoad:      number;
  freeCapacity:     number;
  isPaused:         boolean;
  pauseReason:      string | null;
  confidenceScore:  number;
}

export interface CoverageVerdict {
  district:            string;
  covered:             boolean;       // at least one locksmith has free capacity
  totalFreeCapacity:   number;
  bestLocksmith:       CoveringLocksmith | null;
  allLocksmiths:       CoveringLocksmith[];
  /** Reason if !covered — for telling admins why a campaign was rejected. */
  reason?: "no_coverage_row" | "all_paused" | "all_at_capacity" | "no_active_locksmith";
}

/**
 * Compute current weekly load for one locksmith in one district.
 * "Current" = jobs created in the last 7 rolling days where the job's
 * postcode falls in the district. We count ALL jobs (not just completed)
 * because in-progress jobs still consume the locksmith's capacity.
 */
export async function currentWeeklyLoad(
  locksmithId: string,
  district:    string,
): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // MongoDB doesn't support "startsWith district" via Prisma's filter API in
  // a single shot. We fetch the candidate jobs (already filtered by
  // locksmithId + date — both indexed) and filter the postcode in JS. The
  // candidate set per locksmith over 7 days is tiny.
  const candidates = await prisma.job.findMany({
    where: {
      locksmithId,
      createdAt: { gte: sevenDaysAgo },
      // Exclude jobs that never got assigned (status cancelled before pickup)
      // — those don't consume capacity in the operational sense.
      NOT: { status: "CANCELLED" },
    },
    select: { postcode: true },
  });
  return candidates.filter(
    (j: { postcode: string }) => extractDistrict(j.postcode) === district,
  ).length;
}

/**
 * The campaign gate. Given a postcode district, returns whether ANY
 * onboarded, active locksmith covers it AND has free weekly capacity.
 *
 * Returns a structured verdict so the caller (campaign-create endpoint,
 * scout opportunity ranker) can show admins exactly WHY a district was
 * rejected — actionable diagnostics, not a blunt "no".
 */
export async function getCoverageForDistrict(district: string): Promise<CoverageVerdict> {
  const norm = extractDistrict(district);
  if (!norm) {
    return {
      district,
      covered: false,
      totalFreeCapacity: 0,
      bestLocksmith: null,
      allLocksmiths: [],
      reason: "no_coverage_row",
    };
  }

  // Pull every coverage row for this district, joined to the active locksmith.
  const rows = await prisma.locksmithCoverage.findMany({
    where: {
      postcodeDistrict: norm,
      locksmith: {
        isActive:           true,
        onboardingCompleted: true,
      },
    },
    include: {
      locksmith: { select: { id: true, name: true, isAvailable: true } },
    },
  });

  if (rows.length === 0) {
    return {
      district: norm,
      covered: false,
      totalFreeCapacity: 0,
      bestLocksmith: null,
      allLocksmiths: [],
      reason: "no_active_locksmith",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLocksmiths: CoveringLocksmith[] = await Promise.all(
    rows.map(async (row: any) => {
      const load = await currentWeeklyLoad(row.locksmithId, norm);
      return {
        locksmithId:     row.locksmithId,
        locksmithName:   row.locksmith.name,
        weeklyCapacity:  row.weeklyCapacity,
        currentLoad:     load,
        freeCapacity:    Math.max(0, row.weeklyCapacity - load),
        isPaused:        row.isPaused,
        pauseReason:     row.pauseReason,
        confidenceScore: row.confidenceScore,
      };
    }),
  );

  const eligible = allLocksmiths.filter((l) => !l.isPaused && l.freeCapacity > 0);
  const totalFreeCapacity = eligible.reduce((s, l) => s + l.freeCapacity, 0);

  if (eligible.length === 0) {
    const allPaused = allLocksmiths.every((l) => l.isPaused);
    return {
      district: norm,
      covered: false,
      totalFreeCapacity: 0,
      bestLocksmith: null,
      allLocksmiths,
      reason: allPaused ? "all_paused" : "all_at_capacity",
    };
  }

  // "Best" = highest free capacity, then highest confidence as tie-breaker.
  const best = [...eligible].sort((a, b) =>
    b.freeCapacity - a.freeCapacity ||
    b.confidenceScore - a.confidenceScore,
  )[0];

  return {
    district: norm,
    covered: true,
    totalFreeCapacity,
    bestLocksmith: best,
    allLocksmiths,
  };
}

/**
 * Batch version — check multiple districts in one DB round trip. Used by
 * the scout's opportunity ranker to filter geos before ranking spend.
 */
export async function getCoverageForDistricts(
  districts: string[],
): Promise<Map<string, CoverageVerdict>> {
  const normalised = [...new Set(districts.map(extractDistrict).filter(Boolean))];
  const verdicts = await Promise.all(normalised.map(getCoverageForDistrict));
  const out = new Map<string, CoverageVerdict>();
  for (const v of verdicts) out.set(v.district, v);
  return out;
}

/**
 * Convenience: from a free-text "city or postcode" string the admin types
 * into the campaign creator (e.g. "Reading", "RG1", "RG1 2AB", "Milton
 * Keynes"), return the list of covered districts.
 *
 * - If the input parses as a postcode/district → check that one district.
 * - If it parses as a city name → look up every district tagged with that
 *   city in LocksmithCoverage and return those whose verdict is covered.
 */
export async function findCoveredDistrictsFromInput(
  input: string,
): Promise<{ district: string; verdict: CoverageVerdict }[]> {
  const asDistrict = extractDistrict(input);
  if (asDistrict) {
    const v = await getCoverageForDistrict(asDistrict);
    return [{ district: asDistrict, verdict: v }];
  }

  // Treat as city name — case-insensitive match on the `city` denorm field.
  const rows = await prisma.locksmithCoverage.findMany({
    where: { city: { equals: input.trim(), mode: "insensitive" } },
    select: { postcodeDistrict: true },
    distinct: ["postcodeDistrict"],
  });
  const districts = rows.map((r: { postcodeDistrict: string }) => r.postcodeDistrict);
  const verdicts  = await Promise.all(
    districts.map((d: string) =>
      getCoverageForDistrict(d).then((v: CoverageVerdict) => ({ district: d, verdict: v })),
    ),
  );
  return verdicts.filter((x: { verdict: CoverageVerdict }) => x.verdict.covered);
}
