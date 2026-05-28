import prisma from '../src/lib/db';

async function main() {
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { name: { contains: 'Test', mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      dailyBudget: true,
      biddingStrategy: true,
      channel: true,
      finalUrl: true,
      googleCampaignId: true,
      totalSpend: true,
      totalClicks: true,
      totalImpressions: true,
      totalConversions: true,
      publishError: true,
      publishedAt: true,
      pausedAt: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(JSON.stringify({ count: drafts.length, drafts }, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
