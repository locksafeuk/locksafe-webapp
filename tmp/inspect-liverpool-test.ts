import prisma from '../src/lib/db';

async function main() {
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { name: { contains: 'Liverpool', mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      dailyBudget: true,
      biddingStrategy: true,
      targetCpa: true,
      channel: true,
      geoTargets: true,
      languageTargets: true,
      finalUrl: true,
      headlines: true,
      descriptions: true,
      keywords: true,
      negativeKeywords: true,
      accountId: true,
      googleCampaignId: true,
      googleAdGroupId: true,
      googleAdId: true,
      googleBudgetId: true,
      totalSpend: true,
      totalClicks: true,
      totalImpressions: true,
      totalConversions: true,
      totalRevenue: true,
      publishError: true,
      publishedAt: true,
      pausedAt: true,
      lastSyncAt: true,
      adminNotes: true,
      publishedSnapshot: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const accountIds = [...new Set(drafts.map((d) => d.accountId))];
  const accounts = accountIds.length
    ? await prisma.googleAdsAccount.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          customerId: true,
          name: true,
          isActive: true,
          currency: true,
          timezone: true,
          lastSyncAt: true,
          tokenExpiresAt: true,
        },
      })
    : [];

  console.log(JSON.stringify({ count: drafts.length, drafts, accounts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
