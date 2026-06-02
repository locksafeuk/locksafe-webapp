/**
 * Removes a fixed set of duplicate Google Ads campaigns and deletes the
 * matching Locksafe draft rows.
 *
 * Dry-run by default. Pass --apply to remove live Google Ads campaigns and
 * then delete the corresponding GoogleAdsCampaignDraft rows.
 */
import prisma from "../src/lib/db";
import { getGoogleAdsClientForAccount } from "../src/lib/google-ads";

const APPLY = process.argv.includes("--apply");

const TARGET_NAMES = [
  "LockSafe · B2B · BS1",
  "LockSafe · Trust · M1",
  "LockSafe · Trust · LS1",
  "Locksmith — Locksafe UK (TW20)",
  "LockSafe Emergency Locksmith UK Cities",
  "AntiScam",
  "LockSafeEmergency Locksmith UK",
];

async function removeGoogleCampaign(row: {
  accountId: string;
  googleCampaignId: string | null;
  name: string;
}) {
  if (!row.googleCampaignId || !/^[0-9]+$/.test(row.googleCampaignId)) {
    return { removed: false, reason: "missing-or-invalid-googleCampaignId" };
  }

  const client = await getGoogleAdsClientForAccount(row.accountId);
  if (!client) {
    throw new Error(`No active Google Ads client for ${row.name}`);
  }

  const liveRows = await client.query<{
    campaign: { resourceName: string; id: string; name: string; status: string };
  }>(`
    SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status
    FROM campaign
    WHERE campaign.id = ${row.googleCampaignId}
  `);

  const live = liveRows[0]?.campaign;
  if (!live) {
    return { removed: false, reason: "already-missing-from-google-ads" };
  }

  if (live.status === "REMOVED") {
    return { removed: false, reason: "already-removed-from-google-ads" };
  }

  if (!APPLY) {
    return { removed: true, reason: `would-remove-live-campaign-${live.status}` };
  }

  await client.mutate("campaigns", [{ remove: live.resourceName }]);
  return { removed: true, reason: `removed-live-campaign-${live.status}` };
}

async function main() {
  console.log(`▶ Google Ads duplicate cleanup — ${APPLY ? "APPLY" : "DRY RUN"}`);

  const rows = await prisma.googleAdsCampaignDraft.findMany({
    where: { name: { in: TARGET_NAMES } },
    select: {
      id: true,
      accountId: true,
      name: true,
      status: true,
      googleCampaignId: true,
    },
    orderBy: { name: "asc" },
  });

  if (rows.length === 0) {
    console.log("  No matching rows found.");
    return;
  }

  console.log(`  Matched ${rows.length} row${rows.length === 1 ? "" : "s"}:`);
  for (const row of rows) {
    console.log(`  • ${row.status.padEnd(10)} ${row.name} ${row.googleCampaignId ?? ""}`);
  }

  let deleted = 0;
  for (const row of rows) {
    const result = await removeGoogleCampaign(row);
    console.log(`  → ${row.name}: ${result.reason}`);

    if (APPLY) {
      if (result.removed && result.reason.startsWith("removed-live-campaign")) {
        await prisma.googleAdsCampaignDraft.delete({ where: { id: row.id } });
        deleted += 1;
        console.log(`    ✓ deleted draft row`);
      } else if (result.reason === "already-missing-from-google-ads" || result.reason === "already-removed-from-google-ads") {
        await prisma.googleAdsCampaignDraft.delete({ where: { id: row.id } });
        deleted += 1;
        console.log(`    ✓ deleted stale draft row`);
      } else {
        console.log(`    ! skipped DB delete`);
      }
    }
  }

  if (APPLY) {
    console.log(`  Deleted ${deleted} row${deleted === 1 ? "" : "s"}.`);
  } else {
    console.log("  Dry-run only. Re-run with --apply to remove the campaigns and delete rows.");
  }
}

main()
  .catch((error) => {
    console.error("✗ Failed:");
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });