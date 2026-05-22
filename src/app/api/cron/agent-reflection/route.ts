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
import prisma from "@/lib/db";
import {
  gradeOutcome,
  recordReflection,
  type ReflectionMetric,
} from "@/agents/core/reflection";
import { applyReflection as applySeedReflection } from "@/agents/core/seed-bank";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";
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

async function run(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const counters: Counters = { graded: 0, narrated: 0, skipped: 0, errors: 0 };

  try {
    await reflectOnDraftedOpportunities(counters);
    await reflectOnPublishedDrafts(counters);

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startTime,
      ...counters,
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
