/**
 * Opportunity Scout Subagent.
 *
 * Reports to CMO. Weekly cron-driven discovery loop:
 *
 *   1. Build the coverage universe (cities where eligible locksmiths can fulfil)
 *      via {@link getCoverageUniverse}.
 *   2. Pull historical learnings (top-converting keywords) for the connected
 *      Google Ads account.
 *   3. Build a seed keyword list: 8 baseline seeds + the top ~10 proven
 *      converters (Option B per the plan).
 *   4. Call Google Keyword Planner per geo via {@link scoreOpportunities}.
 *   5. Persist results as `GoogleAdsOpportunity` rows (kind = "COVERAGE").
 *   6. Phase 9 — repeat scoring against the *uncovered* cities (kind =
 *      "RECRUIT") so sales can see where to onboard next.
 *   7. Optional auto-draft (Option C): for the top N opportunities whose
 *      best-rated covering locksmith has totalJobs >= 5, automatically call
 *      {@link generateDraftPlanForLocksmith} and persist as PENDING_APPROVAL.
 *
 * The Agent row exists primarily for visibility/budget tracking in admin UI.
 * The heartbeat itself is deterministic (not LLM-driven) — Google Keyword
 * Planner is the source of truth for CPC/competition data.
 */

import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AgentConfig } from "@/agents/core/types";

import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import { getCoverageUniverse, type CoverageUniverseEntry } from "@/lib/google-ads-geo-universe";
import { extractDefaultAccountLearnings } from "@/lib/google-ads-learnings";
import { scoreOpportunities, type GeoOpportunity } from "@/lib/google-ads-opportunities";
import { generateDraftPlanForLocksmith } from "@/lib/google-ads-onboarding";
import { UK_GEO_IDS, type UKGeoKey } from "@/lib/google-ads-locations";
import {
  getTopSeeds,
  addSeed,
  markSeedsUsed,
  FALLBACK_BASELINE_SEEDS,
} from "@/agents/core/seed-bank";

// =========================================================================
// Agent config
// =========================================================================

export const OPPORTUNITY_SCOUT_AGENT_CONFIG: AgentConfig = {
  name: "opportunity-scout",
  displayName: "Opportunity Scout",
  role: "Geo Opportunity Scout — weekly Google Keyword Planner scan; finds cheaper / less competitive UK cities to spin up Search campaigns and flags where to recruit next.",
  skillsPath: "cmo/subagents/opportunity-scout/SKILL.md",
  monthlyBudgetUsd: 5, // small — does not call paid LLMs in the default path
  heartbeatCronExpr: "0 4 * * 1", // Monday 04:00 UTC
  permissions: ["opportunity-scout", "ads-specialist"],
  governanceLevel: "supervised",
};

async function getCMOAgentId(): Promise<string | undefined> {
  const cmo = await prisma.agent.findUnique({ where: { name: "cmo" } });
  return cmo?.id;
}

export async function initializeOpportunityScoutAgent(): Promise<void> {
  const parentAgentId = await getCMOAgentId();
  const existing = await prisma.agent.findUnique({
    where: { name: OPPORTUNITY_SCOUT_AGENT_CONFIG.name },
  });
  if (existing) {
    await prisma.agent.update({
      where: { name: OPPORTUNITY_SCOUT_AGENT_CONFIG.name },
      data: {
        displayName: OPPORTUNITY_SCOUT_AGENT_CONFIG.displayName,
        role: OPPORTUNITY_SCOUT_AGENT_CONFIG.role,
        skillsPath: OPPORTUNITY_SCOUT_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: OPPORTUNITY_SCOUT_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: OPPORTUNITY_SCOUT_AGENT_CONFIG.heartbeatCronExpr,
        permissions: OPPORTUNITY_SCOUT_AGENT_CONFIG.permissions,
        governanceLevel: OPPORTUNITY_SCOUT_AGENT_CONFIG.governanceLevel,
        parentAgentId,
      },
    });
    return;
  }
  await prisma.agent.create({
    data: {
      name: OPPORTUNITY_SCOUT_AGENT_CONFIG.name,
      displayName: OPPORTUNITY_SCOUT_AGENT_CONFIG.displayName,
      role: OPPORTUNITY_SCOUT_AGENT_CONFIG.role,
      skillsPath: OPPORTUNITY_SCOUT_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: OPPORTUNITY_SCOUT_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: OPPORTUNITY_SCOUT_AGENT_CONFIG.heartbeatCronExpr,
      permissions: OPPORTUNITY_SCOUT_AGENT_CONFIG.permissions,
      governanceLevel: OPPORTUNITY_SCOUT_AGENT_CONFIG.governanceLevel,
      parentAgentId,
      heartbeatEnabled: true,
      status: "active",
    },
  });
}

// =========================================================================
// Heartbeat
// =========================================================================

// Static fallback — only used if the KeywordSeed bank is empty AND the
// seed-bank module's own fallback fails (defence-in-depth). Real seeds live in
// the `KeywordSeed` collection and are reshuffled by reflection outcomes.
const BASELINE_SEEDS = FALLBACK_BASELINE_SEEDS;

export interface OpportunityScoutOptions {
  /** Skip the recruit-here scan (Phase 9). Default false. */
  skipRecruit?: boolean;
  /** Skip auto-draft (Option C). Default false. */
  skipAutoDraft?: boolean;
  /** Cap coverage geos scored per run. Default 25 (covers most realistic UKs). */
  maxCoverageGeos?: number;
  /** Cap recruit geos scored per run. Default 15. */
  maxRecruitGeos?: number;
  /** Auto-draft only when a locksmith has at least this many jobs. Default 5. */
  minLocksmithJobsForAutoDraft?: number;
  /** Auto-draft the top N covered opportunities per run. Default 3. */
  autoDraftTopN?: number;
  /** Daily budget (GBP) for auto-drafted campaigns. Default £5. */
  autoDraftDailyBudget?: number;
}

export interface OpportunityScoutResult {
  startedAt: string;
  finishedAt: string;
  coverageScored: number;
  recruitScored: number;
  autoDraftsCreated: number;
  failures: string[];
  topOpportunities: Array<{
    label: string;
    score: number;
    medianCpcGbp: number;
    competitionTier: string;
    locksmithCount: number;
  }>;
  topRecruitTargets: Array<{
    label: string;
    score: number;
    medianCpcGbp: number;
    competitionTier: string;
  }>;
}

export async function runOpportunityScoutHeartbeat(
  opts: OpportunityScoutOptions = {},
): Promise<OpportunityScoutResult> {
  const startedAt = new Date().toISOString();
  const failures: string[] = [];
  let autoDraftsCreated = 0;

  // Find the active Google Ads account.
  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { lastSyncAt: "desc" },
  });
  if (!account) {
    failures.push("no-active-google-ads-account");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      coverageScored: 0,
      recruitScored: 0,
      autoDraftsCreated: 0,
      failures,
      topOpportunities: [],
      topRecruitTargets: [],
    };
  }

  const defaultClient = await getDefaultGoogleAdsClient();
  if (!defaultClient) {
    failures.push("could-not-build-default-client");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      coverageScored: 0,
      recruitScored: 0,
      autoDraftsCreated: 0,
      failures,
      topOpportunities: [],
      topRecruitTargets: [],
    };
  }
  const { client } = defaultClient;

  // 1. Universe
  const universe = await getCoverageUniverse();

  // 2 + 3. Build seed list — adaptive KeywordSeed bank (ranked by win/loss
  // score) merged with the top-converting historical keywords for this
  // account. Falls back to BASELINE_SEEDS if the bank is empty.
  const learnings = await extractDefaultAccountLearnings({ windowDays: 90 }).catch(
    () => null,
  );
  const provenSeeds = (learnings?.topConvertingKeywords ?? [])
    .slice(0, 10)
    .map((k) => k.text)
    .filter((t) => t && t.length < 40);
  const bankSeeds = await getTopSeeds({ limit: 12 }).catch(() => BASELINE_SEEDS);
  const seedKeywords = dedupe([...bankSeeds, ...provenSeeds]).slice(0, 20);

  // Mark these seeds as used (drives the usageCount/lastUsedAt counters).
  markSeedsUsed(seedKeywords).catch(() => undefined);

  // 4. Score coverage universe
  const coverageResult = await scoreOpportunities(client, universe.entries, {
    seedKeywords,
    maxGeos: opts.maxCoverageGeos ?? 25,
    perGeoDelayMs: 250,
    onGeoFailed: (_id, label, err) =>
      failures.push(`coverage:${label}:${err.message.slice(0, 80)}`),
  });

  // 5. Persist coverage opportunities
  await persistOpportunities("COVERAGE", coverageResult.opportunities);

  // 5b. Discover new seeds — every keyword that surfaced in a top opportunity
  // gets pushed into the seed bank as `category="learned"`. Idempotent.
  for (const opp of coverageResult.opportunities.slice(0, 10)) {
    for (const kw of (opp.topKeywords ?? []).slice(0, 5)) {
      if (!kw?.text) continue;
      await addSeed(kw.text, {
        category: "learned",
        source: `opportunity-scout:${opp.geoId}`,
      }).catch(() => undefined);
    }
  }

  // 6. Recruit-here scan (Phase 9)
  let recruitResult: { opportunities: GeoOpportunity[] } = { opportunities: [] };
  if (!opts.skipRecruit && universe.uncoveredCityKeys.length > 0) {
    const synthetic = universe.uncoveredCityKeys
      .slice(0, opts.maxRecruitGeos ?? 15)
      .map<CoverageUniverseEntry>((cityKey) => ({
        geoId: UK_GEO_IDS[cityKey as UKGeoKey],
        cityKey: cityKey as UKGeoKey,
        label: titleCase(cityKey),
        locksmithCount: 0,
        homeLocksmithCount: 0,
        locksmithIds: [],
        totalJobs: 0,
        avgRating: 0,
      }));
    recruitResult = await scoreOpportunities(client, synthetic, {
      seedKeywords,
      maxGeos: opts.maxRecruitGeos ?? 15,
      perGeoDelayMs: 250,
      onGeoFailed: (_id, label, err) =>
        failures.push(`recruit:${label}:${err.message.slice(0, 80)}`),
    });
    await persistOpportunities("RECRUIT", recruitResult.opportunities);
  }

  // 7. Auto-draft top-N covered opportunities
  if (!opts.skipAutoDraft) {
    const autoDraftN = opts.autoDraftTopN ?? 3;
    const minJobs = opts.minLocksmithJobsForAutoDraft ?? 5;
    const dailyBudget = opts.autoDraftDailyBudget ?? 5;
    const topCovered = coverageResult.opportunities.slice(0, autoDraftN);

    for (const opp of topCovered) {
      try {
        const created = await maybeAutoDraft({
          opportunity: opp,
          accountId: account.id,
          minLocksmithJobs: minJobs,
          dailyBudget,
          learnings,
        });
        if (created) autoDraftsCreated += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`autodraft:${opp.label}:${msg.slice(0, 100)}`);
      }
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    coverageScored: coverageResult.opportunities.length,
    recruitScored: recruitResult.opportunities.length,
    autoDraftsCreated,
    failures,
    topOpportunities: coverageResult.opportunities.slice(0, 5).map((o) => ({
      label: o.label,
      score: o.score,
      medianCpcGbp: o.medianCpcGbp,
      competitionTier: o.competitionTier,
      locksmithCount: o.locksmithCount,
    })),
    topRecruitTargets: recruitResult.opportunities.slice(0, 5).map((o) => ({
      label: o.label,
      score: o.score,
      medianCpcGbp: o.medianCpcGbp,
      competitionTier: o.competitionTier,
    })),
  };
}

// =========================================================================
// Helpers
// =========================================================================

async function persistOpportunities(
  kind: "COVERAGE" | "RECRUIT",
  opportunities: GeoOpportunity[],
): Promise<void> {
  if (!opportunities.length) return;
  // One row per (kind, geoTargetId, computedAt). We keep prior rows for trend
  // analysis; status NEW so the admin can act on the fresh batch.
  const now = new Date();
  for (const o of opportunities) {
    await prisma.googleAdsOpportunity.create({
      data: {
        kind,
        geoTargetId: o.geoId,
        geoLabel: o.label,
        computedAt: now,
        score: o.score,
        medianCpcGbp: o.medianCpcGbp,
        medianCompetitionIndex: o.medianCompetitionIndex,
        competitionTier: o.competitionTier,
        totalMonthlySearches: o.totalMonthlySearches,
        topKeywords: o.topKeywords as unknown as Prisma.InputJsonValue,
        locksmithCount: o.locksmithCount,
        locksmithIds: o.locksmithIds,
        supplyRatio: o.supplyRatio,
        status: "NEW",
      },
    });
  }
}

async function maybeAutoDraft(args: {
  opportunity: GeoOpportunity;
  accountId: string;
  minLocksmithJobs: number;
  dailyBudget: number;
  // biome-ignore lint/suspicious/noExplicitAny: learnings shape is verbose
  learnings: any;
}): Promise<boolean> {
  const { opportunity, accountId, minLocksmithJobs, dailyBudget, learnings } = args;
  if (opportunity.locksmithIds.length === 0) return false;

  // Skip if a NEW/PENDING_APPROVAL/PUBLISHED draft already targets this geo.
  const existing = await prisma.googleAdsCampaignDraft.findFirst({
    where: {
      accountId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHING", "PUBLISHED"] },
      geoTargets: { has: opportunity.geoId },
    },
    select: { id: true },
  });
  if (existing) return false;

  // Pick the best-reputation locksmith with >= minJobs.
  const candidates = await prisma.locksmith.findMany({
    where: {
      id: { in: opportunity.locksmithIds },
      isActive: true,
      isVerified: true,
      onboardingCompleted: true,
      stripeConnectVerified: true,
      totalJobs: { gte: minLocksmithJobs },
    },
    orderBy: [{ rating: "desc" }, { totalJobs: "desc" }],
    take: 1,
  });
  const picked = candidates[0];
  if (!picked) return false;

  const plan = await generateDraftPlanForLocksmith(picked, {
    learnings,
    dailyBudget,
  });

  const scoutAgent = await prisma.agent.findUnique({
    where: { name: "opportunity-scout" },
    select: { id: true },
  });

  const created = await prisma.googleAdsCampaignDraft.create({
    data: {
      accountId,
      name: `${plan.plan.campaignName} · scout:${opportunity.label}`,
      status: "PENDING_APPROVAL",
      dailyBudget: plan.plan.recommendedDailyBudget,
      biddingStrategy: "MANUAL_CPC",
      channel: "SEARCH",
      // Override the locksmith's home geo with the OPPORTUNITY geo we want to test.
      geoTargets: [opportunity.geoId],
      languageTargets: ["1000"],
      headlines: plan.plan.headlines,
      descriptions: plan.plan.descriptions,
      finalUrl: plan.plan.finalUrl,
      keywords: plan.plan.keywords as unknown as object[],
      negativeKeywords: plan.plan.negativeKeywords,
      aiGenerated: true,
      aiPrompt: `opportunity-scout:${opportunity.geoId}:${picked.id}`,
      aiReasoning: `Opportunity Scout auto-draft for ${opportunity.label}. Score ${opportunity.score}, median CPC £${opportunity.medianCpcGbp}, ${opportunity.competitionTier} competition. Anchor locksmith: ${picked.companyName ?? picked.name} (${picked.totalJobs} jobs, ${(picked.rating ?? 0).toFixed(1)}★). ${plan.plan.reasoning}`,
      agentId: scoutAgent?.id,
      createdBy: "ai",
    },
  });

  // Link the opportunity to the draft.
  await prisma.googleAdsOpportunity.updateMany({
    where: {
      geoTargetId: opportunity.geoId,
      kind: "COVERAGE",
      status: "NEW",
    },
    data: { status: "DRAFTED", draftId: created.id },
  });

  // Emit an AgentDecision row so the reflection cron has a typed audit trail.
  await prisma.agentDecision
    .create({
      data: {
        agent: "opportunity-scout",
        platform: "google",
        action: "draft-coverage-opportunity",
        payload: {
          opportunityGeoId: opportunity.geoId,
          opportunityLabel: opportunity.label,
          predictedScore: opportunity.score,
          medianCpcGbp: opportunity.medianCpcGbp,
          competitionTier: opportunity.competitionTier,
          locksmithId: picked.id,
          locksmithJobs: picked.totalJobs,
          locksmithRating: picked.rating,
          seedKeywords: (opportunity.topKeywords ?? [])
            .slice(0, 5)
            .map((k) => k.text),
          draftId: created.id,
          reasoning: plan.plan.reasoning,
        },
        policySnapshot: {
          minLocksmithJobs,
          dailyBudget,
        },
        dryRun: false,
        outcome: "ok",
        executedAt: new Date(),
      },
    })
    .catch((err) => {
      console.warn("[opportunity-scout] failed to emit AgentDecision", err);
    });

  return true;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
