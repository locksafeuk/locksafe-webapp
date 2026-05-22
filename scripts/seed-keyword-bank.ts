/**
 * One-off: seed the `KeywordSeed` collection with the 8 baseline locksmith
 * keywords that originally lived hardcoded in opportunity-scout/agent.ts.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/seed-keyword-bank.ts
 *
 * Idempotent — uses upsert on the unique `keyword` index.
 */

import prisma from "../src/lib/db";
import { FALLBACK_BASELINE_SEEDS } from "../src/agents/core/seed-bank";

async function main() {
  console.log(`Seeding ${FALLBACK_BASELINE_SEEDS.length} baseline keywords…`);
  let inserted = 0;
  let updated = 0;
  for (const keyword of FALLBACK_BASELINE_SEEDS) {
    const normalised = keyword.toLowerCase().trim();
    const existing = await prisma.keywordSeed.findUnique({
      where: { keyword: normalised },
    });
    if (existing) {
      updated++;
      continue;
    }
    await prisma.keywordSeed.create({
      data: {
        keyword: normalised,
        category: "baseline",
        score: 1.0,
        isActive: true,
        firstSeenSource: "seed-keyword-bank-script",
      },
    });
    inserted++;
  }
  console.log(`Inserted ${inserted}, skipped ${updated} (already present).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
