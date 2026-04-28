/**
 * Google Ads performance sync.
 *
 * Phase 1 — read-only. Pulls daily metrics for every active GoogleAdsAccount
 * and writes one AdPerformanceSnapshot row per (campaign, day) with
 * platform="google". Idempotent: re-running for the same day overwrites prior
 * rows for that day (so re-pulls capture late-arriving conversion data).
 */

import prisma from "@/lib/db";
import {
  getGoogleAdsClientForAccount,
  microsToCurrency,
  type GoogleAdsCampaignRow,
} from "@/lib/google-ads";

export interface GoogleSyncOptions {
  /** Days of history to pull. Default: 7. */
  lookbackDays?: number;
  /** Optional explicit range, overrides lookbackDays. */
  dateRange?: { since: string; until: string };
}

export interface GoogleSyncResult {
  success: boolean;
  accountsProcessed: number;
  campaignsObserved: number;
  snapshotsWritten: number;
  errors: string[];
}

export async function syncAllGoogleAdsAccounts(
  options: GoogleSyncOptions = {},
): Promise<GoogleSyncResult> {
  const result: GoogleSyncResult = {
    success: true,
    accountsProcessed: 0,
    campaignsObserved: 0,
    snapshotsWritten: 0,
    errors: [],
  };

  const range = resolveRange(options);

  const accounts = await prisma.googleAdsAccount.findMany({
    where: { isActive: true },
  });

  for (const account of accounts) {
    try {
      const client = await getGoogleAdsClientForAccount(account.id);
      if (!client) {
        result.errors.push(`Could not build client for account ${account.id}`);
        continue;
      }

      const rows = await client.getCampaignMetrics(range);
      result.campaignsObserved += rows.length;

      // Aggregate-by-campaign rows we just got cover the whole range. To match
      // Meta's per-day snapshot pattern, also fetch a per-day breakdown and
      // upsert one snapshot per (campaign, day).
      const perDayRows = await fetchPerDayBreakdown(client, range);

      for (const r of perDayRows) {
        const cost = microsToCurrency(r.costMicros);
        const cpc = r.clicks > 0 ? cost / r.clicks : 0;
        const cpm = r.impressions > 0 ? (cost / r.impressions) * 1000 : 0;
        const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
        const roas = cost > 0 ? r.conversionsValue / cost : 0;

        // Idempotent upsert: delete-then-insert keyed by
        // (platform, googleCampaignId, date) since we don't have a unique
        // constraint on that tuple in Mongo Prisma.
        await prisma.adPerformanceSnapshot.deleteMany({
          where: {
            platform: "google",
            googleCampaignId: r.campaignId,
            date: r.date,
          },
        });
        await prisma.adPerformanceSnapshot.create({
          data: {
            platform: "google",
            googleAccountId: account.id,
            googleCampaignId: r.campaignId,
            googleCampaignName: r.campaignName,
            date: r.date,
            spend: cost,
            impressions: r.impressions,
            clicks: r.clicks,
            conversions: Math.round(r.conversions),
            revenue: r.conversionsValue,
            ctr,
            cpc,
            cpm,
            roas,
          },
        });
        result.snapshotsWritten++;
      }

      await prisma.googleAdsAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date() },
      });

      // Phase 2: roll up per-day snapshots into the GoogleAdsCampaignDraft
      // aggregate counters so the admin UI shows live spend/conversions for
      // any draft we published. Bounded to the campaigns we touched in this
      // sync to avoid N+1 queries on unrelated drafts.
      const touchedCampaignIds = Array.from(
        new Set(perDayRows.map((r) => r.campaignId).filter(Boolean)),
      );
      if (touchedCampaignIds.length > 0) {
        const drafts = await prisma.googleAdsCampaignDraft.findMany({
          where: { googleCampaignId: { in: touchedCampaignIds } },
          select: { id: true, googleCampaignId: true },
        });
        for (const d of drafts) {
          if (!d.googleCampaignId) continue;
          const totals = await prisma.adPerformanceSnapshot.aggregate({
            where: { platform: "google", googleCampaignId: d.googleCampaignId },
            _sum: {
              spend: true,
              impressions: true,
              clicks: true,
              conversions: true,
              revenue: true,
            },
          });
          await prisma.googleAdsCampaignDraft.update({
            where: { id: d.id },
            data: {
              totalSpend: totals._sum.spend ?? 0,
              totalImpressions: totals._sum.impressions ?? 0,
              totalClicks: totals._sum.clicks ?? 0,
              totalConversions: totals._sum.conversions ?? 0,
              totalRevenue: totals._sum.revenue ?? 0,
              lastSyncAt: new Date(),
            },
          });
        }
      }

      result.accountsProcessed++;
    } catch (err) {
      result.success = false;
      result.errors.push(
        `Account ${account.customerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

/**
 * Fetch per-(campaign, day) metrics. We do this as a separate query because
 * the campaign-level metrics fetch above aggregates across the range.
 */
async function fetchPerDayBreakdown(
  client: ReturnType<typeof getGoogleAdsClientForAccount> extends Promise<infer T> ? NonNullable<T> : never,
  range: { since: string; until: string },
): Promise<Array<GoogleAdsCampaignRow & { date: Date }>> {
  // GAQL: add segments.date to break out by day. Same field shape otherwise.
  const gaql = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'
      AND campaign.status != 'REMOVED'
  `;
  const rows = await client.query<{
    campaign: { id: string; name: string; status: string; advertisingChannelType: string };
    segments: { date: string };
    metrics: {
      impressions?: string;
      clicks?: string;
      costMicros?: string;
      conversions?: number;
      conversionsValue?: number;
      ctr?: number;
      averageCpc?: string;
    };
  }>(gaql);

  return rows.map((r) => ({
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
    status: r.campaign.status,
    advertisingChannelType: r.campaign.advertisingChannelType,
    date: parseDate(r.segments.date),
    impressions: Number(r.metrics.impressions ?? 0),
    clicks: Number(r.metrics.clicks ?? 0),
    costMicros: Number(r.metrics.costMicros ?? 0),
    conversions: Number(r.metrics.conversions ?? 0),
    conversionsValue: Number(r.metrics.conversionsValue ?? 0),
    ctr: Number(r.metrics.ctr ?? 0),
    averageCpc: Number(r.metrics.averageCpc ?? 0),
  }));
}

function resolveRange(options: GoogleSyncOptions): { since: string; until: string } {
  if (options.dateRange) return options.dateRange;
  const lookback = options.lookbackDays ?? 7;
  const until = new Date();
  const since = new Date(until.getTime() - lookback * 24 * 60 * 60 * 1000);
  return { since: ymd(since), until: ymd(until) };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  // GAQL returns YYYY-MM-DD; treat as UTC midnight to keep snapshot.date
  // stable across timezones.
  return new Date(`${s}T00:00:00.000Z`);
}

/**
 * Lightweight status used by the cron GET handler + dashboard.
 */
export async function getGoogleAdsSyncStatus(): Promise<{
  isConfigured: boolean;
  accountsConnected: number;
  lastSyncAt: Date | null;
  totalSpend: number;
  totalConversions: number;
}> {
  const developerTokenSet = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const accountsConnected = await prisma.googleAdsAccount.count({ where: { isActive: true } });
  const newest = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { lastSyncAt: "desc" },
    select: { lastSyncAt: true },
  });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const agg = await prisma.adPerformanceSnapshot.aggregate({
    where: { platform: "google", date: { gte: since } },
    _sum: { spend: true, conversions: true },
  });
  return {
    isConfigured: developerTokenSet && accountsConnected > 0,
    accountsConnected,
    lastSyncAt: newest?.lastSyncAt ?? null,
    totalSpend: agg._sum.spend ?? 0,
    totalConversions: agg._sum.conversions ?? 0,
  };
}
