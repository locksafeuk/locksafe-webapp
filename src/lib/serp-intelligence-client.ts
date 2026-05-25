/**
 * Google SERP Intelligence Client
 *
 * Fetches live Google UK search results and extracts paid advertising data
 * for competitor analysis. Replaces the SEMrush + SpyFu API dependency with
 * a direct, real-time view of the search landscape.
 *
 * WHY THIS BEATS SEMRUSH / SPYFU:
 *   ✓ Real-time   — shows ads running RIGHT NOW, not cached 2-week-old snapshots
 *   ✓ Geo-accurate — city appended to query produces city-specific results
 *   ✓ Focused     — monitors YOUR keyword universe, not every keyword on earth
 *   ✓ Free        — no API cost, no per-row billing
 *   ✓ Ad-copy live — headline + description captured as actually shown today
 *   ✓ Organic too  — first five organic domains as a bonus signal
 *
 * Rate limiting: 1 request per 2 000 ms (30 req/min) — well within informal
 * Googlebot-adjacent tolerance. Max 150 requests per agent run (configurable).
 *
 * Usage:
 *   const client = new SerpIntelligenceClient();
 *   const result = await client.scanKeyword("emergency locksmith", "london");
 *   // result.ads[0].domain → "lockforce.co.uk"
 */

const REQUEST_DELAY_MS = 2_000;
const DEFAULT_MAX_REQUESTS = 150;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SerpAdResult {
  /** Bare domain extracted from the ad's display URL, e.g. "lockforce.co.uk". */
  domain: string;
  /** Ad rank position on the page — 1 = top. */
  position: number;
  /** Primary headline text. */
  headline: string;
  /** Ad body / description text. */
  description: string;
  /** Green display URL shown under the headline. */
  displayUrl: string;
  /** Sitelink extensions if detected. */
  sitelinks: string[];
}

export interface SerpScanResult {
  keyword: string;
  /** City / geo string appended to the query (e.g. "london"). */
  geo: string;
  scannedAt: Date;
  /** Paid ads found, in position order. */
  ads: SerpAdResult[];
  /** First five organic result domains (bonus signal — no PPC cost). */
  organicDomains: string[];
  /** Raw query sent to Google. */
  query: string;
  /**
   * True if the response looked like a bot block (CAPTCHA, "unusual traffic",
   * 429, suspiciously short HTML). Distinguishes "ad market is genuinely empty"
   * from "we got blocked and parsed nothing". Consumers should not interpret
   * blocked=true scans as evidence of no competitor activity.
   */
  blocked: boolean;
  /** If blocked, the reason — for logging / alerting / fallback routing. */
  blockReason?: "captcha" | "429" | "short_response" | "non_html" | "http_error" | "js_only_serp";
}

export interface SerpBatchSummary {
  /** keyword → list of competitor domains seen in paid ads across all geos scanned. */
  byKeyword: Map<string, Set<string>>;
  /** domain → list of keywords where that domain appeared in paid ads. */
  byDomain: Map<string, string[]>;
  /** All individual scan results. */
  results: SerpScanResult[];
  /** How many HTTP requests were used. */
  requestsUsed: number;
  /** How many requests came back blocked (CAPTCHA / 429 / etc.). */
  blockedCount: number;
  /**
   * blockedCount / requestsUsed. Consumers should treat > 0.5 as a "Google
   * is blocking us, results are unreliable, alert operations" signal and
   * skip persisting any "competitor went silent" decisions this run.
   */
  blockedRate: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract the bare domain from a display URL string.
 * Handles: "lockforce.co.uk/emergency", "www.lockforce.co.uk › london" etc.
 */
export function extractDomainFromDisplayUrl(displayUrl: string): string {
  if (!displayUrl) return "";
  // Strip protocol, www., path separators (› / \)
  const cleaned = displayUrl
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/›\\?#]/)[0]
    .trim()
    .toLowerCase();
  return cleaned;
}

/**
 * Parse Google SERP HTML and return all sponsored (paid) ad units found.
 *
 * Strategy: Google marks paid ads in several stable ways —
 *   1. A <span> containing exactly the text "Sponsored"
 *   2. data-text-ad attributes on container divs
 *   3. The aria-label "Ads" on a result-set container
 *
 * We chunk the HTML around these markers, then extract headline (h3 text),
 * display URL (the green cite-like element), and description.
 *
 * This is intentionally tolerant — Google changes class names frequently but
 * the structural patterns (h3 headline, cite/span display URL, description
 * paragraph) have been stable for years.
 */
export function parseSponsoredAds(html: string): SerpAdResult[] {
  const ads: SerpAdResult[] = [];

  // ── Step 1: Find all ad blocks ───────────────────────────────────────────
  // Each paid ad block contains the word "Sponsored" somewhere inside it.
  // We identify ad container boundaries by looking for data-text-ad or the
  // Google "Ads" section aria label, then split into individual ad units.

  // Split the document at every opening <div that starts a top-level result.
  // We use a lookahead pattern to find div openings near "Sponsored" text.

  // Approach: extract all "Sponsored" regions by scanning for the label and
  // collecting the enclosing block (bounded by balanced div depth).
  const sponsoredBlocks = extractSponsoredBlocks(html);

  for (let i = 0; i < sponsoredBlocks.length; i++) {
    const block = sponsoredBlocks[i];
    const headline   = extractHeadline(block);
    const displayUrl = extractDisplayUrl(block);
    const description = extractDescription(block, headline);
    const sitelinks  = extractSitelinks(block);
    const domain     = extractDomainFromDisplayUrl(displayUrl);

    if (!headline || !domain) continue; // Skip malformed blocks

    ads.push({
      domain,
      position:    i + 1,
      headline,
      description,
      displayUrl,
      sitelinks,
    });
  }

  return ads;
}

/**
 * Split SERP HTML into individual "sponsored" content blocks, one per ad unit.
 * Returns raw HTML strings, one per ad.
 */
function extractSponsoredBlocks(html: string): string[] {
  const blocks: string[] = [];

  // Pattern A: data-text-ad attribute (most reliable marker).
  // Each top-level ad container in Google has this attribute. We find the
  // matching balanced </div> for each opener so the block covers exactly
  // that ad — no overlap with siblings (which would let a malformed ad
  // borrow the next ad's headline) and no over-reach into organic results
  // sitting below the last ad.
  const dataTextAdRe = /(<div[^>]+data-text-ad[^>]*>)/gi;
  const dataMatches  = [...html.matchAll(dataTextAdRe)];

  if (dataMatches.length > 0) {
    for (let i = 0; i < dataMatches.length; i++) {
      const start = dataMatches[i].index ?? 0;
      const balancedEnd = findBalancedDivEnd(html, start);
      const nextStart   = i + 1 < dataMatches.length
        ? (dataMatches[i + 1].index ?? html.length)
        : html.length;
      // Cap at the next ad's start so even a missing closing tag can't
      // bleed past the boundary.
      blocks.push(html.slice(start, Math.min(balancedEnd, nextStart)));
    }
    return blocks;
  }

  // Pattern B: "Sponsored" text — use indexOf to avoid zero-width lookahead
  // infinite loop when using exec() with the g flag on zero-width assertions.
  const htmlLower = html.toLowerCase();
  const seen = new Set<string>();
  let pos = 0;
  while (true) {
    pos = htmlLower.indexOf("sponsored", pos);
    if (pos === -1) break;
    const start = Math.max(0, pos - 500);
    const chunk = html.slice(start, Math.min(html.length, pos + 3_500));
    // Deduplicate — adjacent markers often share context
    const key = chunk.slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      blocks.push(chunk);
    }
    pos += 9; // advance past "sponsored"
  }

  return blocks;
}

/** Extract the primary headline from an ad block. */
function extractHeadline(block: string): string {
  // Pattern A: <h3> — classic Google desktop layout (still dominant 2024-2026).
  const h3 = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block);
  if (h3) return stripTags(h3[1]).trim();

  // Pattern B: <div role="heading"> — used in some 2024+ test variants and
  // on mobile. Google A/B-tests heading semantics frequently.
  const roleH = /<div[^>]+role=["']heading["'][^>]*>([\s\S]*?)<\/div>/i.exec(block);
  if (roleH) return stripTags(roleH[1]).trim();

  // Pattern C: <span> nested inside an <a> with aria-level — another modern
  // accessibility-driven layout.
  const ariaSpan = /<span[^>]+aria-level=["']\d["'][^>]*>([\s\S]*?)<\/span>/i.exec(block);
  if (ariaSpan) return stripTags(ariaSpan[1]).trim();

  // Fallback: first <strong> or <b> with non-trivial content.
  const strong = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i.exec(block);
  if (strong) {
    const txt = stripTags(strong[1]).trim();
    if (txt.length >= 6) return txt;
  }

  return "";
}

/**
 * Extract the green display URL from an ad block.
 *
 * Google's markup has drifted significantly:
 *   • Until ~2023: <cite>display.url</cite>
 *   • Until ~2024: data-pcu="https://..." on the ad container
 *   • 2025-2026:  no <cite>, no data-pcu — the URL is rendered as plain
 *                 text after the brand name (e.g. "https://www.lockforce.co.uk
 *                 › manchester › emergency"), and the first <a href> points
 *                 at "/url?q=ENCODED_REAL_URL&..." (Google click-tracker).
 *
 * We try each, in order, accepting the first match. The plain-text fallback
 * is what 2026-rendered ads actually carry.
 */
function extractDisplayUrl(block: string): string {
  // Pattern A: <cite> — classic display URL container.
  const cite = /<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(block);
  if (cite) return stripTags(cite[1]).trim();

  // Pattern B: data-pcu attribute (deprecated but still seen on some test buckets).
  const pcu = /data-pcu=["']([^"']+)["']/i.exec(block);
  if (pcu) return pcu[1].trim();

  // Pattern C: any visible URL-shaped string in the block — covers the
  // 2025-2026 layout where the URL is just rendered text.
  const url = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:co\.uk|uk|com|net|org)[^\s"'<›]{0,80})/i
    .exec(block);
  if (url) return url[0].trim();

  return "";
}

/**
 * Unwrap Google's click-tracking redirect URLs.
 * Google's ad anchors point at "/url?q=ENCODED_REAL_URL&sa=..." or
 * "https://www.googleadservices.com/pagead/aclk?...&adurl=ENCODED_URL".
 * If we naively extract the domain from those, we get "google.co.uk" for
 * every ad. This unwraps to the real destination.
 */
export function unwrapGoogleRedirect(href: string): string {
  if (!href) return href;
  try {
    const u = href.startsWith("/") ? new URL(href, "https://www.google.co.uk") : new URL(href);
    // /url?q=... or /url?url=...
    if (u.pathname === "/url" || u.pathname.endsWith("/url")) {
      const target = u.searchParams.get("q") || u.searchParams.get("url");
      if (target) return target;
    }
    // googleadservices /pagead/aclk?...&adurl=...
    if (u.hostname.endsWith("googleadservices.com") || u.hostname.endsWith("google.com") || u.hostname.endsWith("google.co.uk")) {
      const target = u.searchParams.get("adurl") || u.searchParams.get("q") || u.searchParams.get("url");
      if (target) return target;
    }
  } catch {
    // Not a parseable URL — fall through
  }
  return href;
}

/** Extract the ad description (the paragraph text below the display URL). */
function extractDescription(block: string, headline: string): string {
  // Remove the headline portion and look for a plain paragraph
  const withoutH3 = block.replace(/<h3[\s\S]*?<\/h3>/i, "");
  // Find first substantial text run (>20 chars) after stripping tags
  const stripped = stripTags(withoutH3);
  const lines = stripped
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && l !== headline && !/^Sponsored$/i.test(l));
  return lines[0] ?? "";
}

/** Extract sitelink text from an ad block. */
function extractSitelinks(block: string): string[] {
  // Sitelinks appear as short anchor texts, often in a list after the main ad
  const sitelinkRe = /<a[^>]+>([\s\S]*?)<\/a>/gi;
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = sitelinkRe.exec(block)) !== null) {
    const text = stripTags(m[1]).trim();
    // Sitelink texts are short (2–40 chars), not URLs, not "Sponsored"
    if (text.length >= 2 && text.length <= 40 && !/sponsored|http/i.test(text)) {
      links.push(text);
    }
  }
  // Deduplicate and limit to 6
  return [...new Set(links)].slice(0, 6);
}

/** Parse the first 5 organic (non-sponsored) result domains. */
export function parseOrganicDomains(html: string): string[] {
  const domains: string[] = [];

  // Strip sponsored blocks precisely. Earlier versions removed 4 000 chars
  // after every "Sponsored" token, which eats organic results when a single
  // ad sits above them. Now we use the same balanced-div extraction as the
  // ad parser so the strip is exactly the ad's range.
  const dataMatches = [...html.matchAll(/(<div[^>]+data-text-ad[^>]*>)/gi)];
  let withoutAds = html;

  if (dataMatches.length > 0) {
    // Walk from the end so prior splice offsets stay valid.
    for (let i = dataMatches.length - 1; i >= 0; i--) {
      const start = dataMatches[i].index ?? 0;
      const end   = findBalancedDivEnd(withoutAds, start);
      withoutAds  = withoutAds.slice(0, start) + withoutAds.slice(end);
    }
  } else {
    // No data-text-ad markers: bounded fallback that removes just the
    // immediate sponsored block up to the next </div>, capped at 2 000 chars.
    withoutAds = html.replace(/Sponsored[\s\S]{0,2000}?<\/div>/gi, "");
  }

  const citeRe = /<cite[^>]*>([\s\S]*?)<\/cite>/gi;
  let m: RegExpExecArray | null;
  while ((m = citeRe.exec(withoutAds)) !== null && domains.length < 5) {
    const domain = extractDomainFromDisplayUrl(stripTags(m[1]));
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

/** Strip all HTML tags from a string. */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Find the offset of the closing </div> that balances the <div> starting at
 * `start`. Counts nested divs. Returns the offset just after the closing tag,
 * or a 4 000-char cap if the opener is unbalanced. Used to extract per-ad
 * HTML ranges without overlapping siblings or eating organic results.
 */
function findBalancedDivEnd(html: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html[i] === "<") {
      // Match <div ...> (opener, possibly self-closing-style though unused here)
      if (/^<div\b/i.test(html.slice(i, i + 5))) {
        depth++;
        i += 4;
        continue;
      }
      // Match </div>
      if (/^<\/div>/i.test(html.slice(i, i + 6))) {
        depth--;
        i += 6;
        if (depth <= 0) return i;
        continue;
      }
    }
    i++;
  }
  return Math.min(html.length, start + 4_000);
}

// ── Client class ─────────────────────────────────────────────────────────────

/**
 * Optional hook for a JS-executing fetcher (Playwright, Puppeteer, SerpAPI,
 * etc.). If set, scanKeyword() uses it instead of the raw HTTP fetch when
 * the raw fetch returns a `js_only_serp` blocked result.
 *
 * Production wiring example (Playwright):
 *
 *   import { chromium } from "playwright";
 *   setRenderedFetcher(async (query) => {
 *     const browser = await chromium.launch();
 *     const page    = await browser.newPage();
 *     await page.goto(`https://www.google.co.uk/search?q=${encodeURIComponent(query)}`);
 *     await page.waitForSelector("[data-text-ad]", { timeout: 5_000 }).catch(() => null);
 *     const html = await page.content();
 *     await browser.close();
 *     return html;
 *   });
 *
 * Until set, JS-only SERP responses are returned with blocked=true so the
 * agent knows the scan was inconclusive and doesn't false-record "competitor
 * went silent" from a tooling gap.
 */
export type RenderedFetcher = (query: string) => Promise<string>;
let renderedFetcher: RenderedFetcher | null = null;
export function setRenderedFetcher(fetcher: RenderedFetcher | null): void {
  renderedFetcher = fetcher;
}
export function getRenderedFetcher(): RenderedFetcher | null {
  return renderedFetcher;
}

export class SerpIntelligenceClient {
  private requestsUsed = 0;
  private maxRequests: number;

  constructor(maxRequests = DEFAULT_MAX_REQUESTS) {
    this.maxRequests = maxRequests;
  }

  // ── Private fetch ────────────────────────────────────────────────────────

  /**
   * Detect whether a Google response is a bot-block / CAPTCHA / sorry page
   * or a JS-only shell rather than a real SERP. Returns the reason string,
   * or null if the response looks like a fully-rendered SERP.
   *
   * Google's block responses include:
   *   • https://www.google.com/sorry/... redirects with reCAPTCHA
   *   • "Our systems have detected unusual traffic from your computer network"
   *   • Very small HTML (< 5 KB) — a real SERP is typically 200-800 KB
   *   • text/plain Content-Type instead of text/html
   *
   * JS-only shell: Google increasingly ships an SSR skeleton that loads
   * paid ads (and many organic results) via JavaScript after page render.
   * A raw HTTP fetch sees the shell but no ads. We detect this by checking
   * for the data-text-ad attribute marker: if the response is healthy
   * length but contains zero "data-text-ad" substrings, the ads haven't
   * been hydrated and the scan is inconclusive — not "no ads in market".
   *
   * Production note: to actually capture ads in 2026, you need to fetch
   * with a JS-executing engine (Playwright / Puppeteer). The blocked flag
   * lets the agent record "we tried but couldn't see ads" without falsely
   * marking the auction as silent.
   */
  private static classifyBlock(
    html: string,
    contentType: string,
    httpStatus: number,
  ): SerpScanResult["blockReason"] | null {
    if (httpStatus === 429)                              return "429";
    if (httpStatus >= 400)                                return "http_error";
    if (contentType && !/text\/html/i.test(contentType)) return "non_html";
    if (html.length < 5_000)                              return "short_response";
    if (/sorry\/index|unusual\s+traffic|recaptcha|g-recaptcha|"captchaSitekey"|captcha-form/i
        .test(html))                                      return "captcha";
    // JS-shell detection: Google's SSR no longer includes paid ad blocks.
    // If the response is otherwise healthy but has no data-text-ad markers,
    // we got the shell — not the ads-rendered version.
    if (!/data-text-ad/i.test(html))                      return "js_only_serp";
    return null;
  }

  /**
   * Fetch a SERP page and classify whether it's a real result or a bot block.
   * Returns { html, blocked, blockReason } — the caller decides whether to
   * parse, retry, or alert. Never throws for "got blocked" cases — those are
   * normal-and-expected operational states, not exceptional ones.
   */
  private async fetchSerpHtml(query: string): Promise<{
    html: string;
    blocked: boolean;
    blockReason?: SerpScanResult["blockReason"];
  }> {
    const url = new URL("https://www.google.co.uk/search");
    url.searchParams.set("q", query);
    url.searchParams.set("num", "20");     // Up to 20 results
    url.searchParams.set("hl", "en");      // English UI
    url.searchParams.set("gl", "gb");      // Country: United Kingdom
    url.searchParams.set("pws", "0");      // Disable personalisation
    url.searchParams.set("safe", "off");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      // Network-level failure (DNS, timeout, TLS) — treated as http_error so
      // the caller can record `blocked=true` and move on without crashing the
      // batch. The error message is logged but not thrown.
      console.warn(`[serp-intelligence] network error for "${query}":`,
        err instanceof Error ? err.message : err);
      this.requestsUsed++;
      await sleep(REQUEST_DELAY_MS);
      return { html: "", blocked: true, blockReason: "http_error" };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const html = await res.text();
    const reason = SerpIntelligenceClient.classifyBlock(html, contentType, res.status);

    this.requestsUsed++;
    await sleep(REQUEST_DELAY_MS);

    if (reason) {
      console.warn(
        `[serp-intelligence] blocked query "${query}" — reason=${reason}, ` +
        `status=${res.status}, html=${html.length} bytes`,
      );
      return { html, blocked: true, blockReason: reason };
    }

    return { html, blocked: false };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Scan a single keyword + geo combination.
   * The geo string is appended to the keyword as natural language:
   * keyword="emergency locksmith", geo="london" → query="emergency locksmith london"
   */
  async scanKeyword(keyword: string, geo: string): Promise<SerpScanResult> {
    if (this.requestsUsed >= this.maxRequests) {
      throw new Error(
        `SerpIntelligenceClient: maxRequests (${this.maxRequests}) reached. ` +
        `Reduce batch size or increase limit.`,
      );
    }

    const query = geo ? `${keyword} ${geo}` : keyword;
    let { html, blocked, blockReason } = await this.fetchSerpHtml(query);

    // JS-only-shell escalation: if the raw fetch returned a healthy but
    // ad-stripped response AND a rendered fetcher is configured, retry
    // through the JS-executing path. The renderedFetcher is provided by
    // the host application (Playwright / SerpAPI wrapper / etc.).
    if (blocked && blockReason === "js_only_serp" && renderedFetcher) {
      try {
        const rendered = await renderedFetcher(query);
        // Re-classify — the rendered fetch might itself fail or come back
        // CAPTCHA'd.
        const reason = SerpIntelligenceClient.classifyBlock(
          rendered, "text/html", 200,
        );
        if (!reason) {
          html        = rendered;
          blocked     = false;
          blockReason = undefined;
        }
      } catch (err) {
        console.warn(`[serp-intelligence] rendered fetcher failed for "${query}":`,
          err instanceof Error ? err.message : err);
      }
    }

    // When blocked we still return a valid SerpScanResult — but with empty
    // ads/organic arrays and blocked=true so the merge layer knows not to
    // interpret silence as evidence of an empty ad market.
    if (blocked) {
      return {
        keyword,
        geo,
        scannedAt: new Date(),
        ads: [],
        organicDomains: [],
        query,
        blocked: true,
        blockReason,
      };
    }

    const ads = parseSponsoredAds(html);
    const organicDomains = parseOrganicDomains(html);

    return {
      keyword,
      geo,
      scannedAt: new Date(),
      ads,
      organicDomains,
      query,
      blocked: false,
    };
  }

  /**
   * Scan a list of keywords against a single geo.
   * Stops early if maxRequests is reached.
   * Returns a structured summary in addition to raw results.
   */
  async scanBatch(
    keywords: string[],
    geo: string,
  ): Promise<SerpBatchSummary> {
    const results: SerpScanResult[] = [];
    const byKeyword  = new Map<string, Set<string>>();
    const byDomain   = new Map<string, string[]>();
    let blockedCount = 0;

    for (const kw of keywords) {
      if (this.requestsUsed >= this.maxRequests) break;
      try {
        const result = await this.scanKeyword(kw, geo);
        results.push(result);
        if (result.blocked) blockedCount++;

        // Aggregate byKeyword
        const domains = result.ads.map((a) => a.domain).filter(Boolean);
        byKeyword.set(kw, new Set(domains));

        // Aggregate byDomain
        for (const domain of domains) {
          const existing = byDomain.get(domain) ?? [];
          existing.push(kw);
          byDomain.set(domain, existing);
        }
      } catch (err) {
        // Log but continue — one failed scan shouldn't abort the batch
        console.error(`[serp-intelligence] scanKeyword failed for "${kw}" / "${geo}":`, err);
      }
    }

    return {
      byKeyword,
      byDomain,
      results,
      requestsUsed: this.requestsUsed,
      blockedCount,
      blockedRate: this.requestsUsed > 0 ? blockedCount / this.requestsUsed : 0,
    };
  }

  /**
   * Scan a list of keywords across multiple geos.
   * Useful for detecting geo-specific bidding patterns.
   * Total requests = keywords.length × geos.length (capped by maxRequests).
   */
  async scanMultiGeo(
    keywords: string[],
    geos: string[],
  ): Promise<SerpBatchSummary> {
    const results: SerpScanResult[] = [];
    const byKeyword  = new Map<string, Set<string>>();
    const byDomain   = new Map<string, string[]>();
    let blockedCount = 0;

    for (const geo of geos) {
      for (const kw of keywords) {
        if (this.requestsUsed >= this.maxRequests) break;
        try {
          const result = await this.scanKeyword(kw, geo);
          results.push(result);
          if (result.blocked) blockedCount++;

          const domains = result.ads.map((a) => a.domain).filter(Boolean);
          const existing = byKeyword.get(kw) ?? new Set<string>();
          domains.forEach((d) => existing.add(d));
          byKeyword.set(kw, existing);

          for (const domain of domains) {
            const kws = byDomain.get(domain) ?? [];
            const entry = `${kw} [${geo}]`;
            kws.push(entry);
            byDomain.set(domain, kws);
          }
        } catch (err) {
          console.error(`[serp-intelligence] scan failed for "${kw}" / "${geo}":`, err);
        }
      }
    }

    return {
      byKeyword,
      byDomain,
      results,
      requestsUsed: this.requestsUsed,
      blockedCount,
      blockedRate: this.requestsUsed > 0 ? blockedCount / this.requestsUsed : 0,
    };
  }

  get requestCount(): number {
    return this.requestsUsed;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Build a SerpIntelligenceClient with an optional request cap.
 * Override the cap via SERP_MAX_REQUESTS env var.
 */
export function getSerpIntelligenceClient(): SerpIntelligenceClient {
  const cap = parseInt(process.env.SERP_MAX_REQUESTS ?? "150", 10) || DEFAULT_MAX_REQUESTS;
  return new SerpIntelligenceClient(cap);
}

// ── Locksmith keyword templates ───────────────────────────────────────────────

/**
 * The core keyword templates for the UK locksmith market.
 * Combine with city names (see UK_INTEL_CITIES) to generate the full
 * keyword universe to monitor.
 */
export const LOCKSMITH_KEYWORD_TEMPLATES: string[] = [
  "emergency locksmith",
  "locksmith near me",
  "24 hour locksmith",
  "locksmith locked out",
  "lock change",
  "lock replacement",
  "upvc door lock repair",
  "composite door lock repair",
  "yale lock replacement",
  "mortice lock replacement",
  "car locksmith",
  "auto locksmith",
  "commercial locksmith",
  "landlord lock change",
  "eviction locksmith",
];

/**
 * UK cities to scan, paired with their geoId for cross-referencing
 * with CompetitorGeoSignal in the database.
 */
export const UK_INTEL_CITIES: Array<{ city: string; geoId: string }> = [
  { city: "london",        geoId: "london" },
  { city: "birmingham",    geoId: "birmingham" },
  { city: "manchester",    geoId: "manchester" },
  { city: "leeds",         geoId: "leeds" },
  { city: "sheffield",     geoId: "sheffield" },
  { city: "liverpool",     geoId: "liverpool" },
  { city: "bristol",       geoId: "bristol" },
  { city: "leicester",     geoId: "leicester" },
  { city: "nottingham",    geoId: "nottingham" },
  { city: "coventry",      geoId: "coventry" },
  { city: "hull",          geoId: "hull" },
  { city: "bradford",      geoId: "bradford" },
  { city: "stoke",         geoId: "stoke" },
  { city: "wolverhampton", geoId: "wolverhampton" },
  { city: "derby",         geoId: "derby" },
  { city: "reading",       geoId: "reading" },
  { city: "luton",         geoId: "luton" },
  { city: "milton keynes", geoId: "milton-keynes" },
  { city: "southampton",   geoId: "southampton" },
  { city: "plymouth",      geoId: "plymouth" },
  { city: "edinburgh",     geoId: "edinburgh" },
];
