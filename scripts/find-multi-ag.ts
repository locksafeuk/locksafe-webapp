import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const all = await (prisma as any).googleAdsCampaignDraft.findMany({
    where: { OR: [ { name: { contains: "Yorkshire" } }, { name: { contains: "Midlands" } }, { name: { contains: "North East" } }, { name: { contains: "London" } } ] },
    select: { id: true, name: true, status: true, adGroups: true, dailyBudget: true, biddingStrategy: true, geoTargets: true, finalUrl: true, headlines: true, descriptions: true, keywords: true, negativeKeywords: true, assets: true },
    orderBy: { createdAt: "desc" },
  });
  for (const d of all) {
    const adGroupsLen = Array.isArray(d.adGroups) ? d.adGroups.length : 0;
    console.log(d.name + " :: status=" + d.status + " :: adGroups=" + adGroupsLen);
  }
  const withAg = all.find((d: any) => Array.isArray(d.adGroups) && d.adGroups.length > 0);
  if (withAg) {
    console.log("=== TEMPLATE: " + withAg.name + " ===");
    console.log(JSON.stringify(withAg, null, 2));
  } else {
    console.log("No drafts with adGroups found");
  }
  await (prisma as any).$disconnect();
}
main();
