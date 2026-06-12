/**
 * GET /api/admin/google-ads/health
 *
 * Real-time health view for every live-ish Locksafe campaign. Joins:
 *   • Locksafe state (status, dailyBudget, publishedAt, finalUrl)
 *   • Google Ads live state via GAQL (campaign + ad_group + ad status,
 *     impressions/clicks/cost/conversions over rolling 7 days)
 *   • Landing-page health (HEAD request to the campaign's finalUrl)
 *
 * Returns one row per draft with a derived "label" the UI uses to
 * colour-code health:
 *
 *   GREEN      — SERVING + landing 200 + > 0 conversions in last 7d
 *   YELLOW     — SERVING + landing 200 + 0 conversions in last 7d
 *   YELLOW     — DORMANT (operator decision pending)
 *   ORANGE     — PAUSED + landing OK (probably auto-paused or operator)
 *   ORANGE     — landing returns 4xx/5xx (broken finalUrl)
 *   RED        — REMOVED on Google Ads side
 *   GREY       — UNKNOWN (Google Ads didn't return the campaign)
 *
 * Auth: admin only.
 *
 * No caching — every load is a fresh GAQL call + HEAD requests. Use
 * sparingly; this is a debug/triage view, not a high-traffic page.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const LANDING_HEALTH_TIMEOUT_MS = 5_000;
const ROLLING_DAYS = 7;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface AdGroupAdRow {
  campaign:    { id: string; name: string; status: string };
  adGroup:     { id: string; status: string };
  adGroupAd:   { ad: { id: string }; status: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
  };
}

type HealthLabel = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY";
type LiveLabel   = "SERVING" | "DORMANT" | "PAUSED" | "REMOVED" | "UNKNOWN";
type LandingLabel = "ok" | "broken" | "skipped" | "unknown";

interface HealthRow {
  id:                 string;
  name:               string;
  locksafeStatus:     string;
  dailyBudget:        number;
  publishedAt:        string | null;
  daysSincePublished: number | null;
  finalUrl:           string | null;
  googleCampaignId:   string | null;
  live:               LiveLabel;
  liveCampaignStatus: string | null;
  enabledAdGroups:    number;
  totalAdGroups:      number;
  enabledAds:         number;
  totalAds:           number;
  rolling: {
    impressions: number;
    clicks:      number;
    spend:       number;
    conversions: number;
  };
  landing: {
    status: LandingLabel;
    code:   number | null;
  };
  label: HealthLabel;
  note:  string;
}

async function checkLandingHealth(finalUrl: string | null): Promise<{
  status: LandingLabel;
  code:   number | null;
}> {
  if (!finalUrl) return { status: "skipped", code: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LANDING_HEALTH_TIMEOUT_MS);
    const res = await fetch(finalUrl, {
      method: "HEAD", redirect: "follow", signal: controller.signal,
      headers: { "user-agent": "Locksafe-Health-Dashboard/1.0" },
    });
    clearTimeout(timer);
    return { status: res.ok ? "ok" : "broken", code: res.status };
  } catch {
    return { status: "broken", code: null };
  }
}

function classifyLive(agg: {
  status: string; enabledAdGroups: number; enabledAds: number;
} | undefined): LiveLabel {
  if (!agg) return "UNKNOWN";
  if (agg.status === "REMOVED") return "REMOVED";
  if (agg.status === "PAUSED")  return "PAUSED";
  if (agg.status !== "ENABLED") return "UNKNOWN";
  if (agg.enabledAdGroups === 0 || agg.enabledAds === 0) return "DORMANT";
  return "SERVING";
}

function classifyHealth(
  live: LiveLabel,
  landing: LandingLabel,
  conversions: number,
): { label: HealthLabel; note: string } {
  if (live === "REMOVED") {
    return { label: "RED", note: "Campaign removed on Google Ads side — Locksafe needs to sync" };
  }
  if (live === "UNKNOWN") {
    return { label: "GREY", note: "Google Ads did not return this campaign — verify ID" };
  }
  if (landing === "broken") {
    return { label: "ORANGE", note: "Landing page returning non-200 — auto-pause is holding off, but spend is wasted" };
  }
  if (live === "PAUSED") {
    return { label: "ORANGE", note: "Paused — won't serve until campaign is enabled" };
  }
  if (live === "DORMANT") {
    return { label: "YELLOW", note: "Campaign enabled but ad group/ad paused — won't serve until both are enabled" };
  }
  // SERVING
  if (conversions > 0) {
    return { label: "GREEN", note: "Healthy: serving + converting" };
  }
  return { label: "YELLOW", note: "Serving but no conversions in last 7d — monitor closely" };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull all live-ish drafts (PUBLISHED + PAUSED + PUBLISHING). PAUSED
  // is included so admins can spot what's currently down.
  const drafts: Array<{
    id: string; name: string; status: string; dailyBudget: number;
    publishedAt: Date | null; finalUrl: string | null;
    googleCampaignId: string | null;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status: { in: ["PUBLISHED", "PUBLISHING", "PAUSED"] },
      googleCampaignId: { not: null },
    },
    select: {
      id: true, name: true, status: true, dailyBudget: true,
      publishedAt: true, finalUrl: true, googleCampaignId: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return NextResponse.json({
      error: "No active GoogleAdsAccount", rows: [], generatedAt: new Date().toISOString(),
    }, { status: 503 });
  }
  const { client } = ctx;

  const ids = drafts
    .map((d) => d.googleCampaignId)
    .filter((id): id is string => !!id && /^[0-9]+$/.test(id));

  // Aggregate live state from ad_group_ad (gets adgroup+ad statuses
  // in one shot), plus a top-level pass to catch REMOVED campaigns.
  const since = new Date(Date.now() - ROLLING_DAYS * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = new Date().toISOString().slice(0, 10);

  let adRows: AdGroupAdRow[] = [];
  let campRows: Array<{ campaign: { id: string; name: string; status: string } }> = [];
  let perfRows: Array<{
    campaign: { id: string };
    metrics: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number };
  }> = [];

  try {
  if (ids.length > 0) {
    [adRows, campRows, perfRows] = await Promise.all([
      client.query<AdGroupAdRow>(`
        SELECT campaign.id, campaign.name, campaign.status,
               ad_group.id, ad_group.status,
               ad_group_ad.ad.id, ad_group_ad.status
        FROM ad_group_ad
        WHERE campaign.id IN (${ids.join(",")})
      `),
      client.query<{ campaign: { id: string; name: string; status: string } }>(`
        SELECT campaign.id, campaign.name, campaign.status
        FROM campaign
        WHERE campaign.id IN (${ids.join(",")})
      `),
      client.query<{
        campaign: { id: string };
        metrics: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number };
      }>(`
        SELECT campaign.id,
               metrics.impressions, metrics.clicks,
               metrics.cost_micros, metrics.conversions
        FROM campaign
        WHERE campaign.id IN (${ids.join(",")})
          AND segments.date BETWEEN '${sinceStr}' AND '${untilStr}'
      `),
    ]);
  }
  } catch (err) {
    // Previously any GAQL failure here (token refresh, bad campaign id, API
    // quota, transient Google outage) threw unhandled → the route returned an
    // opaque 500 with an EMPTY body, so the health dashboard just broke with no
    // explanation. Now it degrades to a structured 502 that names the actual
    // cause, and logs it server-side for diagnosis.
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[google-ads/health] GAQL query failed:", msg);
    return NextResponse.json({
      error: "Google Ads query failed",
      detail: msg,
      generatedAt: new Date().toISOString(),
    }, { status: 502 });
  }

  const liveAgg = new Map<string, {
    status: string; adGroupCount: number; enabledAdGroups: number;
    adCount: number; enabledAds: number;
  }>();
  for (const r of campRows) {
    liveAgg.set(r.campaign.id, {
      status: r.campaign.status,
      adGroupCount: 0, enabledAdGroups: 0,
      adCount: 0,      enabledAds: 0,
    });
  }
  const seenAg = new Map<string, Set<string>>();
  for (const r of adRows) {
    const agg = liveAgg.get(r.campaign.id);
    if (!agg) continue;
    const ag = seenAg.get(r.campaign.id) ?? new Set<string>();
    if (!ag.has(r.adGroup.id)) {
      ag.add(r.adGroup.id);
      agg.adGroupCount++;
      if (r.adGroup.status === "ENABLED") agg.enabledAdGroups++;
    }
    seenAg.set(r.campaign.id, ag);
    agg.adCount++;
    if (r.adGroupAd.status === "ENABLED") agg.enabledAds++;
  }

  const perfAgg = new Map<string, { imp: number; clk: number; cost: number; conv: number }>();
  for (const r of perfRows) {
    const agg = perfAgg.get(r.campaign.id) ?? { imp: 0, clk: 0, cost: 0, conv: 0 };
    agg.imp  += Number(r.metrics.impressions ?? 0);
    agg.clk  += Number(r.metrics.clicks ?? 0);
    agg.cost += Number(r.metrics.costMicros ?? 0) / 1_000_000;
    agg.conv += Number(r.metrics.conversions ?? 0);
    perfAgg.set(r.campaign.id, agg);
  }

  // Landing-page checks in parallel (5s per timeout). Capped at ~30
  // concurrent — for typical Locksafe sizes (< 50 live campaigns) this
  // is fine and finishes inside the function maxDuration.
  const rows: HealthRow[] = await Promise.all(drafts.map(async (d) => {
    const cid = d.googleCampaignId!;
    const agg = liveAgg.get(cid);
    const liveLabel = classifyLive(agg);
    const perf = perfAgg.get(cid) ?? { imp: 0, clk: 0, cost: 0, conv: 0 };
    const landing = await checkLandingHealth(d.finalUrl);
    const days = d.publishedAt
      ? Math.floor((Date.now() - d.publishedAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const { label, note } = classifyHealth(liveLabel, landing.status, perf.conv);

    return {
      id:                 d.id,
      name:               d.name,
      locksafeStatus:     d.status,
      dailyBudget:        d.dailyBudget,
      publishedAt:        d.publishedAt?.toISOString() ?? null,
      daysSincePublished: days,
      finalUrl:           d.finalUrl,
      googleCampaignId:   cid,
      live:               liveLabel,
      liveCampaignStatus: agg?.status ?? null,
      enabledAdGroups:    agg?.enabledAdGroups ?? 0,
      totalAdGroups:      agg?.adGroupCount ?? 0,
      enabledAds:         agg?.enabledAds ?? 0,
      totalAds:           agg?.adCount ?? 0,
      rolling: {
        impressions: perf.imp,
        clicks:      perf.clk,
        spend:       perf.cost,
        conversions: perf.conv,
      },
      landing,
      label,
      note,
    };
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    rollingDays: ROLLING_DAYS,
    totals: {
      campaigns:   rows.length,
      green:       rows.filter((r) => r.label === "GREEN").length,
      yellow:      rows.filter((r) => r.label === "YELLOW").length,
      orange:      rows.filter((r) => r.label === "ORANGE").length,
      red:         rows.filter((r) => r.label === "RED").length,
      grey:        rows.filter((r) => r.label === "GREY").length,
      totalSpend:  rows.reduce((s, r) => s + r.rolling.spend, 0),
      totalConv:   rows.reduce((s, r) => s + r.rolling.conversions, 0),
    },
    rows,
  });
}
