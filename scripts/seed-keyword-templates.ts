/**
 * Seed `KeywordTemplate` rows from the static seed in
 * `src/lib/keyword-templates.ts`.
 *
 *   npx tsx scripts/seed-keyword-templates.ts
 *
 * Idempotent — upserts by slug. Safe to run repeatedly. Optional: the
 * runtime loader merges DB rows on top of the static seed, so unseeded
 * templates still render. Seed only when you want admin to edit a given
 * template in the UI.
 */

import { PrismaClient } from "@prisma/client";
import { KEYWORD_TEMPLATES } from "../src/lib/keyword-templates";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const tpl of KEYWORD_TEMPLATES) {
    const existing = await prisma.keywordTemplate.findUnique({
      where: { slug: tpl.slug },
    });

    const data = {
      slug: tpl.slug,
      label: tpl.label,
      pillarKeyword: tpl.pillarKeyword ?? null,
      intentTags: tpl.intentTags ?? [],
      isActive: tpl.isActive !== false,
      position: tpl.position ?? 0,
      citiesMode: tpl.citiesMode,
      selectedCities: tpl.selectedCities ?? [],
      content: tpl.content as unknown as object,
    };

    await prisma.keywordTemplate.upsert({
      where: { slug: tpl.slug },
      create: data,
      update: data,
    });

    if (existing) updated += 1;
    else created += 1;
    console.log(`  ${existing ? "updated" : "created"}  ${tpl.slug}`);
  }

  console.log(
    `\nDone. ${created} created, ${updated} updated (total ${KEYWORD_TEMPLATES.length}).`,
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
