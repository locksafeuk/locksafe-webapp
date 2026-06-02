/**
 * Inspect ad groups + ads inside the three live campaigns.
 */
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

const CAMPAIGN_IDS = ["23903266748", "23898155724", "23903269385"];

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active Google Ads account");
  const { client } = ctx;

  console.log("=== Ad groups ===");
  const agRows = await client.query<{
    campaign: { id: string; name: string };
    adGroup: { id: string; name: string; status: string };
  }>(`
    SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status
    FROM ad_group
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
  `);
  for (const r of agRows) {
    console.log({
      campaign: r.campaign.name,
      campaignId: r.campaign.id,
      adGroupId: r.adGroup.id,
      adGroup: r.adGroup.name,
      adGroupStatus: r.adGroup.status,
    });
  }

  console.log("\n=== Ads ===");
  const adRows = await client.query<{
    campaign: { id: string; name: string };
    adGroup: { id: string; name: string };
    adGroupAd: {
      status: string;
      ad: {
        id: string;
        type: string;
        finalUrls?: string[];
        responsiveSearchAd?: {
          headlines?: { text: string }[];
          descriptions?: { text: string }[];
        };
      };
    };
    policySummary?: { approvalStatus?: string; reviewStatus?: string };
  }>(`
    SELECT
      campaign.id, campaign.name,
      ad_group.id, ad_group.name,
      ad_group_ad.status,
      ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.review_status
    FROM ad_group_ad
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
  `);
  for (const r of adRows) {
    console.log({
      campaign: r.campaign.name,
      adGroup: r.adGroup.name,
      adId: r.adGroupAd.ad.id,
      type: r.adGroupAd.ad.type,
      status: r.adGroupAd.status,
      approval: r.policySummary?.approvalStatus,
      review: r.policySummary?.reviewStatus,
      finalUrl: r.adGroupAd.ad.finalUrls?.[0],
      headlines: r.adGroupAd.ad.responsiveSearchAd?.headlines?.map((h) => h.text),
      descriptions: r.adGroupAd.ad.responsiveSearchAd?.descriptions?.map((d) => d.text),
    });
  }

  console.log("\n=== Keyword counts ===");
  const kwRows = await client.query<{
    campaign: { id: string; name: string };
    adGroup: { name: string };
    adGroupCriterion: { keyword?: { text: string; matchType: string }; status: string };
  }>(`
    SELECT campaign.id, campaign.name, ad_group.name,
           ad_group_criterion.keyword.text,
           ad_group_criterion.keyword.match_type,
           ad_group_criterion.status
    FROM keyword_view
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
  `);
  const counts = new Map<string, number>();
  for (const r of kwRows) {
    const key = `${r.campaign.name} :: ${r.adGroup.name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [k, v] of counts) console.log({ group: k, keywords: v });
  if (counts.size === 0) console.log("(no keywords found)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
