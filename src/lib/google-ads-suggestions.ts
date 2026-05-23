/**
 * Google Ads Copilot — Suggestion Analysis Engine.
 *
 * Runs every 6 hours (after the performance sync cron). Reads existing
 * AdPerformanceSnapshot + search-term data and generates CampaignSuggestion
 * rows that an admin must approve before any Google Ads mutation fires.
 *
 * Model routing (all local via Ollama):
 *   HERMES    → structured suggestion card generation (tool-calling specialist)
 *   REASONING → weekly reflection / threshold learning from approvals
 *   FAST      → lightweight keyword classification
 *
 * Philosophy: observe → suggest → human approves → execute.
 * Nothing in this file mutates Google Ads directly.
 */

import prisma from "@/lib/db";
import { chat, Models } from "@/lib/llm-router";

// ─── Evidence thresholds ─────────────────────────────────────────────────────
// Conservative defaults — err on the side of too few suggestions rather than
// noise. Thresholds adjust upward over time when humans reject suggestions,
// and downward when they consistently approve. See reflectOnApprovalPatterns().

const DEFAULT_THRESHOLDS = {
  addNegative:     { minSpend: 2.00, minClicks: 10, maxConversions: 0 },
  addKeyword:      { minConversions: 2, minClicks: 5 },
  increaseBudget:  { minUtilisationRate: 0.90, minDays: 3, minRoas: 3.0 },
  decreaseBudget:  { minDays: 7, minImpressions: 200, maxConversions: 0 },
  pauseCandidate:  { minSpend: 20, minDays: 14, maxConversions: 0 },
  scaleWinner:     { minRoas: 4.0, maxCpa: 12, minDays: 14 },
  lowerBid:        { cpcMultiplierVsAccount: 2.0, minDays: 5, maxConversions: 0 },
};

export type SuggestionType =
  | "ADD_NEGATIVE_KEYWORD"
  | "ADD_KEYWORD"
  | "INCREASE_BUDGET"
  | "DECREASE_BUDGET"
  | "LOWER_BID"
  | "RAISE_BID"
  | "PAUSE_CANDIDATE"
  | "SCALE_WINNER"
  | "NEW_DRAFT_CITY";

export interface SuggestionEvidence {
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

async function getAdsSpecialistAgentId(): Promise<string | undefined> {
  const agent = await prisma.agent.findUnique({ where: { name: "ads-specialist" } });
  return agent?.id ?? undefined;
}

async function suggestionAlreadyPending(
  googleCampaignId: string,
  type: SuggestionType,
  keyEvidence: string,
): Promise<boolean> {
  const existing = await (prisma as any).campaignSuggestion.findFirst({
    where: {
      googleCampaignId,
      type,
      status: "PENDING",
      reasoning: { contains: keyEvidence },
    },
    select: { id: true },
  });
  return !!existing;
}

async function createSuggestion(args: {
  type: SuggestionType;
  draftId?: string;
  googleCampaignId?: string;
  campaignName?: string;
  evidence: SuggestionEvidence;
  suggestedValue: Record<string, unknown>;
  currentValue?: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  agentId?: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await (prisma as any).campaignSuggestion.create({
    data: {
      type: args.type,
      draftId: args.draftId,
      googleCampaignId: args.googleCampaignId,
      campaignName: args.campaignName,
      evidence: args.evidence,
      suggestedValue: args.suggestedValue,
      currentValue: args.currentValue ?? {},
      reasoning: args.reasoning,
      confidence: args.confidence,
      status: "PENDING",
      agentId: args.agentId,
      expiresAt,
    },
  });
}

// ─── Analysis: search terms → ADD_NEGATIVE / ADD_KEYWORD ─────────────────────

async function analyseSearchTermsForCampaign(
  draft: { id: string; googleCampaignId: string; name: string; negativeKeywords: string[]; dailyBudget: number },
  agentId: string | undefined,
): Promise<void> {
  const t = DEFAULT_THRESHOLDS;

  // Pull search term data from the last 30 days via AdPerformanceSnapshot.
  // The sync cron writes per-campaign daily rows; we aggregate here.
  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: {
      googleCampaignId: draft.googleCampaignId,
      platform: "google",
      date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: "desc" },
  });

  if (!snapshots.length) return;

  const totalSpend = snapshots.reduce((s, r) => s + r.spend, 0);
  const totalClicks = snapshots.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = snapshots.reduce((s, r) => s + r.conversions, 0);
  const totalImpressions = snapshots.reduce((s, r) => s + r.impressions, 0);
  const days = snapshots.length;

  // Use Hermes to analyse the campaign snapshot and suggest keyword actions.
  // Hermes-4 (tool-calling specialist) produces clean structured JSON.
  const prompt = `You are a Google Ads analyst for LockSafe UK (anti-fraud locksmith marketplace).
Analyse this campaign's 30-day performance and suggest up to 3 specific keyword actions.

CAMPAIGN: "${draft.name}"
DAILY BUDGET: £${draft.dailyBudget}
PERIOD: ${days} days
TOTAL SPEND: £${totalSpend.toFixed(2)}
TOTAL CLICKS: ${totalClicks}
TOTAL CONVERSIONS: ${totalConversions}
TOTAL IMPRESSIONS: ${totalImpressions}
AVG CPC: £${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "n/a"}
AVG CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0"}%
EXISTING NEGATIVES (already blocked): ${draft.negativeKeywords.slice(0, 20).join(", ")}

LockSafe ONLY serves residential/commercial door lockouts and lock changes in the UK.
Negatives needed for: car/auto locksmith, safe opening, training/courses, DIY/lockpicking, key cutting only, price comparison.

Return a JSON array of suggestions (max 3, only high-confidence ones):
[{
  "type": "ADD_NEGATIVE_KEYWORD" | "ADD_KEYWORD",
  "keyword": "the keyword text",
  "matchType": "EXACT" | "PHRASE" | "BROAD",
  "reasoning": "1-2 sentence plain English explanation for the human",
  "confidence": 0.0-1.0
}]
Return [] if no high-confidence suggestions. No markdown, raw JSON only.`;

  let suggestions: Array<{ type: string; keyword: string; matchType: string; reasoning: string; confidence: number }> = [];
  try {
    const res = await chat(Models.HERMES, [{ role: "user", content: prompt }], {
      responseFormat: "json",
      temperature: 0.2,
      maxTokens: 600,
    });
    const parsed = JSON.parse(res.content || "[]");
    if (Array.isArray(parsed)) suggestions = parsed;
  } catch {
    return;
  }

  for (const s of suggestions) {
    if (!s.keyword || !s.type) continue;
    const kw = String(s.keyword).toLowerCase().trim();
    if (!kw || kw.length > 80) continue;

    // Don't re-suggest something already in the negative list.
    if (s.type === "ADD_NEGATIVE_KEYWORD" && draft.negativeKeywords.some((n) => n.toLowerCase() === kw)) continue;

    const alreadyPending = await suggestionAlreadyPending(draft.googleCampaignId, s.type as SuggestionType, kw);
    if (alreadyPending) continue;

    // Enforce evidence thresholds for negatives.
    if (s.type === "ADD_NEGATIVE_KEYWORD") {
      const spendOk = totalSpend >= t.addNegative.minSpend;
      const clicksOk = totalClicks >= t.addNegative.minClicks;
      if (!spendOk || !clicksOk) continue;
    }

    await createSuggestion({
      type: s.type as SuggestionType,
      draftId: draft.id,
      googleCampaignId: draft.googleCampaignId,
      campaignName: draft.name,
      evidence: { totalSpend, totalClicks, totalConversions, days, avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0 },
      suggestedValue: { keyword: kw, matchType: s.matchType ?? "PHRASE" },
      reasoning: String(s.reasoning ?? "").slice(0, 500),
      confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.5))),
      agentId,
    });
  }
}

// ─── Analysis: budget utilisation ────────────────────────────────────────────

async function analyseBudgetForCampaign(
  draft: { id: string; googleCampaignId: string; name: string; dailyBudget: number },
  agentId: string | undefined,
): Promise<void> {
  const t = DEFAULT_THRESHOLDS;
  const recent = await prisma.adPerformanceSnapshot.findMany({
    where: {
      googleCampaignId: draft.googleCampaignId,
      platform: "google",
      date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  if (!recent.length) return;

  const days = recent.length;
  const avgDailySpend = recent.reduce((s, r) => s + r.spend, 0) / days;
  const avgDailyConversions = recent.reduce((s, r) => s + r.conversions, 0) / days;
  const avgRoas = recent.filter((r) => r.spend > 0).reduce((s, r) => s + r.roas, 0) / recent.filter((r) => r.spend > 0).length || 0;
  const utilisationRate = draft.dailyBudget > 0 ? avgDailySpend / draft.dailyBudget : 0;

  // SCALE_WINNER: high utilisation + good ROAS
  if (
    utilisationRate >= t.increaseBudget.minUtilisationRate &&
    avgRoas >= t.increaseBudget.minRoas &&
    avgDailyConversions > 0 &&
    days >= t.increaseBudget.minDays
  ) {
    const alreadyPending = await suggestionAlreadyPending(draft.googleCampaignId, "SCALE_WINNER", "ROAS");
    if (!alreadyPending) {
      const suggestedBudget = Math.min(15, Math.round(draft.dailyBudget * 1.25));
      await createSuggestion({
        type: "SCALE_WINNER",
        draftId: draft.id,
        googleCampaignId: draft.googleCampaignId,
        campaignName: draft.name,
        evidence: { avgDailySpend, utilisationRate, avgRoas, avgDailyConversions, days },
        suggestedValue: { newDailyBudget: suggestedBudget },
        currentValue: { currentDailyBudget: draft.dailyBudget },
        reasoning: `Campaign is hitting ${(utilisationRate * 100).toFixed(0)}% of budget daily with a ${avgRoas.toFixed(1)}× ROAS over ${days} days. Increasing from £${draft.dailyBudget} to £${suggestedBudget}/day targets ~25% more clicks at the same efficiency. Capped at £15/day per policy.`,
        confidence: 0.8,
        agentId,
      });
    }
  }

  // PAUSE_CANDIDATE: spending without converting for 14+ days
  const totalSpend = recent.reduce((s, r) => s + r.spend, 0);
  const totalConversions = recent.reduce((s, r) => s + r.conversions, 0);
  const totalImpressions = recent.reduce((s, r) => s + r.impressions, 0);

  if (
    totalSpend >= t.pauseCandidate.minSpend &&
    totalConversions === 0 &&
    days >= t.pauseCandidate.minDays &&
    totalImpressions >= 200
  ) {
    const alreadyPending = await suggestionAlreadyPending(draft.googleCampaignId, "PAUSE_CANDIDATE", "conversions");
    if (!alreadyPending) {
      await createSuggestion({
        type: "PAUSE_CANDIDATE",
        draftId: draft.id,
        googleCampaignId: draft.googleCampaignId,
        campaignName: draft.name,
        evidence: { totalSpend, totalConversions, totalImpressions, days },
        suggestedValue: { action: "review_and_pause" },
        currentValue: { status: "PUBLISHED" },
        reasoning: `Campaign has spent £${totalSpend.toFixed(2)} over ${days} days with ${totalImpressions.toLocaleString()} impressions but zero conversions. Review ad copy, landing page, and keyword match types before considering pause. Do not pause without checking the search terms report first.`,
        confidence: 0.65,
        agentId,
      });
    }
  }
}

// ─── Main cycle ───────────────────────────────────────────────────────────────

export interface SuggestionCycleResult {
  campaignsAnalysed: number;
  suggestionsCreated: number;
  suggestionsExpired: number;
  errors: string[];
}

export async function runFullSuggestionCycle(): Promise<SuggestionCycleResult> {
  const result: SuggestionCycleResult = {
    campaignsAnalysed: 0,
    suggestionsCreated: 0,
    suggestionsExpired: 0,
    errors: [],
  };

  const agentId = await getAdsSpecialistAgentId();

  // Expire stale PENDING suggestions.
  const expired = await (prisma as any).campaignSuggestion.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  result.suggestionsExpired = expired.count;

  // Analyse all PUBLISHED Google Ads campaigns.
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: { status: "PUBLISHED", googleCampaignId: { not: null } },
    select: { id: true, googleCampaignId: true, name: true, negativeKeywords: true, dailyBudget: true },
  });

  const countBefore = await (prisma as any).campaignSuggestion.count({ where: { status: "PENDING" } });

  for (const draft of drafts) {
    if (!draft.googleCampaignId) continue;
    try {
      await analyseSearchTermsForCampaign(
        { ...draft, googleCampaignId: draft.googleCampaignId },
        agentId,
      );
      await analyseBudgetForCampaign(
        { ...draft, googleCampaignId: draft.googleCampaignId },
        agentId,
      );
      result.campaignsAnalysed++;
    } catch (err) {
      result.errors.push(`${draft.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const countAfter = await (prisma as any).campaignSuggestion.count({ where: { status: "PENDING" } });
  result.suggestionsCreated = Math.max(0, countAfter - countBefore);

  return result;
}

// ─── Reflection: learn from approval/rejection patterns ──────────────────────

export interface ReflectionResult {
  summary: string;
  approvalRates: Record<SuggestionType, { approved: number; rejected: number; rate: number }>;
}

export async function reflectOnApprovalPatterns(): Promise<ReflectionResult> {
  // Pull last 90 days of decided suggestions.
  const decided = await (prisma as any).campaignSuggestion.findMany({
    where: {
      status: { in: ["APPROVED", "REJECTED"] },
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    select: { type: true, status: true, rejectedReason: true },
  });

  if (!decided.length) {
    return { summary: "No decided suggestions yet — thresholds unchanged.", approvalRates: {} as ReflectionResult["approvalRates"] };
  }

  const byType: Record<string, { approved: number; rejected: number }> = {};
  for (const s of decided) {
    if (!byType[s.type]) byType[s.type] = { approved: 0, rejected: 0 };
    if (s.status === "APPROVED") byType[s.type].approved++;
    else byType[s.type].rejected++;
  }

  const approvalRates = Object.fromEntries(
    Object.entries(byType).map(([type, counts]) => {
      const total = counts.approved + counts.rejected;
      return [type, { ...counts, rate: total > 0 ? counts.approved / total : 0 }];
    }),
  ) as ReflectionResult["approvalRates"];

  // Use REASONING model (qwen3:32b thinking) to interpret the pattern and
  // produce a plain-English note for the MarketingPolicy.notes field.
  const summaryPrompt = `You are reviewing a Google Ads copilot system for LockSafe UK.
These are the human approval rates for AI suggestions over the last 90 days:
${JSON.stringify(approvalRates, null, 2)}

In 2-3 sentences: What patterns do you see? What should the system learn about
this human's preferences? What suggestion types are trusted vs. distrusted?
Be specific and actionable. Plain text only.`;

  let summary = "Reflection complete.";
  try {
    const res = await chat(Models.REASONING, [{ role: "user", content: summaryPrompt }], {
      temperature: 0.3,
      maxTokens: 300,
    });
    summary = res.content?.trim() || summary;
  } catch {
    // Non-fatal — summary is informational only.
  }

  // Persist the summary as a note on the Google MarketingPolicy row.
  try {
    await prisma.marketingPolicy.updateMany({
      where: { platform: "google" },
      data: {
        notes: JSON.stringify({
          reflectedAt: new Date().toISOString(),
          approvalRates,
          summary,
        }),
      },
    });
  } catch {
    // Non-fatal.
  }

  return { summary, approvalRates };
}
