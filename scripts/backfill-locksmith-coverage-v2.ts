/**
 * Locksmith coverage backfill v2 — radius-based.
 *
 * Reads baseLat/baseLng + coverageRadius (which all 43 active locksmiths
 * have, per the admin map view) and expands each into the postcode
 * districts the locksmith actually covers, using the free UK postcodes.io
 * /outcodes endpoint.
 *
 * v1 only read the legacy Locksmith.coverageAreas[] free-text field
 * (populated by 13 of 57 locksmiths) — that's why earlier coverage runs
 * only seeded 13 rows. v2 uses the same data source the admin UI uses.
 *
 * Idempotent: upserts on (locksmithId, postcodeDistrict). Safe to re-run.
 *
 * Run with:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/backfill-locksmith-coverage-v2.ts
 *
 * Dry-run preview:
 *   DRY_RUN=1 node_modules/.bin/ts-node ... v2.ts
 */

import * as path from "path";
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const DRY_RUN          = process.env["DRY_RUN"] === "1";
const DEFAULT_CAPACITY = Number(process.env["DEFAULT_CAPACITY"] ?? "5");
const REQ_DELAY_MS     = 250; // polite rate-limit
const MAX_RADIUS_MI    = 25;  // postcodes.io API cap

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PostcodesIoOutcode {
  outcode: string;       // e.g. "RG1"
  longitude: number;
  latitude: number;
  northings: number;
  eastings: number;
  admin_district: string[];
  parish: string[];
  admin_county: string[];
  admin_ward: string[];
  country: string[];
}

interface PostcodesIoResponse {
  status: number;
  result: PostcodesIoOutcode[] | null;
  error?: string;
}

/**
 * Query postcodes.io for all outcodes within `radiusMiles` of (lat, lng).
 * Returns outcode strings (e.g. ["RG1", "RG2", "RG30", ...]).
 * Returns [] on API error — caller can fall back.
 */
async function outcodesInRadius(
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<string[]> {
  const radiusMeters = Math.min(radiusMiles, MAX_RADIUS_MI) * 1609.34;
  const url =
    `https://api.postcodes.io/outcodes?lat=${lat}&lon=${lng}` +
    `&radius=${Math.round(radiusMeters)}&limit=100`;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const json = (await res.json()) as PostcodesIoResponse;
    if (json.status !== 200 || !json.result) {
      console.warn(`  postcodes.io returned status ${json.status}: ${json.error ?? "no result"}`);
      return [];
    }
    return json.result.map((o) => o.outcode.toUpperCase());
  } catch (err) {
    console.warn(`  postcodes.io fetch failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

interface BackfillSummary {
  locksmithsConsidered: number;
  locksmithsWithCoords: number;
  locksmithsBackfilled: number;
  totalRowsUpserted:    number;
  errors:               string[];
}

async function main(): Promise<void> {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Locksmith coverage backfill v2 — radius-based\n`);

  const summary: BackfillSummary = {
    locksmithsConsidered: 0, locksmithsWithCoords: 0, locksmithsBackfilled: 0,
    totalRowsUpserted: 0, errors: [],
  };

  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: {
      id: true, name: true,
      baseLat: true, baseLng: true,
      coverageRadius: true, baseAddress: true,
    },
  });
  summary.locksmithsConsidered = locksmiths.length;
  console.log(`Found ${locksmiths.length} active onboarded locksmiths\n`);

  for (const lock of locksmiths) {
    if (typeof lock.baseLat !== "number" || typeof lock.baseLng !== "number") {
      console.log(`  ${lock.name}: SKIP (no baseLat/baseLng)`);
      continue;
    }
    summary.locksmithsWithCoords++;
    const radius = lock.coverageRadius ?? 10;

    const outcodes = await outcodesInRadius(lock.baseLat, lock.baseLng, radius);
    await sleep(REQ_DELAY_MS);

    if (outcodes.length === 0) {
      console.log(`  ${lock.name}: SKIP (postcodes.io returned 0 outcodes within ${radius}mi)`);
      continue;
    }

    console.log(`  ${lock.name} (${radius}mi radius): ${outcodes.length} outcodes → ` +
      `${outcodes.slice(0, 6).join(", ")}${outcodes.length > 6 ? ` +${outcodes.length - 6}` : ""}`);

    summary.locksmithsBackfilled++;
    for (const district of outcodes) {
      if (DRY_RUN) { summary.totalRowsUpserted++; continue; }
      try {
        await prisma.locksmithCoverage.upsert({
          where: { locksmithId_postcodeDistrict: { locksmithId: lock.id, postcodeDistrict: district } },
          create: {
            locksmithId:      lock.id,
            postcodeDistrict: district,
            weeklyCapacity:   DEFAULT_CAPACITY,
            source:           "radius_backfill",
            confidenceScore:  0.7,
          },
          update: {
            lastConfirmedAt: new Date(),
            // Don't overwrite weeklyCapacity / pause state on re-run — those
            // may have been manually set by ops.
          },
        });
        summary.totalRowsUpserted++;
      } catch (err) {
        summary.errors.push(`${lock.id} ${district}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Locksmiths considered:    ${summary.locksmithsConsidered}`);
  console.log(`Locksmiths with coords:   ${summary.locksmithsWithCoords}`);
  console.log(`Locksmiths backfilled:    ${summary.locksmithsBackfilled}`);
  console.log(`Total rows upserted:      ${summary.totalRowsUpserted}${DRY_RUN ? " (dry run)" : ""}`);
  if (summary.errors.length) {
    console.log(`Errors (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }
  console.log(`──────────────────────────────────────────`);
  console.log(`\nNext: review at /admin/locksmiths/coverage (or just /admin/locksmiths map view)`);

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Backfill v2 crashed:", err);
  process.exit(2);
});
