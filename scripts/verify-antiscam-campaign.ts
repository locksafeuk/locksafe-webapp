import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("no client");
  const rows = await ctx.client.query<any>(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
            campaign.bidding_strategy_type, campaign_budget.amount_micros,
            campaign.geo_target_type_setting.positive_geo_target_type
     FROM campaign WHERE campaign.id = 23876350462`,
  );
  console.log(JSON.stringify(rows[0], null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
