/**
 * One-shot generator for a single DistrictLandingPage row.
 *
 * Usage:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/generate-district.ts L1
 *
 * Wraps `ensureDistrictLandingPage` for ad-hoc page creation outside
 * the admin UI / orchestrator. NoCoverageError is surfaced clearly so
 * the operator knows whether to add coverage first.
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

import { ensureDistrictLandingPage } from "../src/lib/district-landing/ensure-landing";
import { NoCoverageError } from "../src/lib/district-landing/assemble-facts";
import { prisma } from "../src/lib/db";

async function main() {
  const district = process.argv[2]?.trim().toUpperCase();
  if (!district) {
    console.error("Usage: generate-district.ts <OUTCODE>   (e.g. L1)");
    process.exit(2);
  }

  console.log(`\n→ Generating DistrictLandingPage for ${district}…\n`);

  try {
    const result = await ensureDistrictLandingPage(district);
    console.log("✅ Done.\n");
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nVisit: /locksmith-in/${result.slug}`);
  } catch (err) {
    if (err instanceof NoCoverageError) {
      console.error(`❌ NoCoverageError: ${err.reason} — ${err.details ?? ""}`);
      console.error(
        `\nAdd active LocksmithCoverage for ${district} first, then retry.`,
      );
      process.exit(1);
    }
    throw err;
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$disconnect();
  });
