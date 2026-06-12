/**
 * Resolve the conflict between preflight (says Bristol BS1 has no CALL
 * asset) and attach-call-assets (says it already has one). Query GAQL
 * directly with three different shapes.
 */

import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const BRISTOL_ID = "23915071322";

  console.log("\n=== A. campaign_asset rows for Bristol (any field_type) ===");
  const a = await client.query(`
    SELECT campaign.id, campaign.name, campaign_asset.field_type, asset.type, asset.resource_name
      FROM campaign_asset
     WHERE campaign.id = ${BRISTOL_ID}
  `);
  console.log(JSON.stringify(a, null, 2));

  console.log("\n=== B. campaign_asset rows for Bristol, field_type=CALL ===");
  const b = await client.query(`
    SELECT campaign.id, campaign.name, campaign_asset.field_type, asset.type, asset.resource_name
      FROM campaign_asset
     WHERE campaign.id = ${BRISTOL_ID}
       AND campaign_asset.field_type = CALL
  `);
  console.log(JSON.stringify(b, null, 2));

  console.log("\n=== C. Same query as preflight ===");
  const c = await client.query(`
    SELECT campaign.resource_name, campaign.name, campaign_asset.field_type, asset.type
      FROM campaign_asset
     WHERE campaign.status = ENABLED
       AND campaign_asset.field_type = CALL
  `);
  console.log(JSON.stringify(c, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
