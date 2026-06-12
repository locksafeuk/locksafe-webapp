/**
 * One-shot drift fix: sync our DB's `pausedAt` to reflect Google's actual
 * `liveCampaignStatus`. We had 5 drafts marked status=PUBLISHED with
 * pausedAt=null, but every one of them is PAUSED on Google's side. The
 * §17 spend cap reads our DB so it thinks £400/day is live, blocking
 * any new draft from being persisted. Reality: nothing is serving.
 *
 * Stamps pausedAt on drafts that:
 *   - have a googleCampaignId (so they really were published)
 *   - are currently liveCampaignStatus == PAUSED on Google
 *   - have pausedAt: null in our DB
 *
 * Run with: npx tsx scripts/fix-ga-drift-paused.ts
 */

import { PrismaClient } from "@prisma/client";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

const prisma = new PrismaClient();

interface CampaignRow {
  campaign?: { id?: string; name?: string; status?: string };
}

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client, accountId } = ctx;

  const rows = (await client.query(`
    SELECT campaign.id, campaign.name, campaign.status
      FROM campaign
     WHERE campaign.status IN (PAUSED, REMOVED)
  `)) as CampaignRow[];

  const pausedIds = new Set<string>();
  const removedIds = new Set<string>();
  for (const r of rows) {
    if (!r.campaign?.id) continue;
    if (r.campaign.status === "PAUSED")  pausedIds.add(r.campaign.id);
    if (r.campaign.status === "REMOVED") removedIds.add(r.campaign.id);
  }
  console.log(`Google reports: ${pausedIds.size} PAUSED, ${removedIds.size} REMOVED campaigns.`);

  // Find drafts that are PUBLISHED + pausedAt null + googleCampaignId in PAUSED set.
  // NB: MongoDB-Prisma `pausedAt: null` filter only matches explicit nulls
  // (not missing fields). Both states represent "not paused" semantically;
  // we sweep both by post-filtering after a broader query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const candidates = await p.googleAdsCampaignDraft.findMany({
    where:  { accountId, status: "PUBLISHED" },
    select: { id: true, name: true, dailyBudget: true, googleCampaignId: true, pausedAt: true },
  });
  console.log(`\nFound ${candidates.length} PUBLISHED drafts in DB.`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toFix = candidates.filter((d: any) =>
    d.googleCampaignId &&
    pausedIds.has(d.googleCampaignId) &&
    d.pausedAt == null,
  );
  const toMarkRemoved = candidates.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => d.googleCampaignId && removedIds.has(d.googleCampaignId),
  );

  console.log(`\nDrift to fix:`);
  console.log(`  ${toFix.length} drafts to mark pausedAt = now (PAUSED on Google, alive in DB)`);
  console.log(`  ${toMarkRemoved.length} drafts to mark pausedAt = now (REMOVED on Google)`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of toFix as any[]) {
    console.log(`    • ${d.name} (£${d.dailyBudget}/day)`);
  }

  const now = new Date();
  let stamped = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of [...toFix, ...toMarkRemoved] as any[]) {
    await p.googleAdsCampaignDraft.update({
      where: { id: d.id },
      data:  { pausedAt: now },
    });
    stamped++;
  }
  console.log(`\n✅ Updated pausedAt on ${stamped} drafts.`);

  // Re-compute § 17 live-budget from updated DB.
  const remaining = await p.googleAdsCampaignDraft.findMany({
    where:  { accountId, status: "PUBLISHED", pausedAt: null },
    select: { name: true, dailyBudget: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freedSum = remaining.reduce((s: number, r: any) => s + (r.dailyBudget ?? 0), 0);
  console.log(`\n§ 17 live budget after fix: £${freedSum}/day (was £400/day).`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of remaining as any[]) {
    console.log(`  Still counted: ${r.name} (£${r.dailyBudget}/day)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
