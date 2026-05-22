/**
 * Read locations + ad final URLs with the correct GAQL nesting.
 */
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

const CAMPAIGN_ID = "23864393250";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;

  const locations = await client.query<any>(
    `SELECT campaign_criterion.criterion_id, campaign_criterion.location.geo_target_constant,
            campaign_criterion.status, campaign_criterion.negative
     FROM campaign_criterion
     WHERE campaign.id = ${CAMPAIGN_ID} AND campaign_criterion.type = 'LOCATION'`,
  );
  console.log("=== LOCATION criteria ===");
  console.log(JSON.stringify(locations, null, 2));

  const ads = await client.query<any>(
    `SELECT ad_group_ad.resource_name, ad_group_ad.ad.id,
            ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.path1,
            ad_group_ad.ad.responsive_search_ad.path2
     FROM ad_group_ad WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group_ad.status != 'REMOVED'`,
  );
  console.log("\n=== ADs ===");
  console.log(JSON.stringify(ads, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
