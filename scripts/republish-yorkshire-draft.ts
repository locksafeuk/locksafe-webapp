import prisma from "@/lib/db";
import { publishGoogleAdsDraft } from "@/lib/google-ads-publish";

const DRAFT_ID = "6a1ef386059191233bbca84e";

async function main() {
  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: DRAFT_ID },
    select: {
      id: true,
      name: true,
      status: true,
      googleCampaignId: true,
      locationMatchType: true,
      publishError: true,
    },
  });

  if (!draft) throw new Error("Draft not found");

  console.log(`[before] ${draft.id} | ${draft.status} | name=${draft.name} | campaign=${draft.googleCampaignId ?? "-"}`);
  if (draft.publishError) console.log(`[before] publishError=${draft.publishError.slice(0, 300)}`);

  if (draft.googleCampaignId) {
    console.log("Already published; nothing to do.");
    return;
  }

  const baseName = draft.name.slice(0, 46);
  const suffix = ` ${new Date().toISOString().slice(0, 10)}`;
  const newName = `${baseName}${suffix}`.slice(0, 60);

  await prisma.googleAdsCampaignDraft.update({
    where: { id: DRAFT_ID },
    data: { name: newName },
  });

  console.log(`[rename] ${draft.name} -> ${newName}`);

  try {
    const res = await publishGoogleAdsDraft(DRAFT_ID);
    console.log(`[publish] success campaign=${res.googleCampaignId} adGroup=${res.googleAdGroupId} ad=${res.googleAdId}`);
  } catch (err) {
    console.log(`[publish] failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const after = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: DRAFT_ID },
    select: {
      id: true,
      name: true,
      status: true,
      locationMatchType: true,
      googleCampaignId: true,
      publishError: true,
    },
  });

  console.log("[after]", JSON.stringify(after, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
