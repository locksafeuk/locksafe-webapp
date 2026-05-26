/**
 * @deprecated SUPERSEDED — No longer used by competitor-intel agent.
 *
 * Replaced by: src/lib/serp-intelligence-client.ts (live SERP scans)
 *              src/lib/competitor-fingerprint.ts   (landing page analysis)
 *              src/lib/competitor-cross-validate.ts (keyword merging)
 *
 * Retained for reference. Safe to delete once the new stack is validated in
 * production. If you want to re-enable SEMrush as an optional data source,
 * import this client and feed its output into mergeIntelKeywords() alongside
 * the SERP results.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEMrush Advertising Research API Client
 *
 * Covers the three endpoints needed by the competitor-intel agent:
 *
 *   1. domain_adwords          — paid keywords a domain is currently bidding on
 *   2. domain_adwords_historical — historical ad copy per domain
 *   3. phrase_adwords           — keyword-level CPC, volume, competition index
 *
 * API reference: https://developer.semrush.com/api/v3/analytics/
 *
 * Authentication: SEMRUSH_API_KEY environment variable.
 * When the key is absent the client returns null from every method so the
 * competitor-intel agent degrades gracefully (runs in "SpyFu-only" mode or
 * skips entirely).
 *
 * Rate limits (free / Pro):
 *   - 10 requests / second
 *   - Each report row costs 1 API unit; domain_adwords ~ 10 units per domain
 * We add a 120ms inter-request delay to stay safely under the 10 rps cap.
 *
 * Country codes: SEMrush uses two-letter country codes (uk, us, au …).
 * "uk" maps to Great Britain in SEMrush terminology.
 */

const SEMRUSH_BASE = "https://api.semrush.com";
const REQUEST_DELAY_MS = 150; // ~6–7 req/s — well under the 10 rps cap

// ── Types ────────────────────────────────────────────────────────────────────

export interface SemrushPaidKeyword {
  keyword: string;
  /** Average CPC in the target currency (GBP for uk). */
  cpcGbp: number;
  /** Monthly search volume. */
  searchVolume: number;
  /** Competition index 0–100. */
  competitionIndex: number;
  /** Estimated number of paid clicks the domain gets for this keyword (alias: paidClicks). */
  monthlyClicks: number;
  /** Paid traffic share (0–1). */
  trafficShare: number;
  /** Average ad position (1–4 for top ads). */
  avgPosition: number;
}

export interface SemrushAdCopy {
  keyword: string;
  headline1: string;
  headline2?: string;
  headline3?: string;
  description1?: string;
  description2?: string;
  displayUrl?: string;
}

export interface SemrushDomainOverview {
  domain: string;
  /** Estimated monthly PPC traffic (paid clicks). */
  paidTraffic: number;
  /** Estimated monthly PPC spend (currency units — GBP for uk). */
  paidTrafficCost: number;
  /** Number of paid keywords. */
  paidKeywords: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse SEMrush's CSV-like pipe-delimited response.
 * First row is headers; subsequent rows are data.
 * Returns an array of column-keyed objects.
 */
function parseSemrushResponse(raw: string): Array<Record<string, string>> {
  const lines = raw.trim().split("\r\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cols = line.split(";");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (cols[i] ?? "").trim();
    });
    return obj;
  });
}

// ── Client class ─────────────────────────────────────────────────────────────

export class SemrushClient {
  private apiKey: string;
  private countryCode: string;

  constructor(apiKey: string, countryCode = "uk") {
    this.apiKey = apiKey;
    this.countryCode = countryCode;
  }

  // ── Private fetch helper ─────────────────────────────────────────────────

  private async fetchReport(
    type: string,
    params: Record<string, string | number>,
  ): Promise<Array<Record<string, string>>> {
    const url = new URL(SEMRUSH_BASE);
    url.searchParams.set("type", type);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("database", this.countryCode);
    url.searchParams.set("export_columns",
      this.defaultColumns(type));
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    url.searchParams.set("display_limit", "100");
    url.searchParams.set("export_escape", "1");

    const res = await fetch(url.toString(), {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `SEMrush API error ${res.status} for type=${type}: ${body.substring(0, 200)}`,
      );
    }

    const text = await res.text();
    // SEMrush returns "ERROR …" lines for invalid keys / no data
    if (text.startsWith("ERROR")) {
      const errCode = text.split("::")[1]?.trim() ?? text.substring(0, 80);
      // Code 50 = no data available (domain has no paid ads in this database)
      if (errCode.startsWith("50 ")) return [];
      throw new Error(`SEMrush report error: ${errCode}`);
    }

    await sleep(REQUEST_DELAY_MS);
    return parseSemrushResponse(text);
  }

  private defaultColumns(type: string): string {
    switch (type) {
      case "domain_adwords":
        return "Ph,Po,Nq,Cp,Tr,Tc,Co,Nr";
      //  Ph=keyword, Po=position, Nq=search_volume, Cp=cpc, Tr=traffic_share,
      //  Tc=paid_clicks, Co=competition, Nr=results
      case "domain_adwords_history":
        return "Ph,Dn,Ti,Ds,Ur";
      //  Ph=keyword, Dn=domain, Ti=title (headlines), Ds=description, Ur=url
      default:
        return "Ph,Nq,Cp,Co";
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetch the paid keywords a domain is currently (or recently) bidding on.
   * Returns up to 100 keywords sorted by traffic share desc.
   */
  async getDomainPaidKeywords(domain: string): Promise<SemrushPaidKeyword[]> {
    const rows = await this.fetchReport("domain_adwords", { domain });
    return rows.map((r) => ({
      keyword:          r["Keyword"] ?? r["Ph"] ?? "",
      cpcGbp:           parseFloat(r["CPC"] ?? r["Cp"] ?? "0") || 0,
      searchVolume:     parseInt(r["Search Volume"] ?? r["Nq"] ?? "0", 10) || 0,
      competitionIndex: Math.round((parseFloat(r["Competition"] ?? r["Co"] ?? "0") || 0) * 100),
      monthlyClicks:    parseInt(r["Traffic"] ?? r["Tc"] ?? "0", 10) || 0,
      trafficShare:     parseFloat(r["Traffic (%)"] ?? r["Tr"] ?? "0") || 0,
      avgPosition:      parseFloat(r["Position"] ?? r["Po"] ?? "1") || 1,
    })).filter((k) => k.keyword.length > 0);
  }

  /**
   * Fetch historical ad copy (headlines + descriptions) for a domain.
   * Returns up to 100 unique ads.
   */
  async getDomainAdCopy(domain: string): Promise<SemrushAdCopy[]> {
    const rows = await this.fetchReport("domain_adwords_history", { domain });
    return rows.map((r) => {
      const keyword = r["Keyword"] ?? r["Ph"] ?? "";
      const titleRaw = r["Title"] ?? r["Ti"] ?? "";
      const descRaw  = r["Description"] ?? r["Ds"] ?? "";
      const headlines = titleRaw.split("|").map((s: string) => s.trim()).filter(Boolean);
      const descs     = descRaw.split("|").map((s: string) => s.trim()).filter(Boolean);
      return {
        keyword,
        headline1:    headlines[0] ?? "",
        headline2:    headlines[1],
        headline3:    headlines[2],
        description1: descs[0],
        description2: descs[1],
        displayUrl:   r["Url"] ?? r["Ur"],
      };
    }).filter((a) => a.keyword.length > 0 && a.headline1.length > 0);
  }

  /**
   * High-level domain overview — estimated monthly PPC spend, traffic, keyword count.
   */
  async getDomainOverview(domain: string): Promise<SemrushDomainOverview | null> {
    const rows = await this.fetchReport("domain_adwords", { domain });
    if (rows.length === 0) return null;
    const totalTraffic = rows.reduce(
      (sum, r) => sum + (parseInt(r["Traffic"] ?? r["Tc"] ?? "0", 10) || 0),
      0,
    );
    const avgCpc = rows.reduce(
      (sum, r) => sum + (parseFloat(r["CPC"] ?? r["Cp"] ?? "0") || 0), 0,
    ) / (rows.length || 1);
    return {
      domain,
      paidTraffic:     totalTraffic,
      paidTrafficCost: totalTraffic * avgCpc,
      paidKeywords:    rows.length,
    };
  }
}

// ── Factory (reads env) ───────────────────────────────────────────────────────

/**
 * Build a SemrushClient from the SEMRUSH_API_KEY environment variable.
 * Returns null when the key is absent — callers must handle the null case.
 */
export function getSemrushClient(countryCode = "uk"): SemrushClient | null {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) return null;
  return new SemrushClient(key, countryCode);
}
