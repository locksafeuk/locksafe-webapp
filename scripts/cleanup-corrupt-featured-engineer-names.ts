/**
 * One-off cleanup: null out corrupt `featuredEngineerName` values in
 * DistrictLandingPage rows.
 *
 * Background. The field audit on 2026-05-26 found 5/6 published district
 * rows storing a stringified longitude/latitude ("-2.6627", "-1.7004",
 * "-1.0546") or an admin-region label ("Borough of Runnymede") in the
 * `featuredEngineerName` column. These values flow in from
 * Locksmith.baseAddress → extractBaseLocation() → ensure-landing.ts. The
 * page template never renders `featuredEngineerName` so users never saw
 * the bad data, but the column was wrong and any future code path that
 * surfaces it would have produced nonsense copy.
 *
 * What this script does:
 *   1. Read every DistrictLandingPage row.
 *   2. Re-evaluate the current `featuredEngineerName` with the same
 *      defensive guards that now live in `extractBaseLocation`.
 *   3. Null out rows where the value is a coordinate, admin-region,
 *      or empty string.
 *   4. Print a summary of every change.
 *
 * Idempotent: safe to re-run. A fresh generation pipeline run with the
 * patched extractBaseLocation will not re-introduce these bad values.
 *
 * Usage: double-click cleanup-corrupt-featured-engineer-names.command
 * (sibling of diag-district-state.command) — same harness, same .env.
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// Mirror of the guards in src/lib/district-landing/assemble-facts.ts.
// Kept local so the cleanup script is self-contained — same heuristics.
function isCoordString(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?$/.test(s.trim());
}
function isAdminRegionName(s: string): boolean {
  return /^(Borough of\b|City of\b|County of\b|District of\b|Royal Borough of\b|London Borough of\b|Metropolitan Borough of\b|Unitary Authority of\b)/i.test(s.trim());
}

interface ChangeRecord {
  district: string;
  slug:     string;
  before:   string;
  reason:   "coord" | "admin-region" | "empty-string";
}

async function main() {
  const rows: Array<{
    id:                   string;
    district:             string;
    slug:                 string;
    featuredEngineerName: string | null;
  }> = await prisma.districtLandingPage.findMany({
    select: { id: true, district: true, slug: true, featuredEngineerName: true },
    orderBy: { district: "asc" },
  });

  console.log("");
  console.log(`▶ Scanning ${rows.length} DistrictLandingPage rows…`);
  console.log("");

  const changes: ChangeRecord[] = [];

  for (const row of rows) {
    const value = row.featuredEngineerName;
    if (value === null) continue;            // already clean
    if (typeof value !== "string") continue; // shouldn't happen but defend

    let reason: ChangeRecord["reason"] | null = null;
    if (value.trim() === "") reason = "empty-string";
    else if (isCoordString(value)) reason = "coord";
    else if (isAdminRegionName(value)) reason = "admin-region";

    if (!reason) continue;
    changes.push({
      district: row.district, slug: row.slug, before: value, reason,
    });

    await prisma.districtLandingPage.update({
      where: { id: row.id },
      data:  { featuredEngineerName: null },
    });
  }

  console.log("");
  console.log("──────────────────────────────────────────────────────────────");
  if (changes.length === 0) {
    console.log("✓ Nothing to clean — all featuredEngineerName values look healthy.");
  } else {
    console.log(`✓ Nulled ${changes.length} row${changes.length === 1 ? "" : "s"}:`);
    for (const c of changes) {
      console.log(`  • ${c.district.padEnd(6)} (${c.slug.padEnd(6)})  reason=${c.reason.padEnd(13)}  was="${c.before}"`);
    }
    console.log("");
    console.log(`${rows.length - changes.length} row(s) left unchanged.`);
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("✗ Failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
