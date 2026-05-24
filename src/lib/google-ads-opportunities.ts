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
import prisma from "@/lib/db";

// =========================================================================
// London geo IDs — excluded from auto-draft to avoid competing with
// national chains (Lockforce, Local Heroes, HomeServe) who dominate London
// auctions at £5–15/click. The two existing UK-wide campaigns already
// cover London via phrase-match on "emergency locksmith london" etc.
// Admins can still create London drafts manually.
// =========================================================================
// All 33 London boroughs + City of London. Must stay in sync with
// UK_GEO_IDS in google-ads-locations.ts. Last verified vs Google Ads
// GeoTargetConstant reference May 2026.
export const LONDON_GEO_IDS = new Set([
  "1006450", // London (city)
  "9041107", // Greater London

  // Inner North
  "1006453", // Westminster (City of Westminster)
  "1006459", // Camden
  "1006456", // Islington
  "9198373", // Hackney
  "9041110", // City of London

  // Inner East
  "9198785", // Tower Hamlets
  "9198858", // Newham
  "9198805", // Waltham Forest
  "9208638", // Redbridge
  "9046056", // Barking & Dagenham
  "9046054", // Havering

  // Inner South
  "1006465", // Southwark
  "1006466", // Lambeth
  "1006467", // Wandsworth
  "1006470", // Greenwich
  "1006471", // Lewisham

  // South West / West
  "1006468", // Kensington & Chelsea
  "1006469", // Hammersmith & Fulham
  "9046053", // Ealing
  "9046051", // Hillingdon
  "9046052", // Hounslow
  "9198371", // Richmond upon Thames
  "9046055", // Kingston upon Thames

  // South
  "1006472", // Croydon
  "9198370", // Merton
  "9198369", // Sutton
  "1006473", // Bromley
  "1006474", // Bexley

  // North
  "9046050", // Barnet
  "9198374", // Haringey
  "9198372", // Enfield
]);

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
  /**
   * True if this city is within ~38 miles of London and suffers from auction
   * bleed from national chain broad-match campaigns. Score is already penalised
   * by NEAR_LONDON_PENALTY; this flag lets the UI show a warning.
   */
  nearLondonPenalty?: boolean;
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
  /**
   * Exclude all London borough geo IDs from scoring (LONDON_GEO_IDS set).
   * Defaults to true — the two existing UK-wide campaigns already cover London.
   */
  excludeLondon?: boolean;
  /**
   * Skip geos whose computed medianCpcGbp exceeds this threshold.
   * Defaults to 1.80 (matching the production-hardened MANUAL_CPC max bid).
   * Set to Infinity to score all geos regardless of CPC.
   */
  maxMedianCpcGbp?: number;
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

// =========================================================================
// Near-London proximity penalty
//
// National chain broad-match campaigns targeting "South East" bleed into
// cities within ~30 miles of London, inflating actual CPCs 30–60% above
// what Google Keyword Planner shows. Penalise these geos so they don't
// rank above genuinely cheap northern cities.
// =========================================================================

// =========================================================================
// Near-London proximity penalty
//
// National chains running broad-match campaigns targeting "South East"
// bleed auction pressure into cities near London, inflating actual CPCs
// 30–60% above what Google Keyword Planner predicts.
//
// Pre-computed from UK_CITY_CENTROIDS haversine distances (≤ 35 miles from
// Central London 51.51, -0.13):
//   slough   21mi  guildford  27mi  crawley  26mi
//   maidstone 30mi reading    38mi  (reading borderline — included)
// =========================================================================

/** Score multiplier applied to near-London cities (0.7 = −30%). */
const NEAR_LONDON_PENALTY = 0.70;

/**
 * City keys that suffer from London auction bleed.
 * Based on haversine distances ≤ 38 miles from Central London.
 */
const NEAR_LONDON_CITY_KEYS = new Set([
  "slough",      // 21 miles
  "guildford",   // 27 miles
  "crawley",     // 26 miles
  "maidstone",   // 30 miles
  "reading",     // 38 miles — borderline but national chains frequently target "M4 corridor"
  "worthing",    // 45 miles — occasionally bleeds, include with lighter signal
  "eastbourne",  // 49 miles — not as bad but SE coastal belt
  "brighton",    // 47 miles — high tourism = high competition spillover
  "canterbury",  // 55 miles — less affected; excluded from penalty
]);

function isNearLondonCity(cityKey: string): boolean {
  return NEAR_LONDON_CITY_KEYS.has(cityKey.toLowerCase());
}

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
  const excludeLondon = opts.excludeLondon !== false; // default true
  const maxCpc = opts.maxMedianCpcGbp ?? 1.80;

  // Filter the universe before hitting the Planner API to save quota.
  let filtered = universe;
  if (excludeLondon) {
    filtered = filtered.filter((e) => !LONDON_GEO_IDS.has(e.geoId));
  }
  const candidates = opts.maxGeos ? filtered.slice(0, opts.maxGeos) : filtered;

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

      // Skip this geo if its median CPC exceeds the production max bid.
      // No point scoring a city where we can't compete at our £1.80 ceiling.
      if (medianCpc > maxCpc) {
        opts.onGeoFailed?.(
          entry.geoId,
          entry.label,
          new Error(`medianCpc £${medianCpc.toFixed(2)} > maxMedianCpcGbp £${maxCpc.toFixed(2)} — skipped`),
        );
        continue;
      }

      // Supply-fitness multiplier: reward cities with enough locksmiths to
      // fulfil demand. supplyRatio ≥ 0.5 → full score; lower → partial.
      const supplyRatio =
        totalSearches > 0
          ? Number(((entry.locksmithCount / (totalSearches / 100)) || 0).toFixed(2))
          : entry.locksmithCount;
      const supplyFactor = Math.min(1, supplyRatio > 0 ? supplyRatio / 0.5 : 0.5);
      const supplyAdjusted = top5Score * (0.5 + 0.5 * supplyFactor);

      // Near-London proximity penalty: national chains' broad-match campaigns
      // bleed into SE cities, making actual CPCs 30–60% higher than Planner shows.
      const nearLondon = isNearLondonCity(entry.cityKey);
      const adjustedScore = Number(
        (nearLondon ? supplyAdjusted * NEAR_LONDON_PENALTY : supplyAdjusted).toFixed(2),
      );

      const opportunity: GeoOpportunity = {
        geoId: entry.geoId,
        cityKey: entry.cityKey,
        label: entry.label,
        score: adjustedScore,
        medianCpcGbp: Number(medianCpc.toFixed(2)),
        medianCompetitionIndex: Number(medianComp.toFixed(1)),
        competitionTier: classifyTier(medianComp),
        totalMonthlySearches: totalSearches,
        topKeywords: top10,
        locksmithCount: entry.locksmithCount,
        nearLondonPenalty: nearLondon,
        locksmithIds: entry.locksmithIds,
        supplyRatio,
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

// =========================================================================
// Campaign Performance Reflection
//
// Compares what Google Keyword Planner predicted (medianCpcGbp stored on the
// GoogleAdsOpportunity row at draft time) with what Google Ads actually
// charged (average CPC from AdPerformanceSnapshot rows for that campaign).
//
// Output: cpaBias = actualCpc / predictedCpc
//   cpaBias > 1   → city more expensive than predicted (downgrade score)
//   cpaBias < 1   → city cheaper than predicted (upgrade score)
//   cpaBias ≈ 1   → prediction was accurate
//
// Stored in GoogleAdsOpportunity.agentNotes as a JSON blob so the next
// weekly scout run can read and apply it.
// =========================================================================

export interface CampaignReflectionResult {
  geoTargetId: string;
  geoLabel: string;
  predictedCpcGbp: number;
  actualCpcGbp: number;
  cpaBias: number;
  sampleDays: number;
  opportunityUpdated: boolean;
}

export interface ReflectOnCampaignPerformanceResult {
  reflections: CampaignReflectionResult[];
  skipped: number; // campaigns with < minDays data
  errors: string[];
}

/**
 * Run the city reflection step. Call this at the START of the weekly scout
 * heartbeat, BEFORE scoreOpportunities(), so the bias adjustments are baked
 * into the new scores.
 *
 * @param minDays  Min days a campaign must have run before we trust the data (default 14).
 * @param lookback How many days of snapshots to average (default 30).
 */
export async function reflectOnCampaignPerformance(
  opts: { minDays?: number; lookback?: number } = {},
): Promise<ReflectOnCampaignPerformanceResult> {
  const minDays = opts.minDays ?? 14;
  const lookback = opts.lookback ?? 30;
  const errors: string[] = [];
  let skipped = 0;
  const reflections: CampaignReflectionResult[] = [];

  // Only look at PUBLISHED campaigns that have a googleCampaignId.
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status: "PUBLISHED",
      googleCampaignId: { not: null },
    },
    select: {
      id: true,
      googleCampaignId: true,
      name: true,
      geoTargets: true, // string[] of geo IDs
    },
  });

  if (drafts.length === 0) return { reflections, skipped, errors };

  const since = new Date();
  since.setDate(since.getDate() - lookback);

  for (const draft of drafts) {
    if (!draft.googleCampaignId) continue;
    try {
      // Pull actuals from AdPerformanceSnapshot
      const snapshots = await prisma.adPerformanceSnapshot.findMany({
        where: {
          platform: "google",
          googleCampaignId: draft.googleCampaignId,
          date: { gte: since },
        },
        select: { date: true, spend: true, clicks: true },
        orderBy: { date: "asc" },
      });

      if (snapshots.length < minDays) {
        skipped++;
        continue; // not enough data yet
      }

      const totalSpend = snapshots.reduce((a, s) => a + s.spend, 0);
      const totalClicks = snapshots.reduce((a, s) => a + s.clicks, 0);
      if (totalClicks < 10) {
        skipped++; // too few clicks for meaningful average
        continue;
      }

      const actualCpcGbp = Number((totalSpend / totalClicks).toFixed(3));

      // Match to a GoogleAdsOpportunity row for this campaign's primary geo.
      // A campaign can target multiple geos; we update the one that most closely
      // matches (the first geoTarget that has an opportunity row).
      const geoTargets = Array.isArray(draft.geoTargets) ? draft.geoTargets : [];
      let updated = false;

      for (const geoId of geoTargets) {
        // Find the most recent COVERAGE opportunity for this geo
        const opp = await prisma.googleAdsOpportunity.findFirst({
          where: { geoTargetId: geoId, kind: "COVERAGE" },
          orderBy: { computedAt: "desc" },
          select: { id: true, medianCpcGbp: true, geoLabel: true, agentNotes: true },
        });

        if (!opp || opp.medianCpcGbp <= 0) continue;

        const cpaBias = Number((actualCpcGbp / opp.medianCpcGbp).toFixed(3));
        const sampledAt = new Date().toISOString();

        // Merge into existing agentNotes JSON
        let existing: Record<string, unknown> = {};
        try {
          if (opp.agentNotes) {
            existing = JSON.parse(opp.agentNotes);
          }
        } catch {
          // agentNotes wasn't valid JSON — start fresh
        }

        const updatedNotes = JSON.stringify({
          ...existing,
          cpaBias,
          actualCpcGbp,
          predictedCpcGbp: opp.medianCpcGbp,
          sampleDays: snapshots.length,
          sampledAt,
          campaignId: draft.googleCampaignId,
        });

        await prisma.googleAdsOpportunity.update({
          where: { id: opp.id },
          data: { agentNotes: updatedNotes },
        });

        reflections.push({
          geoTargetId: geoId,
          geoLabel: opp.geoLabel,
          predictedCpcGbp: opp.medianCpcGbp,
          actualCpcGbp,
          cpaBias,
          sampleDays: snapshots.length,
          opportunityUpdated: true,
        });

        console.log(
          `[CampaignReflection] ${opp.geoLabel}: predicted £${opp.medianCpcGbp} vs actual £${actualCpcGbp} → bias ${cpaBias} (${cpaBias > 1 ? "more expensive" : cpaBias < 0.9 ? "cheaper ✓" : "accurate"})`,
        );

        updated = true;
        break; // update once per draft (primary geo only)
      }

      if (!updated) skipped++;
    } catch (err) {
      errors.push(
        `${draft.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { reflections, skipped, errors };
}

/**
 * Apply the cpaBias stored on GoogleAdsOpportunity rows to adjust a raw score
 * before presenting it in the scout ranking.
 *
 * bias > 1 (expensive) → divide score → city falls in ranking.
 * bias < 1 (cheap)     → multiply score → city rises in ranking.
 *
 * Clamped: bias below 0.3 or above 3.0 is treated as 0.3/3.0 to prevent
 * a single bad data point destroying a geo.
 */
export function applyBiasToScore(rawScore: number, cpaBias: number | null | undefined): number {
  if (!cpaBias || cpaBias <= 0) return rawScore;
  const clampedBias = Math.max(0.3, Math.min(3.0, cpaBias));
  return Number((rawScore / clampedBias).toFixed(2));
}
