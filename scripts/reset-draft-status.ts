import prisma from "../src/lib/db";

async function main() {
  const updated = await prisma.googleAdsCampaignDraft.update({
    where: { id: "6a0893b3568a779bcdda7af2" },
    data: { status: "APPROVED", publishError: null },
  });
  console.log("Updated:", updated.status, updated.id);
  await prisma.$disconnect();
}

main().catch(console.error);
