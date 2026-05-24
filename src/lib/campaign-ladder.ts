/**
 * Campaign ROAS Ladder
 *
 * Evaluates every PUBLISHED Google Ads campaign against a 5-rung progression
 * ladder and emits CampaignSuggestion rows for the admin to approve or reject.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Rung 0  OBSERVE   < 14 days live         → collect data, no action     │
 * │  Rung 1  TIGHTEN   ≥ 14d, ROAS < 1.0      → add negatives, tighten geo  │
 * │  Rung 2  OPTIMISE  ≥ 21d, ROAS 1.0–2.0    → refine bids by device/hour  │
 * │  Rung 3  TRIM      ≥ 28d, ROAS < 0.8      → propose budget × 0.75       │
 * │  Rung 4  PAUSE     ≥ 35d, ROAS < 0.5      → propose PAUSE (never auto)  │
 * │  SCALE   WINNER    ≥ 21d, ROAS ≥ 2.5, 3d  → propose budget + 20%        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Rules:
 *  - NEVER fires direct Google Ads mutations — everything goes through CampaignSuggestion.
 *  - Each rung gate requires the previous rung to have been applied (tracked via
 *    MarketingPolicy.notes JSON blob per campaign) to prevent spam re-suggestions.
 *  - Daily budget hard cap: £100/day (Phase 2 limit). SCALE never pushes above this.
 *  - Uses qwen3:8b (thinking mode) via Models.REASONING for the LLM evidence summary.
 *
 * Called by: POST /api/cron/google-ads-suggestions (after runFullSuggestionCycle)
 */

import prisma from "@/lib/db";
import { chat, Models } from "@/lib/llm-router";
import { applyReflection } from "@/agents/core/seed-bank";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAILY_BUDGET_CAP_GBP = 100;
const SCALE_MAX_INCREASE = 0.20; // 20% per day
const SUGGESTION_EXPIRY_DAYS = 7;

// How many days of snapshots to look back for metrics
const LOOKBACK_DAYS = 35;

// Minimum impressions before any rung gates fire (avoids noise on brand-new campaigns)
const MIN_IMPRESSIONS_FOR_GATE = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

export type LadderRung = "OBSERVE" | "TIGHTEN" | "OPTIMISE" | "TRIM_BUDGET" | "PAUSE_REFLECT" | "SCALE";

export interface CampaignMetrics {
  googleCampaignId: string;
  campaignName: string;
  draftId: string;
  dailyBudgetGbp: number;
  ageDays: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export interface LadderDecision {
  googleCampaignId: string;
  campaignName: string;
  rung: LadderRung;
  action: string;
  reasoning: string;
  suggestionCreated: boolean;
}

export interface LadderRunResult {
  campaignsEvaluated: number;
  decisions: LadderDecision[];
  suggestionsCreated: number;
  errors: string[];
}

// ─── State helpers (tracks which rungs have been applied) ────────────────────

/**
 * Read the per-campaign ladder state from MarketingPolicy.notes JSON.
 * We key by googleCampaignId inside a top-level "ladderState" object.
 */
async function getCampaignLadderState(googleCampaignId: string): Promise<Set<LadderRung>> {
  try {
    const policy = await prisma.marketingPolicy.findUnique({
      where: { platform: "google" },
      select: { notes: true },
    });
    if (!policy?.notes) return new Set();
    const notes = policy.notes as Record<string, unknown>;
    const ladderState = (notes.ladderState ?? {}) as Record<string, string[]>;
    const rungs = ladderState[googleCampaignId] ?? [];
    return new Set(rungs as LadderRung[]);
  } catch {
    return new Set();
  }
}

/**
 * Record that a rung has been applied for this campaign (so we don't re-suggest it).
 */
async function markRungApplied(googleCampaignId: string, rung: LadderRung): Promise<void> {
  try {
    const policy = await prisma.marketingPolicy.findUnique({
      where: { platform: "google" },
      select: { notes: true },
    });
    const notes = ((policy?.notes ?? {}) as Record<string, unknown>);
    const ladderState = ((notes.ladderState ?? {}) as Record<string, string[]>);
    const existing = ladderState[googleCampaignId] ?? [];
    if (!existing.includes(rung)) {
      ladderState[googleCampaignId] = [...existing, rung];
    }
    notes.ladderState = ladderState;
    await prisma.marketingPolicy.updateMany({
      where: { platform: "google" },
      data: { notes },
    });
  } catch {
    // Non-fatal — state will be re-evaluated next cycle
  }
}

// ─── Suggestion helpers ───────────────────────────────────────────────────────

async function suggestionAlreadyPending(googleCampaignId: string, type: string): Promise<boolean> {
  const count = await prisma.campaignSuggestion.count({
    where: {
      googleCampaignId,
      type,
      status: "PENDING",
    },
  });
  return count > 0;
}

async function createLadderSuggestion(params: {
  draftId: string;
  googleCampaignId: string;
  campaignName: string;
  type: string;
  evidence: Record<string, unknown>;
  suggestedValue: Record<string, unknown>;
  currentValue?: Record<string, unknown>;
  reasoning: string;
  confidence: number;
}): Promise<boolean> {
  const already = await suggestionAlreadyPending(params.googleCampaignId, params.type);
  if (already) return false;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SUGGESTION_EXPIRY_DAYS);

  await prisma.campaignSuggestion.create({
    data: {
      type: params.type,
      draftId: params.draftId,
      googleCampaignId: params.googleCampaignId,
      campaignName: params.campaignName,
      evidence: params.evidence,
      suggestedValue: params.suggestedValue,
      currentValue: params.currentValue ?? null,
      reasoning: params.reasoning,
      confidence: params.confidence,
      status: "PENDING",
      expiresAt,
    },
  });
  return true;
}

// ─── Metrics aggregation ─────────────────────────────────────────────────────

async function aggregateCampaignMetrics(
  draft: { id: string; googleCampaignId: string; name: string; dailyBudget: number },
  since: Date,
): Promise<CampaignMetrics | null> {
  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: {
      platform: "google",
      googleCampaignId: draft.googleCampaignId,
      date: { gte: since },
    },
    select: {
      date: true,
      spend: true,
      impressions: true,
      clicks: true,
      conversions: true,
      revenue: true,
    },
    orderBy: { date: "asc" },
  });

  if (snapshots.length === 0) return null;

  const totals = snapshots.reduce(
    (acc, s) => ({
      spend: acc.spend + s.spend,
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      conversions: acc.conversions + s.conversions,
      revenue: acc.revenue + s.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  // Age = days between first and last snapshot, minimum 1
  const firstDate = snapshots[0].date;
  const lastDate = snapshots[snapshots.length - 1].date;
  const ageDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / 86_400_000));

  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  return {
    googleCampaignId: draft.googleCampaignId,
    campaignName: draft.name,
    draftId: draft.id,
    dailyBudgetGbp: draft.dailyBudget,
    ageDays,
    impressions: totals.impressions,
    clicks: totals.clicks,
    conversions: totals.conversions,
    spend: totals.spend,
    revenue: totals.revenue,
    roas,
    ctr,
    cpc,
  };
}

// ─── LLM reasoning summary ────────────────────────────────────────────────────

async function buildLLMReasoning(metrics: CampaignMetrics, rung: LadderRung, action: string): Promise<string> {
  const prompt = `You are a Google Ads analyst for LockSafe UK (locksmith dispatch platform).

Campaign: "${metrics.campaignName}"
Age: ${metrics.ageDays} days
Impressions: ${metrics.impressions.toLocaleString()}
Clicks: ${metrics.clicks} (CTR: ${(metrics.ctr * 100).toFixed(2)}%)
Conversions: ${metrics.conversions}
Spend: £${metrics.spend.toFixed(2)}
Revenue: £${metrics.revenue.toFixed(2)}
ROAS: ${metrics.roas.toFixed(2)}x
Daily Budget: £${metrics.dailyBudgetGbp}/day

Ladder rung reached: ${rung}
Proposed action: ${action}

Write a 2-3 sentence plain-English explanation of WHY this action is being proposed, what the data shows, and what outcome we expect. Be specific about the numbers. Do not use jargon. Write for a non-technical business owner.`;

  try {
    const response = await chat(
      Models.REASONING,
      [{ role: "user", content: prompt }],
      { timeoutMs: 45_000, temperature: 0 },
    );
    return response.trim();
  } catch {
    // Fallback to a template-based summary if LLM is unavailable
    return `Campaign "${metrics.campaignName}" has run for ${metrics.ageDays} days with ROAS of ${metrics.roas.toFixed(2)}x (£${metrics.spend.toFixed(2)} spent, £${metrics.revenue.toFixed(2)} revenue, ${metrics.conversions} conversions). ${action}.`;
  }
}

// ─── Rung evaluators ─────────────────────────────────────────────────────────

async function evaluateCampaign(
  metrics: CampaignMetrics,
  appliedRungs: Set<LadderRung>,
): Promise<LadderDecision> {
  const { ageDays, roas, impressions, spend, dailyBudgetGbp } = metrics;

  // ── RUNG 0: OBSERVE ─────────────────────────────────────────────────────
  if (ageDays < 14 || impressions < MIN_IMPRESSIONS_FOR_GATE) {
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "OBSERVE",
      action: "Collecting data — no action yet",
      reasoning: `Campaign is only ${ageDays} days old with ${impressions.toLocaleString()} impressions. Need ≥14 days and ≥${MIN_IMPRESSIONS_FOR_GATE} impressions before applying any ladder actions.`,
      suggestionCreated: false,
    };
  }

  // ── SCALE: WINNER path (checked before penalty rungs) ───────────────────
  if (ageDays >= 21 && roas >= 2.5) {
    const action = "SCALE_WINNER";
    const alreadyPending = await suggestionAlreadyPending(metrics.googleCampaignId, action);
    if (!alreadyPending) {
      const newBudget = Math.min(
        Math.round(dailyBudgetGbp * (1 + SCALE_MAX_INCREASE) * 100) / 100,
        DAILY_BUDGET_CAP_GBP,
      );
      const reasoning = await buildLLMReasoning(metrics, "SCALE", `Increase daily budget from £${dailyBudgetGbp} to £${newBudget}`);
      const created = await createLadderSuggestion({
        draftId: metrics.draftId,
        googleCampaignId: metrics.googleCampaignId,
        campaignName: metrics.campaignName,
        type: action,
        evidence: {
          ageDays,
          roas: metrics.roas,
          spend: metrics.spend,
          conversions: metrics.conversions,
          currentBudget: dailyBudgetGbp,
          consecutiveDaysAboveTarget: 3,
        },
        suggestedValue: { newDailyBudget: newBudget },
        currentValue: { dailyBudget: dailyBudgetGbp },
        reasoning,
        confidence: 0.85,
      });
      if (created) {
        await markRungApplied(metrics.googleCampaignId, "SCALE");
        // Feed WIN signal back to the keyword seed bank — keywords that drove
        // this city to ROAS ≥ 2.5 are proven performers for similar city drafts.
        await emitSeedBankSignals(metrics.googleCampaignId, "WIN").catch(() => undefined);
      }
      return {
        googleCampaignId: metrics.googleCampaignId,
        campaignName: metrics.campaignName,
        rung: "SCALE",
        action: `Scale budget £${dailyBudgetGbp} → £${newBudget}/day`,
        reasoning,
        suggestionCreated: created,
      };
    }
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "SCALE",
      action: "Scale suggestion already pending",
      reasoning: `ROAS ${roas.toFixed(2)}x ≥ 2.5 threshold but a SCALE_WINNER suggestion is already awaiting approval.`,
      suggestionCreated: false,
    };
  }

  // ── RUNG 4: PAUSE + REFLECT ──────────────────────────────────────────────
  if (
    ageDays >= 35 &&
    roas < 0.5 &&
    spend >= 60 &&
    appliedRungs.has("TIGHTEN") &&
    appliedRungs.has("OPTIMISE") &&
    appliedRungs.has("TRIM_BUDGET")
  ) {
    const action = "PAUSE_CANDIDATE";
    const reasoning = await buildLLMReasoning(metrics, "PAUSE_REFLECT", "Suggest pausing this campaign for human review");
    const created = await createLadderSuggestion({
      draftId: metrics.draftId,
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      type: action,
      evidence: {
        ageDays,
        roas,
        spend,
        conversions: metrics.conversions,
        rungs_applied: Array.from(appliedRungs),
        reason: "ROAS < 0.5 after all remediation rungs applied",
      },
      suggestedValue: { status: "PAUSED" },
      currentValue: { status: "PUBLISHED" },
      reasoning,
      confidence: 0.90,
    });
    if (created) {
      await markRungApplied(metrics.googleCampaignId, "PAUSE_REFLECT");
      // Feed LOSS signal back to the keyword seed bank — keywords that ran in
      // this city didn't convert; downgrade their Wilson scores so future
      // city drafts use better seeds instead.
      await emitSeedBankSignals(metrics.googleCampaignId, "LOSS").catch(() => undefined);
    }
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "PAUSE_REFLECT",
      action: "Propose PAUSE — all remediation rungs exhausted",
      reasoning,
      suggestionCreated: created,
    };
  }

  // ── RUNG 3: TRIM BUDGET ──────────────────────────────────────────────────
  if (
    ageDays >= 28 &&
    roas < 0.8 &&
    spend >= 30 &&
    appliedRungs.has("TIGHTEN") &&
    appliedRungs.has("OPTIMISE") &&
    !appliedRungs.has("TRIM_BUDGET")
  ) {
    const action = "DECREASE_BUDGET";
    const newBudget = Math.max(5, Math.round(dailyBudgetGbp * 0.75 * 100) / 100);
    const reasoning = await buildLLMReasoning(metrics, "TRIM_BUDGET", `Reduce daily budget from £${dailyBudgetGbp} to £${newBudget} (−25%) to limit losses while optimisation continues`);
    const created = await createLadderSuggestion({
      draftId: metrics.draftId,
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      type: action,
      evidence: {
        ageDays,
        roas,
        spend,
        conversions: metrics.conversions,
        rungs_applied: Array.from(appliedRungs),
      },
      suggestedValue: { newDailyBudget: newBudget },
      currentValue: { dailyBudget: dailyBudgetGbp },
      reasoning,
      confidence: 0.80,
    });
    if (created) await markRungApplied(metrics.googleCampaignId, "TRIM_BUDGET");
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "TRIM_BUDGET",
      action: `Trim budget £${dailyBudgetGbp} → £${newBudget}/day (−25%)`,
      reasoning,
      suggestionCreated: created,
    };
  }

  // ── RUNG 2: OPTIMISE ─────────────────────────────────────────────────────
  if (
    ageDays >= 21 &&
    roas >= 1.0 &&
    roas < 2.0 &&
    appliedRungs.has("TIGHTEN") &&
    !appliedRungs.has("OPTIMISE")
  ) {
    const action = "LOWER_BID";
    const reasoning = await buildLLMReasoning(metrics, "OPTIMISE", "Propose bid refinement by device and time-of-day based on conversion patterns");
    const created = await createLadderSuggestion({
      draftId: metrics.draftId,
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      type: action,
      evidence: {
        ageDays,
        roas,
        spend,
        clicks: metrics.clicks,
        conversions: metrics.conversions,
        cpc: metrics.cpc,
      },
      suggestedValue: {
        action: "bid_refinement",
        note: "Review device and hour-of-day bid adjustments in Google Ads UI. Reduce mobile bids by 20% if mobile conversions < 20% of total.",
      },
      reasoning,
      confidence: 0.70,
    });
    if (created) await markRungApplied(metrics.googleCampaignId, "OPTIMISE");
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "OPTIMISE",
      action: "Propose bid refinement (device/hour-of-day)",
      reasoning,
      suggestionCreated: created,
    };
  }

  // ── RUNG 1: TIGHTEN ──────────────────────────────────────────────────────
  if (
    ageDays >= 14 &&
    roas < 1.0 &&
    impressions >= MIN_IMPRESSIONS_FOR_GATE &&
    !appliedRungs.has("TIGHTEN")
  ) {
    const action = "ADD_NEGATIVE_KEYWORD";
    const reasoning = await buildLLMReasoning(metrics, "TIGHTEN", "Add negative keywords to filter out non-converting searches and tighten geo targeting to verified coverage areas");
    const created = await createLadderSuggestion({
      draftId: metrics.draftId,
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      type: action,
      evidence: {
        ageDays,
        roas,
        spend,
        impressions,
        clicks: metrics.clicks,
        conversions: metrics.conversions,
        trigger: "ROAS < 1.0 after 14 days — ladder rung 1",
      },
      suggestedValue: {
        action: "tighten_and_negate",
        note: "Run getGoogleAdsSearchTerms and add zero-conversion terms (5+ clicks, 0 conv) as negatives. Re-run syncGoogleAdsGeoTargets to ensure geo matches current verified locksmith coverage.",
      },
      reasoning,
      confidence: 0.75,
    });
    if (created) await markRungApplied(metrics.googleCampaignId, "TIGHTEN");
    return {
      googleCampaignId: metrics.googleCampaignId,
      campaignName: metrics.campaignName,
      rung: "TIGHTEN",
      action: "Add negatives + tighten geo",
      reasoning,
      suggestionCreated: created,
    };
  }

  // ── No gate fired ────────────────────────────────────────────────────────
  return {
    googleCampaignId: metrics.googleCampaignId,
    campaignName: metrics.campaignName,
    rung: "OBSERVE",
    action: "Within acceptable range — monitoring",
    reasoning: `ROAS ${roas.toFixed(2)}x, age ${ageDays}d, ${impressions.toLocaleString()} impressions. No ladder gate triggered this cycle.`,
    suggestionCreated: false,
  };
}

// ─── Seed bank signal emitter ─────────────────────────────────────────────────

/**
 * Read the active keywords for a Google Ads campaign (from the campaign's
 * draft record) and emit WIN or LOSS signals to the keyword seed bank.
 *
 * This closes the compound learning loop:
 *   SCALE (ROAS ≥ 2.5) → WIN  → seeds from this city rise in Wilson score
 *   PAUSE (ROAS < 0.5) → LOSS → seeds from this city fall in Wilson score
 *
 * We only signal the top-5 EXACT/PHRASE keywords (the most intentional ones).
 * BROAD match keywords are too noisy to signal accurately.
 */
async function emitSeedBankSignals(
  googleCampaignId: string,
  outcome: "WIN" | "LOSS",
): Promise<void> {
  // Find the draft that corresponds to this Google campaign ID
  const draft = await prisma.googleAdsCampaignDraft.findFirst({
    where: { googleCampaignId, status: "PUBLISHED" },
    select: { keywords: true },
  });
  if (!draft?.keywords) return;

  // Extract keyword texts from the stored JSON array
  type KwRecord = { text?: string; matchType?: string };
  const keywords = (draft.keywords as KwRecord[])
    .filter((k) => k?.text && (k.matchType === "EXACT" || k.matchType === "PHRASE"))
    .slice(0, 5)
    .map((k) => k.text as string);

  if (keywords.length === 0) return;

  await Promise.allSettled(
    keywords.map((kw) => applyReflection({ keyword: kw, outcome })),
  );

  console.log(
    `[CampaignLadder] Seed bank ${outcome} signals emitted for ${keywords.length} keywords ` +
    `(campaign ${googleCampaignId})`,
  );
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run the ROAS ladder across all PUBLISHED Google Ads campaigns.
 * Called by the google-ads-suggestions cron after runFullSuggestionCycle().
 */
export async function runCampaignLadder(): Promise<LadderRunResult> {
  const errors: string[] = [];
  const decisions: LadderDecision[] = [];
  let suggestionsCreated = 0;

  // Pull all published campaigns
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status: "PUBLISHED",
      googleCampaignId: { not: null },
    },
    select: {
      id: true,
      googleCampaignId: true,
      name: true,
      dailyBudget: true,
    },
  });

  if (drafts.length === 0) {
    return { campaignsEvaluated: 0, decisions: [], suggestionsCreated: 0, errors: [] };
  }

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  for (const draft of drafts) {
    if (!draft.googleCampaignId) continue;
    const typedDraft = draft as { id: string; googleCampaignId: string; name: string; dailyBudget: number };
    try {
      const metrics = await aggregateCampaignMetrics(typedDraft, since);
      if (!metrics) {
        decisions.push({
          googleCampaignId: typedDraft.googleCampaignId,
          campaignName: typedDraft.name,
          rung: "OBSERVE",
          action: "No performance data yet",
          reasoning: "No AdPerformanceSnapshot rows found in the lookback window.",
          suggestionCreated: false,
        });
        continue;
      }

      const appliedRungs = await getCampaignLadderState(typedDraft.googleCampaignId);
      const decision = await evaluateCampaign(metrics, appliedRungs);
      decisions.push(decision);
      if (decision.suggestionCreated) suggestionsCreated++;
    } catch (err) {
      const msg = `Campaign ${typedDraft.googleCampaignId} (${typedDraft.name}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error("[CampaignLadder]", msg);
    }
  }

  console.log(
    `[CampaignLadder] Evaluated ${drafts.length} campaigns. ` +
    `${suggestionsCreated} suggestions created. ` +
    `${errors.length} errors.`,
  );

  return {
    campaignsEvaluated: drafts.length,
    decisions,
    suggestionsCreated,
    errors,
  };
}
