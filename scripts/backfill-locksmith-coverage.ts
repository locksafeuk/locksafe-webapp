/**
 * One-shot backfill: seed LocksmithCoverage from existing locksmith data.
 *
 * Strategy (in priority order — first hit wins per district):
 *   1. Locksmith.coverageAreas[] (legacy free-text postcodes) — parse out
 *      every UK district token. source="legacy_array_import", confidence=1.0.
 *   2. (Future) Radius-based inference from baseLat/baseLng + coverageRadius
 *      using postcodes.io. Not enabled in v1 — postcodes.io is an HTTP
 *      dependency we'd rather opt into per locksmith via the admin UI.
 *
 * Idempotent: re-running upserts existing rows without duplicating. The
 * unique constraint on (locksmithId, postcodeDistrict) enforces this.
 *
 * Capacity default: 5 jobs/week per district. Admins should refine per
 * locksmith via /admin/locksmiths/coverage after this runs.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts
 *
 * Dry-run (preview without writing):
 *   DRY_RUN=1 npx ts-node --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts
 */

// Register tsconfig paths so the `@/` alias inside locksmith-coverage.ts
// resolves at runtime under ts-node. Without this the script crashes with
// MODULE_NOT_FOUND when locksmith-coverage.ts hits `import "@/lib/db"`.
import * as path from "path";
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { extractDistrictsFromText } from "../src/lib/locksmith-coverage";

// LocksmithCoverage is a new Prisma model — typed client gets it after
// `npx prisma generate`. Until then we cast like the other agents do.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const DRY_RUN = process.env.DRY_RUN === "1";
const DEFAULT_CAPACITY = Number(process.env.DEFAULT_CAPACITY ?? "5");

interface BackfillSummary {
  locksmithsScanned:  number;
  locksmithsWithData: number;
  districtsExtracted: number;
  rowsCreated:        number;
  rowsAlreadyExisted: number;
  errors:             string[];
}

async function main(): Promise<void> {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Backfilling LocksmithCoverage from legacy data\n`);

  const summary: BackfillSummary = {
    locksmithsScanned: 0,
    locksmithsWithData: 0,
    districtsExtracted: 0,
    rowsCreated: 0,
    rowsAlreadyExisted: 0,
    errors: [],
  };

  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      coverageAreas: true,
      baseAddress: true,
      onboardingCompleted: true,
    },
  });
  summary.locksmithsScanned = locksmiths.length;
  console.log(`Found ${locksmiths.length} active locksmiths\n`);

  for (const lock of locksmiths) {
    // Combine every text source the locksmith provided — we want the union
    // of districts they've mentioned anywhere.
    const allText = [
      ...lock.coverageAreas,
      lock.baseAddress ?? "",
    ].join(" | ");
    const districts = extractDistrictsFromText(allText);

    if (districts.length === 0) {
      console.log(`  ${lock.name} (${lock.id}): no parseable districts ${lock.onboardingCompleted ? "" : "[onboarding incomplete]"}`);
      continue;
    }

    summary.locksmithsWithData++;
    summary.districtsExtracted += districts.length;
    console.log(`  ${lock.name}: ${districts.length} districts → ${districts.slice(0, 8).join(", ")}${districts.length > 8 ? ` …+${districts.length - 8}` : ""}`);

    for (const district of districts) {
      try {
        if (DRY_RUN) { summary.rowsCreated++; continue; }
        const existing = await prisma.locksmithCoverage.findUnique({
          where: { locksmithId_postcodeDistrict: { locksmithId: lock.id, postcodeDistrict: district } },
        });
        if (existing) {
          summary.rowsAlreadyExisted++;
          // Refresh lastConfirmedAt so re-running doesn't make stale rows.
          await prisma.locksmithCoverage.update({
            where: { id: existing.id },
            data: { lastConfirmedAt: new Date() },
          });
        } else {
          await prisma.locksmithCoverage.create({
            data: {
              locksmithId:      lock.id,
              postcodeDistrict: district,
              weeklyCapacity:   DEFAULT_CAPACITY,
              source:           "legacy_array_import",
              confidenceScore:  1.0,  // legacy entries were manually set by the locksmith
            },
          });
          summary.rowsCreated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${lock.id} ${district}: ${msg}`);
      }
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Locksmiths scanned:          ${summary.locksmithsScanned}`);
  console.log(`Locksmiths with parseable    ${summary.locksmithsWithData}`);
  console.log(`Districts extracted (total): ${summary.districtsExtracted}`);
  console.log(`Rows created:                ${summary.rowsCreated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Rows already existed:        ${summary.rowsAlreadyExisted}`);
  if (summary.errors.length) {
    console.log(`Errors (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }
  console.log(`──────────────────────────────────────────`);
  console.log(`\nNext: refine per-locksmith capacity at /admin/locksmiths/coverage`);

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Backfill crashed:", err);
  process.exit(2);
});
