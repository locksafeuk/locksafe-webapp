/**
 * Meta Campaigns Optimiser
 *
 * Closed-loop maintenance for Meta ads, mirroring `optimiseGoogleCampaigns`.
 * Reads recent `AdPerformanceSnapshot` rows, applies `MarketingPolicy`
 * thresholds, and proposes (or executes) four classes of action:
 *
 *   - PAUSE       — ads with low ROAS sustained over the grace window.
 *   - SCALE       — adsets with strong ROAS get +20% daily budget (capped).
 *   - ROTATE      — ads with rising frequency + falling CTR are paused so
 *                   the copywriter is asked for fresh variants on the next loop.
 *
 * Every decision is written to `AgentDecision` with the policy snapshot,
 * so we have a forensic trail even when the live action is blocked by the
 * spend guard. When `autonomyEnabled === false` we run dry — no Graph
 * API writes, all decisions persisted with `dryRun=true`.
 */

import prisma from "@/lib/db";
import { createMetaClient } from "@/lib/meta-marketing";
import { getEffectivePolicy, checkAutoAction } from "@/lib/spend-guard";
import type { Prisma } from "@prisma/client";

export interface OptimiserDecision {
  action: "pause_ad" | "scale_adset" | "rotate_creative";
  targetType: "ad" | "adset";
  targetId: string;
  metaId?: string | null;
  /** New daily budget (GBP) for scale actions. */
  newDailyBudget?: number;
  reason: string;
  metrics: {
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
    ctr: number;
    frequency?: number;
  };
}

export interface OptimiserResult {
  dryRun: boolean;
  policySnapshot: {
    autonomyEnabled: boolean;
    pauseRoasThreshold: number;
    pauseGraceDays: number;
    minImpressionsForPause: number;
    maxCampaignDailyBudget: number;
  };
  decisions: OptimiserDecision[];
  executed: number;
  blocked: number;
  errors: number;
}

const SCALE_BUDGET_MULTIPLIER = 1.2;
const SCALE_ROAS_FLOOR_MULTIPLIER = 2; // need 2x the pause threshold to scale
const FREQUENCY_ROTATE_THRESHOLD = 3.0;
const CTR_HALVING_BASELINE_DAYS = 3;

interface AggregatedRow {
  id: string;
  metaId: string | null;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  frequency: number;
  daysWithData: number;
}

export async function optimiseMetaCampaigns(opts?: {
  lookbackDays?: number;
  dryRun?: boolean;
}): Promise<OptimiserResult> {
  const lookbackDays = opts?.lookbackDays ?? 7;
  const policy = await getEffectivePolicy("meta");
  // Dry run unless explicitly opted in AND autonomy is on.
  const dryRun = opts?.dryRun ?? !policy.autonomyEnabled;

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const decisions: OptimiserDecision[] = [];

  // ---- Pull 7d snapshots grouped by ad ----
  const adSnapshots = await prisma.adPerformanceSnapshot.findMany({
    where: { platform: "meta", date: { gte: since }, adId: { not: null } },
    orderBy: { date: "asc" },
  });
  const byAd = aggregateSnapshots(adSnapshots, "adId");

  const ads = await prisma.ad.findMany({
    where: { id: { in: Object.keys(byAd) } },
    select: { id: true, metaAdId: true, name: true, status: true, adSetId: true },
  });
  const adsById = new Map(ads.map((a) => [a.id, a]));

  for (const [adId, agg] of Object.entries(byAd)) {
    const ad = adsById.get(adId);
    if (!ad || ad.status !== "ACTIVE") continue;
    if (agg.impressions < policy.minImpressionsForPause) continue;
    if (agg.daysWithData < policy.pauseGraceDays) continue;

    // PAUSE — sustained low ROAS
    if (agg.roas < policy.pauseRoasThreshold) {
      decisions.push({
        action: "pause_ad",
        targetType: "ad",
        targetId: adId,
        metaId: ad.metaAdId,
        reason: `ROAS ${agg.roas.toFixed(2)} < threshold ${policy.pauseRoasThreshold} over ${agg.daysWithData}d, ${agg.impressions} impressions`,
        metrics: snapshotMetrics(agg),
      });
      continue;
    }

    // ROTATE — frequency too high AND CTR halved vs first 3 days
    if (agg.frequency > FREQUENCY_ROTATE_THRESHOLD) {
      const baselineCtr = computeBaselineCtr(adSnapshots, "adId", adId, CTR_HALVING_BASELINE_DAYS);
      if (baselineCtr > 0 && agg.ctr < baselineCtr / 2) {
        decisions.push({
          action: "rotate_creative",
          targetType: "ad",
          targetId: adId,
          metaId: ad.metaAdId,
          reason: `frequency ${agg.frequency.toFixed(2)} > ${FREQUENCY_ROTATE_THRESHOLD} and CTR ${agg.ctr.toFixed(3)} < baseline/2 (${(baselineCtr / 2).toFixed(3)})`,
          metrics: snapshotMetrics(agg),
        });
      }
    }
  }

  // ---- Aggregate by adset for scale decisions ----
  const adSetSnapshots = await prisma.adPerformanceSnapshot.findMany({
    where: { platform: "meta", date: { gte: since }, adSetId: { not: null } },
    orderBy: { date: "asc" },
  });
  const byAdSet = aggregateSnapshots(adSetSnapshots, "adSetId");

  const adSets = await prisma.adSet.findMany({
    where: { id: { in: Object.keys(byAdSet) } },
    select: { id: true, metaAdSetId: true, dailyBudget: true, status: true, name: true },
  });
  const adSetsById = new Map(adSets.map((a) => [a.id, a]));

  const scaleFloor = policy.pauseRoasThreshold * SCALE_ROAS_FLOOR_MULTIPLIER;

  for (const [adSetId, agg] of Object.entries(byAdSet)) {
    const adset = adSetsById.get(adSetId);
    if (!adset || adset.status !== "ACTIVE") continue;
    if (agg.daysWithData < policy.pauseGraceDays) continue;
    if (agg.roas < scaleFloor) continue;
    if (!adset.dailyBudget) continue;

    const proposed = Math.min(
      Math.round(adset.dailyBudget * SCALE_BUDGET_MULTIPLIER * 100) / 100,
      policy.maxCampaignDailyBudget,
    );
    if (proposed <= adset.dailyBudget) continue;

    decisions.push({
      action: "scale_adset",
      targetType: "adset",
      targetId: adSetId,
      metaId: adset.metaAdSetId,
      newDailyBudget: proposed,
      reason: `ROAS ${agg.roas.toFixed(2)} ≥ ${scaleFloor.toFixed(2)} (2× threshold). Scale £${adset.dailyBudget} → £${proposed}.`,
      metrics: snapshotMetrics(agg),
    });
  }

  // ---- Persist + (optionally) execute ----
  let executed = 0;
  let blocked = 0;
  let errors = 0;
  const policySnapshot = {
    autonomyEnabled: policy.autonomyEnabled,
    pauseRoasThreshold: policy.pauseRoasThreshold,
    pauseGraceDays: policy.pauseGraceDays,
    minImpressionsForPause: policy.minImpressionsForPause,
    maxCampaignDailyBudget: policy.maxCampaignDailyBudget,
  };

  const meta = dryRun ? null : createMetaClient();

  for (const decision of decisions) {
    let outcome: "ok" | "blocked_by_policy" | "blocked_by_spend" | "error" | null = null;
    let outcomeMessage: string | null = null;

    if (!dryRun && meta) {
      const guard = await checkAutoAction({
        platform: "meta",
        action:
          decision.action === "scale_adset"
            ? "increase_budget"
            : "pause_campaign",
        proposedDailyBudget: decision.newDailyBudget ?? 0,
        initiator: "agent",
      });

      if (!guard.allowed) {
        outcome = guard.reason.includes("spend") ? "blocked_by_spend" : "blocked_by_policy";
        outcomeMessage = guard.reason;
        blocked++;
      } else {
        try {
          if (decision.action === "pause_ad" && decision.metaId) {
            await meta.updateAd(decision.metaId, { status: "PAUSED" });
            await prisma.ad.update({
              where: { id: decision.targetId },
              data: { status: "PAUSED" },
            });
          } else if (decision.action === "scale_adset" && decision.metaId && decision.newDailyBudget) {
            await meta.updateAdSet(decision.metaId, {
              dailyBudget: decision.newDailyBudget,
            });
            await prisma.adSet.update({
              where: { id: decision.targetId },
              data: { dailyBudget: decision.newDailyBudget },
            });
          } else if (decision.action === "rotate_creative" && decision.metaId) {
            // For now: pause the ad. The copywriter loop refreshes variants
            // in its next heartbeat and a new ad gets created.
            await meta.updateAd(decision.metaId, { status: "PAUSED" });
            await prisma.ad.update({
              where: { id: decision.targetId },
              data: { status: "PAUSED" },
            });
          }
          outcome = "ok";
          executed++;
        } catch (err) {
          outcome = "error";
          outcomeMessage = err instanceof Error ? err.message : "unknown error";
          errors++;
        }
      }
    }

    await prisma.agentDecision.create({
      data: {
        agent: "meta-optimiser",
        platform: "meta",
        action: decision.action,
        payload: decision as unknown as Prisma.InputJsonValue,
        policySnapshot: policySnapshot as unknown as Prisma.InputJsonValue,
        dryRun,
        outcome,
        outcomeMessage,
        executedAt: outcome === "ok" ? new Date() : null,
      },
    });
  }

  return {
    dryRun,
    policySnapshot,
    decisions,
    executed,
    blocked,
    errors,
  };
}

// ---------- helpers ----------

function aggregateSnapshots(
  rows: Array<{
    adId?: string | null;
    adSetId?: string | null;
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    frequency: number | null;
    date: Date;
  }>,
  key: "adId" | "adSetId",
): Record<string, AggregatedRow> {
  const acc: Record<string, AggregatedRow & { _dates: Set<string> }> = {};

  for (const r of rows) {
    const id = r[key];
    if (!id) continue;
    if (!acc[id]) {
      acc[id] = {
        id,
        metaId: null,
        spend: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        roas: 0,
        ctr: 0,
        frequency: 0,
        daysWithData: 0,
        _dates: new Set<string>(),
      };
    }
    const row = acc[id];
    row.spend += r.spend;
    row.revenue += r.revenue;
    row.impressions += r.impressions;
    row.clicks += r.clicks;
    row.conversions += r.conversions;
    if (r.frequency !== null && r.frequency !== undefined) {
      // Keep the latest frequency value (it's a cumulative metric).
      row.frequency = Math.max(row.frequency, r.frequency);
    }
    row._dates.add(r.date.toISOString().slice(0, 10));
  }

  for (const id of Object.keys(acc)) {
    const r = acc[id];
    r.roas = r.spend > 0 ? r.revenue / r.spend : 0;
    r.ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    r.daysWithData = r._dates.size;
    delete (r as Partial<typeof r>)._dates;
  }
  return acc as Record<string, AggregatedRow>;
}

function computeBaselineCtr(
  rows: Array<{
    adId?: string | null;
    adSetId?: string | null;
    impressions: number;
    clicks: number;
    date: Date;
  }>,
  key: "adId" | "adSetId",
  id: string,
  firstNDays: number,
): number {
  const filtered = rows
    .filter((r) => r[key] === id)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, firstNDays);
  const imp = filtered.reduce((s, r) => s + r.impressions, 0);
  const clk = filtered.reduce((s, r) => s + r.clicks, 0);
  return imp > 0 ? clk / imp : 0;
}

function snapshotMetrics(agg: AggregatedRow) {
  return {
    spend: agg.spend,
    revenue: agg.revenue,
    impressions: agg.impressions,
    clicks: agg.clicks,
    conversions: agg.conversions,
    roas: agg.roas,
    ctr: agg.ctr,
    frequency: agg.frequency,
  };
}
