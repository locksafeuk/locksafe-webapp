/**
 * GET /api/admin/google-ads/ghost-audit
 *
 * Find every Google Ads campaign in the connected account that is NOT
 * tracked by a GoogleAdsCampaignDraft in our DB. These "ghosts" escape
 * the entire LockSafe safety system:
 *   - 14 harsh persist-time rules (channel, geo, keywords, etc.)
 *   - Rule #14 per-account daily spend cap
 *   - Post-publish verifier cron
 *   - Coverage rule (≥2 locksmiths within 10mi)
 *
 * Caused the 2026-06-09 Yorkshire ghost discovery — a "LockSafe |
 * Yorkshire & Sheffield | Final" campaign without date suffix was
 * SERVING at £11.44 spend while our DB only knew about the
 * "Yorkshire & Sheffield | Final 2026-06-02" duplicate (paused).
 *
 * Auth: admin JWT cookie. Read-only — does NOT mutate.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface CampaignRow {
  campaign: {
    id: string;
    name: string;
    status: string;
    biddingStrategyType?: string;
    advertisingChannelType?: string;
  };
  campaignBudget?: { amountMicros?: string };
  metrics?: {
    costMicros?: string;
    clicks?: string;
    impressions?: string;
    conversions?: number;
  };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return NextResponse.json({ error: "No active GoogleAdsAccount" }, { status: 500 });
  }
  // getDefaultGoogleAdsClient returns { client, accountId, customerId }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  // Pull every non-REMOVED campaign in the live account, with cost+budget.
  // Lifetime metrics (no date filter) — matches the screenshot reading.
  const rows = (await client.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.bidding_strategy_type,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `)) as CampaignRow[];

  // Pull every DB-tracked draft for cross-reference.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbDrafts = await (prisma.googleAdsCampaignDraft as any).findMany({
    where: { googleCampaignId: { not: null } },
    select: { id: true, name: true, googleCampaignId: true, status: true, pausedAt: true },
  });
  const dbByGoogleId = new Map<string, (typeof dbDrafts)[number]>();
  for (const d of dbDrafts) {
    if (d.googleCampaignId) dbByGoogleId.set(d.googleCampaignId, d);
  }

  const ghosts: Record<string, unknown>[] = [];
  const tracked: Record<string, unknown>[] = [];

  for (const r of rows) {
    const c = r.campaign;
    const dbRow = dbByGoogleId.get(c.id);
    const costMicros = Number(r.metrics?.costMicros ?? 0);
    const budgetMicros = Number(r.campaignBudget?.amountMicros ?? 0);
    const entry = {
      googleCampaignId: c.id,
      name: c.name,
      googleStatus: c.status,
      channel: c.advertisingChannelType,
      bidding: c.biddingStrategyType,
      lifetimeCostGbp: Number((costMicros / 1_000_000).toFixed(2)),
      dailyBudgetGbp: Number((budgetMicros / 1_000_000).toFixed(2)),
      lifetimeClicks: Number(r.metrics?.clicks ?? 0),
      lifetimeImpressions: Number(r.metrics?.impressions ?? 0),
      lifetimeConversions: Number(r.metrics?.conversions ?? 0),
    };
    if (!dbRow) {
      ghosts.push({
        ...entry,
        in_db: false,
        reason: "no GoogleAdsCampaignDraft row matches this googleCampaignId",
      });
    } else {
      tracked.push({
        ...entry,
        in_db: true,
        db_status: dbRow.status,
        db_pausedAt: dbRow.pausedAt,
      });
    }
  }

  // Sort each by spend descending so worst offenders surface first.
  ghosts.sort((a, b) => Number(b.lifetimeCostGbp) - Number(a.lifetimeCostGbp));
  tracked.sort((a, b) => Number(b.lifetimeCostGbp) - Number(a.lifetimeCostGbp));

  return NextResponse.json({
    summary: {
      total_in_google: rows.length,
      tracked_in_db: tracked.length,
      ghosts: ghosts.length,
      ghost_spend_gbp: Number(
        ghosts.reduce((s, g) => s + Number(g.lifetimeCostGbp), 0).toFixed(2),
      ),
      ghost_running_count: ghosts.filter((g) => g.googleStatus === "ENABLED").length,
      ghost_running_daily_budget_gbp: Number(
        ghosts
          .filter((g) => g.googleStatus === "ENABLED")
          .reduce((s, g) => s + Number(g.dailyBudgetGbp), 0)
          .toFixed(2),
      ),
    },
    ghosts,
    tracked,
  });
}
