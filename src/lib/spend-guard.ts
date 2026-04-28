/**
 * Spend Guard — Phase 3 hard caps + kill switch.
 *
 * Single source of truth for "is the agent allowed to do X right now?".
 * Every auto-publish / auto-optimisation / auto-approve path MUST call
 * `checkAutoAction()` first and refuse the action if `allowed === false`.
 *
 * Reads from `MarketingPolicy` (per-platform + a "global" master kill switch)
 * and rolls up live spend from `AdPerformanceSnapshot` into `DailySpendLedger`
 * for fast subsequent checks.
 */

import prisma from "@/lib/db";

export type Platform = "meta" | "google";

export interface AutoActionRequest {
  platform: Platform;
  /** What the agent is trying to do — for log clarity only. */
  action:
    | "publish_draft"
    | "auto_approve_draft"
    | "increase_budget"
    | "pause_campaign"
    | "add_negative_keyword";
  /** Daily budget in GBP this action would commit to (0 for pause/negative-keyword). */
  proposedDailyBudget?: number;
  /** Whether this action was initiated by an agent or by an admin. */
  initiator: "agent" | "admin";
}

export interface AutoActionDecision {
  allowed: boolean;
  reason: string;
  policy: {
    platform: Platform;
    autonomyEnabled: boolean;
    maxDailySpend: number;
    maxMonthlySpend: number;
    maxCampaignDailyBudget: number;
    autoApproveMaxBudget: number;
  };
  spendUsed: {
    today: number;
    last7d: number;
    last30d: number;
  };
}

const DEFAULT_POLICY = {
  platform: "global" as const,
  autonomyEnabled: false,
  maxDailySpend: 15,
  maxMonthlySpend: 300,
  maxCampaignDailyBudget: 20,
  minCampaignDailyBudget: 2,
  autoApproveMaxBudget: 10,
  maxWeeklyAutoApproveSpend: 50,
  pauseRoasThreshold: 0.5,
  pauseGraceDays: 3,
  minImpressionsForPause: 500,
  notifyOnAutoAction: true,
};

type PolicyShape = typeof DEFAULT_POLICY;

/**
 * Get the effective policy for a platform: merges the per-platform row over
 * the "global" row, falling back to defaults. The "global" row's
 * `autonomyEnabled=false` overrides everything else (master kill switch).
 */
export async function getEffectivePolicy(platform: Platform): Promise<PolicyShape> {
  const [globalRow, platformRow] = await Promise.all([
    prisma.marketingPolicy.findUnique({ where: { platform: "global" } }),
    prisma.marketingPolicy.findUnique({ where: { platform } }),
  ]);

  // Merge: platform row > global row > defaults. autonomyEnabled is AND-ed
  // across global and platform so EITHER being off blocks autonomy.
  const merged: PolicyShape = {
    ...DEFAULT_POLICY,
    ...(globalRow ?? {}),
    ...(platformRow ?? {}),
    platform: "global", // typed-only; the consumer cares about the action's platform
  };

  const autonomy =
    (globalRow?.autonomyEnabled ?? DEFAULT_POLICY.autonomyEnabled) &&
    (platformRow?.autonomyEnabled ?? DEFAULT_POLICY.autonomyEnabled);

  return { ...merged, autonomyEnabled: autonomy };
}

/**
 * Aggregate spend for `platform` between two dates, refreshing the ledger so
 * subsequent calls hit cached data instead of re-aggregating snapshots.
 */
async function rollupSpend(
  platform: Platform,
  since: Date,
  until: Date,
): Promise<number> {
  const where =
    platform === "meta"
      ? { platform: "meta", date: { gte: since, lte: until } }
      : { platform: "google", date: { gte: since, lte: until } };
  const agg = await prisma.adPerformanceSnapshot.aggregate({
    where,
    _sum: { spend: true },
  });
  return agg._sum.spend ?? 0;
}

/**
 * Same as rollupSpend but only counts spend on Google Ads campaigns that have
 * a backing GoogleAdsCampaignDraft (i.e. agent-initiated). Used for the
 * weekly auto-approve cap. Meta agent-spend is approximated as 0 since Phase
 * 2 only filed approvals; Meta agent-publishing isn't wired yet.
 */
async function rollupAgentSpend(platform: Platform, since: Date, until: Date): Promise<number> {
  if (platform !== "google") return 0;
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { aiGenerated: true, googleCampaignId: { not: null } },
    select: { googleCampaignId: true },
  });
  const ids = drafts.map((d) => d.googleCampaignId).filter((x): x is string => Boolean(x));
  if (ids.length === 0) return 0;
  const agg = await prisma.adPerformanceSnapshot.aggregate({
    where: {
      platform: "google",
      googleCampaignId: { in: ids },
      date: { gte: since, lte: until },
    },
    _sum: { spend: true },
  });
  return agg._sum.spend ?? 0;
}

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfMonthUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * The single entry point every auto-action must consult. Returns whether
 * the requested action is permitted under current policy + spend.
 */
export async function checkAutoAction(req: AutoActionRequest): Promise<AutoActionDecision> {
  const policy = await getEffectivePolicy(req.platform);

  const today = startOfTodayUtc();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = startOfMonthUtc();

  const [todaySpend, last7d, last30d, monthSpend, agent7d] = await Promise.all([
    rollupSpend(req.platform, today, tomorrow),
    rollupSpend(req.platform, sevenDaysAgo, tomorrow),
    rollupSpend(req.platform, thirtyDaysAgo, tomorrow),
    rollupSpend(req.platform, monthStart, tomorrow),
    rollupAgentSpend(req.platform, sevenDaysAgo, tomorrow),
  ]);

  // Refresh the ledger row for today (idempotent).
  await prisma.dailySpendLedger
    .upsert({
      where: { platform_date: { platform: req.platform, date: today } },
      create: {
        platform: req.platform,
        date: today,
        spend: todaySpend,
        agentSpend: req.platform === "google" ? agent7d : 0,
      },
      update: {
        spend: todaySpend,
        agentSpend: req.platform === "google" ? agent7d : 0,
      },
    })
    .catch(() => {
      /* ledger is best-effort cache */
    });

  const decision: AutoActionDecision = {
    allowed: false,
    reason: "",
    policy: {
      platform: req.platform,
      autonomyEnabled: policy.autonomyEnabled,
      maxDailySpend: policy.maxDailySpend,
      maxMonthlySpend: policy.maxMonthlySpend,
      maxCampaignDailyBudget: policy.maxCampaignDailyBudget,
      autoApproveMaxBudget: policy.autoApproveMaxBudget,
    },
    spendUsed: { today: todaySpend, last7d, last30d },
  };

  // Admin-initiated actions bypass the autonomy switch but still respect
  // hard caps so a typo can't bust the monthly budget.
  if (req.initiator === "agent" && !policy.autonomyEnabled) {
    decision.reason = `Autonomy disabled for ${req.platform}. Enable at /admin/agents/policy.`;
    return decision;
  }

  // Per-campaign budget cap.
  if (req.proposedDailyBudget && req.proposedDailyBudget > policy.maxCampaignDailyBudget) {
    decision.reason = `Proposed daily budget £${req.proposedDailyBudget} exceeds per-campaign cap £${policy.maxCampaignDailyBudget}.`;
    return decision;
  }

  // Daily aggregate cap.
  const projectedToday = todaySpend + (req.proposedDailyBudget ?? 0);
  if (projectedToday > policy.maxDailySpend) {
    decision.reason = `Today's spend £${todaySpend.toFixed(2)} + proposed £${req.proposedDailyBudget ?? 0} would exceed daily cap £${policy.maxDailySpend}.`;
    return decision;
  }

  // Monthly aggregate cap.
  const projectedMonth = monthSpend + (req.proposedDailyBudget ?? 0);
  if (projectedMonth > policy.maxMonthlySpend) {
    decision.reason = `This month's spend £${monthSpend.toFixed(2)} + proposed £${req.proposedDailyBudget ?? 0} would exceed monthly cap £${policy.maxMonthlySpend}.`;
    return decision;
  }

  // Auto-approve specific check: weekly agent-spend ceiling.
  if (req.action === "auto_approve_draft") {
    if ((req.proposedDailyBudget ?? 0) > policy.autoApproveMaxBudget) {
      decision.reason = `Auto-approve budget cap is £${policy.autoApproveMaxBudget}/day. Proposed £${req.proposedDailyBudget}. Manual review required.`;
      return decision;
    }
    if (agent7d + (req.proposedDailyBudget ?? 0) * 7 > policy.maxWeeklyAutoApproveSpend) {
      decision.reason = `Last 7d agent spend £${agent7d.toFixed(2)} + projected £${((req.proposedDailyBudget ?? 0) * 7).toFixed(2)} would exceed weekly auto-approve cap £${policy.maxWeeklyAutoApproveSpend}.`;
      return decision;
    }
  }

  decision.allowed = true;
  decision.reason = "Within policy.";
  return decision;
}

/**
 * Convenience: hard-stop kill switch. Used by the /admin/agents/policy
 * "Stop everything" button. Disables autonomy on all platforms in one call.
 */
export async function killSwitchAll(by: string, notes = "Manual kill switch"): Promise<void> {
  for (const platform of ["global", "meta", "google"] as const) {
    await prisma.marketingPolicy.upsert({
      where: { platform },
      create: { platform, autonomyEnabled: false, updatedBy: by, notes },
      update: { autonomyEnabled: false, updatedBy: by, notes },
    });
  }
}
