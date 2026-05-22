/**
 * Harden the freshly-published AntiScam campaign (23876350462) the same way
 * we did for 23864393250:
 *   - bid strategy MAXIMIZE_CONVERSIONS -> MANUAL_CPC
 *   - geo targeting PRESENCE_OR_INTEREST -> PRESENCE only
 *   - ad group cpc_bid_micros -> £1.80
 *
 * Leaves campaign status PAUSED (caller decides when to enable).
 */
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const CAMPAIGN_ID = "23876350462";
const MANUAL_CPC_MAX_GBP = 1.8;
const DRY_RUN = process.env.DRY_RUN === "1";

function gbpToMicros(gbp: number): string {
  return String(Math.round(gbp * 1_000_000));
}

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("no client");
  const { client } = ctx;
  const cid = client.customerIdPlain;
  const campaignResource = buildResourceName(cid, "campaigns", CAMPAIGN_ID);

  // 1. Bid strategy -> MANUAL_CPC
  await client.mutate(
    "campaigns",
    [
      {
        update: {
          resourceName: campaignResource,
          manualCpc: { enhancedCpcEnabled: false },
        },
        updateMask: "manual_cpc.enhanced_cpc_enabled",
      },
    ],
    { validateOnly: DRY_RUN },
  );
  console.log("[bidding] MANUAL_CPC applied");

  // 2. Geo targeting mode -> PRESENCE only
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
  console.log("[geo] PRESENCE-only applied");

  // 3. Ad-group CPC bid ceiling
  const adGroups = await client.query<any>(
    `SELECT ad_group.id FROM ad_group
     WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group.status != 'REMOVED'`,
  );
  const agOps = adGroups.map((r: any) => ({
    update: {
      resourceName: buildResourceName(cid, "adGroups", r.adGroup.id),
      cpcBidMicros: gbpToMicros(MANUAL_CPC_MAX_GBP),
    },
    updateMask: "cpc_bid_micros",
  }));
  if (agOps.length) {
    await client.mutate("adGroups", agOps, { validateOnly: DRY_RUN });
    console.log(`[ad_groups] set cpc_bid £${MANUAL_CPC_MAX_GBP} on ${agOps.length} ad groups`);
  }

  // Verify
  const verify = await client.query<any>(
    `SELECT campaign.bidding_strategy_type,
            campaign.geo_target_type_setting.positive_geo_target_type,
            campaign.geo_target_type_setting.negative_geo_target_type,
            campaign.status, campaign.serving_status, campaign_budget.amount_micros
     FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}`,
  );
  console.log("[verify]", JSON.stringify(verify[0], null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
