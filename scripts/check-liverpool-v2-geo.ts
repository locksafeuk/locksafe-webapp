import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";
async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error('no client');
  const id = '23945764531';
  const settings = await ctx.client.query(`SELECT campaign.id, campaign.name, campaign.geo_target_type_setting.positive_geo_target_type, campaign.geo_target_type_setting.negative_geo_target_type FROM campaign WHERE campaign.id = ${id}`);
  console.log('SETTINGS:', JSON.stringify(settings, null, 2));
  const criteria = await ctx.client.query(`SELECT campaign.id, campaign_criterion.location.geo_target_constant, campaign_criterion.negative, campaign_criterion.type FROM campaign_criterion WHERE campaign.id = ${id} AND campaign_criterion.type = LOCATION`);
  console.log('LOCATION CRITERIA:', JSON.stringify(criteria, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
