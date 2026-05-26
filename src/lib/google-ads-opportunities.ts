/**
 * Opportunity Scorer — Profit-Potential Model (v2).
 *
 * Ranks geos by EXPECTED MONTHLY PROFIT, not cheapness.
 *
 * Previous model scored searches / (cpc × competition), which systematically
 * penalised high-intent markets (£4–8 CPC) that are still very profitable.
 * In locksmith PPC a £5 click with 15% conversion at £175 avg job value
 * returns £21 expected revenue per click, i.e. £16 gross profit — far better
 * than a £1 click with 5% conversion (£7.75 expected revenue, £6.75 profit).
 *
 * New formula:
 *
 *   profitPerClick(kw) = convRate(tier) × jobValue - cpcGbp
 *   expectedMonthlyProfit(geo) = Σ_top5(searches × profitPerClick)
 *                               × supplyFactor
 *                               × competitorGapFactor      (if IS data available)
 *                               × seasonalMultiplier
 *                               × performanceBias          (from live campaign data)
 *
 * Conversion rate priors (calibrated against UK locksmith SEM benchmarks):
 *   LOW competition  7%   — mixed intent, planned work, less urgent
 *   MEDIUM          12%   — good emergency mix
 *   HIGH            15%   — very high intent; only urgent searches click through
 *
 * These are overridden by real campaign data when available (passed via
 * opts.geoConvRateMap).
 *
 * Quota note: KeywordPlanIdeaService has a small daily cap. The scout calls
 * this weekly only, and we batch all seeds per geo into a single API call.
 */

import type { GoogleAdsClient, KeywordIdea } from "@/lib/google-ads";
import { microsToCurrency } from "@/lib/google-ads";
import type { CoverageUniverseEntry } from "@/lib/google-ads-geo-universe";
import prisma from "@/lib/db";
import {
  recordSeedScanAppearance,
  recordGeoScanAppearance,
  getGeoLocalScoreMap,
  getAllGeoOperationalFactors,
  computeStabilityWeight,
} from "@/lib/keyword-geo-score";

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
  /** Top-of-page bid in GBP (high end preferred for realism). */
  cpcGbp: number;
  /**
   * Expected gross profit per click for this keyword:
   *   profitPerClick = convRate × jobValue - cpcGbp
   * Negative when CPC > expected revenue per click (keyword is unprofitable at baseline).
   */
  profitPerClick: number;
  /** Expected monthly gross profit contribution: searches × profitPerClick. */
  monthlyProfitGbp: number;
  /** True when this keyword contains strong emergency-intent signals. */
  isEmergencyIntent: boolean;
  /** @deprecated kept for backwards compat — use monthlyProfitGbp for ranking */
  score: number;

  /**
   * Stability weight applied to this keyword's profitPerClick (0.05–1.0).
   * < 1 = discounted because keyword is new, volatile, or has a short scan history.
   * = 1 = stable, consistent across ≥ 4 scans with low variance.
   */
  stabilityWeight?: number;

  /**
   * Consecutive scans in which this keyword appeared with profitPerClick > 0.
   * Used for UI stability badge: 0–1 = 🆕, 2–3 = ⚡, 4+ = ✓
   */
  consecutiveSurvivalCount?: number;
}

export interface GeoOpportunity {
  geoId: string;
  cityKey: string;
  label: string;
  /**
   * Primary ranking signal — expected gross monthly profit (£) at median CPC,
   * after supply, seasonal, near-London, and performance-bias adjustments.
   * Replace any display of the legacy `score` with this field.
   */
  expectedMonthlyProfitGbp: number;
  /** Conversion rate used for this geo (real data override or tier baseline). */
  estimatedConvRate: number;
  /** Estimated cost per acquisition: medianCpcGbp / estimatedConvRate. */
  estimatedCpaGbp: number;
  /**
   * Fraction of top-10 keywords with emergency intent signals.
   * Higher = more urgent demand = better conversion rate assumption.
   */
  emergencyIntentFraction: number;
  /** @deprecated use expectedMonthlyProfitGbp for ranking; kept for DB compat */
  score: number;
  /** Median CPC across returned ideas (GBP). */
  medianCpcGbp: number;
  /** Median competition index 0–100. */
  medianCompetitionIndex: number;
  /** Bucketed competition tier derived from medianCompetitionIndex. */
  competitionTier: CompetitionTier;
  /** Sum of avgMonthlySearches across returned ideas. */
  totalMonthlySearches: number;
  /** Top 10 keywords sorted by expected monthly profit (not cheapness). */
  topKeywords: OpportunityKeyword[];
  /** Number of eligible locksmiths who can fulfil leads from this geo. */
  locksmithCount: number;
  /** Locksmith IDs from the coverage cohort. */
  locksmithIds: string[];
  /** "Supply ratio" — locksmiths per 100 monthly searches. */
  supplyRatio: number;
  /**
   * Impression share data from a live campaign targeting this geo (0–1).
   * Null when no campaign is running here yet.
   */
  ourImpressionShare?: number;
  /**
   * True when competitors have significantly lower impression share after 20:00
   * — indicates an after-hours coverage gap we can exploit with day-parting.
   */
  afterHoursGap?: boolean;
  /** True if this city is within ~38 miles of London (auction bleed). */
  nearLondonPenalty?: boolean;
  /** True if the winter seasonal boost (1.2×) was applied. */
  winterBoost?: boolean;
  /**
   * True when ALL keywords for this geo returned 0 bid estimates from the
   * Keyword Planner and industry fallback CPCs were used instead.
   */
  usingFallbackCpc?: boolean;

  /**
   * Operational efficiency factor applied to the profit estimate (0–1).
   * Derived from GeoOperationalMetrics: spam rate, missed calls, dispatch
   * success, cancellations, refunds. Returns 1.0 when no operational data
   * exists yet (optimistic assumption).
   */
  operationalEfficiencyFactor?: number;

  /**
   * False when operationalEfficiencyFactor = 1.0 due to missing data (not
   * because the geo is genuinely 100% efficient). The UI uses this to show
   * a "model confidence: unverified" warning on the profit estimate.
   */
  modelConfidenceVerified?: boolean;
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
   * Defaults to true.
   */
  excludeLondon?: boolean;
  /**
   * @deprecated No longer used as a hard filter — the profit model handles
   * unprofitable CPCs naturally (negative profit term). Kept for backwards compat.
   */
  maxMedianCpcGbp?: number;
  /**
   * Average locksmith job revenue in GBP. Used in the profit calculation.
   * Defaults to £175 (UK average: emergency £200, planned £120, blended ~£175).
   */
  jobValueGbp?: number;
  /**
   * Per-geo conversion rate overrides from live campaign data.
   * Key = geoId (e.g. "1006886"), value = observed conversion rate (0–1).
   * When present, overrides the tier-based baseline for that geo.
   */
  geoConvRateMap?: Map<string, number>;
  /**
   * Per-geo impression share from live campaigns.
   * Key = geoId, value = impression share (0–1).
   * Used to detect where we're already dominant vs where we have room to grow.
   */
  geoImpressionShareMap?: Map<string, number>;
  /**
   * Per-geo after-hours gap flag.
   * Key = geoId, value = true when competitor IS drops >30% after 20:00.
   */
  geoAfterHoursGapMap?: Map<string, boolean>;

  /**
   * Operational efficiency factors — fetched once per run from GeoOperationalMetrics.
   * Key = geoId, value = { factor: 0–1, dataAvailable: boolean }.
   * When absent for a geo, assumes factor=1.0 (no discount, but model unverified).
   * Pre-fetch with getAllGeoOperationalFactors() before calling scoreOpportunities.
   */
  geoOperationalFactorMap?: Map<string, { factor: number; dataAvailable: boolean }>;

  /**
   * When true, record scan appearances in KeywordSeed (stability) and
   * KeywordGeoScore (geo isolation) tables after scoring each geo.
   * Defaults to true. Set to false in tests to avoid DB side effects.
   */
  recordScanData?: boolean;

  /** Optional callback when one geo finishes. */
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

// =========================================================================
// Seasonal multiplier — winter boost for northern UK cities
//
// Lockouts and emergency call-outs spike Oct–Feb in northern cities because
// of cold-weather lock freeze, shorter days, and higher crime rates in
// winter.  The Keyword Planner uses 12-month averages, which under-estimates
// winter search volume in these geos by roughly 20%.  We apply a 1.2×
// multiplier Oct–Feb so the scorer prioritises them during the high-season
// window rather than waiting until the spring cycle.
//
// The boost is only applied to cities north of ~52°N where the effect is
// most pronounced; southern cities don't show the same uplift.
// =========================================================================

/** Score multiplier applied to northern cities in the winter months Oct–Feb. */
const WINTER_BOOST = 1.2;

/**
 * City keys that benefit from the winter boost.
 * All ≥ ~52°N where cold-season lockout spikes are statistically significant.
 */
const NORTHERN_CITY_KEYS = new Set([
  "hull",
  "sheffield",
  "leeds",
  "nottingham",
  "manchester",
  "liverpool",
  "newcastle",
  "sunderland",
  "bradford",
  "middlesbrough",
  "stoke",
  "derby",
  "leicester",
  "coventry",
  "birmingham",
]);

/** True if today falls in the winter boost window (October through February). */
function isWinterBoostActive(): boolean {
  const month = new Date().getMonth(); // 0-indexed: Jan=0, Oct=9, Dec=11
  return month >= 9 || month <= 1; // Oct(9), Nov(10), Dec(11), Jan(0), Feb(1)
}

function isNorthernCity(cityKey: string): boolean {
  return NORTHERN_CITY_KEYS.has(cityKey.toLowerCase());
}

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

// =========================================================================
// Profit model constants
// =========================================================================

/**
 * Average locksmith job revenue in GBP (blended: emergency £200, planned £120).
 * Override via ScoreOpportunitiesOptions.jobValueGbp when regional data exists.
 */
export const LOCKSMITH_DEFAULT_JOB_VALUE_GBP = 175;

/**
 * Baseline conversion rate priors, calibrated against UK locksmith SEM data.
 *
 * Key insight: HIGH competition → HIGHER conversion rate, not lower.
 * National chains bid aggressively on "emergency locksmith" only because the
 * intent is near-guaranteed purchase. Low-competition terms often reflect
 * informational or comparison searches with weaker intent.
 *
 *   LOW    7%  — mixed intent, some planned/research queries
 *   MEDIUM 12% — good emergency mix, high urgency
 *   HIGH   15% — near-guaranteed purchase intent; only serious searches survive
 */
export const BASELINE_CONV_RATES: Record<CompetitionTier, number> = {
  LOW:     0.07,
  MEDIUM:  0.12,
  HIGH:    0.15,
  UNKNOWN: 0.10,
};

/**
 * Bonus multiplier applied when ≥30% of a geo's top keywords are
 * emergency-intent terms. These convert faster and at higher job value.
 */
const EMERGENCY_INTENT_BOOST = 1.15;

/**
 * Regex patterns that flag emergency-intent locksmith keywords.
 * These commands a ~15–25% conversion premium over general locksmith terms.
 */
const EMERGENCY_INTENT_RE =
  /\b(emergency|urgent|24.?hour|locked out|lockout|lock out|broken key|snapped key|burglary|break.?in|asap|now|tonight|today)\b/i;

/**
 * Industry-calibrated CPC floor for the UK locksmith vertical.
 * Used when Google Keyword Planner returns 0 bid estimates.
 *
 * Benchmark ranges (UK locksmith SEM, May 2026):
 *   LOW    → £0.80–£2.00
 *   MEDIUM → £2.00–£4.50
 *   HIGH   → £4.00–£9.00
 */
function locksmithCpcFloor(competitionIndex: number): number {
  if (competitionIndex >= 67) return 5.00;  // HIGH
  if (competitionIndex >= 34) return 2.80;  // MEDIUM
  if (competitionIndex > 0)   return 1.20;  // LOW
  return 1.80;                               // UNKNOWN
}

export async function scoreOpportunities(
  client: GoogleAdsClient,
  universe: CoverageUniverseEntry[],
  opts: ScoreOpportunitiesOptions,
): Promise<ScoreOpportunitiesResult> {
  if (!opts.seedKeywords.length) {
    throw new Error("scoreOpportunities: seedKeywords required");
  }
  const seeds = opts.seedKeywords.slice(0, 25); // bumped from 20 — competitor terms need room
  const delay = opts.perGeoDelayMs ?? 250;
  const excludeLondon = opts.excludeLondon !== false;
  const jobValue = opts.jobValueGbp ?? LOCKSMITH_DEFAULT_JOB_VALUE_GBP;
  const shouldRecord = opts.recordScanData !== false;

  // Filter the universe before hitting the Planner API to save quota.
  let filtered = universe;
  if (excludeLondon) {
    filtered = filtered.filter((e) => !LONDON_GEO_IDS.has(e.geoId));
  }
  const candidates = opts.maxGeos ? filtered.slice(0, opts.maxGeos) : filtered;

  // Pre-fetch operational efficiency factors for all known geos.
  // Falls back to an empty map (all geos get factor=1.0 / dataAvailable=false).
  const operationalFactors = opts.geoOperationalFactorMap ??
    await getAllGeoOperationalFactors().catch(() => new Map<string, { factor: number; dataAvailable: boolean }>());

  const opportunities: GeoOpportunity[] = [];
  const failures: ScoreOpportunitiesResult["failures"] = [];

  for (const entry of candidates) {
    try {
      const ideas = await client.generateKeywordIdeas({
        geoTargetIds: [entry.geoId],
        keywordSeeds: seeds,
      });

      const allZeroBids = ideas.every(
        (i) => i.highTopOfPageBidMicros === 0 && i.lowTopOfPageBidMicros === 0,
      );

      // ── Step 1: Determine geo-level conversion rate ──────────────────────
      // Use real campaign data if available for this geo; otherwise use the
      // competition-tier baseline. Real data always wins.
      const compIdx = ideas
        .map((i) => i.competitionIndex)
        .filter((v) => v > 0);
      const medianComp = median(compIdx);
      const tier = classifyTier(medianComp);
      const realConvRate = opts.geoConvRateMap?.get(entry.geoId);
      const estimatedConvRate = realConvRate ?? BASELINE_CONV_RATES[tier];

      // ── Step 1b: Geo-local keyword score map ─────────────────────────────
      // Fetch per-(keyword × geo) stability weights. These isolate geo-specific
      // learning so Sheffield's conversion history doesn't inflate Exeter.
      // Returns empty map on error — scorer falls back to global weights.
      const geoLocalScoreMap = await getGeoLocalScoreMap(entry.geoId).catch(
        () => new Map<string, number>(),
      );

      // ── Step 2: Per-keyword profit calculation ───────────────────────────
      const scored = ideas
        .filter((i) => i.avgMonthlySearches > 0 && i.text)
        .map<OpportunityKeyword>((i) => {
          // Prefer highTopOfPageBid — best proxy for actual auction clearing price.
          const highCpc = microsToCurrency(i.highTopOfPageBidMicros);
          const lowCpc  = microsToCurrency(i.lowTopOfPageBidMicros);
          const rawCpc  = highCpc > 0 ? highCpc : (lowCpc + highCpc) / 2;
          const cpcGbp  = rawCpc > 0 ? rawCpc : locksmithCpcFloor(i.competitionIndex);

          const isEmergencyIntent = EMERGENCY_INTENT_RE.test(i.text);
          // Emergency terms convert ~15% better and command higher job values.
          const effectiveConvRate = isEmergencyIntent
            ? Math.min(0.30, estimatedConvRate * 1.15)
            : estimatedConvRate;

          // Core profit formula:
          //   profitPerClick = convRate × jobValue - cpcGbp
          const rawProfitPerClick = effectiveConvRate * jobValue - cpcGbp;

          // ── Stability / geo isolation weight ──────────────────────────
          // geoLocalScoreMap contains localScore × stabilityWeight for
          // keywords we've seen in this geo before. For new keywords (not
          // in the map), apply the global default stability weight of 0.25
          // (new/unverified → heavily discounted until confirmed by scans).
          const geoWeight = geoLocalScoreMap.get(i.text.toLowerCase()) ?? 0.25;
          // stabilityAdjustedProfit: new keywords start at 25% of face value.
          // After 4+ profitable scans in this geo, weight reaches ~1.0.
          const stabilityAdjustedProfit = rawProfitPerClick * geoWeight;

          const monthlyProfitGbp = i.avgMonthlySearches * stabilityAdjustedProfit;

          // Legacy score kept for any callers that still read it.
          const score = Math.max(0, monthlyProfitGbp);

          return {
            text: i.text,
            monthlySearches: i.avgMonthlySearches,
            competition: i.competition,
            competitionIndex: i.competitionIndex,
            cpcGbp: Number(cpcGbp.toFixed(2)),
            profitPerClick: Number(rawProfitPerClick.toFixed(2)),  // raw (pre-stability) for display
            monthlyProfitGbp: Number(monthlyProfitGbp.toFixed(0)), // stability-adjusted
            isEmergencyIntent,
            stabilityWeight: Number(geoWeight.toFixed(3)),
            score: Number(score.toFixed(2)),
          };
        })
        // Sort by stability-adjusted expected monthly profit.
        .sort((a, b) => b.monthlyProfitGbp - a.monthlyProfitGbp);

      const top10 = scored.slice(0, 10);
      const cpcs = scored.map((s) => s.cpcGbp).filter((v) => v > 0);
      const medianCpc = median(cpcs);
      const totalSearches = scored.reduce((acc, s) => acc + s.monthlySearches, 0);

      // Fraction of top-10 keywords with emergency intent.
      const emergencyIntentFraction = top10.length > 0
        ? top10.filter((k) => k.isEmergencyIntent).length / top10.length
        : 0;

      // ── Step 3: Geo-level profit (sum of top-5 keyword monthly profits) ──
      const rawProfitScore = top10.slice(0, 5).reduce((acc, k) => acc + k.monthlyProfitGbp, 0);

      // ── Step 4: Supply-fitness multiplier ────────────────────────────────
      const supplyRatio =
        totalSearches > 0
          ? Number(((entry.locksmithCount / (totalSearches / 100)) || 0).toFixed(2))
          : entry.locksmithCount;
      const supplyFactor = Math.min(1, supplyRatio > 0 ? supplyRatio / 0.5 : 0.5);
      const supplyAdjusted = rawProfitScore * (0.5 + 0.5 * supplyFactor);

      // ── Step 5: Emergency intent bonus ───────────────────────────────────
      const intentAdjusted = emergencyIntentFraction >= 0.3
        ? supplyAdjusted * EMERGENCY_INTENT_BOOST
        : supplyAdjusted;

      // ── Step 6: Near-London proximity penalty ────────────────────────────
      // National chain broad-match campaigns bleed actual CPCs 30–60% above
      // Planner predictions in SE cities. The profit formula partially handles
      // this (higher CPC → lower profitPerClick) but apply additional penalty
      // for unpredictable auction variance in these markets.
      const nearLondon = isNearLondonCity(entry.cityKey);
      const nearLondonAdjusted = nearLondon ? intentAdjusted * NEAR_LONDON_PENALTY : intentAdjusted;

      // ── Step 7: Seasonal winter boost ────────────────────────────────────
      const winterBoostApplied = isWinterBoostActive() && isNorthernCity(entry.cityKey);
      const seasonalAdjusted = winterBoostApplied ? nearLondonAdjusted * WINTER_BOOST : nearLondonAdjusted;

      // ── Step 8: After-hours gap bonus ────────────────────────────────────
      // Geos where competitors disappear after 20:00 offer a structural advantage
      // for a 24/7 locksmith platform. Boost these geos by 20%.
      const hasAfterHoursGap = opts.geoAfterHoursGapMap?.get(entry.geoId) ?? false;
      const afterHoursAdjusted = hasAfterHoursGap ? seasonalAdjusted * 1.20 : seasonalAdjusted;

      // ── Step 9: Operational efficiency factor ────────────────────────────
      // Discounts the profit estimate by the geo's operational reality:
      // spam leads, missed calls, dispatch failures, cancellations, refunds.
      // Returns factor=1.0 + dataAvailable=false when no platform data exists.
      // The UI shows a confidence warning when dataAvailable=false.
      const opFactor = operationalFactors.get(entry.geoId) ?? { factor: 1.0, dataAvailable: false };
      const operationallyAdjusted = afterHoursAdjusted * opFactor.factor;

      const finalProfitScore = Number(operationallyAdjusted.toFixed(2));
      const estimatedCpaGbp = estimatedConvRate > 0
        ? Number((medianCpc / estimatedConvRate).toFixed(2))
        : 0;

      const opportunity: GeoOpportunity = {
        geoId: entry.geoId,
        cityKey: entry.cityKey,
        label: entry.label,
        expectedMonthlyProfitGbp: finalProfitScore,
        estimatedConvRate: Number(estimatedConvRate.toFixed(4)),
        estimatedCpaGbp,
        emergencyIntentFraction: Number(emergencyIntentFraction.toFixed(2)),
        // Legacy score = same as expectedMonthlyProfitGbp for DB compat.
        score: finalProfitScore,
        medianCpcGbp: Number(medianCpc.toFixed(2)),
        medianCompetitionIndex: Number(medianComp.toFixed(1)),
        competitionTier: tier,
        totalMonthlySearches: totalSearches,
        topKeywords: top10,
        locksmithCount: entry.locksmithCount,
        nearLondonPenalty: nearLondon,
        winterBoost: winterBoostApplied,
        afterHoursGap: hasAfterHoursGap,
        usingFallbackCpc: allZeroBids,
        ourImpressionShare: opts.geoImpressionShareMap?.get(entry.geoId),
        locksmithIds: entry.locksmithIds,
        supplyRatio,
        operationalEfficiencyFactor: opFactor.factor,
        modelConfidenceVerified: opFactor.dataAvailable,
      };

      opportunities.push(opportunity);
      opts.onGeoScored?.(opportunity);

      // ── Step 10: Record scan data for stability + geo isolation ──────────
      // Non-blocking: failures here must not abort the scan.
      if (shouldRecord) {
        for (const kw of top10) {
          const p = kw.profitPerClick; // raw (pre-stability) profit for honest learning
          // Record geo-local appearance (keyword × geo isolation).
          recordGeoScanAppearance(kw.text, entry.geoId, p).catch(() => undefined);
          // Record global seed appearance (stability tracking).
          recordSeedScanAppearance(kw.text, p).catch(() => undefined);
        }
      }
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
  /** actualCpc / predictedCpc. >1 = more expensive than predicted. */
  cpaBias: number;
  /** Observed conversion rate from actual campaign data (clicks → conversions). */
  actualConvRate: number | null;
  /**
   * actualConvRate / baselineConvRate.
   * >1 = converting better than expected (boost score).
   * <1 = converting worse than expected (decay score).
   * null when insufficient conversion data.
   */
  convRateBias: number | null;
  /** Estimated actual profit per click from live data. */
  actualProfitPerClick: number | null;
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
      // Pull actuals from AdPerformanceSnapshot.
      // We also pull conversions so we can track conv rate bias.
      const snapshots = await prisma.adPerformanceSnapshot.findMany({
        where: {
          platform: "google",
          googleCampaignId: draft.googleCampaignId,
          date: { gte: since },
        },
        select: { date: true, spend: true, clicks: true, conversions: true },
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

      // Conversion rate from real data — only trust when we have ≥50 clicks
      // (below that, conversion counts are too noisy to be meaningful).
      const totalConversions = snapshots.reduce(
        (a, s) => a + (typeof s.conversions === "number" ? s.conversions : 0),
        0,
      );
      const actualConvRate = totalClicks >= 50 && totalConversions > 0
        ? Number((totalConversions / totalClicks).toFixed(4))
        : null;

      const geoTargets = Array.isArray(draft.geoTargets) ? draft.geoTargets : [];
      let updated = false;

      for (const geoId of geoTargets) {
        const opp = await prisma.googleAdsOpportunity.findFirst({
          where: { geoTargetId: geoId, kind: "COVERAGE" },
          orderBy: { computedAt: "desc" },
          select: { id: true, medianCpcGbp: true, geoLabel: true, agentNotes: true },
        });

        if (!opp || opp.medianCpcGbp <= 0) continue;

        // CPA bias: are we paying more or less than predicted?
        const cpaBias = Number((actualCpcGbp / opp.medianCpcGbp).toFixed(3));

        // Conv rate bias: are we converting better or worse than the baseline
        // we used when we generated this opportunity's score?
        let convRateBias: number | null = null;
        let actualProfitPerClick: number | null = null;
        if (actualConvRate !== null) {
          // Read the baseline conv rate from the stored notes (or derive from tier).
          let existing: Record<string, unknown> = {};
          try { if (opp.agentNotes) existing = JSON.parse(opp.agentNotes); } catch { /**/ }
          const baselineConvRate =
            (existing.estimatedConvRate as number | undefined) ??
            BASELINE_CONV_RATES[classifyTier(0)]; // fallback UNKNOWN 10%
          convRateBias = Number((actualConvRate / baselineConvRate).toFixed(3));
          actualProfitPerClick = Number(
            (actualConvRate * LOCKSMITH_DEFAULT_JOB_VALUE_GBP - actualCpcGbp).toFixed(2),
          );
        }

        const sampledAt = new Date().toISOString();
        let existing: Record<string, unknown> = {};
        try { if (opp.agentNotes) existing = JSON.parse(opp.agentNotes); } catch { /**/ }

        const updatedNotes = JSON.stringify({
          ...existing,
          cpaBias,
          actualCpcGbp,
          predictedCpcGbp: opp.medianCpcGbp,
          actualConvRate,
          convRateBias,
          actualProfitPerClick,
          sampleDays: snapshots.length,
          totalClicks,
          totalConversions,
          sampledAt,
          campaignId: draft.googleCampaignId,
        });

        await prisma.googleAdsOpportunity.update({
          where: { id: opp.id },
          data: { agentNotes: updatedNotes },
        });

        const convNote = actualConvRate !== null
          ? ` | conv ${(actualConvRate * 100).toFixed(1)}% (bias ${convRateBias?.toFixed(2)}×)`
          : "";
        console.log(
          `[CampaignReflection] ${opp.geoLabel}: CPC predicted £${opp.medianCpcGbp} vs actual £${actualCpcGbp} (bias ${cpaBias})${convNote}`,
        );

        reflections.push({
          geoTargetId: geoId,
          geoLabel: opp.geoLabel,
          predictedCpcGbp: opp.medianCpcGbp,
          actualCpcGbp,
          cpaBias,
          actualConvRate,
          convRateBias,
          actualProfitPerClick,
          sampleDays: snapshots.length,
          opportunityUpdated: true,
        });

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
 * Apply CPA and conversion rate biases to adjust a profit score based on
 * real campaign performance data.
 *
 * cpaBias > 1  → more expensive than predicted → reduce score
 * cpaBias < 1  → cheaper than predicted → boost score
 * convRateBias > 1 → converting better than baseline → boost score
 * convRateBias < 1 → converting worse than baseline → decay score
 *
 * The combined effect:
 *   adjustedScore = rawScore × (convRateBias / cpaBias)
 *
 * All biases are clamped 0.3–3.0 to prevent single bad data points
 * from destroying or inflating a geo permanently.
 *
 * If convRateBias is null (insufficient conversion data), only cpaBias
 * is applied. This means new campaigns decay if expensive but don't boost
 * until we have enough conversions to trust the conversion rate.
 */
export function applyBiasToScore(
  rawScore: number,
  cpaBias: number | null | undefined,
  convRateBias?: number | null,
): number {
  if (rawScore <= 0) return rawScore;

  const clampedCpaBias = cpaBias && cpaBias > 0
    ? Math.max(0.3, Math.min(3.0, cpaBias))
    : 1.0;
  const clampedConvBias = convRateBias && convRateBias > 0
    ? Math.max(0.3, Math.min(3.0, convRateBias))
    : 1.0;

  // Combined profit bias: better conversion offsets higher CPC.
  // A city that costs 2× more but converts 2× as well is net-neutral.
  const combinedBias = clampedCpaBias / clampedConvBias;
  return Number((rawScore / combinedBias).toFixed(2));
}
