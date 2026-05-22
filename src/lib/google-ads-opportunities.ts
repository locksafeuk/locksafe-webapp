/**
 * Opportunity Scorer.
 *
 * Given a coverage universe and a Google Ads client, calls the Keyword Planner
 * once per geo with our locksmith seed keywords, then computes per-geo
 * "opportunity scores" used to rank where it's cheapest and least competitive
 * for us to start running ads.
 *
 *   score(keyword) = avgMonthlySearches / max(1, cpcGbp * (competitionIndex/10))
 *   geoScore        = sum of top-5 keyword scores
 *
 * High-volume + low-CPC + low-competition geos rise to the top. London comes
 * back saturated; secondary cities (Bristol, Leeds, Wrexham, Hull, ...) bubble.
 *
 * Quota note: KeywordPlanIdeaService has a small daily cap. The scout calls
 * this weekly only, and we batch all seeds per geo into a single API call.
 */

import type { GoogleAdsClient, KeywordIdea } from "@/lib/google-ads";
import { microsToCurrency } from "@/lib/google-ads";
import type { CoverageUniverseEntry } from "@/lib/google-ads-geo-universe";

export type CompetitionTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface OpportunityKeyword {
  text: string;
  monthlySearches: number;
  competition: KeywordIdea["competition"];
  competitionIndex: number;
  /** Midpoint top-of-page bid in GBP. */
  cpcGbp: number;
  /** Opportunity score for this single keyword. */
  score: number;
}

export interface GeoOpportunity {
  geoId: string;
  cityKey: string;
  label: string;
  /** Aggregate score (sum of top-5 keyword scores). */
  score: number;
  /** Median CPC across returned ideas (GBP). */
  medianCpcGbp: number;
  /** Median competition index 0–100. */
  medianCompetitionIndex: number;
  /** Bucketed competition tier derived from medianCompetitionIndex. */
  competitionTier: CompetitionTier;
  /** Sum of avgMonthlySearches across returned ideas. */
  totalMonthlySearches: number;
  /** Top 10 keywords by per-keyword score. */
  topKeywords: OpportunityKeyword[];
  /** Number of eligible locksmiths who can fulfil leads from this geo. */
  locksmithCount: number;
  /** Locksmith IDs from the coverage cohort. */
  locksmithIds: string[];
  /** "Supply ratio" — locksmiths per 100 monthly searches. >1 = healthy fulfilment. */
  supplyRatio: number;
}

export interface ScoreOpportunitiesOptions {
  /** Seed keywords passed to the Planner. ≤20 (API limit). */
  seedKeywords: string[];
  /**
   * Sleep between Planner calls to be polite on quota (ms). Defaults to 250.
   * Set to 0 in tests.
   */
  perGeoDelayMs?: number;
  /** Max geos to call the Planner for. Cuts cost on huge universes. */
  maxGeos?: number;
  /** Optional callback when one geo finishes — used for cron progress logs. */
  onGeoScored?: (geo: GeoOpportunity) => void;
  /** Hook to record per-geo failures without aborting the whole batch. */
  onGeoFailed?: (geoId: string, label: string, error: Error) => void;
}

export interface ScoreOpportunitiesResult {
  opportunities: GeoOpportunity[];
  /** Geos that errored (logged but did not abort the run). */
  failures: Array<{ geoId: string; label: string; error: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function scoreOpportunities(
  client: GoogleAdsClient,
  universe: CoverageUniverseEntry[],
  opts: ScoreOpportunitiesOptions,
): Promise<ScoreOpportunitiesResult> {
  if (!opts.seedKeywords.length) {
    throw new Error("scoreOpportunities: seedKeywords required");
  }
  const seeds = opts.seedKeywords.slice(0, 20);
  const delay = opts.perGeoDelayMs ?? 250;
  const candidates = opts.maxGeos ? universe.slice(0, opts.maxGeos) : universe;

  const opportunities: GeoOpportunity[] = [];
  const failures: ScoreOpportunitiesResult["failures"] = [];

  for (const entry of candidates) {
    try {
      const ideas = await client.generateKeywordIdeas({
        geoTargetIds: [entry.geoId],
        keywordSeeds: seeds,
      });
      const scored = ideas
        .filter((i) => i.avgMonthlySearches > 0 && i.text)
        .map<OpportunityKeyword>((i) => {
          const cpcGbp =
            (microsToCurrency(i.lowTopOfPageBidMicros) +
              microsToCurrency(i.highTopOfPageBidMicros)) /
            2;
          const safeCpc = cpcGbp > 0 ? cpcGbp : 0.1; // £0.10 placeholder when planner returns 0
          const compDiv = Math.max(1, i.competitionIndex / 10); // 0..10
          const score = i.avgMonthlySearches / (safeCpc * compDiv);
          return {
            text: i.text,
            monthlySearches: i.avgMonthlySearches,
            competition: i.competition,
            competitionIndex: i.competitionIndex,
            cpcGbp: Number(safeCpc.toFixed(2)),
            score: Number(score.toFixed(2)),
          };
        })
        .sort((a, b) => b.score - a.score);

      const top10 = scored.slice(0, 10);
      const top5Score = top10
        .slice(0, 5)
        .reduce((acc, k) => acc + k.score, 0);
      const cpcs = scored.map((s) => s.cpcGbp).filter((v) => v > 0);
      const compIdx = scored.map((s) => s.competitionIndex).filter((v) => v > 0);
      const medianCpc = median(cpcs);
      const medianComp = median(compIdx);
      const totalSearches = scored.reduce((acc, s) => acc + s.monthlySearches, 0);

      const opportunity: GeoOpportunity = {
        geoId: entry.geoId,
        cityKey: entry.cityKey,
        label: entry.label,
        score: Number(top5Score.toFixed(2)),
        medianCpcGbp: Number(medianCpc.toFixed(2)),
        medianCompetitionIndex: Number(medianComp.toFixed(1)),
        competitionTier: classifyTier(medianComp),
        totalMonthlySearches: totalSearches,
        topKeywords: top10,
        locksmithCount: entry.locksmithCount,
        locksmithIds: entry.locksmithIds,
        supplyRatio:
          totalSearches > 0
            ? Number(
                ((entry.locksmithCount / (totalSearches / 100)) || 0).toFixed(2),
              )
            : entry.locksmithCount,
      };

      opportunities.push(opportunity);
      opts.onGeoScored?.(opportunity);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      failures.push({ geoId: entry.geoId, label: entry.label, error: e.message });
      opts.onGeoFailed?.(entry.geoId, entry.label, e);
    }
    if (delay > 0) await sleep(delay);
  }

  opportunities.sort((a, b) => b.score - a.score);
  return { opportunities, failures };
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyTier(competitionIndex: number): CompetitionTier {
  if (competitionIndex <= 0) return "UNKNOWN";
  if (competitionIndex < 34) return "LOW";
  if (competitionIndex < 67) return "MEDIUM";
  return "HIGH";
}

/**
 * Score the *uncovered* universe — geos with zero eligible locksmiths.
 * Reuses the same scorer but emits results into a separate bucket for the
 * "Recruit-Here" report (Phase 9). Callers pass the synthetic CoverageUniverse
 * entries built from `uncoveredCityKeys`.
 */
export async function scoreRecruitOpportunities(
  client: GoogleAdsClient,
  recruitUniverse: CoverageUniverseEntry[],
  opts: ScoreOpportunitiesOptions,
): Promise<ScoreOpportunitiesResult> {
  return scoreOpportunities(client, recruitUniverse, opts);
}
