/**
 * Google Ads Copilot — Suggestion Executor.
 *
 * Called only when a human clicks APPROVE on a CampaignSuggestion card.
 * This is the ONLY place in the system that mutates live Google Ads data
 * in response to a suggestion. Nothing fires automatically.
 *
 * Each suggestion type maps to a specific, minimal Google Ads mutation.
 * Budget/bid changes are capped by MarketingPolicy to prevent overspend.
 */

import prisma from "@/lib/db";
import { getGoogleAdsClientForAccount, buildResourceName } from "./google-ads";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecuteResult {
  success: boolean;
  message: string;
  mutationApplied?: string;
}

// ─── Policy guard ─────────────────────────────────────────────────────────────

async function getGooglePolicy() {
  return prisma.marketingPolicy.findUnique({ where: { platform: "google" } });
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeSuggestion(
  suggestionId: string,
  approvedByAdminId: string,
): Promise<ExecuteResult> {
  const suggestion = await (prisma as any).campaignSuggestion.findUnique({
    where: { id: suggestionId },
    include: { draft: { select: { accountId: true, googleCampaignId: true, googleAdGroupId: true, dailyBudget: true, googleBudgetId: true } } },
  });

  if (!suggestion) return { success: false, message: "Suggestion not found." };
  if (suggestion.status !== "PENDING") {
    return { success: false, message: `Suggestion is already ${suggestion.status}.` };
  }

  // Mark approved immediately so a double-click can't fire twice.
  await (prisma as any).campaignSuggestion.update({
    where: { id: suggestionId },
    data: { status: "APPROVED", approvedBy: approvedByAdminId, approvedAt: new Date() },
  });

  // PAUSE_CANDIDATE and NEW_DRAFT_CITY are informational — no mutation needed.
  if (suggestion.type === "PAUSE_CANDIDATE") {
    await (prisma as any).campaignSuggestion.update({
      where: { id: suggestionId },
      data: { status: "APPLIED", appliedAt: new Date() },
    });
    return { success: true, message: "Noted. Review this campaign manually in Google Ads." };
  }
  if (suggestion.type === "NEW_DRAFT_CITY") {
    await (prisma as any).campaignSuggestion.update({
      where: { id: suggestionId },
      data: { status: "APPLIED", appliedAt: new Date() },
    });
    return { success: true, message: "City draft approved. Create or review the PENDING_APPROVAL draft." };
  }

  // All other types require a live Google Ads API call.
  const draft = suggestion.draft;
  if (!draft?.accountId || !draft.googleCampaignId) {
    await markFailed(suggestionId, "No linked draft or campaign ID — cannot execute mutation.");
    return { success: false, message: "No linked campaign to mutate." };
  }

  const client = await getGoogleAdsClientForAccount(draft.accountId);
  if (!client) {
    await markFailed(suggestionId, "Could not build Google Ads client for account.");
    return { success: false, message: "Google Ads account not accessible." };
  }

  const cid = client.customerIdPlain;
  const policy = await getGooglePolicy();
  const suggested = suggestion.suggestedValue as Record<string, unknown>;

  try {
    let mutationApplied = "";

    // ── ADD_NEGATIVE_KEYWORD ─────────────────────────────────────────────────
    if (suggestion.type === "ADD_NEGATIVE_KEYWORD") {
      const keyword = String(suggested.keyword ?? "").trim();
      if (!keyword) throw new Error("No keyword in suggestedValue.");

      const campaignResource = buildResourceName(cid, "campaigns", draft.googleCampaignId);
      await client.mutate("campaignCriteria", [
        {
          create: {
            campaign: campaignResource,
            negative: true,
            keyword: { text: keyword, matchType: "BROAD" },
          },
        },
      ]);

      // Also persist the negative into the draft record so future re-publishes include it.
      await prisma.googleAdsCampaignDraft.update({
        where: { googleCampaignId: draft.googleCampaignId },
        data: { negativeKeywords: { push: keyword } },
      });

      mutationApplied = `Added negative keyword "${keyword}" to campaign ${draft.googleCampaignId}`;
    }

    // ── ADD_KEYWORD ──────────────────────────────────────────────────────────
    else if (suggestion.type === "ADD_KEYWORD") {
      const keyword = String(suggested.keyword ?? "").trim();
      const matchType = String(suggested.matchType ?? "PHRASE").toUpperCase();
      if (!keyword || !draft.googleAdGroupId) throw new Error("Missing keyword or ad group ID.");

      const adGroupResource = buildResourceName(cid, "adGroups", draft.googleAdGroupId);
      await client.mutate("adGroupCriteria", [
        {
          create: {
            adGroup: adGroupResource,
            keyword: { text: keyword, matchType },
            status: "ENABLED",
          },
        },
      ]);
      mutationApplied = `Added keyword [${keyword}] (${matchType}) to ad group.`;
    }

    // ── INCREASE_BUDGET / SCALE_WINNER ───────────────────────────────────────
    else if (suggestion.type === "INCREASE_BUDGET" || suggestion.type === "SCALE_WINNER") {
      const newBudget = Number(suggested.newDailyBudget ?? 0);
      if (!newBudget) throw new Error("No newDailyBudget in suggestedValue.");

      const maxAllowed = policy?.maxCampaignDailyBudget ?? 15;
      const capped = Math.min(newBudget, maxAllowed);

      if (!draft.googleBudgetId) throw new Error("No budget ID on draft.");
      const budgetResource = buildResourceName(cid, "campaignBudgets", draft.googleBudgetId);
      await client.mutate("campaignBudgets", [
        {
          update: {
            resourceName: budgetResource,
            amountMicros: String(Math.round(capped * 1_000_000)),
          },
          updateMask: "amount_micros",
        },
      ]);

      await prisma.googleAdsCampaignDraft.update({
        where: { googleCampaignId: draft.googleCampaignId },
        data: { dailyBudget: capped },
      });
      mutationApplied = `Budget updated to £${capped}/day (requested £${newBudget}, policy cap £${maxAllowed}).`;
    }

    // ── DECREASE_BUDGET ──────────────────────────────────────────────────────
    else if (suggestion.type === "DECREASE_BUDGET") {
      const newBudget = Number(suggested.newDailyBudget ?? 0);
      const minBudget = policy?.minCampaignDailyBudget ?? 3;
      const capped = Math.max(newBudget, minBudget);

      if (!draft.googleBudgetId) throw new Error("No budget ID on draft.");
      const budgetResource = buildResourceName(cid, "campaignBudgets", draft.googleBudgetId);
      await client.mutate("campaignBudgets", [
        {
          update: {
            resourceName: budgetResource,
            amountMicros: String(Math.round(capped * 1_000_000)),
          },
          updateMask: "amount_micros",
        },
      ]);

      await prisma.googleAdsCampaignDraft.update({
        where: { googleCampaignId: draft.googleCampaignId },
        data: { dailyBudget: capped },
      });
      mutationApplied = `Budget decreased to £${capped}/day.`;
    }

    // ── LOWER_BID ────────────────────────────────────────────────────────────
    else if (suggestion.type === "LOWER_BID") {
      const newCpcGbp = Number(suggested.newMaxCpcGbp ?? 0);
      if (!newCpcGbp || !draft.googleAdGroupId) throw new Error("Missing bid value or ad group ID.");

      const adGroupResource = buildResourceName(cid, "adGroups", draft.googleAdGroupId);
      await client.mutate("adGroups", [
        {
          update: {
            resourceName: adGroupResource,
            cpcBidMicros: String(Math.round(newCpcGbp * 1_000_000)),
          },
          updateMask: "cpc_bid_micros",
        },
      ]);
      mutationApplied = `Max CPC lowered to £${newCpcGbp.toFixed(2)} on ad group.`;
    }

    else {
      throw new Error(`Unhandled suggestion type: ${suggestion.type}`);
    }

    await (prisma as any).campaignSuggestion.update({
      where: { id: suggestionId },
      data: { status: "APPLIED", appliedAt: new Date() },
    });

    // Emit AgentDecision for the reflection system.
    await prisma.agentDecision.create({
      data: {
        agent: "ads-specialist",
        platform: "google",
        action: `suggestion-applied:${suggestion.type}`,
        payload: { suggestionId, suggested: suggested as Record<string, unknown>, mutationApplied } as object,
        policySnapshot: {} as object,
        outcome: "ok",
        dryRun: false,
        executedAt: new Date(),
      },
    }).catch(() => undefined);

    return { success: true, message: mutationApplied, mutationApplied };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(suggestionId, msg);
    return { success: false, message: msg };
  }
}

export async function rejectSuggestion(
  suggestionId: string,
  rejectedByAdminId: string,
  reason: string,
): Promise<void> {
  await (prisma as any).campaignSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: "REJECTED",
      rejectedBy: rejectedByAdminId,
      rejectedAt: new Date(),
      rejectedReason: reason,
    },
  });

  // Emit AgentDecision so the reflection system learns from this rejection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectedSuggestion = await (prisma as any).campaignSuggestion
    .findUnique({ where: { id: suggestionId }, select: { type: true } })
    .catch(() => null);
  await prisma.agentDecision.create({
    data: {
      agent: "ads-specialist",
      platform: "google",
      action: `suggestion-rejected:${rejectedSuggestion?.type ?? "unknown"}`,
      payload: { suggestionId, reason } as object,
      policySnapshot: {} as object,
      outcome: "rejected",
      dryRun: false,
      executedAt: new Date(),
    },
  }).catch(() => undefined);
}

async function markFailed(suggestionId: string, error: string): Promise<void> {
  await (prisma as any).campaignSuggestion.update({
    where: { id: suggestionId },
    data: { status: "PENDING", applyError: error.slice(0, 500) },
  }).catch(() => undefined);
}
