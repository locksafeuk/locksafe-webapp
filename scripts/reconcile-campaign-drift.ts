/**
 * Reconcile drift between Locksafe's GoogleAdsCampaignDraft.status and
 * what Google Ads actually reports for the same campaigns.
 *
 * Why this script exists. During the 2026-05-26 launch we discovered
 * Locksafe marks several campaigns "PUBLISHED" while Google Ads has them
 * Removed, or has the campaign Enabled but ad group + ad both Paused
 * (status "Not eligible — All ad groups are paused"). Locksafe doesn't
 * auto-sync — the publishedSnapshot is only refreshed on demand. This
 * script does the comparison once, reports drift, and leaves the user to
 * decide remediation (rather than auto-mutating live ads).
 *
 * For each Locksafe draft with a googleCampaignId AND a non-DRAFT,
 * non-REJECTED status, the script:
 *   1. Pulls campaign + ad group + ad status from Google Ads via GAQL.
 *   2. Computes a "live state" label:
 *        SERVING       — campaign+adgroup+ad all ENABLED
 *        DORMANT       — campaign ENABLED but adgroup or ad PAUSED
 *        PAUSED        — campaign PAUSED
 *        REMOVED       — campaign REMOVED on Google Ads side
 *        UNKNOWN       — Google Ads didn't return the campaign ID
 *   3. Compares to Locksafe's recorded status and prints a drift report.
 *
 * Does NOT modify either side — read-only.
 *
 * Usage: ./reconcile-campaign-drift.command
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── GAQL result type ────────────────────────────────────────────────────────

interface AdGroupAdRow {
  campaign:    { id: string; name: string; status: string };
  adGroup:     { id: string; status: string };
  adGroupAd:   { ad: { id: string }; status: string };
}

type LiveLabel = "SERVING" | "DORMANT" | "PAUSED" | "REMOVED" | "UNKNOWN";

interface LiveState {
  campaignName:    string;
  campaignStatus:  string;            // raw Google Ads enum
  adGroupCount:    number;
  enabledAdGroups: number;
  adCount:         number;
  enabledAds:      number;
  label:           LiveLabel;
}

function classify(state: Omit<LiveState, "label">): LiveLabel {
  if (state.campaignStatus === "REMOVED") return "REMOVED";
  if (state.campaignStatus === "PAUSED")  return "PAUSED";
  if (state.campaignStatus !== "ENABLED") return "UNKNOWN";
  // Campaign ENABLED — check downstream.
  if (state.enabledAdGroups === 0 || state.enabledAds === 0) return "DORMANT";
  return "SERVING";
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("▶ Reconciling Locksafe campaign drafts ↔ Google Ads live state");
  console.log("");

  const drafts: Array<{
    id:               string;
    name:             string;
    status:           string;          // Locksafe lifecycle status
    googleCampaignId: string | null;
    dailyBudget:      number;
    publishedAt:      Date | null;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      googleCampaignId: { not: null },
      status: { in: ["PUBLISHED", "PUBLISHING", "PAUSED", "FAILED"] },
    },
    select: {
      id: true, name: true, status: true, googleCampaignId: true,
      dailyBudget: true, publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  if (drafts.length === 0) {
    console.log("  (no published drafts to reconcile)");
    return;
  }

  console.log(`  Found ${drafts.length} Locksafe draft${drafts.length === 1 ? "" : "s"} with a Google campaign ID.`);
  console.log("");

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    console.error("✗ No active GoogleAdsAccount in the DB — can't query Google Ads.");
    process.exit(1);
  }
  const { client, customerId } = ctx;
  console.log(`  Google Ads customer: ${customerId}`);
  console.log("");

  // Build a safe IN(...) list from the integer-only campaign IDs.
  const ids: string[] = [];
  for (const d of drafts) {
    if (!d.googleCampaignId) continue;
    if (!/^[0-9]+$/.test(d.googleCampaignId)) {
      console.warn(`  ⚠ skipping non-integer campaign ID for draft "${d.name}": ${d.googleCampaignId}`);
      continue;
    }
    ids.push(d.googleCampaignId);
  }
  if (ids.length === 0) {
    console.error("  ✗ No valid campaign IDs to query.");
    process.exit(1);
  }

  const gaql = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      ad_group.id,
      ad_group.status,
      ad_group_ad.ad.id,
      ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id IN (${ids.join(",")})
  `;

  let rows: AdGroupAdRow[];
  try {
    rows = await client.query<AdGroupAdRow>(gaql);
  } catch (err) {
    console.error("✗ Google Ads query failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ad_group_ad query won't surface REMOVED-only campaigns (no ads remain
  // under them). Do a second top-level pass to catch those — REMOVED
  // campaigns may still appear in `FROM campaign`.
  let removedRows: Array<{ campaign: { id: string; name: string; status: string } }>;
  try {
    removedRows = await client.query<{ campaign: { id: string; name: string; status: string } }>(`
      SELECT campaign.id, campaign.name, campaign.status
      FROM campaign
      WHERE campaign.id IN (${ids.join(",")})
    `);
  } catch (err) {
    console.error("✗ Top-level campaign query failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Aggregate live state per campaign ID.
  const liveByCampaign = new Map<string, Omit<LiveState, "label">>();
  for (const r of removedRows) {
    liveByCampaign.set(r.campaign.id, {
      campaignName:    r.campaign.name,
      campaignStatus:  r.campaign.status,
      adGroupCount:    0,
      enabledAdGroups: 0,
      adCount:         0,
      enabledAds:      0,
    });
  }
  // Track unique ad groups + ads per campaign
  const adGroupsSeen = new Map<string, Set<string>>();
  for (const r of rows) {
    const cid = r.campaign.id;
    const live = liveByCampaign.get(cid);
    if (!live) continue;
    const ags = adGroupsSeen.get(cid) ?? new Set<string>();
    if (!ags.has(r.adGroup.id)) {
      ags.add(r.adGroup.id);
      live.adGroupCount++;
      if (r.adGroup.status === "ENABLED") live.enabledAdGroups++;
    }
    adGroupsSeen.set(cid, ags);
    live.adCount++;
    if (r.adGroupAd.status === "ENABLED") live.enabledAds++;
  }

  // Report
  console.log("──────────────────────────────────────────────────────────────");
  console.log("");
  let driftCount = 0;
  for (const d of drafts) {
    const cid = d.googleCampaignId!;
    const raw = liveByCampaign.get(cid);
    const live: LiveState = raw
      ? { ...raw, label: classify(raw) }
      : {
          campaignName: "(not found)", campaignStatus: "MISSING",
          adGroupCount: 0, enabledAdGroups: 0, adCount: 0, enabledAds: 0,
          label: "UNKNOWN",
        };

    // Drift detection
    let drift: string | null = null;
    if (live.label === "REMOVED" && d.status !== "PAUSED" && d.status !== "FAILED") {
      drift = "Locksafe says published, Google Ads has REMOVED the campaign";
    } else if (live.label === "DORMANT" && d.status === "PUBLISHED") {
      drift = "Locksafe says published, but ad group or ad is paused — won't serve";
    } else if (live.label === "UNKNOWN") {
      drift = "Google Ads doesn't recognise this campaign ID";
    } else if (live.label === "SERVING" && d.status === "PAUSED") {
      drift = "Locksafe thinks paused, but Google Ads is actively serving";
    }

    const marker = drift ? "✗ DRIFT " : "✓ in sync";
    console.log(`  ${marker}  ${d.name}`);
    console.log(`     Locksafe: status=${d.status.padEnd(12)} dailyBudget=£${d.dailyBudget.toFixed(2).padStart(6)}  publishedAt=${d.publishedAt?.toISOString() ?? "—"}`);
    console.log(`     Live:     ${live.label.padEnd(12)} campaign=${live.campaignStatus.padEnd(8)}  adgroups=${live.enabledAdGroups}/${live.adGroupCount} enabled  ads=${live.enabledAds}/${live.adCount} enabled`);
    if (drift) {
      console.log(`     ⚠ ${drift}`);
      driftCount++;
    }
    console.log("");
  }

  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Summary: ${drafts.length} drafts scanned, ${driftCount} drift case${driftCount === 1 ? "" : "s"}.`);
  if (driftCount > 0) {
    console.log("");
    console.log("Suggested next steps:");
    console.log("  • REMOVED drifts: update Locksafe status to PAUSED or FAILED to reflect reality.");
    console.log("  • DORMANT drifts: either unpause the ad group + ad on Google Ads, or pause in Locksafe.");
    console.log("  • UNKNOWN drifts: clear googleCampaignId if the campaign was deleted, or investigate ID mismatch.");
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("✗ Failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
