/**
 * Enable every ad group and every ad inside the three live campaigns
 * so they actually appear (and serve) in Google Ads.
 */
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

const CAMPAIGN_IDS = ["23903266748", "23898155724", "23903269385"];

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active Google Ads account");
  const { client } = ctx;
  const cid = client.customerIdPlain;

  // ---- 1. Enable ad groups ----
  const ags = await client.query<{
    adGroup: { id: string; name: string; status: string; resourceName: string };
    campaign: { name: string };
  }>(`
    SELECT campaign.name, ad_group.id, ad_group.name, ad_group.status, ad_group.resource_name
    FROM ad_group
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
      AND ad_group.status = 'PAUSED'
  `);
  if (ags.length) {
    const ops = ags.map((r) => ({
      update: { resourceName: r.adGroup.resourceName, status: "ENABLED" },
      updateMask: "status",
    }));
    await client.mutate("adGroups", ops);
    console.log(`Enabled ${ags.length} ad groups`);
  } else {
    console.log("No paused ad groups.");
  }

  // ---- 2. Enable ad_group_ads ----
  const ads = await client.query<{
    adGroup: { id: string; name: string };
    adGroupAd: { status: string; resourceName: string; ad: { id: string } };
    campaign: { name: string };
  }>(`
    SELECT campaign.name, ad_group.id, ad_group.name,
           ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.resource_name
    FROM ad_group_ad
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
      AND ad_group_ad.status = 'PAUSED'
  `);
  if (ads.length) {
    const ops = ads.map((r) => ({
      update: { resourceName: r.adGroupAd.resourceName, status: "ENABLED" },
      updateMask: "status",
    }));
    await client.mutate("adGroupAds", ops);
    console.log(`Enabled ${ads.length} ads`);
  } else {
    console.log("No paused ads.");
  }

  // ---- 3. Re-check ----
  const check = await client.query<{
    campaign: { name: string };
    adGroup: { name: string; status: string };
    adGroupAd: { status: string };
  }>(`
    SELECT campaign.name, ad_group.name, ad_group.status, ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id IN (${CAMPAIGN_IDS.join(",")})
  `);
  console.log("\n=== Post-enable status ===");
  for (const r of check) {
    console.log({
      campaign: r.campaign.name,
      adGroup: r.adGroup.name,
      adGroupStatus: r.adGroup.status,
      adStatus: r.adGroupAd.status,
    });
  }

  void cid;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
