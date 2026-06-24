/**
 * Cron: daily Agent Reflection sweep.
 *
 * Walks decisions made 7 / 14 / 28 days ago that don't yet have an
 * `AgentReflection`, grades each deterministically, and (for non-inconclusive
 * outcomes) asks the REASONING tier to write a narrative + lessons.
 *
 * First-pass subjects:
 *   - GoogleAdsOpportunity rows with status="DRAFTED" — measure whether the
 *     draft actually drove conversions / spend efficiency.
 *   - GoogleAdsCampaignDraft rows published 7+ days ago (no opportunity link).
 *
 * Cost guardrail: caps narrative LLM calls per run via REFLECTION_MAX_NARRATIVES
 * env (defaults 50). Inconclusive grades are still persisted but skip the LLM.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import {
  gradeOutcome,
  recordReflection,
  reflectOnAgentExecutions,
  type ReflectionMetric,
} from "@/agents/core/reflection";

// Every agent that runs the Hermes tool-loop — all of them now learn from their
// own tool success/failure history, not just the ads pipeline.
const EXECUTION_REFLECTION_AGENTS = ["ceo", "cmo", "coo", "cto", "copywriter", "ads-specialist"];
import { applyReflection as applySeedReflection } from "@/agents/core/seed-bank";

const MAX_NARRATIVES = Number(process.env.REFLECTION_MAX_NARRATIVES ?? 50);

interface TopKeyword {
  text: string;
  score?: number;
}

interface Counters {
  graded: number;
  narrated: number;
  skipped: number;
  errors: number;
}

async function reflectOnDraftedOpportunities(counters: Counters) {
  // Opportunities drafted 7+ days ago that don't have a reflection yet.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const opps = await prisma.googleAdsOpportunity.findMany({
    where: {
      status: "DRAFTED",
      draftId: { not: null },
      computedAt: { lte: cutoff },
    },
    orderBy: { computedAt: "asc" },
    take: 100,
  });

  for (const opp of opps) {
    // Skip if already reflected.
    const existing = await prisma.agentReflection.findFirst({
      where: { subjectType: "opportunity", subjectId: opp.id },
    });
    if (existing) {
      counters.skipped++;
      continue;
    }

    if (!opp.draftId) continue;
    const draft = await prisma.googleAdsCampaignDraft.findUnique({
      where: { id: opp.draftId },
    });
    if (!draft) {
      counters.skipped++;
      continue;
    }

    // The opportunity's predicted score is dimensionless. Grade on
    // spend-efficiency instead: conversions per £100 spent.
    // Expected baseline: 1.0 conversion per £100 (rough industry floor).
    const spend = draft.totalSpend ?? 0;
    const conversions = draft.totalConversions ?? 0;
    const actual = spend > 0 ? (conversions / spend) * 100 : null;
    const expected = 1.0;

    const graded = gradeOutcome({
      metric: "spend_efficiency",
      expected,
      actual,
      sampleSize: Math.round(spend), // £ spent as a rough sample-size proxy
      minSampleSize: 20, // need at least £20 spent to grade
    });

    const enableLLM =
      (graded.outcome === "WIN" || graded.outcome === "LOSS") &&
      counters.narrated < MAX_NARRATIVES;

    try {
      const topKeywords = (opp.topKeywords as unknown as TopKeyword[]) ?? [];
      const reflection = await recordReflection({
        agentName: "opportunity-scout",
        subjectType: "opportunity",
        subjectId: opp.id,
        subjectLabel: `${opp.geoLabel} (geo ${opp.geoTargetId})`,
        windowDays: 7,
        metric: "spend_efficiency" as ReflectionMetric,
        expectedValue: expected,
        actualValue: actual,
        graded,
        enableLLM,
        facts: {
          predictedScore: opp.score,
          medianCpcGbp: opp.medianCpcGbp,
          competitionTier: opp.competitionTier,
          totalMonthlySearches: opp.totalMonthlySearches,
          draftId: draft.id,
          draftName: draft.name,
          spend,
          conversions,
          totalCovering: opp.locksmithCount,
          topKeywords: topKeywords.slice(0, 5).map((k) => k.text),
        },
      });

      counters.graded++;
      if (reflection.narrative) counters.narrated++;

      // Propagate outcome into the seed bank — every top keyword used by this
      // opportunity gets credit (or blame).
      for (const kw of topKeywords.slice(0, 5)) {
        if (!kw?.text) continue;
        await applySeedReflection({ keyword: kw.text, outcome: graded.outcome });
      }
    } catch (err) {
      console.error("[reflection] failed for opportunity", opp.id, err);
      counters.errors++;
    }
  }
}

async function reflectOnPublishedDrafts(counters: Counters) {
  // Drafts published 7+ days ago that have no associated opportunity.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: cutoff, not: null },
    },
    orderBy: { publishedAt: "asc" },
    take: 50,
  });

  for (const draft of drafts) {
    const existing = await prisma.agentReflection.findFirst({
      where: { subjectType: "draft", subjectId: draft.id },
    });
    if (existing) {
      counters.skipped++;
      continue;
    }

    const spend = draft.totalSpend ?? 0;
    const conversions = draft.totalConversions ?? 0;
    const actual = spend > 0 ? (conversions / spend) * 100 : null;
    const expected = 1.0;

    const graded = gradeOutcome({
      metric: "spend_efficiency",
      expected,
      actual,
      sampleSize: Math.round(spend),
      minSampleSize: 20,
    });

    const enableLLM =
      (graded.outcome === "WIN" || graded.outcome === "LOSS") &&
      counters.narrated < MAX_NARRATIVES;

    try {
      const reflection = await recordReflection({
        agentName: "ads-specialist",
        subjectType: "draft",
        subjectId: draft.id,
        subjectLabel: draft.name,
        windowDays: 7,
        metric: "spend_efficiency",
        expectedValue: expected,
        actualValue: actual,
        graded,
        enableLLM,
        facts: {
          dailyBudget: draft.dailyBudget,
          biddingStrategy: draft.biddingStrategy,
          geoTargets: draft.geoTargets,
          spend,
          conversions,
          publishedAt: draft.publishedAt,
        },
      });

      counters.graded++;
      if (reflection.narrative) counters.narrated++;
    } catch (err) {
      console.error("[reflection] failed for draft", draft.id, err);
      counters.errors++;
    }
  }
}

/**
 * Sweep 3: CampaignSuggestion outcomes — 7 / 14 / 28 days post-approval.
 *
 * For every APPROVED suggestion that was actioned 7–35 days ago, we look at
 * the campaign's ROAS in the period AFTER approval and grade it WIN/LOSS/
 * INCONCLUSIVE.  The outcome is:
 *  1. Persisted as an AgentReflection row (subjectType="suggestion").
 *  2. Fed back to the seed bank so keywords that drove winning suggestions
 *     gain score and keywords that drove losing ones decay.
 *
 * "After approval" ROAS is computed from AdPerformanceSnapshot rows with
 * date > approvedAt.  We need at least 5 days of post-approval data; if
 * fewer exist the suggestion is skipped (INCONCLUSIVE later this week).
 */
async function reflectOnApprovedSuggestions(counters: Counters) {
  // Windows: 7, 14, 28 days post-approval. Max age 35d (avoids re-grading very old rows).
  const now = Date.now();
  const minAge = 7 * 24 * 60 * 60 * 1000;
  const maxAge = 35 * 24 * 60 * 60 * 1000;

  const suggestions = await prisma.campaignSuggestion.findMany({
    where: {
      status: "APPROVED",
      approvedAt: {
        gte: new Date(now - maxAge),
        lte: new Date(now - minAge),
      },
    },
    select: {
      id: true,
      type: true,
      campaignName: true,
      googleCampaignId: true,
      approvedAt: true,
      confidence: true,
    },
    orderBy: { approvedAt: "asc" },
    take: 100,
  });

  for (const sug of suggestions) {
    // Skip if already reflected at any window.
    const existing = await prisma.agentReflection.findFirst({
      where: { subjectType: "suggestion", subjectId: sug.id },
    });
    if (existing) {
      counters.skipped++;
      continue;
    }

    if (!sug.googleCampaignId || !sug.approvedAt) {
      counters.skipped++;
      continue;
    }

    // Pull post-approval snapshots for this campaign.
    const snapshots = await prisma.adPerformanceSnapshot.findMany({
      where: {
        platform: "google",
        googleCampaignId: sug.googleCampaignId,
        date: { gte: sug.approvedAt },
      },
      select: { spend: true, revenue: true, conversions: true },
    });

    const totalSpend = snapshots.reduce((a, s) => a + s.spend, 0);
    const totalRevenue = snapshots.reduce((a, s) => a + s.revenue, 0);
    const totalConversions = snapshots.reduce((a, s) => a + s.conversions, 0);
    const actualRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;

    // Need at least 5 days of data and £10 spend before grading.
    const graded = gradeOutcome({
      metric: "roas",
      expected: 2.0, // production target ROAS
      actual: actualRoas,
      sampleSize: Math.round(totalSpend),
      minSampleSize: 10,
    });

    const windowDays = Math.round((now - sug.approvedAt.getTime()) / 86_400_000);
    const enableLLM =
      (graded.outcome === "WIN" || graded.outcome === "LOSS") &&
      counters.narrated < MAX_NARRATIVES;

    try {
      await recordReflection({
        agentName: "ads-specialist",
        subjectType: "suggestion",
        subjectId: sug.id,
        subjectLabel: `${sug.type} — ${sug.campaignName}`,
        windowDays,
        metric: "roas" as ReflectionMetric,
        expectedValue: 2.0,
        actualValue: actualRoas,
        graded,
        enableLLM,
        facts: {
          suggestionType: sug.type,
          confidence: sug.confidence,
          approvedAt: sug.approvedAt,
          postApprovalDays: snapshots.length,
          spend: totalSpend,
          revenue: totalRevenue,
          conversions: totalConversions,
          roas: actualRoas,
        },
      });

      counters.graded++;
      if (enableLLM) counters.narrated++;

      // Propagate to seed bank: find the draft for this campaign, then the
      // opportunity that linked to it, and grade its top keywords.
      const draft = await prisma.googleAdsCampaignDraft.findFirst({
        where: { googleCampaignId: sug.googleCampaignId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      const opportunity = draft
        ? await prisma.googleAdsOpportunity.findFirst({
            where: { draftId: draft.id },
            orderBy: { computedAt: "desc" },
            select: { topKeywords: true, id: true },
          })
        : null;

      if (opportunity) {
        const topKws = (opportunity.topKeywords as unknown as Array<{ text: string }>) ?? [];
        for (const kw of topKws.slice(0, 5)) {
          if (!kw?.text) continue;
          await applySeedReflection({ keyword: kw.text, outcome: graded.outcome });
        }
      }
    } catch (err) {
      console.error("[reflection] failed for suggestion", sug.id, err);
      counters.errors++;
    }
  }
}

async function run(request: NextRequest) {
  const startTime = Date.now();
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const counters: Counters = { graded: 0, narrated: 0, skipped: 0, errors: 0 };

  try {
    await reflectOnDraftedOpportunities(counters);
    await reflectOnPublishedDrafts(counters);
    await reflectOnApprovedSuggestions(counters);

    // All-agent execution reflection — deterministic, no business metric needed.
    let executionLessons = 0;
    for (const agentName of EXECUTION_REFLECTION_AGENTS) {
      try {
        const r = await reflectOnAgentExecutions(agentName);
        executionLessons += r.lessonsWritten;
      } catch (err) {
        console.warn(`[Cron] execution reflection failed for ${agentName}`, err);
        counters.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startTime,
      ...counters,
      executionLessons,
      narrativeCap: MAX_NARRATIVES,
    });
  } catch (err) {
    console.error("[Cron] agent-reflection failed", err);
    return NextResponse.json(
      {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
        ...counters,
      },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
