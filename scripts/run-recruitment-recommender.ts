/**
 * Run the locksmith recruitment recommender against live data.
 *
 * Reads:
 *   • LocksmithCoverage  → list of currently-served outcodes
 *   • Locksmith          → active locksmiths' baseLat/baseLng/coverageRadius
 *
 * Optional input:
 *   --region=<comma,list>   restrict recommendations to listed regions
 *   --limit=<N>             max items to surface (default 20)
 *
 * Output: a ranked table printed to stdout. Read-only — does not write
 * to the database. Use this to inform the ops conversation about WHERE
 * to focus recruitment next.
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
import {
  recommendRecruitmentTargets,
  partitionRecommendations,
  type ExistingLocksmithLocation,
} from "../src/lib/locksmith-recruitment-recommender";
import type { UkRegion } from "../src/lib/uk-outcodes-reference";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── CLI flags ──────────────────────────────────────────────────────────────

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const regionFlag = getFlag("region");
const limitFlag  = getFlag("limit");

const regionFilter: UkRegion[] | undefined = regionFlag
  ? regionFlag.split(",").map((s) => s.trim()) as UkRegion[]
  : undefined;
const limit = limitFlag ? parseInt(limitFlag, 10) : 20;

// ── Helpers ────────────────────────────────────────────────────────────────

interface Col { label: string; value: string; width: number }

function fmtRow(cols: Col[]): string {
  return cols.map((c) => c.value.padEnd(c.width)).join(" │ ");
}

function header(cols: Col[]): string {
  const top = cols.map((c) => c.label.padEnd(c.width)).join(" │ ");
  const sep = cols.map((c) => "─".repeat(c.width)).join("─┼─");
  return `${top}\n${sep}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("▶ Locksmith Recruitment Recommender");
  console.log("");

  // 1. Currently-covered outcodes
  const coverageRows = await prisma.locksmithCoverage.findMany({
    where:    { isPaused: false },
    select:   { postcodeDistrict: true },
    distinct: ["postcodeDistrict"],
  });
  const coveredOutcodes: string[] = coverageRows.map(
    (r: { postcodeDistrict: string }) => r.postcodeDistrict,
  );
  console.log(`  Covered outcodes: ${coveredOutcodes.length}`);

  // 2. Active locksmith locations (for radius-extend recommendations)
  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive:        true,
      baseLat:         { not: null },
      baseLng:         { not: null },
      coverageRadius:  { not: null },
    },
    select: {
      id:             true,
      name:           true,
      baseLat:        true,
      baseLng:        true,
      coverageRadius: true,
    },
  });
  const existingLocksmithLocations: ExistingLocksmithLocation[] = locksmiths.map(
    (l: { id: string; name: string; baseLat: number; baseLng: number; coverageRadius: number }) => ({
      id:       l.id,
      name:     l.name,
      lat:      l.baseLat,
      lng:      l.baseLng,
      radiusMi: l.coverageRadius,
    }),
  );
  console.log(`  Active locksmiths with location data: ${existingLocksmithLocations.length}`);

  if (regionFilter) {
    console.log(`  Region filter: ${regionFilter.join(", ")}`);
  }
  console.log(`  Result limit: ${limit}`);
  console.log("");

  // 3. Run the pure recommender
  const recs = recommendRecruitmentTargets({
    coveredOutcodes,
    existingLocksmithLocations,
    regionFilter,
    limit,
  });

  if (recs.length === 0) {
    console.log("No recommendations — either every reference outcode is already covered,");
    console.log("or the region filter excluded everything.");
    return;
  }

  const { newHires, radiusExtends } = partitionRecommendations(recs);

  console.log(`Recommendations: ${recs.length} total`);
  console.log(`  • new hires      : ${newHires.length}`);
  console.log(`  • radius extends : ${radiusExtends.length}`);
  console.log("");

  // 4. Print the table
  const cols = (r: typeof recs[number]): Col[] => [
    { label: "Outcode",    value: r.outcode,                                         width: 7  },
    { label: "City",       value: r.primaryCity,                                     width: 28 },
    { label: "Region",     value: r.region,                                          width: 16 },
    { label: "Score",      value: r.score.toFixed(1),                                width: 6  },
    { label: "Action",     value: r.recommendation.action,                           width: 14 },
    { label: "Locksmith",  value: r.recommendation.locksmithName
                                  ? `${r.recommendation.locksmithName} (${r.recommendation.distanceMi}mi)`
                                  : "—",                                             width: 36 },
  ];

  if (recs[0]) console.log(header(cols(recs[0])));
  for (const r of recs) console.log(fmtRow(cols(r)));
  console.log("");

  // 5. Reason details (top 5 only — keeps output manageable)
  console.log("Reasoning detail (top 5):");
  console.log("");
  for (const r of recs.slice(0, 5)) {
    console.log(`  ${r.outcode} — ${r.primaryCity}  (score ${r.score})`);
    for (const reason of r.reasons) console.log(`    • ${reason}`);
    console.log("");
  }

  console.log("Next step: take the top new-hires to the recruitment funnel; for");
  console.log("radius-extends, message the named locksmith and ask if they can");
  console.log("absorb the listed outcode by bumping their coverage radius.");
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
