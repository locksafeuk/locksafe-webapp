/**
 * Diagnostic: print the actual state of DistrictLandingPage rows +
 * their coverage, so we can pinpoint why /locksmith-in/{slug} is 404'ing.
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

async function main() {
  console.log("");
  console.log("▶ DistrictLandingPage rows");
  console.log("");

  const rows: Array<{
    district: string; slug: string;
    isPublished: boolean; contentSource: string;
    heroHeadline: string | null;
    generatedAt: Date | null; updatedAt: Date;
    llmModel: string | null;
  }> = await prisma.districtLandingPage.findMany({
    select: {
      district: true, slug: true, isPublished: true, contentSource: true,
      heroHeadline: true, generatedAt: true, updatedAt: true, llmModel: true,
    },
    orderBy: { district: "asc" },
  });

  if (rows.length === 0) {
    console.log("  (empty — no rows exist)");
  } else {
    for (const r of rows) {
      console.log(`  ${r.district.padEnd(6)} slug=${r.slug.padEnd(6)}  published=${r.isPublished}  source=${r.contentSource}`);
      console.log(`    headline: ${r.heroHeadline ? r.heroHeadline.slice(0, 70) + (r.heroHeadline.length > 70 ? "…" : "") : "(none)"}`);
      console.log(`    model:    ${r.llmModel ?? "(none)"}`);
      console.log(`    gen-at:   ${r.generatedAt?.toISOString() ?? "(never)"}`);
      console.log(`    updated:  ${r.updatedAt.toISOString()}`);
    }
  }
  console.log("");

  console.log("▶ LocksmithCoverage for each district (active only)");
  console.log("");
  for (const r of rows) {
    const cov: Array<{ locksmithId: string; isPaused: boolean; weeklyCapacity: number }> =
      await prisma.locksmithCoverage.findMany({
        where:  { postcodeDistrict: r.district },
        select: { locksmithId: true, isPaused: true, weeklyCapacity: true },
      });
    const active = cov.filter((c) => !c.isPaused);
    console.log(`  ${r.district}: total=${cov.length} active=${active.length} paused=${cov.length - active.length}`);
    if (active.length === 0 && cov.length > 0) {
      console.log(`    ⚠ ALL coverage rows are paused — the page route's defence-in-depth check`);
      console.log(`      will return 404 even though the row is published.`);
    }
  }
  console.log("");

  console.log("▶ Latest 6 GoogleAdsCampaignDraft rows by createdAt");
  console.log("");
  const drafts: Array<{
    name: string; status: string; finalUrl: string;
    aiPrompt: string | null; createdAt: Date;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    select: { name: true, status: true, finalUrl: true, aiPrompt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take:    8,
  });
  for (const d of drafts) {
    console.log(`  ${d.status.padEnd(18)} ${d.name.padEnd(34)} → ${d.finalUrl}`);
    console.log(`    tag: ${d.aiPrompt ?? "(none)"}  created: ${d.createdAt.toISOString()}`);
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
