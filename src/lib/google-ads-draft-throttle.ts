/**
 * Autonomous Google Ads draft throttle.
 *
 * Why this exists
 * ───────────────
 * On 2026-06-03 the agent-approvals queue held 139 pending
 * `publish_google_ads_draft` rows accumulated over ~6 days — the CMO and
 * Ads Specialist agents were creating duplicate "London Emergency Lockout
 * Refund Guarantee" drafts every ~30 minutes via their LLM-driven heartbeats.
 *
 * The SKILL.md / platform-stage prompt told the LLM to be conservative; the
 * LLM ignored it. Soft guidance on *whether to act* fails the same way that
 * soft guidance on *bid strategy* did (Liverpool). This module is the hard
 * gate.
 *
 * Where it sits
 * ─────────────
 * Called at the TOP of every autonomous draft-creation path:
 *   • `createGoogleAdsDraftTool.execute()` — used by CMO + Ads Specialist
 *   • Opportunity Scout's `createDraftFromOpportunity` block
 *
 * What it checks (fail-fast, first violation wins)
 * ─────────────────────────────────────────────────
 * 1. Feature flag `ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS` — if exactly "false",
 *    block everything. Default is permissive (unset → allowed), so this is
 *    an opt-in kill switch.
 * 2. Pending-backlog cap — if pending `publish_google_ads_draft` approvals
 *    >= `maxPendingApprovals` (default 3), block. Don't propose more while
 *    a human hasn't cleared the queue.
 * 3. Min interval since last draft — for this agent, the most recent
 *    GoogleAdsCampaignDraft.createdAt must be older than `minIntervalHours`
 *    (default 72h ≈ every 2-3 days). The user's explicit ask 2026-06-03:
 *    "no point doing everyday".
 * 4. Real-data gate — at least one PUBLISHED draft must have non-zero
 *    impressions OR conversions in the lookback window (default 14d). No
 *    point creating new variants when nothing is generating signal yet.
 *
 * What it does NOT do
 * ───────────────────
 * - It doesn't gate manual dashboard actions (the from-locksmith feature
 *   flag lives in `google-ads-draft-enforcement` and handles that).
 * - It doesn't gate one-shot admin scripts. Override is per-call via the
 *   `bypass: true` option.
 */

import prisma from "@/lib/db";

// ─── Decision shape ────────────────────────────────────────────────────────

export type ThrottleReason =
  | "feature_flag_off"
  | "pending_backlog"
  | "too_soon_after_last_draft"
  | "no_real_data_yet";

export type ThrottleDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: ThrottleReason;
      message: string;
      nextAttemptAt?: Date;
      /** Useful metadata for telemetry / agent reflection. */
      meta?: Record<string, unknown>;
    };

// ─── Defaults — change with deliberate review ──────────────────────────────

export const THROTTLE_DEFAULTS = {
  /** ≈ every 2–3 days per agent. */
  MIN_INTERVAL_HOURS: 72,
  /** Max stacked pending approvals before we stop proposing. */
  MAX_PENDING_APPROVALS: 3,
  /** Lookback window for "did existing campaigns gather data?". */
  DATA_LOOKBACK_DAYS: 14,
} as const;

export interface ThrottleOptions {
  /** Friendly label for telemetry only — does NOT key the throttle. */
  agentName: string;
  /** Override min-interval (hours). Default 72. */
  minIntervalHours?: number;
  /** Override pending-backlog cap. Default 3. */
  maxPendingApprovals?: number;
  /** Skip the real-data gate (e.g. for first-ever launch). Default false. */
  skipRealDataGate?: boolean;
  /** Lookback window for the real-data gate. Default 14d. */
  dataLookbackDays?: number;
  /** Hard bypass — admin-flagged exception only. Default false. */
  bypass?: boolean;
}

// ─── Feature flag ──────────────────────────────────────────────────────────

/**
 * Returns true if autonomous campaign-draft creation has been explicitly
 * disabled via env. Default (unset) is "not disabled" — i.e. allowed.
 * Set ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS=false in the environment to kill
 * all autonomous draft creation regardless of throttle state.
 */
export function isAutonomousCampaignDraftsDisabled(): boolean {
  return process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS === "false";
}

// ─── Main entry ────────────────────────────────────────────────────────────

/**
 * Should the calling agent be allowed to create a new Google Ads draft right
 * now? See module-level comment for the four gates this enforces.
 */
export async function shouldCreateAutonomousDraft(
  opts: ThrottleOptions,
): Promise<ThrottleDecision> {
  if (opts.bypass) {
    return { allowed: true };
  }

  // 1. Feature flag
  if (isAutonomousCampaignDraftsDisabled()) {
    return {
      allowed: false,
      reason: "feature_flag_off",
      message:
        "Autonomous campaign draft creation is disabled via ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS=false. " +
        "Manual creation via /admin/integrations/google-ads/drafts/new still works.",
    };
  }

  // 2. Pending backlog
  const maxPending = opts.maxPendingApprovals ?? THROTTLE_DEFAULTS.MAX_PENDING_APPROVALS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;
  const pendingCount: number = await prismaAny.agentApproval.count({
    where: {
      status: "pending",
      actionType: "publish_google_ads_draft",
    },
  });
  if (pendingCount >= maxPending) {
    return {
      allowed: false,
      reason: "pending_backlog",
      message:
        `${pendingCount} publish_google_ads_draft approval(s) already pending ` +
        `(max ${maxPending}). Resolve the backlog at /admin/agents/approvals before proposing more.`,
      meta: { pendingCount, maxPending },
    };
  }

  // 3. Min interval since last draft
  const minIntervalHours = opts.minIntervalHours ?? THROTTLE_DEFAULTS.MIN_INTERVAL_HOURS;
  const intervalMs = minIntervalHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - intervalMs);
  const recent = await prisma.googleAdsCampaignDraft.findFirst({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
  if (recent) {
    const nextAttemptAt = new Date(recent.createdAt.getTime() + intervalMs);
    return {
      allowed: false,
      reason: "too_soon_after_last_draft",
      message:
        `A draft was created at ${recent.createdAt.toISOString()} (less than ${minIntervalHours}h ago). ` +
        `Next attempt allowed at ${nextAttemptAt.toISOString()}. Throttle is global across agents.`,
      nextAttemptAt,
      meta: { lastDraftId: recent.id, lastDraftName: recent.name, minIntervalHours },
    };
  }

  // 4. Real-data gate
  if (!opts.skipRealDataGate) {
    const lookbackDays = opts.dataLookbackDays ?? THROTTLE_DEFAULTS.DATA_LOOKBACK_DAYS;
    const lookbackCutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const dataSignal = await prisma.googleAdsCampaignDraft.findFirst({
      where: {
        status: "PUBLISHED",
        OR: [
          { totalImpressions: { gt: 0 } },
          { totalClicks: { gt: 0 } },
          { totalConversions: { gt: 0 } },
        ],
        updatedAt: { gte: lookbackCutoff },
      },
      select: {
        id: true,
        name: true,
        totalImpressions: true,
        totalClicks: true,
        totalConversions: true,
      },
    });
    if (!dataSignal) {
      return {
        allowed: false,
        reason: "no_real_data_yet",
        message:
          `No published campaign has produced impressions/clicks/conversions in the last ${lookbackDays} days. ` +
          "Wait for the existing campaigns to gather data before proposing new variants. " +
          "Set skipRealDataGate:true for a first-ever launch.",
        meta: { lookbackDays },
      };
    }
  }

  return { allowed: true };
}
