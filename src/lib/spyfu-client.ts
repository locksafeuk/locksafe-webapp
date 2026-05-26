/**
 * @deprecated SUPERSEDED — No longer used by competitor-intel agent.
 *
 * Replaced by: src/lib/serp-intelligence-client.ts (live SERP scans)
 *              src/lib/competitor-fingerprint.ts   (landing page analysis)
 *              src/lib/competitor-cross-validate.ts (keyword merging)
 *
 * The crossValidateKeywords() export at the bottom of this file is preserved
 * because it is referenced in the test runner (run-scout-scenarios.ts).
 * The new equivalent is mergeIntelKeywords() in competitor-cross-validate.ts.
 *
 * Safe to delete this file once test runner is fully migrated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SpyFu Paid Keywords API Client
 *
 * SpyFu specialises in historical PPC data — it shows keywords a domain has
 * *ever* bought ads on, not just current active keywords. This makes it
 * complementary to SEMrush: SEMrush gives current snapshot, SpyFu gives
 * the long-term keyword history.
 *
 * Endpoints used:
 *   1. /apis/keyword_api/v2/paid/getByDomain    — all paid keywords for a domain
 *   2. /apis/domain_stats_api/v2/getDomainStats — domain-level PPC summary
 *
 * API reference: https://www.spyfu.com/api/core
 *
 * Authentication: SPYFU_API_KEY environment variable.
 * When absent the client returns null — agent degrades to SEMrush-only.
 *
 * Rate limits:
 *   - 100 requests / minute on paid plans
 *   - We add a 700ms inter-request delay (≈85 req/min) to stay safe.
 *
 * Currency: SpyFu returns USD by default; we apply a fixed GBP/USD exchange
 * rate (configurable via env SPYFU_USD_GBP_RATE, default 0.80).
 */

const SPYFU_BASE = "https://www.spyfu.com";
const REQUEST_DELAY_MS = 700;
const DEFAULT_USD_GBP = 0.80;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpyFuPaidKeyword {
  keyword:          string;
  /** CPC in GBP (converted from USD). */
  cpcGbp:           number;
  /** Estimated monthly clicks. */
  monthlyClicks:    number;
  /** Estimated monthly cost in GBP. */
  monthlyCostGbp:   number;
  /** Is the domain actively bidding right now? */
  isActive:         boolean;
  /** How many months in the last 12 did the domain bid on this keyword? */
  monthsActive:     number;
  /** Broad / Exact / Phrase */
  matchType?:       string;
}

export interface SpyFuDomainStats {
  domain:            string;
  totalPaidKeywords: number;
  /** Estimated monthly paid budget (GBP). */
  monthlyBudgetGbp:  number;
  /** Estimated monthly paid clicks. */
  monthlyClicks:     number;
  /** Number of currently active paid keywords. */
  activeKeywords:    number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function usdToGbp(usd: number, rate: number): number {
  return Math.round(usd * rate * 100) / 100;
}

// ── Client class ─────────────────────────────────────────────────────────────

export class SpyFuClient {
  private apiKey: string;
  private usdGbpRate: number;

  constructor(apiKey: string, usdGbpRate = DEFAULT_USD_GBP) {
    this.apiKey  = apiKey;
    this.usdGbpRate = usdGbpRate;
  }

  // ── Private fetch helper ─────────────────────────────────────────────────

  private async fetchJson<T>(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<T | null> {
    const url = new URL(`${SPYFU_BASE}${path}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 404) return null; // domain not in SpyFu's index
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `SpyFu API error ${res.status} for ${path}: ${body.substring(0, 200)}`,
      );
    }

    await sleep(REQUEST_DELAY_MS);
    return res.json() as Promise<T>;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetch all paid keywords SpyFu has recorded for a domain.
   * Returns up to 100 results sorted by monthly cost desc.
   */
  async getDomainPaidKeywords(domain: string): Promise<SpyFuPaidKeyword[]> {
    interface SpyFuKwResponse {
      results?: Array<{
        keyword:       string;
        avgAdPosition: number;
        monthlyBudget: number; // USD
        clicks:        number;
        isActive:      boolean;
        totalMonths:   number;
        matchType?:    string;
        cpc?:          number; // USD
      }>;
    }

    const data = await this.fetchJson<SpyFuKwResponse>(
      "/apis/keyword_api/v2/paid/getByDomain",
      { domain, numResults: 100, startingRow: 1 },
    );
    if (!data?.results) return [];

    return data.results
      .map((r) => ({
        keyword:        r.keyword ?? "",
        cpcGbp:         usdToGbp(r.cpc ?? 0, this.usdGbpRate),
        monthlyClicks:  r.clicks ?? 0,
        monthlyCostGbp: usdToGbp(r.monthlyBudget ?? 0, this.usdGbpRate),
        isActive:       r.isActive ?? false,
        monthsActive:   r.totalMonths ?? 0,
        matchType:      r.matchType,
      }))
      .filter((k) => k.keyword.length > 0);
  }

  /**
   * Fetch high-level PPC stats for a domain.
   */
  async getDomainStats(domain: string): Promise<SpyFuDomainStats | null> {
    interface SpyFuStatsResponse {
      domain?:           string;
      totalAdKeywords?:  number;
      monthlyAdsBudget?: number; // USD
      adClicks?:         number;
      adKeywordsHist?:   number;
    }

    const data = await this.fetchJson<SpyFuStatsResponse>(
      "/apis/domain_stats_api/v2/getDomainStats",
      { domain },
    );
    if (!data) return null;

    return {
      domain:            data.domain ?? domain,
      totalPaidKeywords: data.totalAdKeywords ?? 0,
      monthlyBudgetGbp:  usdToGbp(data.monthlyAdsBudget ?? 0, this.usdGbpRate),
      monthlyClicks:     data.adClicks ?? 0,
      activeKeywords:    data.adKeywordsHist ?? 0,
    };
  }
}

// ── Factory (reads env) ───────────────────────────────────────────────────────

/**
 * Build a SpyFuClient from SPYFU_API_KEY + optional SPYFU_USD_GBP_RATE env vars.
 * Returns null when the key is absent.
 */
export function getSpyFuClient(): SpyFuClient | null {
  const key = process.env.SPYFU_API_KEY;
  if (!key) return null;
  const rate = parseFloat(process.env.SPYFU_USD_GBP_RATE ?? "0.80") || 0.80;
  return new SpyFuClient(key, rate);
}

// ── Cross-validation helper ───────────────────────────────────────────────────

/**
 * Given two keyword lists (SEMrush + SpyFu), returns a merged set with a
 * `dualSource` flag on keywords that appear in both.
 *
 * "Appearing in both" = keyword text matches after normalisation (lowercase,
 * trim). When both sources agree on a keyword, confidence is high — it's a
 * live, intentional bid by the competitor, not sampling noise.
 */
export interface MergedCompetitorKeyword {
  keyword:          string;
  /** CPC: prefer SEMrush (more current) but fall back to SpyFu. */
  cpcGbp:           number;
  monthlyClicks:    number;
  competitionIndex: number;
  avgPosition:      number;
  /** True when both SEMrush AND SpyFu reported this keyword. */
  dualSource:       boolean;
  /** Monthly activity months from SpyFu (0 if not in SpyFu). */
  monthsActive:     number;
  /** Whether SpyFu reports this as currently active. */
  spyfuActive:      boolean;
}

export function crossValidateKeywords(
  semrushKeywords: Array<{ keyword: string; cpcGbp: number; monthlyClicks: number; competitionIndex: number; avgPosition: number }>,
  spyfuKeywords:   Array<{ keyword: string; cpcGbp: number; monthlyClicks: number; monthsActive: number; isActive: boolean }>,
): MergedCompetitorKeyword[] {
  const normalize = (k: string) => k.toLowerCase().trim();

  const spyfuMap = new Map<string, typeof spyfuKeywords[0]>();
  for (const sk of spyfuKeywords) {
    spyfuMap.set(normalize(sk.keyword), sk);
  }

  const semrushMap = new Map<string, typeof semrushKeywords[0]>();
  for (const sr of semrushKeywords) {
    semrushMap.set(normalize(sr.keyword), sr);
  }

  const merged: MergedCompetitorKeyword[] = [];
  const seen = new Set<string>();

  // Process SEMrush keywords first
  for (const sr of semrushKeywords) {
    const norm = normalize(sr.keyword);
    const sf   = spyfuMap.get(norm);
    seen.add(norm);
    merged.push({
      keyword:          sr.keyword,
      cpcGbp:           sr.cpcGbp > 0 ? sr.cpcGbp : (sf?.cpcGbp ?? 0),
      monthlyClicks:    sr.monthlyClicks,
      competitionIndex: sr.competitionIndex,
      avgPosition:      sr.avgPosition,
      dualSource:       !!sf,
      monthsActive:     sf?.monthsActive ?? 0,
      spyfuActive:      sf?.isActive ?? false,
    });
  }

  // Add SpyFu-only keywords (SEMrush may not have them if they're historical)
  for (const sf of spyfuKeywords) {
    const norm = normalize(sf.keyword);
    if (seen.has(norm)) continue;
    merged.push({
      keyword:          sf.keyword,
      cpcGbp:           sf.cpcGbp,
      monthlyClicks:    sf.monthlyClicks,
      competitionIndex: 0, // unknown — not in SEMrush
      avgPosition:      0,
      dualSource:       false,
      monthsActive:     sf.monthsActive,
      spyfuActive:      sf.isActive,
    });
  }

  // Sort: dual-source first, then by monthly clicks desc
  return merged.sort((a, b) => {
    if (a.dualSource !== b.dualSource) return a.dualSource ? -1 : 1;
    return b.monthlyClicks - a.monthlyClicks;
  });
}
