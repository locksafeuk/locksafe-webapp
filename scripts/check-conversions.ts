/**
 * Check Google Ads conversion actions configured on the account.
 */
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const rows = await client.query<any>(
    `SELECT conversion_action.id, conversion_action.name, conversion_action.status,
            conversion_action.type, conversion_action.category,
            conversion_action.primary_for_goal, conversion_action.tag_snippets
     FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
  );
  for (const r of rows) {
    const ca = r.conversionAction;
    console.log(`- [${ca.id}] ${ca.name}  status=${ca.status}  type=${ca.type}  category=${ca.category}  primary=${ca.primaryForGoal}`);
  }
  console.log(`\nTotal: ${rows.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
