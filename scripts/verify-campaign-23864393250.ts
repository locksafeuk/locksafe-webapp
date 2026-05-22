import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

const CAMPAIGN_ID = "23864393250";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const rows = await client.query<{
    campaign: { id: string; name: string; status: string; biddingStrategyType: string; servingStatus: string };
    campaignBudget: { amountMicros: string };
  }>(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type,
            campaign.serving_status, campaign_budget.amount_micros
     FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}`,
  );
  console.log(JSON.stringify(rows[0], null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
