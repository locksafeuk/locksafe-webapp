/**
 * One-off maintenance: force-regenerate every PUBLISHED, AI-generated
 * district landing page so it picks up the answer-first FAQ prompt
 * (added 2026-06-11). Ollama-first via the local llm-router (free),
 * using local source so it does not depend on the Vercel deploy.
 *
 * Safe to re-run. manual_override pages are never touched (ensure() guards
 * them). After regeneration each page is ai_generated + fresh (generatedAt
 * reset to now), so there is no nightly churn.
 *
 * Run:
 *   cd locksafe-webapp
 *   node --env-file=.env --import tsx scripts/regen-published-districts.ts
 */

import "dotenv/config";
import { prisma as _prisma } from "@/lib/db";
import { ensureDistrictLandingPage } from "@/lib/district-landing/ensure-landing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function main() {
  const pages = await prisma.districtLandingPage.findMany({
    where: { isPublished: true, contentSource: "ai_generated" },
    select: { district: true },
    orderBy: { district: "asc" },
  });

  console.log(`[regen] ${pages.length} published AI district pages to refresh`);

  // Backdate generatedAt so ensure() treats each as stale and regenerates.
  for (const pg of pages) {
    await prisma.districtLandingPage.update({
      where: { district: pg.district },
      data: { generatedAt: new Date("2020-01-01T00:00:00.000Z") },
    });
  }

  let regenerated = 0;
  let other = 0;
  let failed = 0;

  for (const pg of pages) {
    try {
      const r = await ensureDistrictLandingPage(pg.district);
      console.log(`[regen] ${pg.district}: ${r.action} ${r.modelUsed ?? ""}`.trim());
      if (r.action === "regenerated") regenerated++;
      else other++;
    } catch (err) {
      failed++;
      console.error(
        `[regen] ${pg.district}: ERROR ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`[regen] DONE regenerated=${regenerated} other=${other} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[regen] FATAL", err);
  process.exit(1);
});
