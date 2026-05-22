/**
 * Switch campaign 23864393250 from PRESENCE_OR_INTEREST -> PRESENCE for positive
 * geo targeting. Stops Google serving ads to people merely "interested in" East
 * London (e.g. someone in Manchester searching about Hackney) — a common
 * silent budget drain on small local campaigns.
 *
 * Negative geo type is already PRESENCE (correct).
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/set-campaign-presence-only.ts
 */

import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const CAMPAIGN_ID = "23864393250";
const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const cid = client.customerIdPlain;
  const campaignResource = buildResourceName(cid, "campaigns", CAMPAIGN_ID);

  console.log(`[presence] -> PRESENCE on ${campaignResource} (dryRun=${DRY_RUN})`);
  await client.mutate(
    "campaigns",
    [
      {
        update: {
          resourceName: campaignResource,
          geoTargetTypeSetting: {
            positiveGeoTargetType: "PRESENCE",
            negativeGeoTargetType: "PRESENCE",
          },
        },
        updateMask: "geo_target_type_setting.positive_geo_target_type,geo_target_type_setting.negative_geo_target_type",
      },
    ],
    { validateOnly: DRY_RUN },
  );

  // Verify
  const rows = await client.query<any>(
    `SELECT campaign.geo_target_type_setting.positive_geo_target_type,
            campaign.geo_target_type_setting.negative_geo_target_type
     FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}`,
  );
  console.log("[verify]", JSON.stringify(rows[0], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
