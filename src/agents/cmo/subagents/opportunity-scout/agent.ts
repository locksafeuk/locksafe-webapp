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
import {
  scoreOpportunities,
  type GeoOpportunity,
  LONDON_GEO_IDS,
  reflectOnCampaignPerformance,
  applyBiasToScore,
} from "@/lib/google-ads-opportunities";
import { generateDraftPlanForLocksmith } from "@/lib/google-ads-onboarding";
import { UK_GEO_IDS, type UKGeoKey } from "@/lib/google-ads-locations";
import {
  getTopSeeds,
  addSeed,
  markSeedsUsed,
  FALLBACK_BASELINE_SEEDS,
} from "@/agents/core/seed-bank";
import { BASELINE_NEGATIVE_KEYWORDS } from "@/lib/google-ads-keywords";
import {
  getDualSourceCompetitorSeeds,
  getCompetitorGeoFactor,
} from "@/agents/cmo/subagents/competitor-intel/agent";
import {
  assertDraftGuardrails,
  PLAYBOOK_GUARDRAILS,
} from "@/lib/google-ads-draft-enforcement";
import { shouldCreateAutonomousDraft } from "@/lib/google-ads-draft-throttle";

// =========================================================================
// Known UK locksmith competitor domains
// (Pre-seeded list; auction insights will augment this at runtime)
// =========================================================================
const KNOWN_COMPETITOR_SITES = [
  "https://www.checkatrade.com/search/Locksmith",
  "https://www.rated.co.uk/tradespeople/locksmiths",
  "https://www.trustatrader.com/locksmiths",
  "https://www.locksmiths.co.uk",
  "https://www.lockforce.co.uk",
] as const;

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
  /** Cap coverage geos scored per run. Default 40. */
  maxCoverageGeos?: number;
  /** Cap recruit geos scored per run. Default 15. */
  maxRecruitGeos?: number;
  /** Auto-draft only when a locksmith has at least this many jobs. Default 5. */
  minLocksmithJobsForAutoDraft?: number;
  /** Auto-draft the top N covered opportunities per run. Default 5. */
  autoDraftTopN?: number;
  /**
   * Maximum median CPC (GBP) allowed for auto-draft. Defaults to 3.00 —
   * allows LOW and most MEDIUM competition cities. HIGH competition cities
   * (£4–8 CPC) must be drafted manually to avoid wasting budget.
   */
  maxAutoDraftCpcGbp?: number;
  /**
   * Skip auto-draft for HIGH competition geos. Default true.
   * MEDIUM and LOW competition cities are the cheap-city-first target.
   */
  skipHighCompetition?: boolean;
}

export interface OpportunityScoutResult {
  startedAt: string;
  finishedAt: string;
  coverageScored: number;
  recruitScored: number;
  autoDraftsCreated: number;
  failures: string[];
  /** Competitor domains discovered via Auction Insights (empty if no active campaigns). */
  competitorDomains: string[];
  /** True when the Keyword Planner returned 0 bids and fallback CPCs were used. */
  usingFallbackCpc: boolean;
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
      competitorDomains: [],
      usingFallbackCpc: false,
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
      competitorDomains: [],
      usingFallbackCpc: false,
      topOpportunities: [],
      topRecruitTargets: [],
    };
  }
  const { client } = defaultClient;

  // 0. Reflection — compare predicted vs actual CPC for each live campaign.
  //    Must run BEFORE scoring so the cpaBias adjustments feed into this run's scores.
  const reflectionResult = await reflectOnCampaignPerformance({ minDays: 14, lookback: 30 }).catch(
    (err) => {
      failures.push(`reflection:${err instanceof Error ? err.message : String(err)}`);
      return null;
    },
  );
  if (reflectionResult) {
    console.log(
      `[OpportunityScout] Reflection: ${reflectionResult.reflections.length} cities updated, ` +
      `${reflectionResult.skipped} skipped, ${reflectionResult.errors.length} errors.`,
    );
  }

  // 0.5 Auction Co-occurrence Discovery — pull Auction Insights from active
  //     campaigns. This shows which domains appeared in the SAME AUCTION SLOTS
  //     as us (overlap rate, position above rate, IS). It does NOT reveal their
  //     keywords, ad copy, bid strategy, landing page performance, or negatives.
  //     We use the discovered domains as inputs for the Keyword Planner site-seed
  //     API to surface keyword topics we might be missing — NOT as paid-search
  //     reverse-engineering. The resulting keywords go through profitability
  //     filtering before they can influence the seed bank.
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const insightRange = {
    since: thirtyDaysAgo.toISOString().slice(0, 10),
    until: today.toISOString().slice(0, 10),
  };
  const auctionInsights = await client.getAuctionInsights(insightRange).catch((err) => {
    failures.push(`auction-insights:${err instanceof Error ? err.message : String(err)}`);
    return [];
  });

  // Top competitor domains by overlap rate (excluding our own domain)
  const competitorDomains = auctionInsights
    .filter((i) => !i.domain.includes("locksafe"))
    .slice(0, 5)
    .map((i) => i.domain);

  // ── Competitor term sourcing (upgraded from site-seed proxy) ─────────────
  // V1 used generateKeywordIdeasFromSite() as a rough proxy — it extracts
  // keyword *topics* from competitor page content, not their actual paid keywords.
  //
  // V2 reads directly from the CompetitorKeyword table populated by the
  // competitor-intel agent (weekly SEMrush + SpyFu scan).
  //
  // Only DUAL-SOURCE keywords (confirmed by both SEMrush AND SpyFu) are used
  // as seeds here. These have already passed the quality gate in the
  // competitor-intel agent, so they're safe to use as Planner seeds.
  //
  // FALLBACK: if the competitor-intel agent has never run (table empty), we
  // retain the old Keyword Planner site-seed approach for the first run.
  const negativeSet = new Set(BASELINE_NEGATIVE_KEYWORDS.map((k: string) => k.toLowerCase()));
  let competitorTermsThisRun: string[] = [];

  try {
    const dbCompetitorSeeds = await getDualSourceCompetitorSeeds(20);
    if (dbCompetitorSeeds.length > 0) {
      competitorTermsThisRun = dbCompetitorSeeds;
      console.log(
        `[OpportunityScout] Using ${dbCompetitorSeeds.length} dual-source competitor seeds ` +
        `from competitor-intel DB (SEMrush + SpyFu confirmed).`,
      );
    } else {
      // Fallback: site-seed via Keyword Planner (first-run / DB empty)
      console.log(
        `[OpportunityScout] Competitor-intel DB empty — falling back to Keyword Planner site-seed.`,
      );
      const LONDON_GEO_ID = "1006450";
      const fallbackSites = [
        ...competitorDomains.map((d: string) => `https://${d}`),
        ...KNOWN_COMPETITOR_SITES,
      ].slice(0, 2);

      for (const siteUrl of fallbackSites) {
        try {
          const competitorIdeas = await client.generateKeywordIdeasFromSite({
            siteUrl,
            geoTargetIds: [LONDON_GEO_ID],
          });
          const locksmithTerms = competitorIdeas
            .filter((k) => {
              const text = k.text.toLowerCase();
              return (
                k.avgMonthlySearches >= 50 &&
                k.text.length < 50 &&
                /lock|locked|lockout|locksmith|upvc|deadlock|burglary|door/i.test(k.text) &&
                !negativeSet.has(text) &&
                !Array.from(negativeSet).some((neg) => text.includes(neg))
              );
            })
            .slice(0, 10);
          competitorTermsThisRun.push(...locksmithTerms.map((k) => k.text));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[OpportunityScout] Fallback site probe failed for ${siteUrl}: ${msg}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OpportunityScout] Competitor seed fetch failed: ${msg}`);
  }

  // 0.8 Pull impression share and hourly performance from live campaigns.
  //     These feed the profit scorer with real competitive gap data.
  const [geoImpressionShareMap, hourlyPerf] = await Promise.all([
    client.getCampaignImpressionShareByGeo(insightRange).catch(() => new Map<string, number>()),
    client.getHourlyPerformance(insightRange).catch(() => []),
  ]);

  // Detect after-hours gap: hours 20–06 where our IS is significantly lower
  // than peak hours. This signals competitors are day-parting aggressively —
  // meaning a 24/7 platform has a structural advantage in those windows.
  const peakHours = hourlyPerf.filter((h) => h.hour >= 9 && h.hour <= 18);
  const afterHours = hourlyPerf.filter((h) => h.hour >= 20 || h.hour <= 6);
  const peakAvgIS = peakHours.length
    ? peakHours.reduce((a, h) => a + h.searchImpressionShare, 0) / peakHours.length
    : 0;
  const afterHourAvgIS = afterHours.length
    ? afterHours.reduce((a, h) => a + h.searchImpressionShare, 0) / afterHours.length
    : 0;
  // If after-hours IS is >30% lower than peak-hours IS, flag this globally.
  // We apply the after-hours bonus to all covered geos since we operate 24/7.
  const globalAfterHoursGap = peakAvgIS > 0 && afterHourAvgIS < peakAvgIS * 0.70;

  // Build per-geo after-hours gap map (currently global — per-geo requires
  // geo-segmented hourly data which needs a more complex GAQL query).
  const geoAfterHoursGapMap = new Map<string, boolean>();
  if (globalAfterHoursGap) {
    // Apply to all geos where we have impression share data (active campaigns).
    for (const geoId of geoImpressionShareMap.keys()) {
      geoAfterHoursGapMap.set(geoId, true);
    }
  }

  // Build per-geo conv rate map from reflection results.
  // Only use geos where we have ≥50 clicks of data (enough to trust conv rate).
  const geoConvRateMap = new Map<string, number>();
  if (reflectionResult) {
    for (const r of reflectionResult.reflections) {
      if (r.actualConvRate !== null) {
        geoConvRateMap.set(r.geoTargetId, r.actualConvRate);
      }
    }
  }

  // 1. Universe
  const universe = await getCoverageUniverse();

  // 2 + 3. Build seed list.
  //
  // Seeds come from three sources, in order of trust:
  //   1. Bank seeds (baseline + learned + experimental categories).
  //      "learned" seeds are only added after they proved profitPerClick > 0 in
  //      a previous run — see the seed discovery loop below.
  //   2. Proven converters from live campaigns (actual conversions recorded).
  //      Highest trust. Keywords with clicks but zero conversions are excluded —
  //      those are typically broad-match junk, spam clicks, or irrelevant searches.
  //   3. Competitor terms from site-seed Planner call — temporary, this run only.
  //      These haven't been scored for profitability yet, so they are NOT written
  //      to the seed bank. They expand the Planner query but don't influence the
  //      long-term learning loop until they survive profitability scoring.
  const learnings = await extractDefaultAccountLearnings({ windowDays: 90 }).catch(
    () => null,
  );
  const provenSeeds = (learnings?.topConvertingKeywords ?? [])
    .filter((k) => k.conversions > 0)   // must have actual conversions
    .slice(0, 10)
    .map((k) => k.text)
    .filter((t) => t && t.length < 40);
  const bankSeeds = await getTopSeeds({
    limit: 15,
    includeCategories: ["baseline", "learned", "competitor", "experimental"],
  }).catch(() => BASELINE_SEEDS);
  // Combine: bank seeds first (most trusted), then proven converters, then
  // competitor-site terms (unverified, for query diversity only this run).
  const seedKeywords = dedupe([
    ...bankSeeds,
    ...provenSeeds,
    ...competitorTermsThisRun,
  ]).slice(0, 25);

  // Mark these seeds as used (drives the usageCount/lastUsedAt counters).
  markSeedsUsed(seedKeywords).catch(() => undefined);

  // 4. Score coverage universe — profit-potential model.
  // Passes real campaign data (conv rates, impression share, after-hours gaps)
  // so the scorer can override baseline priors with observed performance.
  const coverageResult = await scoreOpportunities(client, universe.entries, {
    seedKeywords,
    maxGeos: opts.maxCoverageGeos ?? 35,
    perGeoDelayMs: 250,
    geoConvRateMap,
    geoImpressionShareMap,
    geoAfterHoursGapMap,
    onGeoFailed: (_id, label, err) =>
      failures.push(`coverage:${label}:${err.message.slice(0, 80)}`),
  });

  // 4b. Apply competitor geo factors from CompetitorGeoSignal table.
  //     Geos where competitors are EXITING get a boost (reduced auction pressure).
  //     Geos where competitors are ENTERING get a caution reduction.
  //     This is non-blocking — if the competitor-intel DB has no data, factor=1.0.
  for (const opp of coverageResult.opportunities) {
    try {
      const { factor, entryCount, exitCount } = await getCompetitorGeoFactor(opp.geoId);
      if (factor !== 1.0) {
        opp.expectedMonthlyProfitGbp = opp.expectedMonthlyProfitGbp * factor;
        opp.score = opp.expectedMonthlyProfitGbp;
        if (exitCount > 0) {
          console.log(
            `[OpportunityScout] ${opp.label}: ${exitCount} competitor(s) exiting → +${((factor - 1) * 100).toFixed(0)}% boost`,
          );
        }
        if (entryCount > 0) {
          console.log(
            `[OpportunityScout] ${opp.label}: ${entryCount} competitor(s) entering → -${((1 - factor) * 100).toFixed(0)}% caution`,
          );
        }
      }
    } catch {
      // Non-fatal — competitor geo data is an enhancement, not required
    }
  }

  // 4c. Apply combined CPA + conv-rate bias from reflection data.
  //     cpaBias > 1 (expensive) decays score; convRateBias > 1 (better conv) boosts.
  //     A city that costs 2× more but converts 2× as well stays neutral.
  if (reflectionResult && reflectionResult.reflections.length > 0) {
    // Explicit tuple type — without it TS widens the .map() return to
    // (string | object)[][] and the Map becomes Map<unknown, unknown>, which
    // breaks the `bias.cpaBias` access below.
    const biasMap = new Map<string, { cpaBias: number; convRateBias: number | null }>(
      reflectionResult.reflections.map((r) => [
        r.geoTargetId,
        { cpaBias: r.cpaBias, convRateBias: r.convRateBias },
      ] as const),
    );
    for (const opp of coverageResult.opportunities) {
      const bias = biasMap.get(opp.geoId);
      if (bias) {
        opp.expectedMonthlyProfitGbp = applyBiasToScore(
          opp.expectedMonthlyProfitGbp,
          bias.cpaBias,
          bias.convRateBias,
        );
        opp.score = opp.expectedMonthlyProfitGbp; // keep in sync
      }
    }
    // Re-sort by adjusted profit score (competitor geo + bias adjustments applied).
    coverageResult.opportunities.sort((a, b) => b.expectedMonthlyProfitGbp - a.expectedMonthlyProfitGbp);
  }

  // 5. Persist coverage opportunities
  await persistOpportunities("COVERAGE", coverageResult.opportunities, competitorDomains);

  // 5b. Discover new seeds — ONLY from keywords that are in the top opportunities
  // AND have a positive profitPerClick (i.e., the keyword is actually profitable
  // at the estimated CPC). Do NOT add keywords with negative profit — those are
  // either too expensive at baseline or low-intent terms.
  // This prevents spam/junk searches from poisoning the seed bank.
  for (const opp of coverageResult.opportunities.slice(0, 10)) {
    for (const kw of (opp.topKeywords ?? []).slice(0, 5)) {
      if (!kw?.text) continue;
      // Guard: only add keywords where expected profit per click is positive.
      if (kw.profitPerClick !== undefined && kw.profitPerClick <= 0) continue;
      await addSeed(kw.text, {
        category: "learned",
        source: `opportunity-scout:${opp.geoId}`,
        notes: `profitPerClick £${kw.profitPerClick?.toFixed(2)} · ${kw.monthlySearches}/mo`,
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
    await persistOpportunities("RECRUIT", recruitResult.opportunities, competitorDomains);
  }

  // 7. Auto-draft top-N covered opportunities (cheap cities only)
  if (!opts.skipAutoDraft) {
    const autoDraftN = opts.autoDraftTopN ?? 5;
    const minJobs = opts.minLocksmithJobsForAutoDraft ?? 5;
    const maxCpc = opts.maxAutoDraftCpcGbp ?? 3.00;
    const skipHigh = opts.skipHighCompetition !== false; // default true
    const topCovered = coverageResult.opportunities.slice(0, autoDraftN);

    for (const opp of topCovered) {
      try {
        const created = await maybeAutoDraft({
          opportunity: opp,
          accountId: account.id,
          minLocksmithJobs: minJobs,
          maxAutoDraftCpcGbp: maxCpc,
          skipHighCompetition: skipHigh,
          learnings,
        });
        if (created) autoDraftsCreated += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`autodraft:${opp.label}:${msg.slice(0, 100)}`);
      }
    }
  }

  // Whether ALL keywords for this run used fallback CPCs (test token detection).
  const usingFallbackCpc = coverageResult.opportunities.length > 0 &&
    coverageResult.opportunities.every((o) => o.usingFallbackCpc);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    coverageScored: coverageResult.opportunities.length,
    recruitScored: recruitResult.opportunities.length,
    autoDraftsCreated,
    failures,
    competitorDomains,
    usingFallbackCpc,
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
  competitorDomains?: string[],
): Promise<void> {
  if (!opportunities.length) return;
  // One row per (kind, geoTargetId, computedAt). We keep prior rows for trend
  // analysis; status NEW so the admin can act on the fresh batch.
  const now = new Date();
  for (const o of opportunities) {
    // Carry forward any existing agentNotes (e.g. cpaBias from reflection)
    const existingOpp = await prisma.googleAdsOpportunity.findFirst({
      where: { geoTargetId: o.geoId, kind },
      orderBy: { computedAt: "desc" },
      select: { agentNotes: true },
    });
    let existingNotes: Record<string, unknown> = {};
    try {
      if (existingOpp?.agentNotes) existingNotes = JSON.parse(existingOpp.agentNotes);
    } catch { /* ok */ }

    const agentNotes = JSON.stringify({
      ...existingNotes,
      // CPC / fallback flags
      usingFallbackCpc: o.usingFallbackCpc ?? false,
      // Profit model outputs — displayed in Opportunity Scout UI
      expectedMonthlyProfitGbp: o.expectedMonthlyProfitGbp,
      estimatedConvRate: o.estimatedConvRate,
      estimatedCpaGbp: o.estimatedCpaGbp,
      emergencyIntentFraction: o.emergencyIntentFraction,
      // Operational confidence
      operationalEfficiencyFactor: o.operationalEfficiencyFactor ?? 1.0,
      modelConfidenceVerified: o.modelConfidenceVerified ?? false,
      // Competitive signals
      ourImpressionShare: o.ourImpressionShare ?? null,
      afterHoursGap: o.afterHoursGap ?? false,
      competitorDomains: competitorDomains ?? [],
      // Geo modifiers
      nearLondonPenalty: o.nearLondonPenalty ?? false,
      winterBoost: o.winterBoost ?? false,
      computedAt: now.toISOString(),
    });

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
        agentNotes,
        status: "NEW",
      },
    });
  }
}

async function maybeAutoDraft(args: {
  opportunity: GeoOpportunity;
  accountId: string;
  minLocksmithJobs: number;
  maxAutoDraftCpcGbp: number;
  skipHighCompetition: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: learnings shape is verbose
  learnings: any;
}): Promise<boolean> {
  const { opportunity, accountId, minLocksmithJobs, maxAutoDraftCpcGbp, skipHighCompetition, learnings } = args;
  if (opportunity.locksmithIds.length === 0) return false;

  // Throttle — global gate against agent over-creation. See decision 2026-06-03.
  const throttle = await shouldCreateAutonomousDraft({
    agentName: "opportunity-scout",
  });
  if (!throttle.allowed) {
    console.log(
      `[opportunity-scout] auto-draft skipped (${throttle.reason}): ${throttle.message}`,
    );
    return false;
  }

  // Hard-block London boroughs — the two existing UK-wide campaigns already
  // cover London via phrase-match; competing in London auctions burns budget.
  if (LONDON_GEO_IDS.has(opportunity.geoId)) return false;

  // Skip if median CPC is above the threshold (can't win at our £1.80 ceiling).
  if (opportunity.medianCpcGbp > maxAutoDraftCpcGbp) return false;

  // Skip HIGH competition geos — too many national chains, low win rate.
  if (skipHighCompetition && opportunity.competitionTier === "HIGH") return false;

  // Dynamic budget: target ~12 clicks/day at median CPC, clamped £3–£15.
  // This matches the production pattern (£15/day on the existing hardened campaigns).
  const dailyBudget = Math.max(3, Math.min(15, Math.round(12 / Math.max(0.5, opportunity.medianCpcGbp))));

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

  const enforced = assertDraftGuardrails({
    accountId,
    name: `${plan.plan.campaignName} · scout:${opportunity.label}`,
    status: "PENDING_APPROVAL",
    dailyBudget: plan.plan.recommendedDailyBudget,
    biddingStrategy: PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY,
    channel: "SEARCH",
    locationMatchType: "PRESENCE",
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
  });
  if (enforced.appliedFixes.length > 0) {
    console.warn(
      "[opportunity-scout] auto-draft auto-corrected by playbook guardrails",
      { opportunityGeo: opportunity.geoId, appliedFixes: enforced.appliedFixes },
    );
  }
  const created = await prisma.googleAdsCampaignDraft.create({
    data: enforced.data as Parameters<
      typeof prisma.googleAdsCampaignDraft.create
    >[0]["data"],
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
