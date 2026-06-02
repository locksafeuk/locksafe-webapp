/**
 * GET /api/admin/google-ads/performance?days=30
 *
 * Returns campaign-level performance metrics enriched with draft data.
 * Handles gracefully when Google Ads API is not yet approved.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import prisma from "@/lib/db";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export interface CampaignPerf {
  campaignId: string;
  campaignName: string;
  status: string;
  costMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionsValue: number;
  averageCpc: number;
  searchImpressionShare: number;
  // Enriched from draft
  draftId?: string;
  draftName?: string;
  dailyBudget?: number;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? "30")));

  // Build date range
  const until = new Date();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const clientData = await getDefaultGoogleAdsClient();
  if (!clientData) {
    return NextResponse.json({
      campaigns: [],
      summary: { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpa: 0 },
      asOf: new Date().toISOString(),
      noAccount: true,
    });
  }

  const { client } = clientData;

  const gaql = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.conversions_value,
      metrics.average_cpc,
      metrics.search_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${fmt(since)}' AND '${fmt(until)}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  try {
    const rows = await client.query<{
      campaign: { id: string; name: string; status: string };
      metrics: {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        ctr?: number;
        conversions?: number;
        conversionsValue?: number;
        averageCpc?: string;
        searchImpressionShare?: number;
      };
    }>(gaql);

    // Load all published drafts for enrichment
    const publishedDrafts = await prisma.googleAdsCampaignDraft.findMany({
      where: { status: "PUBLISHED", googleCampaignId: { not: null } },
      select: { id: true, name: true, dailyBudget: true, googleCampaignId: true },
    });
    const draftMap = new Map(publishedDrafts.map((d) => [d.googleCampaignId!, d]));

    const campaigns: CampaignPerf[] = rows.map((r) => {
      const draft = draftMap.get(r.campaign.id);
      return {
        campaignId: r.campaign.id,
        campaignName: r.campaign.name,
        status: r.campaign.status,
        costMicros: Number(r.metrics.costMicros ?? 0),
        impressions: Number(r.metrics.impressions ?? 0),
        clicks: Number(r.metrics.clicks ?? 0),
        ctr: Number(r.metrics.ctr ?? 0),
        conversions: Number(r.metrics.conversions ?? 0),
        conversionsValue: Number(r.metrics.conversionsValue ?? 0),
        averageCpc: Number(r.metrics.averageCpc ?? 0),
        searchImpressionShare: Number(r.metrics.searchImpressionShare ?? 0),
        draftId: draft?.id,
        draftName: draft?.name,
        dailyBudget: draft?.dailyBudget,
      };
    });

    const totalSpend = campaigns.reduce((sum, c) => sum + c.costMicros, 0) / 1_000_000;
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const totalRoas = totalSpend > 0
      ? campaigns.reduce((sum, c) => sum + c.conversionsValue, 0) / totalSpend
      : 0;

    return NextResponse.json({
      campaigns,
      summary: { totalSpend, totalClicks, totalConversions, avgCpa, totalRoas },
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NOT_AUTHENTICATED") || msg.includes("PERMISSION_DENIED")) {
      return NextResponse.json({
        campaigns: [],
        summary: { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpa: 0, totalRoas: 0 },
        asOf: new Date().toISOString(),
        apiError: msg,
      });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
