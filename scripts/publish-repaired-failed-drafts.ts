import prisma from "@/lib/db";
import { publishGoogleAdsDraft } from "@/lib/google-ads-publish";

const DRAFT_IDS = [
  "6a1ef387059191233bbca850", // Midlands
  "6a1ef387059191233bbca84f", // North East
  "6a1ef386059191233bbca84e", // Yorkshire & Sheffield
] as const;

async function main() {
  for (const id of DRAFT_IDS) {
    const draft = await prisma.googleAdsCampaignDraft.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        locationMatchType: true,
        googleCampaignId: true,
      },
    });

    if (!draft) {
      console.log(`\n[skip] ${id}: draft not found`);
      continue;
    }

    if (draft.googleCampaignId) {
      console.log(`\n[skip] ${id}: already published as ${draft.googleCampaignId}`);
      continue;
    }

    console.log(`\n[publish] ${draft.id} | ${draft.name}`);
    console.log(`  status=${draft.status} locationMatchType=${draft.locationMatchType}`);

    try {
      const res = await publishGoogleAdsDraft(id);
      console.log(`  success campaign=${res.googleCampaignId} adGroup=${res.googleAdGroupId} ad=${res.googleAdId}`);
    } catch (err) {
      console.log(`  failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const final = await prisma.googleAdsCampaignDraft.findMany({
    where: { id: { in: [...DRAFT_IDS] } },
    select: {
      id: true,
      name: true,
      status: true,
      locationMatchType: true,
      googleCampaignId: true,
      publishError: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log("\n[final-status]");
  for (const d of final) {
    console.log(`${d.id} | ${d.status} | campaign=${d.googleCampaignId ?? "-"} | loc=${d.locationMatchType}`);
    if (d.publishError) console.log(`  publishError=${d.publishError.slice(0, 240)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
