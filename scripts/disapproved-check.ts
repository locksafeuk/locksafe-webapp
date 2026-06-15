import { getDefaultGoogleAdsClient } from '../src/lib/google-ads';

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error('no client');

  // 1. All ads + policy status for the 2 named disapproved campaigns + the new Liverpool L1 v2
  const ids = ['23892806116', '23921311879', '23945764531'];
  const idList = ids.join(',');

  console.log('===== ADS + finalUrls + APPROVAL STATUS for relevant campaigns =====');
  const ads = await ctx.client.query(
    'SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ' +
    'ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.ad.final_url_suffix, ' +
    'ad_group_ad.policy_summary.approval_status, ' +
    'ad_group_ad.policy_summary.review_status ' +
    'FROM ad_group_ad WHERE campaign.id IN (' + idList + ')'
  );
  for (const r of (ads as any[])) {
    const a = r.adGroupAd;
    const ag = r.adGroup;
    const c = r.campaign;
    console.log('Campaign: ' + c.id + ' (' + c.name + ')');
    console.log('  AdGroup: ' + ag.id + ' (' + ag.name + ')');
    console.log('  Ad ' + a.ad.id + ' approval=' + a.policySummary?.approvalStatus + ' review=' + a.policySummary?.reviewStatus);
    console.log('  finalUrls: ' + JSON.stringify(a.ad.finalUrls));
    console.log('');
  }

  console.log('\n===== POLICY TOPICS (disapproval reasons) for ALL disapproved ads in account =====');
  const policies = await ctx.client.query(
    'SELECT campaign.id, campaign.name, ad_group_ad.ad.id, ' +
    'ad_group_ad.policy_summary.approval_status, ' +
    'ad_group_ad.policy_summary.policy_topic_entries ' +
    'FROM ad_group_ad WHERE ad_group_ad.policy_summary.approval_status = DISAPPROVED'
  );
  for (const r of (policies as any[])) {
    const a = r.adGroupAd;
    const c = r.campaign;
    console.log(c.id + ' (' + c.name + ') ad ' + a.ad.id);
    console.log('  approval: ' + a.policySummary?.approvalStatus);
    console.log('  topics:   ' + JSON.stringify(a.policySummary?.policyTopicEntries, null, 2));
    console.log('');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
