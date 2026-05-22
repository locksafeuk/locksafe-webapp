/**
 * One-off operational script. Brings campaign 23864393250 into a safe,
 * serve-able state:
 *
 *   1. Lower daily budget from £100 to £15
 *   2. Switch bid strategy from MAXIMIZE_CONVERSIONS -> MANUAL_CPC
 *   3. Enable any PAUSED ad groups under the campaign
 *   4. Enable any PAUSED ads under those ad groups
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/fix-campaign-23864393250.ts
 *
 * Set DRY_RUN=1 to validateOnly the writes.
 */

import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const CAMPAIGN_ID = "23864393250";
const NEW_DAILY_BUDGET_GBP = 15;
const MANUAL_CPC_MAX_GBP = 1.8;
const DRY_RUN = process.env.DRY_RUN === "1";

function gbpToMicros(gbp: number): string {
  return String(Math.round(gbp * 1_000_000));
}

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount in DB");
  const { client, customerId } = ctx;
  const cid = client.customerIdPlain;
  console.log(`[fix-campaign] customer=${customerId} dryRun=${DRY_RUN}`);

  // 1. Read campaign + budget + bidding state
  const campaignRows = await client.query<{
    campaign: {
      id: string;
      name: string;
      status: string;
      biddingStrategyType: string;
      campaignBudget: string;
    };
    campaignBudget: {
      id: string;
      amountMicros: string;
      name: string;
    };
  }>(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type,
            campaign.campaign_budget, campaign_budget.id, campaign_budget.amount_micros,
            campaign_budget.name
     FROM campaign
     WHERE campaign.id = ${CAMPAIGN_ID}`,
  );
  if (!campaignRows.length) throw new Error(`Campaign ${CAMPAIGN_ID} not found`);
  const c = campaignRows[0];
  console.log("[campaign]", {
    name: c.campaign.name,
    status: c.campaign.status,
    bidStrategy: c.campaign.biddingStrategyType,
    budgetResource: c.campaign.campaignBudget,
    currentBudgetGBP: Number(c.campaignBudget.amountMicros) / 1_000_000,
  });

  // 2. Update the campaign budget amount
  const budgetResource = c.campaign.campaignBudget;
  console.log(`[budget] -> £${NEW_DAILY_BUDGET_GBP}/day on ${budgetResource}`);
  await client.mutate(
    "campaignBudgets",
    [
      {
        update: {
          resourceName: budgetResource,
          amountMicros: gbpToMicros(NEW_DAILY_BUDGET_GBP),
        },
        updateMask: "amount_micros",
      },
    ],
    { validateOnly: DRY_RUN },
  );

  // 3. Switch bid strategy to MANUAL_CPC (campaign-level)
  const campaignResource = buildResourceName(cid, "campaigns", CAMPAIGN_ID);
  console.log(`[bidding] -> MANUAL_CPC on ${campaignResource}`);
  await client.mutate(
    "campaigns",
    [
      {
        update: {
          resourceName: campaignResource,
          manualCpc: { enhancedCpcEnabled: false },
        },
        updateMask: "manual_cpc.enhanced_cpc_enabled",
      },
    ],
    { validateOnly: DRY_RUN },
  );

  // 4. Enable ad groups + set a sensible cpc_bid ceiling
  const adGroupRows = await client.query<{
    adGroup: { id: string; name: string; status: string; cpcBidMicros?: string };
  }>(
    `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros
     FROM ad_group
     WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group.status != 'REMOVED'`,
  );
  console.log(`[ad_groups] found ${adGroupRows.length}`);
  for (const ag of adGroupRows) {
    console.log("  -", ag.adGroup.id, ag.adGroup.name, ag.adGroup.status,
      "cpcMicros=", ag.adGroup.cpcBidMicros);
  }
  const agOps = adGroupRows.map((r) => ({
    update: {
      resourceName: buildResourceName(cid, "adGroups", r.adGroup.id),
      status: "ENABLED",
      cpcBidMicros: gbpToMicros(MANUAL_CPC_MAX_GBP),
    },
    updateMask: "status,cpc_bid_micros",
  }));
  if (agOps.length) {
    console.log(`[ad_groups] enabling ${agOps.length} + setting cpc_bid £${MANUAL_CPC_MAX_GBP}`);
    await client.mutate("adGroups", agOps, { validateOnly: DRY_RUN });
  }

  // 5. Enable ads
  const adRows = await client.query<{
    adGroupAd: { resourceName: string; status: string; ad: { id: string } };
    adGroup: { id: string };
  }>(
    `SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.id, ad_group.id
     FROM ad_group_ad
     WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group_ad.status != 'REMOVED'`,
  );
  console.log(`[ads] found ${adRows.length}`);
  for (const a of adRows) {
    console.log("  -", a.adGroupAd.ad.id, a.adGroupAd.status);
  }
  const adOps = adRows.map((r) => ({
    update: { resourceName: r.adGroupAd.resourceName, status: "ENABLED" },
    updateMask: "status",
  }));
  if (adOps.length) {
    console.log(`[ads] enabling ${adOps.length}`);
    await client.mutate("adGroupAds", adOps, { validateOnly: DRY_RUN });
  }

  console.log("[done] campaign fix complete" + (DRY_RUN ? " (DRY RUN)" : ""));
}

main().catch((err) => {
  console.error("[fix-campaign] FAILED:", err);
  process.exit(1);
});
