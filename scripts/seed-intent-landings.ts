/**
 * Seed `IntentLanding` rows from the static seed in `src/lib/intent-landings.ts`.
 *
 * Usage:
 *   npx tsx scripts/seed-intent-landings.ts
 *
 * Idempotent — upserts by slug. Safe to run repeatedly.
 *
 * IMPORTANT: this is OPTIONAL. The runtime loader merges DB rows on top of
 * the static seed, so unseeded slugs still render correctly. Seed only when
 * you want admin to be able to edit a given landing in the UI.
 */

import { PrismaClient } from "@prisma/client";
import { INTENT_LANDINGS } from "../src/lib/intent-landings";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const landing of INTENT_LANDINGS) {
    const existing = await prisma.intentLanding.findUnique({
      where: { slug: landing.slug },
    });

    const data = {
      slug: landing.slug,
      title: landing.title,
      pillarKeyword: landing.pillarKeyword ?? null,
      intentTags: landing.intentTags ?? [],
      isActive: landing.isActive !== false,
      position: landing.position ?? 0,
      content: landing as unknown as object,
    };

    await prisma.intentLanding.upsert({
      where: { slug: landing.slug },
      create: data,
      update: data,
    });

    if (existing) updated += 1;
    else created += 1;
    console.log(`  ${existing ? "updated" : "created"}  ${landing.slug}`);
  }

  console.log(
    `\nDone. ${created} created, ${updated} updated (total ${INTENT_LANDINGS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
