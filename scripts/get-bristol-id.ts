import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const d = await p.googleAdsCampaignDraft.findFirst({
    where: { name: { contains: "Bristol BS1" } },
    select: { id: true, name: true, status: true, dailyBudget: true, pausedAt: true, googleCampaignId: true },
  });
  console.log(JSON.stringify(d, null, 2));
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
