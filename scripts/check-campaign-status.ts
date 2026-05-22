/**
 * Quick status check for ad 809706429260 + campaign serving + recent metrics.
 */
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

const CAMPAIGN_ID = "23864393250";
const AD_ID = "809706429260";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;

  const adRow = await client.query<any>(
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.status,
            ad_group_ad.policy_summary.approval_status,
            ad_group_ad.policy_summary.review_status
     FROM ad_group_ad WHERE ad_group_ad.ad.id = ${AD_ID}`,
  );
  const ad = adRow[0]?.adGroupAd;
  console.log("AD:");
  console.log("  finalUrls:", ad?.ad?.finalUrls?.[0]);
  console.log("  adStatus:", ad?.status);
  console.log("  reviewStatus:", ad?.policySummary?.reviewStatus);
  console.log("  approvalStatus:", ad?.policySummary?.approvalStatus);

  const campRow = await client.query<any>(
    `SELECT campaign.status, campaign.serving_status, metrics.impressions,
            metrics.clicks, metrics.cost_micros
     FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}
     AND segments.date DURING TODAY`,
  );
  const c = campRow[0];
  console.log("\nCAMPAIGN (today):");
  console.log("  status:", c?.campaign?.status, "serving:", c?.campaign?.servingStatus);
  console.log("  impressions:", c?.metrics?.impressions ?? 0);
  console.log("  clicks:", c?.metrics?.clicks ?? 0);
  console.log("  costGBP:", Number(c?.metrics?.costMicros ?? 0) / 1_000_000);
}
main().catch((e) => { console.error(e); process.exit(1); });
