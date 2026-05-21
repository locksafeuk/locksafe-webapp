/**
 * Removes duplicate/dangling PAUSED campaigns named
 * "LockSafe | Emergency Locksmith UK | Search" from Google Ads.
 * Run before re-publishing a draft with the same name.
 */
import prisma from "../src/lib/db";
import { getGoogleAdsClientForAccount } from "../src/lib/google-ads";

const CAMPAIGN_NAME = "LockSafe | Emergency Locksmith UK | Search";

async function main() {
  const accounts = await prisma.googleAdsAccount.findMany({
    where: { isActive: true },
  });

  for (const account of accounts) {
    console.log(`\nChecking account ${account.customerId}…`);
    const client = await getGoogleAdsClientForAccount(account.id);
    if (!client) {
      console.log("  No client (skip)");
      continue;
    }

    const rows = await client.query<{
      campaign: { resourceName: string; id: string; name: string; status: string };
    }>(
      `SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status
       FROM campaign
       WHERE campaign.name = '${CAMPAIGN_NAME.replace(/'/g, "\\'")}'
         AND campaign.status != 'REMOVED'`,
    );

    if (rows.length === 0) {
      console.log("  No matching campaigns found.");
      continue;
    }

    for (const row of rows) {
      const { resourceName, id, status } = row.campaign;
      console.log(`  Removing campaign id=${id} status=${status} name="${row.campaign.name}"`);
      await client.mutate("campaigns", [{ remove: resourceName }]);
      console.log(`  ✓ Removed`);
    }
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
