/**
 * Platform Stage Resolver
 *
 * Determines which operational stage LockSafe is in based on hard business
 * signals — not time or agent activity. This is the single source of truth
 * that all agent heartbeats and approval gates must check before acting.
 *
 * Three stages:
 *
 *   CONSERVATION — pre-product-market fit
 *     Signals: < 50 completed jobs OR < 20 Stripe-confirmed conversions
 *     Agents:  diagnostics + hygiene only, no new spend, no social
 *
 *   OPTIMISE — early growth
 *     Signals: 50-199 completed jobs AND 20-79 paid conversions
 *     Agents:  controlled optimisation, data-backed campaign changes only
 *
 *   SCALE — proven unit economics
 *     Signals: ≥ 200 completed jobs AND ≥ 80 paid conversions
 *     Agents:  expansion allowed with data thresholds
 *
 * The resolver is cached for 5 minutes to avoid DB hammering during
 * concurrent heartbeat bursts. Cache is busted when the stage changes.
 *
 * ENFORCEMENT MODE (controlled by env var PLATFORM_DISCIPLINE_ENFORCE):
 *   false (default) — violations are logged as warnings but not blocked.
 *                     Use during rollout to audit without interrupting agents.
 *   true            — violations throw and are stored on the approval/draft
 *                     as a rejection reason. Hard gate.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlatformStage = "CONSERVATION" | "OPTIMISE" | "SCALE";

export type ActionType =
  | "NEW_CAMPAIGN_DRAFT"
  | "INCREASE_BUDGET"
  | "SCHEDULE_SOCIAL_POST"
  | "SUGGEST_NEGATIVE_KEYWORDS"
  | "PAUSE_CAMPAIGN"
  | "CHANGE_BID_STRATEGY"
  | "ALERT_PERFORMANCE";

export interface StageSignals {
  completedJobs: number;
  paidConversions: number;
  activeLocksmiths: number;
  daysOnline: number;
}

export interface ApprovalEvidence {
  actionType: ActionType;
  /** Campaign daily budget in GBP — required for NEW_CAMPAIGN_DRAFT */
  proposedBudget?: number;
  /** Does the target geo have active locksmiths? */
  coverageSufficient?: boolean;
  /**
   * Data maturity signals from the existing campaign/platform.
   * Prevents agents acting on insufficient data.
   */
  dataMaturity?: {
    impressions: number;
    clicks: number;
    conversions: number;
    daysRunning: number;
  };
  /**
   * Why this action is expected to produce value.
   * Must be data-backed (≥ 80 chars) for high-spend actions.
   */
  expectedImpact?: {
    basis: string;
    estimatedCpaGbp?: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
  };
  stage: PlatformStage;
}

export interface ValidationResult {
  valid: boolean;
  stage: PlatformStage;
  rejectionReason?: string;
  warning?: string;
  signals: StageSignals;
}

// ── Stage action matrix ───────────────────────────────────────────────────────

interface StagePolicy {
  canCreateCampaignDraft: boolean;
  canScheduleSocialPost: boolean;
  canIncreaseBudget: boolean;
  canChangeBidStrategy: boolean;
  canSuggestNegativeKeywords: boolean;
  canPauseCampaigns: boolean;
  canAlertPerformance: boolean;
  minCampaignBudgetGbp: number | null; // null = action not permitted
  requiresCoverageEvidence: boolean;
  requiresDataEvidence: boolean;
  minImpactBasisLength: number;
}

export const STAGE_POLICY: Record<PlatformStage, StagePolicy> = {
  CONSERVATION: {
    canCreateCampaignDraft:    false, // No new campaigns until PMF
    canScheduleSocialPost:     false, // No social — save budget for jobs
    canIncreaseBudget:         false,
    canChangeBidStrategy:      false,
    canSuggestNegativeKeywords: true, // Hygiene: always allowed
    canPauseCampaigns:         true,  // Cost control: always allowed
    canAlertPerformance:       true,
    minCampaignBudgetGbp:      null,
    requiresCoverageEvidence:  true,
    requiresDataEvidence:      false,
    minImpactBasisLength:      0,
  },
  OPTIMISE: {
    canCreateCampaignDraft:    true,
    canScheduleSocialPost:     true,
    canIncreaseBudget:         false, // Must be human-initiated
    canChangeBidStrategy:      true,
    canSuggestNegativeKeywords: true,
    canPauseCampaigns:         true,
    canAlertPerformance:       true,
    minCampaignBudgetGbp:      20,   // £20/day minimum — below this, meaningless
    requiresCoverageEvidence:  true,
    requiresDataEvidence:      true,  // Must cite real data
    minImpactBasisLength:      80,    // 80 chars minimum evidence text
  },
  SCALE: {
    canCreateCampaignDraft:    true,
    canScheduleSocialPost:     true,
    canIncreaseBudget:         true,
    canChangeBidStrategy:      true,
    canSuggestNegativeKeywords: true,
    canPauseCampaigns:         true,
    canAlertPerformance:       true,
    minCampaignBudgetGbp:      15,
    requiresCoverageEvidence:  true,
    requiresDataEvidence:      true,
    minImpactBasisLength:      60,
  },
};

// ── Stage resolver ────────────────────────────────────────────────────────────

/** Signals → stage. Pure function, no I/O. */
export function resolveStageFromSignals(s: StageSignals): PlatformStage {
  if (s.completedJobs >= 200 && s.paidConversions >= 80) return "SCALE";
  if (s.completedJobs >= 50  && s.paidConversions >= 20) return "OPTIMISE";
  return "CONSERVATION";
}

/** 5-minute cache so concurrent heartbeat ticks share one DB round-trip. */
const CACHE_TTL_MS = 5 * 60_000;
let _signalsCache: { signals: StageSignals; stage: PlatformStage; at: number } | null = null;

/**
 * Resolve the current platform stage from DB signals.
 * Cached for 5 minutes. Call once per heartbeat tick and pass the result down.
 */
export async function getPlatformStage(): Promise<{
  stage: PlatformStage;
  signals: StageSignals;
}> {
  if (_signalsCache && Date.now() - _signalsCache.at < CACHE_TTL_MS) {
    return { stage: _signalsCache.stage, signals: _signalsCache.signals };
  }

  const [completedJobs, paidConversions, activeLocksmiths, oldestJob] =
    await Promise.all([
      prisma.job.count({
        where: { status: { in: [JobStatus.COMPLETED, JobStatus.SIGNED] } },
      }),
      prisma.payment.count({
        where: { status: "succeeded", type: { in: ["work_quote", "assessment_fee"] } },
      }),
      prisma.locksmith.count({ where: { isActive: true } }),
      prisma.job.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

  const daysOnline = oldestJob
    ? Math.floor((Date.now() - oldestJob.createdAt.getTime()) / 86_400_000)
    : 0;

  const signals: StageSignals = {
    completedJobs,
    paidConversions,
    activeLocksmiths,
    daysOnline,
  };
  const stage = resolveStageFromSignals(signals);

  _signalsCache = { signals, stage, at: Date.now() };
  return { stage, signals };
}

/** Invalidate the cache (call when a job completes or payment is confirmed). */
export function bustStageCache(): void {
  _signalsCache = null;
}

// ── Approval evidence validator ───────────────────────────────────────────────

/**
 * Validate proposed agent action against the current stage policy and evidence
 * quality bar.
 *
 * Returns { valid: true } if the action is permitted.
 * Returns { valid: false, rejectionReason } if blocked.
 *
 * Respects PLATFORM_DISCIPLINE_ENFORCE:
 *   false → returns warning-only result (valid: true, warning set)
 *   true  → returns valid: false with rejectionReason
 */
export function validateApprovalEvidence(evidence: ApprovalEvidence): ValidationResult {
  const enforce = process.env.PLATFORM_DISCIPLINE_ENFORCE === "true";
  const policy = STAGE_POLICY[evidence.stage];

  const reject = (reason: string): ValidationResult => {
    if (!enforce) {
      // Report-only mode — warn but don't block
      console.warn(`[ApprovalGate][REPORT-ONLY] Would have rejected: ${reason}`);
      return {
        valid: true,
        stage: evidence.stage,
        warning: `[REPORT-ONLY] ${reason}`,
        signals: { completedJobs: 0, paidConversions: 0, activeLocksmiths: 0, daysOnline: 0 },
      };
    }
    return { valid: false, stage: evidence.stage, rejectionReason: reason, signals: { completedJobs: 0, paidConversions: 0, activeLocksmiths: 0, daysOnline: 0 } };
  };

  // ── Action permission checks ──────────────────────────────────────────────

  if (evidence.actionType === "NEW_CAMPAIGN_DRAFT") {
    if (!policy.canCreateCampaignDraft) {
      return reject(
        `NEW_CAMPAIGN_DRAFT blocked in ${evidence.stage} stage. ` +
        `Platform needs ≥50 completed jobs and ≥20 paid conversions before creating new campaigns. ` +
        `Use the 4 existing zone campaigns and wait for conversion data.`
      );
    }
    if (policy.minCampaignBudgetGbp !== null && (evidence.proposedBudget ?? 0) < policy.minCampaignBudgetGbp) {
      return reject(
        `Campaign budget £${evidence.proposedBudget}/day is below the £${policy.minCampaignBudgetGbp}/day minimum. ` +
        `Below this threshold Google's Smart Bidding has insufficient signal and the spend is wasted.`
      );
    }
    if (policy.requiresCoverageEvidence && !evidence.coverageSufficient) {
      return reject(
        `Coverage gate failed: no active locksmiths confirmed in the target area. ` +
        `Do not spend ad budget in areas that cannot be serviced.`
      );
    }
  }

  if (evidence.actionType === "SCHEDULE_SOCIAL_POST" && !policy.canScheduleSocialPost) {
    return reject(
      `SCHEDULE_SOCIAL_POST blocked in ${evidence.stage} stage. ` +
      `Social media builds brand for an audience that doesn't exist yet. ` +
      `Focus budget on generating the first 50 jobs.`
    );
  }

  if (evidence.actionType === "INCREASE_BUDGET" && !policy.canIncreaseBudget) {
    return reject(
      `INCREASE_BUDGET blocked in ${evidence.stage} stage. ` +
      `Budget increases must be human-initiated until the platform reaches SCALE stage.`
    );
  }

  if (evidence.actionType === "CHANGE_BID_STRATEGY" && !policy.canChangeBidStrategy) {
    return reject(
      `CHANGE_BID_STRATEGY blocked in ${evidence.stage} stage.`
    );
  }

  // ── Evidence quality checks ───────────────────────────────────────────────

  const HIGH_SPEND_ACTIONS: ActionType[] = ["NEW_CAMPAIGN_DRAFT", "INCREASE_BUDGET", "CHANGE_BID_STRATEGY"];

  if (HIGH_SPEND_ACTIONS.includes(evidence.actionType)) {
    if (policy.requiresDataEvidence) {
      if (!evidence.dataMaturity || evidence.dataMaturity.impressions < 100) {
        return reject(
          `Insufficient data maturity. Need ≥100 impressions on existing campaigns before proposing ` +
          `${evidence.actionType}. Current impressions: ${evidence.dataMaturity?.impressions ?? 0}.`
        );
      }
    }
    if (
      policy.minImpactBasisLength > 0 &&
      (!evidence.expectedImpact?.basis || evidence.expectedImpact.basis.length < policy.minImpactBasisLength)
    ) {
      return reject(
        `Impact basis too weak. Require ≥${policy.minImpactBasisLength} chars of specific, ` +
        `data-backed reasoning. Got: "${evidence.expectedImpact?.basis ?? "(none)"}". ` +
        `Reference actual metrics: impressions, CTR, CPA, or conversion rates.`
      );
    }
    if (evidence.expectedImpact?.confidence === "LOW") {
      return reject(
        `LOW confidence actions with high spend impact are not permitted. ` +
        `Gather more data or reduce the action scope.`
      );
    }
  }

  return { valid: true, stage: evidence.stage, signals: { completedJobs: 0, paidConversions: 0, activeLocksmiths: 0, daysOnline: 0 } };
}

/**
 * Full gate: resolve stage, validate evidence, return result.
 * The signals are included in the result for logging/audit.
 */
export async function gateApproval(
  evidence: Omit<ApprovalEvidence, "stage">
): Promise<ValidationResult> {
  const { stage, signals } = await getPlatformStage();
  const result = validateApprovalEvidence({ ...evidence, stage });
  return { ...result, stage, signals };
}
