/**
 * Live Google Ads campaign status — the truth the dashboard's stored status
 * can't show on its own.
 *
 * A draft can be PUBLISHED in our DB but, in Google Ads, the campaign may be
 * ENABLED while its ad group / ad are PAUSED ("DORMANT" — won't serve), or the
 * campaign may have been paused/removed entirely. This queries Google Ads live
 * and returns a serving label per campaign id:
 *
 *   SERVING   — campaign + ad group + ad all ENABLED (actually running)
 *   DORMANT   — campaign ENABLED but ad group or ad PAUSED (won't serve)
 *   PAUSED    — campaign PAUSED
 *   REMOVED   — campaign REMOVED on Google Ads
 *   UNKNOWN   — Google Ads didn't return the id (stale id, or not propagated)
 *
 * Shared by the drift-sync cron and the admin "Check live status" button.
 */

import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

export type LiveLabel = "SERVING" | "DORMANT" | "PAUSED" | "REMOVED" | "UNKNOWN";

export interface LiveStatus {
  label: LiveLabel;
  campaignStatus: string; // raw Google Ads campaign.status, or "MISSING"
}

interface AdGroupAdRow {
  campaign: { id: string; name: string; status: string };
  adGroup: { id: string; status: string };
  adGroupAd: { ad: { id: string }; status: string };
}

interface LiveAgg {
  status: string;
  enabledAdGroups: number;
  enabledAds: number;
}

function classify(agg: LiveAgg | undefined): LiveLabel {
  if (!agg) return "UNKNOWN";
  if (agg.status === "REMOVED") return "REMOVED";
  if (agg.status === "PAUSED") return "PAUSED";
  if (agg.status !== "ENABLED") return "UNKNOWN";
  if (agg.enabledAdGroups === 0 || agg.enabledAds === 0) return "DORMANT";
  return "SERVING";
}

/**
 * Query Google Ads for the live serving label of each campaign id.
 * Returns a Map keyed by campaign id. Ids that aren't numeric are skipped.
 * Throws if there's no active GoogleAdsAccount.
 */
export async function fetchLiveLabels(
  campaignIds: string[],
): Promise<Map<string, LiveStatus>> {
  const out = new Map<string, LiveStatus>();
  const ids = Array.from(new Set(campaignIds.filter((id) => /^[0-9]+$/.test(id))));
  if (ids.length === 0) return out;

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;

  // ad_group_ad gives campaign + ad_group + ad statuses in one query, but
  // REMOVED-only campaigns have no ad_group_ad children — so we also pull the
  // top-level campaign rows to catch PAUSED/REMOVED.
  const adRows = await client.query<AdGroupAdRow>(`
    SELECT campaign.id, campaign.name, campaign.status,
           ad_group.id, ad_group.status,
           ad_group_ad.ad.id, ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id IN (${ids.join(",")})
  `);
  const campaignRows = await client.query<{
    campaign: { id: string; name: string; status: string };
  }>(`
    SELECT campaign.id, campaign.name, campaign.status
    FROM campaign
    WHERE campaign.id IN (${ids.join(",")})
  `);

  const agg = new Map<string, LiveAgg>();
  for (const r of campaignRows) {
    agg.set(r.campaign.id, { status: r.campaign.status, enabledAdGroups: 0, enabledAds: 0 });
  }
  const seenAdGroups = new Map<string, Set<string>>();
  for (const r of adRows) {
    const a = agg.get(r.campaign.id);
    if (!a) continue;
    const seen = seenAdGroups.get(r.campaign.id) ?? new Set<string>();
    if (!seen.has(r.adGroup.id)) {
      seen.add(r.adGroup.id);
      if (r.adGroup.status === "ENABLED") a.enabledAdGroups++;
    }
    seenAdGroups.set(r.campaign.id, seen);
    if (r.adGroupAd.status === "ENABLED") a.enabledAds++;
  }

  for (const id of ids) {
    const a = agg.get(id);
    out.set(id, { label: classify(a), campaignStatus: a?.status ?? "MISSING" });
  }
  return out;
}
