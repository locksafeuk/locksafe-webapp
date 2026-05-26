/**
 * Populate the KeywordSeed bank by running the postcode × service
 * keyword generator. Reads LocksmithCoverage to know which districts
 * we can fulfil, then seeds the bank with the 14 templates × covered
 * districts.
 *
 * Run with (from project root):
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project scripts/tsconfig.scripts.json \
 *     scripts/run-postcode-keyword-generator.ts
 *
 * Add --live to actually write seeds (default is dry-run).
 */

import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { generatePostcodeKeywords } from "../src/lib/postcode-keyword-generator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const LIVE = process.argv.includes("--live");

async function main() {
  console.log("");
  console.log(`▶ Postcode Keyword Generator — ${LIVE ? "LIVE" : "DRY-RUN"}`);
  console.log("");

  const result = await generatePostcodeKeywords({ dryRun: !LIVE });

  console.log(`  districts considered : ${result.districtsConsidered}`);
  console.log(`  templates used       : ${result.templatesUsed}`);
  console.log(`  keywords generated   : ${result.keywordsGenerated}`);
  if (LIVE) {
    console.log(`  new seeds created    : ${result.newSeedsCreated}`);
    console.log(`  already existed      : ${result.alreadyExisted}`);
  }
  if (result.errors.length > 0) {
    console.log(`  errors               : ${result.errors.length}`);
    for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
  }
  console.log("");

  if (result.sampleKeywords.length > 0) {
    console.log("Sample of generated keywords:");
    for (const k of result.sampleKeywords) console.log(`    ${k}`);
    console.log("");
  }

  if (!LIVE) {
    console.log("This was a DRY RUN. No seeds were written.");
    console.log("Re-run with --live to actually populate the KeywordSeed bank.");
  } else {
    console.log("✓ Seed bank populated.");
    console.log("  Next: run `review-discovery-campaigns.command` to preview the opening 6 campaigns.");
  }
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
