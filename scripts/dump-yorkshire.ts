import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const d = await (prisma as any).googleAdsCampaignDraft.findFirst({
    where: { name: { contains: 'Yorkshire | Final' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!d) { console.log('NOT FOUND'); return; }
  console.log(JSON.stringify({
    name: d.name,
    status: d.status,
    dailyBudget: d.dailyBudget,
    biddingStrategy: d.biddingStrategy,
    locationMatchType: d.locationMatchType,
    geoTargets: d.geoTargets,
    finalUrl: d.finalUrl,
    headlines: d.headlines,
    descriptions: d.descriptions,
    negativeKeywords_count: d.negativeKeywords?.length,
    keywords_count: Array.isArray(d.keywords) ? d.keywords.length : 0,
    adGroups: d.adGroups,
    assets: d.assets,
  }, null, 2));
  await (prisma as any).$disconnect();
}
main();
