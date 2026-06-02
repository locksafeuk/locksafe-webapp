/**
 * Enable the three published-but-PAUSED campaigns in Google Ads and verify
 * their landing-page URLs respond with HTTP 200.
 */
import { prisma } from "../src/lib/prisma";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

const DRAFT_IDS = [
  "6a1ef387059191233bbca850", // Midlands
  "6a1ef387059191233bbca84f", // North East
  "6a1ef386059191233bbca84e", // Yorkshire & Sheffield
];

async function checkUrl(url: string): Promise<{ url: string; status: number | string }> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return { url, status: res.status };
  } catch (e) {
    return { url, status: `ERROR: ${(e as Error).message}` };
  }
}

async function main() {
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { id: { in: DRAFT_IDS } },
    select: { id: true, name: true, googleCampaignId: true, finalUrl: true, status: true },
  });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active Google Ads account");
  const { client } = ctx;

  // ---- 1. Landing page health check ----
  console.log("=== Landing page checks ===");
  for (const d of drafts) {
    if (!d.finalUrl) {
      console.log({ draft: d.name, finalUrl: null, status: "MISSING" });
      continue;
    }
    const r = await checkUrl(d.finalUrl);
    console.log({ draft: d.name, ...r });
  }

  // ---- 2. Enable each campaign ----
  console.log("\n=== Enabling campaigns ===");
  for (const d of drafts) {
    if (!d.googleCampaignId) {
      console.log({ draft: d.name, action: "skip", reason: "no googleCampaignId" });
      continue;
    }
    const resourceName = `customers/${client.customerIdPlain}/campaigns/${d.googleCampaignId}`;
    try {
      await client.mutate("campaigns", [
        {
          update: { resourceName, status: "ENABLED" },
          updateMask: "status",
        },
      ]);
      console.log({ draft: d.name, campaignId: d.googleCampaignId, action: "ENABLED" });
    } catch (e) {
      console.error({ draft: d.name, campaignId: d.googleCampaignId, action: "ERROR", error: (e as Error).message });
    }
  }

  // ---- 3. Verify live status ----
  const ids = drafts.map((d) => d.googleCampaignId).filter((x): x is string => !!x);
  if (!ids.length) return;
  const gaql = `
    SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
           campaign_budget.amount_micros
    FROM campaign WHERE campaign.id IN (${ids.join(",")})
  `;
  const rows = await client.query<{
    campaign: { id: string; name: string; status: string; servingStatus: string };
    campaignBudget?: { amountMicros?: string };
  }>(gaql);
  console.log("\n=== Live status after enable ===");
  for (const r of rows) {
    console.log({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      servingStatus: r.campaign.servingStatus,
      dailyBudgetGBP: r.campaignBudget?.amountMicros ? Number(r.campaignBudget.amountMicros) / 1_000_000 : null,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
