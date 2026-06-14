import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const d = await (prisma as any).googleAdsCampaignDraft.findFirst({
    where: { name: { contains: 'Liverpool L1' } },
  });
  if (!d) { console.log('NOT FOUND'); return; }
  console.log(JSON.stringify({
    id: d.id, name: d.name, status: d.status, pausedAt: d.pausedAt,
    googleCampaignId: d.googleCampaignId, dailyBudget: d.dailyBudget,
    biddingStrategy: d.biddingStrategy, targetCpa: d.targetCpa,
    geoTargets: d.geoTargets, locationMatchType: d.locationMatchType,
    finalUrl: d.finalUrl, channel: d.channel,
    headlines_count: d.headlines?.length, headlines: d.headlines,
    descriptions_count: d.descriptions?.length, descriptions: d.descriptions,
    keywords_count: Array.isArray(d.keywords) ? d.keywords.length : 0,
    keywords_sample: Array.isArray(d.keywords) ? d.keywords.slice(0, 5) : null,
    negativeKeywords_count: d.negativeKeywords?.length,
    adGroups_count: Array.isArray(d.adGroups) ? d.adGroups.length : 0,
    adGroups: d.adGroups,
    assets: d.assets,
    verificationStatus: d.verificationStatus,
    totalSpend: d.totalSpend, totalClicks: d.totalClicks, totalImpressions: d.totalImpressions, totalConversions: d.totalConversions,
  }, null, 2));
  await (prisma as any).$disconnect();
}
main();
