/**
 * Coverage density report — where do we have the most ACTIVE locksmiths?
 *
 * Answers the canary-town question: rank towns/regions/postcode-districts
 * by how many distinct active (isPaused=false) locksmiths cover them.
 * London is reported separately + excluded from the recommendation, since
 * it's a deliberately-avoided high-CPC market for funnel validation.
 *
 * Source of truth: LocksmithCoverage (one row per {locksmith, district}).
 * We count DISTINCT locksmithId per bucket so a single locksmith covering
 * many districts doesn't inflate a town's count.
 *
 * Usage: ./coverage-density-by-area.command
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

const LONDON_HINTS = /london|greater london|\bE\d|\bEC\d|\bN\d|\bNW\d|\bSE\d|\bSW\d|\bW\d|\bWC\d/i;

function isLondon(city: string | null, region: string | null, district: string): boolean {
  return LONDON_HINTS.test(city ?? "") || LONDON_HINTS.test(region ?? "") ||
    /^(E|EC|N|NW|SE|SW|W|WC)\d/i.test(district);
}

async function main() {
  const rows: Array<{
    locksmithId: string; postcodeDistrict: string;
    city: string | null; region: string | null; isPaused: boolean;
  }> = await prisma.locksmithCoverage.findMany({
    select: { locksmithId: true, postcodeDistrict: true, city: true, region: true, isPaused: true },
  });

  const active = rows.filter((r) => !r.isPaused);
  console.log("");
  console.log(`▶ Coverage density — ${rows.length} total coverage rows, ${active.length} active (unpaused)`);
  console.log("");

  // Bucket by city, region, district — counting DISTINCT locksmiths.
  const byCity     = new Map<string, Set<string>>();
  const byRegion   = new Map<string, Set<string>>();
  const byDistrict = new Map<string, Set<string>>();
  const londonDistricts = new Set<string>();

  for (const r of active) {
    const london = isLondon(r.city, r.region, r.postcodeDistrict);
    if (london) { londonDistricts.add(r.postcodeDistrict); }

    const cityKey = (r.city ?? "(no city)").trim();
    const regKey  = (r.region ?? "(no region)").trim();
    const distKey = r.postcodeDistrict.trim().toUpperCase();

    if (!london) {
      if (!byCity.has(cityKey))     byCity.set(cityKey, new Set());
      if (!byRegion.has(regKey))    byRegion.set(regKey, new Set());
      byCity.get(cityKey)!.add(r.locksmithId);
      byRegion.get(regKey)!.add(r.locksmithId);
    }
    // district table includes London too (reported, then filtered in the rec)
    if (!byDistrict.has(distKey)) byDistrict.set(distKey, new Set());
    byDistrict.get(distKey)!.add(r.locksmithId);
  }

  const rank = (m: Map<string, Set<string>>) =>
    [...m.entries()]
      .map(([k, set]) => ({ key: k, count: set.size }))
      .sort((a, b) => b.count - a.count);

  console.log("── Top TOWNS / CITIES by distinct active locksmiths (London excluded) ──");
  for (const { key, count } of rank(byCity).slice(0, 12)) {
    console.log(`  ${String(count).padStart(3)}  ${key}`);
  }
  console.log("");

  console.log("── Top REGIONS (London excluded) ──");
  for (const { key, count } of rank(byRegion).slice(0, 10)) {
    console.log(`  ${String(count).padStart(3)}  ${key}`);
  }
  console.log("");

  console.log("── Top POSTCODE DISTRICTS by distinct active locksmiths ──");
  for (const { key, count } of rank(byDistrict).slice(0, 15)) {
    const tag = londonDistricts.has(key) ? "  (London — excluded from rec)" : "";
    console.log(`  ${String(count).padStart(3)}  ${key}${tag}`);
  }
  console.log("");

  // Recommendation: densest non-London town.
  const topTown = rank(byCity).filter((x) => x.key !== "(no city)")[0];
  if (topTown) {
    console.log("──────────────────────────────────────────────────────────────");
    console.log(`RECOMMENDED CANARY TOWN: ${topTown.key}  (${topTown.count} active locksmiths)`);
    console.log("Cross-check this town has a /locksmith-in/{district} landing page");
    console.log("and a fast, reliable responder before launching.");
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
