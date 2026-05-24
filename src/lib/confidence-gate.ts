/**
 * Confidence Gate — Auto-Approval Layer for CampaignSuggestions
 *
 * After every suggestion is filed, call tryAutoApproveSuggestion(id).
 * The gate runs a three-layer check before firing any live mutation:
 *
 *   Layer 1 — Policy flags (both must be true):
 *     autonomyEnabled           → master kill switch
 *     allowAutomaticMutations   → defence-in-depth, default false
 *
 *   Layer 2 — AI confidence:
 *     suggestion.confidence >= policy.autoApproveMinConfidence (default 0.85)
 *     Low-confidence suggestions always go to the human queue.
 *
 *   Layer 3 — Spend guard:
 *     Delegates to checkAutoAction() in spend-guard.ts:
 *       - proposedDailyBudget <= autoApproveMaxBudget
 *       - rolling 7d agent spend + projected < maxWeeklyAutoApproveSpend
 *       - daily and monthly aggregate caps
 *
 * If all three layers pass:
 *   → executeSuggestion() runs the actual Google Ads mutation
 *   → Telegram admin alert sent if notifyOnAutoAction
 *   → AgentDecision row written (executor handles this)
 *
 * If any layer fails:
 *   → Suggestion stays PENDING for human review
 *   → No mutation fires
 *   → Reason logged server-side
 */

import { sendAdminAlert } from "@/lib/telegram";
import { checkAutoAction, getEffectivePolicy } from "@/lib/spend-guard";
import { executeSuggestion } from "@/lib/google-ads-suggestion-executor";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AutoApproveResult {
  autoApproved: boolean;
  reason: string;
}

// ─── Budget-mutating suggestion types ────────────────────────────────────────

const BUDGET_MUTATION_TYPES = new Set([
  "INCREASE_BUDGET",
  "DECREASE_BUDGET",
  "SCALE_WINNER",
]);

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Attempt to auto-approve and execute a CampaignSuggestion.
 *
 * Call this immediately after creating a suggestion. It is fully
 * non-throwing: any internal error leaves the suggestion as PENDING.
 *
 * @param suggestionId  The CampaignSuggestion._id to evaluate.
 * @returns             Whether it was auto-approved and the reason.
 */
export async function tryAutoApproveSuggestion(
  suggestionId: string,
): Promise<AutoApproveResult> {
  try {
    // Lazy-import prisma to avoid circular deps
    const { default: prisma } = await import("@/lib/db");

    const suggestion = await (prisma as any).campaignSuggestion.findUnique({
      where: { id: suggestionId },
      select: {
        id: true,
        type: true,
        status: true,
        confidence: true,
        campaignName: true,
        reasoning: true,
        suggestedValue: true,
        draft: {
          select: { accountId: true },
        },
      },
    });

    if (!suggestion) {
      return { autoApproved: false, reason: "Suggestion not found." };
    }

    // Only PENDING suggestions are eligible.
    if (suggestion.status !== "PENDING") {
      return { autoApproved: false, reason: `Already ${suggestion.status}.` };
    }

    // ── Layer 1: Policy flags ─────────────────────────────────────────────────

    const policy = await getEffectivePolicy("google");

    if (!policy.autonomyEnabled) {
      return { autoApproved: false, reason: "Autonomy disabled — suggestion queued for human review." };
    }

    // Check allowAutomaticMutations directly from the DB row (spend-guard merges
    // it out of the shape we need, so we read it separately here).
    const googlePolicyRow = await prisma.marketingPolicy.findUnique({
      where: { platform: "google" },
      select: { allowAutomaticMutations: true, autoApproveMinConfidence: true, notifyOnAutoAction: true },
    });

    if (!googlePolicyRow?.allowAutomaticMutations) {
      return {
        autoApproved: false,
        reason: "allowAutomaticMutations=false — copilot mode active, human approval required.",
      };
    }

    // ── Layer 2: AI confidence ────────────────────────────────────────────────

    const confidenceThreshold =
      googlePolicyRow.autoApproveMinConfidence ??
      (policy as any).autoApproveMinConfidence ??
      0.85;

    if (suggestion.confidence < confidenceThreshold) {
      return {
        autoApproved: false,
        reason: `Confidence ${(suggestion.confidence * 100).toFixed(0)}% below threshold ${(confidenceThreshold * 100).toFixed(0)}% — queued for review.`,
      };
    }

    // ── Layer 3: Spend guard ──────────────────────────────────────────────────

    const proposedBudget = BUDGET_MUTATION_TYPES.has(suggestion.type)
      ? Number((suggestion.suggestedValue as Record<string, unknown>)?.newDailyBudget ?? 0)
      : 0;

    const guardDecision = await checkAutoAction({
      platform: "google",
      action: "auto_approve_draft",
      proposedDailyBudget: proposedBudget > 0 ? proposedBudget : undefined,
      initiator: "agent",
    });

    if (!guardDecision.allowed) {
      return { autoApproved: false, reason: `Spend guard: ${guardDecision.reason}` };
    }

    // ── All layers passed — execute ───────────────────────────────────────────

    const result = await executeSuggestion(suggestionId, "auto-system");

    if (!result.success) {
      return { autoApproved: false, reason: `Execution failed: ${result.message}` };
    }

    console.log(
      `[ConfidenceGate] Auto-approved suggestion ${suggestionId} ` +
        `(type=${suggestion.type}, confidence=${(suggestion.confidence * 100).toFixed(0)}%): ${result.mutationApplied ?? result.message}`,
    );

    // ── Notify admin ──────────────────────────────────────────────────────────

    const notify = googlePolicyRow.notifyOnAutoAction ?? true;
    if (notify) {
      await sendAdminAlert({
        title: "✅ AI Auto-Approved Suggestion",
        message:
          `Type: ${suggestion.type}\n` +
          `Campaign: ${suggestion.campaign?.name ?? suggestion.campaignName ?? "unknown"}\n` +
          `Confidence: ${(suggestion.confidence * 100).toFixed(0)}%\n` +
          `Action: ${result.mutationApplied ?? result.message}\n\n` +
          `Reasoning: ${String(suggestion.reasoning ?? "").slice(0, 200)}\n\n` +
          `Review at: /admin/google-ads/suggestions`,
        severity: "info",
      }).catch(() => {});
    }

    return { autoApproved: true, reason: result.mutationApplied ?? result.message };
  } catch (err) {
    // Never crash the caller — suggestion stays PENDING and gets human review.
    console.error("[ConfidenceGate] Unexpected error:", err);
    return {
      autoApproved: false,
      reason: `Internal error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
