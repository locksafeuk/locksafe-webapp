/**
 * Read-only inspector for a single DistrictLandingPage row.
 *
 * Usage:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/show-district.ts L1
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function main() {
  const district = process.argv[2]?.trim().toUpperCase();
  if (!district) { console.error("Usage: show-district.ts <OUTCODE>"); process.exit(2); }
  const row = await prisma.districtLandingPage.findUnique({ where: { district } });
  if (!row) { console.error(`No row for ${district}`); process.exit(1); }
  console.log(JSON.stringify(row, null, 2));
}

main().finally(() => prisma.$disconnect());
