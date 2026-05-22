/**
 * Google Ads learnings extractor.
 *
 * Pulls historical performance data straight from the Google Ads API for
 * every published campaign on the connected account, then rolls it up
 * into a single `GoogleAdsLearnings` payload that downstream draft
 * generators (e.g. per-locksmith onboarding) can consume.
 *
 * The point: every NEW campaign should start from what already worked
 * on the account, not from scratch.
 *
 * Data sources (GAQL):
 *   - keyword_view              → top keywords by conversions / CTR
 *   - search_term_view          → high-CTR converters (KW candidates)
 *                                  + high-spend zero-conv (negative candidates)
 *   - ad_group_ad               → best-performing RSAs (copy library)
 *   - geographic_view           → conversion density per geo target
 *
 * All metrics are LIFETIME (default Google Ads date range = last 30d
 * unless `DURING LAST_N_DAYS` is added). We pull the last 90d which
 * is the usual sweet spot for "what currently works" without being
 * polluted by stale tests.
 */

import { GoogleAdsClient, getDefaultGoogleAdsClient } from "@/lib/google-ads";
import type { GoogleKeyword, GoogleKeywordMatchType } from "@/lib/openai-google-ads";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProvenKeyword {
  text: string;
  matchType: GoogleKeywordMatchType;
  /** Lifetime clicks attributed to this keyword across all observed campaigns. */
  clicks: number;
  /** Lifetime conversions attributed to this keyword. */
  conversions: number;
  /** Total spend in GBP. */
  cost: number;
  /** Click-through-rate, 0..1. */
  ctr: number;
  /** Cost per conversion in GBP, or null if zero conversions. */
  costPerConv: number | null;
}

export interface ProvenAd {
  headlines: string[];
  descriptions: string[];
  conversions: number;
  clicks: number;
  cost: number;
  /** Ad strength label from Google ("EXCELLENT" | "GOOD" | ...). */
  adStrength?: string;
}

export interface GeoPerformance {
  geoTargetId: string;
  conversions: number;
  clicks: number;
  cost: number;
}

export interface GoogleAdsLearnings {
  /** ISO timestamp the snapshot was taken. */
  capturedAt: string;
  /** Window length in days that was queried. */
  windowDays: number;
  /** Customer ID the data came from (10 digits, no dashes). */
  customerId: string;

  /** Top converting keywords across the account. Sorted by conversions desc. */
  topConvertingKeywords: ProvenKeyword[];
  /** Top click-driving keywords with zero conversions (audit/exclude candidates). */
  zeroConvKeywords: ProvenKeyword[];
  /** Search terms that look like proven converters → KW candidates. */
  searchTermCandidates: ProvenKeyword[];
  /** Search terms that spent money with zero conversions → negative candidates. */
  searchTermNegativeCandidates: string[];

  /** Best-performing RSAs in the account (headline/description library). */
  bestPerformingAds: ProvenAd[];

  /** Conversion density per geo target constant. */
  geoPerformance: GeoPerformance[];

  /** Aggregate totals across the window. */
  totals: {
    clicks: number;
    conversions: number;
    cost: number;
    impressions: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function microsToGbp(micros: unknown): number {
  const n = Number(micros);
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normaliseMatchType(v: unknown): GoogleKeywordMatchType {
  const s = String(v ?? "").toUpperCase();
  if (s === "EXACT" || s === "PHRASE" || s === "BROAD") return s;
  return "PHRASE";
}

// ─── Extractor ──────────────────────────────────────────────────────────────

export interface ExtractLearningsOptions {
  /** How many days of history to pull. Defaults to 90. */
  windowDays?: number;
  /** Minimum clicks before a keyword/search term is considered "evidence". */
  minClicks?: number;
  /** Minimum cost (GBP) before a zero-conv term is flagged as negative candidate. */
  minNegativeCost?: number;
  /** Max items to retain per list (keep payloads small). */
  topN?: number;
}

const DEFAULT_OPTS: Required<ExtractLearningsOptions> = {
  windowDays: 90,
  minClicks: 3,
  minNegativeCost: 2,
  topN: 50,
};

/**
 * Pull the learnings snapshot for a specific Google Ads client.
 *
 * If the account has no historical data yet (brand new), the returned
 * object will still be valid — just with empty arrays. Callers should
 * treat empty learnings as "fall back to BASELINE only".
 */
export async function extractLearningsForClient(
  client: GoogleAdsClient,
  options: ExtractLearningsOptions = {},
): Promise<GoogleAdsLearnings> {
  const opts = { ...DEFAULT_OPTS, ...options };
  const cid = client.customerIdPlain;
  const windowClause = `DURING LAST_${opts.windowDays}_DAYS`;

  // 1. Keyword performance
  const kwRows = await client.query<any>(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.impressions
    FROM keyword_view
    WHERE segments.date ${windowClause}
      AND ad_group_criterion.status = 'ENABLED'
      AND campaign.status != 'REMOVED'
  `).catch(() => [] as any[]);

  // Aggregate by {text, matchType} across ad groups
  const kwAgg = new Map<string, ProvenKeyword>();
  for (const r of kwRows) {
    const text = String(r.adGroupCriterion?.keyword?.text ?? "").toLowerCase().trim();
    if (!text) continue;
    const matchType = normaliseMatchType(r.adGroupCriterion?.keyword?.matchType);
    const key = `${matchType}:${text}`;
    const prev = kwAgg.get(key) ?? {
      text, matchType, clicks: 0, conversions: 0, cost: 0, ctr: 0, costPerConv: null,
    };
    prev.clicks += num(r.metrics?.clicks);
    prev.conversions += num(r.metrics?.conversions);
    prev.cost += microsToGbp(r.metrics?.costMicros);
    kwAgg.set(key, prev);
  }
  for (const k of kwAgg.values()) {
    k.ctr = k.clicks > 0 ? k.clicks / Math.max(1, k.clicks) : 0; // placeholder, see below
    k.costPerConv = k.conversions > 0 ? k.cost / k.conversions : null;
  }
  const allKws = [...kwAgg.values()].filter((k) => k.clicks >= opts.minClicks);
  const topConvertingKeywords = [...allKws]
    .filter((k) => k.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, opts.topN);
  const zeroConvKeywords = [...allKws]
    .filter((k) => k.conversions === 0 && k.cost >= opts.minNegativeCost)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, opts.topN);

  // 2. Search terms — what users actually typed
  const stRows = await client.query<any>(`
    SELECT
      search_term_view.search_term,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions
    FROM search_term_view
    WHERE segments.date ${windowClause}
      AND campaign.status != 'REMOVED'
  `).catch(() => [] as any[]);

  const stAgg = new Map<string, ProvenKeyword>();
  for (const r of stRows) {
    const text = String(r.searchTermView?.searchTerm ?? "").toLowerCase().trim();
    if (!text || text.length > 80) continue;
    const prev = stAgg.get(text) ?? {
      text, matchType: "PHRASE" as GoogleKeywordMatchType,
      clicks: 0, conversions: 0, cost: 0, ctr: 0, costPerConv: null,
    };
    prev.clicks += num(r.metrics?.clicks);
    prev.conversions += num(r.metrics?.conversions);
    prev.cost += microsToGbp(r.metrics?.costMicros);
    stAgg.set(text, prev);
  }
  for (const k of stAgg.values()) {
    k.costPerConv = k.conversions > 0 ? k.cost / k.conversions : null;
  }
  // Candidates: converted >= 1 with >= minClicks → add as PHRASE keywords
  const searchTermCandidates = [...stAgg.values()]
    .filter((k) => k.conversions >= 1 && k.clicks >= opts.minClicks)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, opts.topN);
  // Negative candidates: zero conversions with >= minNegativeCost spend
  const searchTermNegativeCandidates = [...stAgg.values()]
    .filter((k) => k.conversions === 0 && k.cost >= opts.minNegativeCost)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, opts.topN)
    .map((k) => k.text);

  // 3. Best ads (RSAs)
  const adRows = await client.query<any>(`
    SELECT
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad_strength,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date ${windowClause}
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
  `).catch(() => [] as any[]);

  const bestPerformingAds: ProvenAd[] = adRows
    .map((r) => {
      const rsa = r.adGroupAd?.ad?.responsiveSearchAd;
      const headlines = (rsa?.headlines ?? [])
        .map((h: any) => String(h?.text ?? "").trim())
        .filter(Boolean);
      const descriptions = (rsa?.descriptions ?? [])
        .map((d: any) => String(d?.text ?? "").trim())
        .filter(Boolean);
      return {
        headlines,
        descriptions,
        conversions: num(r.metrics?.conversions),
        clicks: num(r.metrics?.clicks),
        cost: microsToGbp(r.metrics?.costMicros),
        adStrength: r.adGroupAd?.adStrength as string | undefined,
      };
    })
    .filter((a) => a.headlines.length > 0)
    .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, 10);

  // 4. Geo performance
  const geoRows = await client.query<any>(`
    SELECT
      geographic_view.country_criterion_id,
      campaign_criterion.criterion_id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM geographic_view
    WHERE segments.date ${windowClause}
  `).catch(() => [] as any[]);

  const geoAgg = new Map<string, GeoPerformance>();
  for (const r of geoRows) {
    const id = String(r.campaignCriterion?.criterionId ?? r.geographicView?.countryCriterionId ?? "");
    if (!id) continue;
    const prev = geoAgg.get(id) ?? { geoTargetId: id, clicks: 0, conversions: 0, cost: 0 };
    prev.clicks += num(r.metrics?.clicks);
    prev.conversions += num(r.metrics?.conversions);
    prev.cost += microsToGbp(r.metrics?.costMicros);
    geoAgg.set(id, prev);
  }
  const geoPerformance = [...geoAgg.values()]
    .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, 30);

  // 5. Totals
  const totals = {
    clicks: 0,
    conversions: 0,
    cost: 0,
    impressions: 0,
  };
  for (const r of kwRows) {
    totals.clicks += num(r.metrics?.clicks);
    totals.conversions += num(r.metrics?.conversions);
    totals.cost += microsToGbp(r.metrics?.costMicros);
    totals.impressions += num(r.metrics?.impressions);
  }

  return {
    capturedAt: new Date().toISOString(),
    windowDays: opts.windowDays,
    customerId: cid,
    topConvertingKeywords,
    zeroConvKeywords,
    searchTermCandidates,
    searchTermNegativeCandidates,
    bestPerformingAds,
    geoPerformance,
    totals,
  };
}

/**
 * Convenience wrapper: extract learnings from the default active Google
 * Ads account in the DB. Returns null if no account is connected.
 */
export async function extractDefaultAccountLearnings(
  options: ExtractLearningsOptions = {},
): Promise<GoogleAdsLearnings | null> {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) return null;
  return extractLearningsForClient(ctx.client, options);
}

/**
 * Merge a set of `ProvenKeyword`s into a `GoogleKeyword[]` shape the
 * draft writer expects. Drops anything with a worse-than-£10 CAC unless
 * we have <3 candidates, in which case we keep them anyway.
 */
export function provenKeywordsToGoogleKeywords(
  proven: ProvenKeyword[],
  opts: { maxCostPerConv?: number; max?: number } = {},
): GoogleKeyword[] {
  const max = opts.max ?? 25;
  const cap = opts.maxCostPerConv ?? 25;
  const sorted = [...proven].sort((a, b) => b.conversions - a.conversions);
  const filtered = sorted.filter(
    (k) => k.costPerConv === null || k.costPerConv <= cap,
  );
  const out = (filtered.length >= 3 ? filtered : sorted).slice(0, max);
  return out.map((k) => ({
    text: k.text,
    matchType: k.matchType,
    reasoning: k.conversions > 0
      ? `Proven: ${k.conversions} conv, £${k.costPerConv?.toFixed(2) ?? "-"} CPA`
      : `Proven traffic: ${k.clicks} clicks`,
  }));
}
