/**
 * Keyword × Geo Isolation Layer
 *
 * PROBLEM: A single global score per keyword propagates learning across all
 * geos. Sheffield's 18% conversion rate on "emergency locksmith" should not
 * inflate estimates for a small market town in Lincolnshire where the same
 * term converts at 4% and barely gets any clicks.
 *
 * SOLUTION: This module maintains a per-(keyword × geoId) score that is
 * isolated from the global KeywordSeed score. The scorer in
 * google-ads-opportunities.ts reads the local score first; falls back to the
 * global score only when no local data exists.
 *
 * STABILITY MODEL:
 * ─────────────────
 * Keywords that appear in only one or two scans could be temporary spikes
 * (seasonal search surge, news event, broad-match pollution).
 *
 * stabilityWeight = min(1, consecutiveSurvivalCount / 4) × (1 / (1 + volatilityScore))
 *
 *   consecutiveSurvivalCount: how many back-to-back scans the keyword appeared
 *   with profitPerClick > 0. Resets on first unprofitable scan.
 *   → 0 scans: 0.25×  (new — heavily discounted)
 *   → 2 scans: 0.50×
 *   → 4+ scans: 1.0× (before volatility discount)
 *
 *   volatilityScore: stddev of rolling profitHistory / mean
 *   → 0 = perfectly stable across scans
 *   → 1 = ±100% variance (wild swings — likely spike or noise)
 *
 * OPERATIONAL EFFICIENCY:
 * ────────────────────────
 * getGeoOperationalFactor(geoId) returns a discount (0–1) derived from
 * platform job outcomes. Returns 1.0 (no discount) when no data exists yet,
 * but the UI shows a "model confidence: unverified" indicator.
 *
 * This module does NOT import google-ads-opportunities.ts to avoid circular
 * dependencies. It is a pure data-access layer over Prisma.
 *
 * NOTE: KeywordGeoScore and GeoOperationalMetrics are new Prisma models added
 * in this session. They require `prisma generate` to be run (happens
 * automatically on Vercel build). Local TypeScript checks may warn on these
 * until you run `npx prisma generate` locally.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — new models added in schema; requires `npx prisma generate`
import prisma from "@/lib/db";

// =========================================================================
// Stability computation helpers
// =========================================================================

/**
 * Standard deviation of an array of numbers.
 * Returns 0 for arrays with fewer than 2 elements.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation (stddev / |mean|).
 * Normalised volatility score: 0 = stable, higher = more volatile.
 * Clamped to [0, 3] to prevent extreme values from dominating.
 */
function volatilityScore(history: number[]): number {
  if (history.length < 2) return 0;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  if (Math.abs(mean) < 0.01) return 1; // near-zero mean = undefined CV, treat as volatile
  const cv = stddev(history) / Math.abs(mean);
  return Math.min(3, cv);
}

/**
 * Stability weight from consecutive survival count + volatility.
 * Range: 0.05 – 1.0.
 * New keywords are discounted until they prove durable.
 */
export function computeStabilityWeight(
  consecutiveSurvivalCount: number,
  history: number[],
): number {
  // Base weight: climbs from 0.25 to 1.0 over 4 consecutive profitable scans.
  const survivalWeight = Math.min(1, 0.25 + (consecutiveSurvivalCount / 4) * 0.75);
  // Volatility discount: 1 / (1 + volatility). Stable = 1.0, CV=1 = 0.5, CV=3 = 0.25.
  const volScore = volatilityScore(history);
  const volDiscount = 1 / (1 + volScore);
  return Math.max(0.05, survivalWeight * volDiscount);
}

// =========================================================================
// Global seed stability (KeywordSeed table)
// =========================================================================

/**
 * Record that a keyword appeared in a Planner scan with this profitPerClick.
 * Updates the global KeywordSeed stability fields (firstScannedAt, scanCount,
 * consecutiveSurvivalCount, profitHistory, volatilityScore, stabilityWeight).
 *
 * Called once per keyword per geo scan in scoreOpportunities().
 * The keyword must already exist in KeywordSeed (it was used as a seed or was
 * discovered and added earlier in the run).
 */
export async function recordSeedScanAppearance(
  keyword: string,
  profitPerClick: number,
): Promise<void> {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const existing = await db.keywordSeed.findUnique({ where: { keyword: normalized } });
  if (!existing) return; // keyword not in bank yet — will be added separately

  const profitable = profitPerClick > 0;
  const newConsecutive = profitable ? (existing.consecutiveSurvivalCount ?? 0) + 1 : 0;

  // Keep rolling last-8 readings (oldest falls off).
  const history: number[] = [...(existing.profitHistory ?? []), profitPerClick].slice(-8);
  const volScore = volatilityScore(history);
  const weight = computeStabilityWeight(newConsecutive, history);

  await db.keywordSeed.update({
    where: { keyword: normalized },
    data: {
      firstScannedAt: existing.firstScannedAt ?? new Date(),
      lastScannedAt: new Date(),
      scanCount: { increment: 1 },
      consecutiveSurvivalCount: newConsecutive,
      profitHistory: history,
      volatilityScore: Number(volScore.toFixed(3)),
      stabilityWeight: Number(weight.toFixed(3)),
    },
  });
}

/**
 * Fetch the stability weight for a single keyword.
 * Returns 0.25 (new-seed default) if not found.
 */
export async function getSeedStabilityWeight(keyword: string): Promise<number> {
  const normalized = keyword.trim().toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const row = await db.keywordSeed.findUnique({
    where: { keyword: normalized },
    select: { stabilityWeight: true },
  });
  return row?.stabilityWeight ?? 0.25;
}

// =========================================================================
// Geo-local keyword scoring (KeywordGeoScore table)
// =========================================================================

/**
 * Record a keyword scan result for a specific geo.
 * Creates or updates the KeywordGeoScore row.
 * This is the core of geo isolation — learning is stored per (keyword × geo)
 * and never bleeds into other geos or the global seed score.
 *
 * @param keyword     Raw keyword text (will be normalised)
 * @param geoId       Google Ads geo target ID
 * @param profitPerClick  Profit estimate from this scan for this geo
 */
export async function recordGeoScanAppearance(
  keyword: string,
  geoId: string,
  profitPerClick: number,
): Promise<void> {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized || !geoId) return;

  const profitable = profitPerClick > 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const existing = await db.keywordGeoScore.findUnique({
    where: { keyword_geoId: { keyword: normalized, geoId } },
  });

  if (!existing) {
    // First time this keyword × geo pair has been seen.
    const history = [profitPerClick];
    await db.keywordGeoScore.create({
      data: {
        keyword: normalized,
        geoId,
        localScore: 1.0, // optimistic default — first scan
        localWinCount: profitable ? 1 : 0,
        localLossCount: profitable ? 0 : 1,
        scanCount: 1,
        profitHistory: history,
        volatilityScore: 0,
        stabilityWeight: 0.25,
        lastProfitPerClick: profitPerClick,
        lastSeenAt: new Date(),
      },
    });
    return;
  }

  const newWins = existing.localWinCount + (profitable ? 1 : 0);
  const newLosses = existing.localLossCount + (profitable ? 0 : 1);
  // Wilson-ish smoothing — consistent with global seed score formula.
  const localScore = (newWins + 1) / (newWins + newLosses + 2);

  const newConsecutive = profitable
    ? (existing.consecutiveSurvivalCount ?? 0) + 1
    : 0;
  const history: number[] = [...(existing.profitHistory ?? []), profitPerClick].slice(-6);
  const volScore = volatilityScore(history);
  const weight = computeStabilityWeight(newConsecutive, history);

  await db.keywordGeoScore.update({
    where: { keyword_geoId: { keyword: normalized, geoId } },
    data: {
      localScore: Number(localScore.toFixed(4)),
      localWinCount: newWins,
      localLossCount: newLosses,
      scanCount: { increment: 1 },
      profitHistory: history,
      volatilityScore: Number(volScore.toFixed(3)),
      stabilityWeight: Number(weight.toFixed(3)),
      lastProfitPerClick: profitPerClick,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Get the geo-local score for a keyword in a specific geo.
 * Returns null when no local data exists (caller should fall back to global).
 *
 * The returned object includes both the score and the stability weight so
 * the scorer can apply them together.
 */
export async function getLocalGeoScore(
  keyword: string,
  geoId: string,
): Promise<{
  localScore: number;
  stabilityWeight: number;
  volatilityScore: number;
  scanCount: number;
  lastProfitPerClick: number | null;
} | null> {
  const normalized = keyword.trim().toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const row = await db.keywordGeoScore.findUnique({
    where: { keyword_geoId: { keyword: normalized, geoId } },
    select: {
      localScore: true,
      stabilityWeight: true,
      volatilityScore: true,
      scanCount: true,
      lastProfitPerClick: true,
    },
  });
  return row ?? null;
}

/**
 * Batch fetch all local geo scores for a specific geo.
 * Returns a Map<keyword, localScore × stabilityWeight> — the effective
 * geo-local weight to apply to the Planner's profitPerClick estimate.
 *
 * Only returns keywords with ≥ 2 scans (one scan is not enough to trust).
 */
export async function getGeoLocalScoreMap(geoId: string): Promise<Map<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const rows = await db.keywordGeoScore.findMany({
    where: { geoId, scanCount: { gte: 2 } },
    select: { keyword: true, localScore: true, stabilityWeight: true },
  });
  return new Map(
    rows.map((r: { keyword: string; localScore: number; stabilityWeight: number }) => [
      r.keyword,
      r.localScore * r.stabilityWeight,
    ]),
  );
}

// =========================================================================
// Operational efficiency factor (GeoOperationalMetrics table)
// =========================================================================

/**
 * Compute and persist the operationalEfficiencyFactor for a geo from its
 * raw metrics. Called when platform data is synced.
 *
 * The formula:
 *   factor = (1 - spamLeadRate)
 *           × (1 - duplicateLeadRate)
 *           × dispatchSuccessRate
 *           × (1 - cancellationRate)
 *           × (1 - missedCallRate)
 *           × (1 - refundProbability)
 *
 * Only non-null metrics contribute. If none are populated, returns 1.0 with
 * `dataAvailable: false` so the UI can show a confidence warning.
 */
export function computeOperationalFactor(metrics: {
  spamLeadRate?: number | null;
  duplicateLeadRate?: number | null;
  dispatchSuccessRate?: number | null;
  cancellationRate?: number | null;
  missedCallRate?: number | null;
  refundProbability?: number | null;
}): { factor: number; dataAvailable: boolean } {
  let factor = 1.0;
  let anyData = false;

  if (metrics.spamLeadRate != null)       { factor *= (1 - metrics.spamLeadRate);       anyData = true; }
  if (metrics.duplicateLeadRate != null)  { factor *= (1 - metrics.duplicateLeadRate);  anyData = true; }
  if (metrics.dispatchSuccessRate != null){ factor *= metrics.dispatchSuccessRate;       anyData = true; }
  if (metrics.cancellationRate != null)   { factor *= (1 - metrics.cancellationRate);   anyData = true; }
  if (metrics.missedCallRate != null)     { factor *= (1 - metrics.missedCallRate);      anyData = true; }
  if (metrics.refundProbability != null)  { factor *= (1 - metrics.refundProbability);  anyData = true; }

  return {
    factor: Math.max(0.01, Math.min(1.0, Number(factor.toFixed(4)))),
    dataAvailable: anyData,
  };
}

/**
 * Fetch the operational efficiency factor for a geo.
 * Returns { factor: 1.0, dataAvailable: false } when no metrics exist yet.
 *
 * This 1.0 default means the profit estimate is NOT discounted when we have
 * no operational data — but the UI shows a "model confidence: unverified"
 * indicator so the operator knows the estimate is optimistic.
 */
export async function getGeoOperationalFactor(geoId: string): Promise<{
  factor: number;
  dataAvailable: boolean;
  metrics?: {
    spamLeadRate: number | null;
    missedCallRate: number | null;
    dispatchSuccessRate: number | null;
    cancellationRate: number | null;
    refundProbability: number | null;
    sampleSize: number | null;
  };
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const row = await db.geoOperationalMetrics.findUnique({
    where: { geoId },
    select: {
      operationalEfficiencyFactor: true,
      spamLeadRate: true,
      missedCallRate: true,
      dispatchSuccessRate: true,
      cancellationRate: true,
      refundProbability: true,
      sampleSize: true,
    },
  });

  if (!row) return { factor: 1.0, dataAvailable: false };

  const factor = row.operationalEfficiencyFactor ??
    computeOperationalFactor(row).factor;

  return {
    factor,
    dataAvailable: true,
    metrics: {
      spamLeadRate: row.spamLeadRate,
      missedCallRate: row.missedCallRate,
      dispatchSuccessRate: row.dispatchSuccessRate,
      cancellationRate: row.cancellationRate,
      refundProbability: row.refundProbability,
      sampleSize: row.sampleSize,
    },
  };
}

/**
 * Batch fetch operational factors for all geos that have data.
 * Returns a Map<geoId, { factor, dataAvailable }>.
 * Geos absent from the map have factor=1.0 + dataAvailable=false.
 */
export async function getAllGeoOperationalFactors(): Promise<
  Map<string, { factor: number; dataAvailable: boolean }>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const rows = await db.geoOperationalMetrics.findMany({
    select: { geoId: true, operationalEfficiencyFactor: true },
  });
  return new Map(
    rows.map((r: { geoId: string; operationalEfficiencyFactor: number | null }) => [
      r.geoId,
      {
        factor: r.operationalEfficiencyFactor ?? 1.0,
        dataAvailable: r.operationalEfficiencyFactor != null,
      },
    ]),
  );
}
