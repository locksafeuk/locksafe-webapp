/**
 * Diagnose draft 6a0f8700240e1b81545583c7 publishing context.
 */
import prisma from "@/lib/db";

const DRAFT_ID = "6a0f8700240e1b81545583c7";

async function main() {
  const accounts = await prisma.googleAdsAccount.findMany({
    select: {
      id: true,
      customerId: true,
      loginCustomerId: true,
      isActive: true,
      name: true,
      currency: true,
      timezone: true,
      createdAt: true,
    },
  });
  console.log("=== GoogleAdsAccount rows ===");
  for (const a of accounts) {
    console.log(
      `- ${a.id}  customer=${a.customerId}  login=${a.loginCustomerId}  active=${a.isActive}  name="${a.name}"  currency=${a.currency}`,
    );
  }

  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: DRAFT_ID },
    select: {
      id: true,
      name: true,
      status: true,
      accountId: true,
      googleCampaignId: true,
      publishError: true,
    },
  });
  console.log("\n=== Draft ===");
  console.log(JSON.stringify(draft, null, 2));

  if (draft?.accountId) {
    const acc = accounts.find((a) => a.id === draft.accountId);
    console.log("\n=== Draft -> Account ===");
    console.log(JSON.stringify(acc, null, 2));
    if (acc?.customerId === "2229519701") {
      console.log("\n>>> BUG: draft is bound to the MCC account; cannot create campaigns there.");
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
