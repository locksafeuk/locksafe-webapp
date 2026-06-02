/**
 * Check live status in Google Ads for the three campaigns we just published.
 * Reports campaign.status and campaign.serving_status from the live API.
 */
import { prisma } from "../src/lib/prisma";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

const DRAFT_IDS = [
  "6a1ef387059191233bbca850",
  "6a1ef387059191233bbca84f",
  "6a1ef386059191233bbca84e",
];

async function main() {
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { id: { in: DRAFT_IDS } },
    select: {
      id: true,
      name: true,
      status: true,
      googleCampaignId: true,
      publishError: true,
    },
  });

  console.log("=== DB draft status ===");
  for (const d of drafts) console.log(d);

  const ids = drafts
    .map((d) => d.googleCampaignId)
    .filter((x): x is string => !!x);
  if (!ids.length) {
    console.log("No googleCampaignId values to query.");
    return;
  }

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    console.log("No active Google Ads account configured.");
    return;
  }
  const client = ctx.client;
  const gaql = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.serving_status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id IN (${ids.join(",")})
  `;
  const rows = await client.query<{
    campaign: {
      id: string;
      name: string;
      status: string;
      servingStatus: string;
      advertisingChannelType: string;
    };
    campaignBudget?: { amountMicros?: string };
  }>(gaql);

  console.log("\n=== Live Google Ads status ===");
  for (const r of rows) {
    console.log({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      servingStatus: r.campaign.servingStatus,
      channel: r.campaign.advertisingChannelType,
      dailyBudgetGBP: r.campaignBudget?.amountMicros
        ? Number(r.campaignBudget.amountMicros) / 1_000_000
        : null,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
