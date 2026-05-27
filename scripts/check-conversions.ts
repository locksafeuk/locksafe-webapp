/**
 * Check Google Ads conversion actions configured on the account.
 *
 * Prints each conversion action's resource name so you can set
 * GOOGLE_ADS_CONVERSION_ACTION_RESOURCE in the production env to the
 * "LockSafe Job Completed" action. Without that env, every offline
 * conversion upload from the Stripe webhook fails silently.
 */
import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client, customerId } = ctx;
  const rows = await client.query<any>(
    `SELECT conversion_action.id, conversion_action.name, conversion_action.status,
            conversion_action.type, conversion_action.category,
            conversion_action.primary_for_goal, conversion_action.tag_snippets
     FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
  );
  const cid = customerId.replace(/[^0-9]/g, "");
  for (const r of rows) {
    const ca = r.conversionAction;
    const resourceName = `customers/${cid}/conversionActions/${ca.id}`;
    console.log(`- ${ca.name}`);
    console.log(`    status=${ca.status}  type=${ca.type}  category=${ca.category}  primary=${ca.primaryForGoal}`);
    console.log(`    GOOGLE_ADS_CONVERSION_ACTION_RESOURCE=${resourceName}`);
  }
  console.log(`\nTotal: ${rows.length}`);
  console.log(`\nSet the resource name above for "LockSafe Job Completed" as`);
  console.log(`GOOGLE_ADS_CONVERSION_ACTION_RESOURCE in Vercel production env.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
