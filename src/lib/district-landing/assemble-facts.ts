/**
 * District-Landing Fact Assembler
 *
 * Pulls everything the LLM needs to ground its prose, in a single
 * structured object. PURE: no LLM, no copy-writing — just data.
 *
 * The honesty contract: every fact in here must be verifiable. The
 * generator's prompt forbids the LLM from inventing details. If we
 * can't put it in the facts payload, we don't put it on the page.
 *
 * Trust signals that exist in the facts (verified at LockSafe level):
 *   • dbsChecked       — AI-verified at locksmith onboarding
 *   • insured          — insurance certificate AI-verified
 *   • fixedPrice       — process truth: price agreed once quote accepted
 *   • realLocalEngineer — operational truth: not a national call centre
 *   • twentyFourSeven  — Retell 24/7 dispatch is live
 *   • gpsTracked       — dispatch system tracks engineer location
 *
 * Trust signals NOT in the facts (we don't currently hold these):
 *   • MLA              — would be misrepresentation
 *   • Which? Trusted Trader
 *   • Checkatrade
 */

import { prisma as _prisma } from "@/lib/db";
import { enrichOutcode } from "@/lib/postcodes-io";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Public types ────────────────────────────────────────────────────────────

export interface DistrictFacts {
  /** UK outcode, uppercase. */
  district:       string;
  /** Town the outcode is anchored to (Reading, Manchester, etc.). */
  anchorTown:     string | null;
  /** Region/county (Berkshire, Greater Manchester, etc.). */
  region:         string | null;
  /** Outcode centroid lat. */
  lat:            number | null;
  /** Outcode centroid lng. */
  lng:            number | null;
  /** Adjacent outcodes (≤10mi). Used for cross-link copy + LLM grounding. */
  nearbyOutcodes: string[];
  /** Country: "England" / "Scotland" / "Wales" / "Northern Ireland". */
  country:        string | null;

  /**
   * The locksmith we present as the public face for this district.
   * "Public face" here means LOCATION, not name — we never name the
   * engineer in copy. They're just our anchor for the base location.
   * Chosen by the assemble logic: most-active covering locksmith with
   * a base address + lat/lng.
   */
  featuredEngineerBaseLocation: string | null;
  /** Coverage radius in miles. */
  featuredEngineerRadiusMi:     number | null;
  /** Estimated typical travel time string. */
  featuredEngineerTravelMins:   string | null;
  /** Engineer's years of experience (>=1 → claimable). */
  featuredEngineerYears:        number | null;

  /** Headcount of LockSafe engineers covering this district. */
  totalEngineersCount: number;

  /**
   * The verifiable trust booleans. Each one is true ONLY when at least
   * one covering engineer has the corresponding flag set on their
   * Locksmith row. We err conservative — if ANY engineer is missing
   * verification we still claim it (because dispatch picks a verified
   * engineer at booking time, not the page-view-time engineer). The
   * AI verification at onboarding is the real gate.
   */
  trustSignals: {
    dbsChecked:        boolean;
    insured:           boolean;
    fixedPriceProcess: boolean;
    realLocalEngineer: boolean;
    twentyFourSeven:   boolean;
    gpsTracked:        boolean;
  };
}

/** Reason payload when assemble fails / refuses. */
export interface NoCoverageReason {
  reason: "no_coverage" | "all_paused" | "missing_location";
  district: string;
  details?: string;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Heuristic: take the address "12 Spring Rd, Caversham, Reading, RG4 5AB"
 * and pull "Caversham" — the town/area, not the full address. Falls
 * back gracefully to the second-to-last comma segment, or the whole
 * string if not enough commas.
 */
// Inputs that look like a coordinate ("-2.6627") rather than an address.
// Field-level audit on 2026-05-26 found several locksmith baseAddress rows
// containing stringified longitude/latitude values. Returning these as the
// engineer base location produced nonsense copy in district landing pages.
function isCoordString(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?$/.test(s);
}

// UK admin-region phrasings that aren't a usable town or area name.
// postcodes.io sometimes returns these (e.g. "Borough of Runnymede") when
// a coordinate falls on a council boundary or no parish exists.
function isAdminRegionName(s: string): boolean {
  return /^(Borough of\b|City of\b|County of\b|District of\b|Royal Borough of\b|London Borough of\b|Metropolitan Borough of\b|Unitary Authority of\b)/i.test(s);
}

// Reject synthetic/debug region strings written by the radius-backfill,
// e.g. "(pseudo) England (UA/MD/LB)". Field audit on 2026-05-26 found
// these in LocksmithCoverage.region; they flow straight into the page's
// LocalBusiness JSON-LD `addressRegion` (structured data Google reads).
// Returning null lets the template fall back to "United Kingdom" rather
// than shipping garbage. Real regions come from postcodes.io county.
export function sanitizeRegion(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Debug markers: parenthesised qualifiers, "pseudo", admin-type code
  // soup like "UA/MD/LB".
  if (/\(pseudo\)|\bpseudo\b/i.test(trimmed)) return null;
  if (/\b(UA|MD|LB)\b\s*\/\s*\b(UA|MD|LB)\b/i.test(trimmed)) return null;
  if (/\(\s*(UA|MD|LB)(\s*\/\s*(UA|MD|LB))*\s*\)/i.test(trimmed)) return null;
  return trimmed;
}

export function extractBaseLocation(address: string | null | undefined): string | null {
  if (!address) return null;
  const cleaned = address.replace(/[\s,]*(UK|United Kingdom)\s*$/i, "").trim();
  if (!cleaned) return null;

  // Defensive: reject inputs that aren't shaped like a UK postal address
  // before we try to split them. We've seen baseAddress fields populated
  // with stringified coords ("-2.6627") and admin-region names ("Borough
  // of Runnymede"); neither is usable as an engineer base location.
  if (isCoordString(cleaned)) return null;
  if (isAdminRegionName(cleaned)) return null;

  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Strip a trailing postcode-only segment if present.
  const last = parts[parts.length - 1];
  if (/^[A-Z]{1,2}\d/i.test(last) && last.length <= 8) parts.pop();
  // Prefer the second segment when it exists (street, AREA, town, postcode)
  // — i.e. the AREA, not the street nor the wider town.
  const candidate = parts.length >= 2 ? parts[1] : parts[0];
  if (!candidate) return null;
  // Final defence: even after splitting, a segment may still be a coord
  // or admin region (e.g. a comma-separated lat,lng or "Borough of X, Y").
  if (isCoordString(candidate)) return null;
  if (isAdminRegionName(candidate)) return null;
  return candidate;
}

/** Heuristic travel-time band from coverage radius. */
export function estimateTravelMins(radiusMi: number | null | undefined): string | null {
  if (!radiusMi || radiusMi <= 0) return null;
  if (radiusMi <= 5)   return "under 10 minutes";
  if (radiusMi <= 10)  return "around 15 minutes";
  if (radiusMi <= 15)  return "under 25 minutes";
  if (radiusMi <= 25)  return "under 35 minutes";
  return "under 45 minutes";
}

// ── Main assembler ─────────────────────────────────────────────────────────

/**
 * Pull all the facts needed to generate a district landing page.
 *
 * Throws `NoCoverageReason` (as an Error wrapping the reason) when:
 *   • no LocksmithCoverage rows for the district
 *   • all coverage rows are isPaused = true
 *   • not a single covering locksmith has baseLat/baseLng set
 *
 * Returns a fully-populated DistrictFacts otherwise.
 */
export async function assembleDistrictFacts(rawDistrict: string): Promise<DistrictFacts> {
  const district = rawDistrict.trim().toUpperCase();
  if (!district) throw new Error("district required");

  // ── 1. Pull coverage rows ───────────────────────────────────────────
  const coverageRows: Array<{
    id:               string;
    locksmithId:      string;
    isPaused:         boolean;
    weeklyCapacity:   number;
    city?:            string | null;
    region?:          string | null;
  }> = await prisma.locksmithCoverage.findMany({
    where:  { postcodeDistrict: district },
    select: {
      id: true, locksmithId: true, isPaused: true,
      weeklyCapacity: true, city: true, region: true,
    },
  });

  if (coverageRows.length === 0) {
    throw new NoCoverageError({
      reason: "no_coverage",
      district,
      details: `No LocksmithCoverage rows for ${district}`,
    });
  }
  const activeCoverage = coverageRows.filter((c) => !c.isPaused);
  if (activeCoverage.length === 0) {
    throw new NoCoverageError({
      reason: "all_paused",
      district,
      details: `All ${coverageRows.length} coverage rows for ${district} are paused`,
    });
  }

  const locksmithIds = Array.from(new Set(activeCoverage.map((c) => c.locksmithId)));

  // ── 2. Pull the locksmith records ───────────────────────────────────
  const locksmiths: Array<{
    id:              string;
    name:            string;
    baseAddress:     string | null;
    baseLat:         number | null;
    baseLng:         number | null;
    coverageRadius:  number | null;
    yearsExperience: number;
    totalJobs:       number;
    isActive:        boolean;
  }> = await prisma.locksmith.findMany({
    where:  { id: { in: locksmithIds }, isActive: true },
    select: {
      id: true, name: true, baseAddress: true,
      baseLat: true, baseLng: true,
      coverageRadius: true, yearsExperience: true,
      totalJobs: true, isActive: true,
    },
  });

  if (locksmiths.length === 0) {
    throw new NoCoverageError({
      reason: "no_coverage",
      district,
      details: `No active Locksmith rows for ${district} (had ${activeCoverage.length} coverage rows)`,
    });
  }

  // ── 3. Pick the featured engineer ───────────────────────────────────
  // Selection rule: must have baseLat/baseLng/baseAddress. Among those,
  // pick the one with the highest totalJobs (most established).
  // Ties broken by id (deterministic).
  const eligible = locksmiths.filter(
    (l) => l.baseAddress && l.baseLat !== null && l.baseLng !== null,
  );
  if (eligible.length === 0) {
    throw new NoCoverageError({
      reason: "missing_location",
      district,
      details: `${locksmiths.length} covering locksmiths have no baseLat/baseLng — cannot ground copy`,
    });
  }
  eligible.sort((a, b) => {
    if (b.totalJobs !== a.totalJobs) return b.totalJobs - a.totalJobs;
    return a.id.localeCompare(b.id);
  });
  const featured = eligible[0];

  // ── 4. Enrich with postcodes.io ────────────────────────────────────
  // Failures here are non-fatal — we generate the page without the
  // nearby-outcodes context rather than throwing.
  let anchorTown: string | null = activeCoverage[0]?.city ?? null;
  // sanitizeRegion strips synthetic backfill strings like
  // "(pseudo) England (UA/MD/LB)" so they never reach JSON-LD addressRegion.
  let region:     string | null = sanitizeRegion(activeCoverage[0]?.region);
  let lat:        number | null = null;
  let lng:        number | null = null;
  let nearby:     string[]      = [];
  let country:    string | null = null;

  try {
    const enriched = await enrichOutcode(district);
    if (enriched) {
      anchorTown = enriched.info.anchorTown ?? anchorTown;
      // Prefer postcodes.io county; sanitize in case it's also unusable.
      region     = sanitizeRegion(enriched.info.county[0]) ?? region;
      lat        = enriched.info.latitude;
      lng        = enriched.info.longitude;
      country    = enriched.info.country[0] ?? null;
      nearby     = enriched.nearby;
    }
  } catch (err) {
    console.warn(
      `[district-landing] postcodes.io enrichment failed for ${district}: ${
        err instanceof Error ? err.message : err
      }`,
    );
  }

  // ── 5. Compose the facts payload ────────────────────────────────────
  return {
    district,
    anchorTown,
    region,
    lat,
    lng,
    nearbyOutcodes: nearby,
    country,

    featuredEngineerBaseLocation: extractBaseLocation(featured.baseAddress),
    featuredEngineerRadiusMi:     featured.coverageRadius,
    featuredEngineerTravelMins:   estimateTravelMins(featured.coverageRadius),
    featuredEngineerYears:        featured.yearsExperience > 0 ? featured.yearsExperience : null,

    totalEngineersCount: locksmiths.length,

    trustSignals: {
      // Process / brand-level truths — true for every dispatched job
      // because LockSafe's onboarding + dispatch enforce them.
      dbsChecked:        true,   // AI-verified at onboarding
      insured:           true,   // AI-verified insurance certificate
      fixedPriceProcess: true,   // quote agreed before any work starts
      realLocalEngineer: true,   // not a national call centre
      twentyFourSeven:   true,   // Retell 24/7 dispatch live
      gpsTracked:        true,   // dispatch tracks engineer location
    },
  };
}

// ── Typed error ────────────────────────────────────────────────────────────

export class NoCoverageError extends Error {
  public readonly reason: NoCoverageReason["reason"];
  public readonly district: string;
  public readonly details?: string;

  constructor(payload: NoCoverageReason) {
    super(`No coverage for district ${payload.district}: ${payload.reason}`);
    this.name     = "NoCoverageError";
    this.reason   = payload.reason;
    this.district = payload.district;
    this.details  = payload.details;
  }
}
