/**
 * Repair: re-point draft 6a0f8700240e1b81545583c7 from the MCC account to the
 * real operating account (www.locksafe.uk), reset its status to retry, and
 * deactivate the MCC GoogleAdsAccount row so future drafts can't be created
 * against it.
 */
import prisma from "@/lib/db";

const DRAFT_ID = "6a0f8700240e1b81545583c7";
const CHILD_ACCOUNT_ID = "6a04a82274a1cd54a87edb68"; // customerId 4715226378
const MCC_ACCOUNT_ID = "6a0f4a82fe3b046631ad43b8";   // customerId 2229519701

async function main() {
  // 1. Re-point + reset the draft
  const updated = await prisma.googleAdsCampaignDraft.update({
    where: { id: DRAFT_ID },
    data: {
      accountId: CHILD_ACCOUNT_ID,
      status: "PENDING_APPROVAL",
      publishError: null,
    },
    select: { id: true, name: true, status: true, accountId: true, publishError: true },
  });
  console.log("[draft] updated:", updated);

  // 2. Deactivate the MCC account row so the admin UI no longer offers it as a
  //    publish target. The row stays in the DB for audit.
  const deactivated = await prisma.googleAdsAccount.update({
    where: { id: MCC_ACCOUNT_ID },
    data: { isActive: false },
    select: { id: true, customerId: true, isActive: true },
  });
  console.log("[mcc] deactivated:", deactivated);

  // 3. Re-point any other drafts that were also bound to the MCC row
  const repointed = await prisma.googleAdsCampaignDraft.updateMany({
    where: { accountId: MCC_ACCOUNT_ID, status: { not: "PUBLISHED" } },
    data: { accountId: CHILD_ACCOUNT_ID },
  });
  console.log(`[drafts] re-pointed ${repointed.count} other non-published drafts from MCC -> child`);
}
main().catch((e) => { console.error(e); process.exit(1); });
