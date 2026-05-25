/**
 * Competitor Fingerprint Client
 *
 * Fetches competitor homepages (and optionally key inner pages) and extracts
 * rich intelligence signals that SEMrush / SpyFu simply don't provide:
 *
 *   ✓ PPC tracking signals — CallRail, WhatConverts, Google Ads conversion IDs
 *     (AW-xxxxx) confirm the competitor IS running paid ads, even before any
 *     SERP scan spots them. A domain with Google Ads conversion tracking but
 *     not showing up in SERPs is probably geo-limiting or dayparting.
 *
 *   ✓ MLA / trust badges — Master Locksmiths Association membership is a
 *     competitive differentiator; knowing which rivals have it shapes copy.
 *
 *   ✓ Price anchors — "from £49", "starting at £65" signal their pricing floor.
 *
 *   ✓ Service-area breadth — do they have dedicated city landing pages?
 *     /locksmith-london, /locksmith-birmingham etc. = national player.
 *
 *   ✓ 24/7 emphasis — whether they lead with emergency / after-hours messaging.
 *
 * All HTTP fetches use a polite 1.5 s delay. Results are cached in-memory
 * for the duration of one agent run to avoid re-fetching the same domain.
 */

const REQUEST_DELAY_MS = 1_500;

/**
 * Inner pages we'll crawl after the homepage to gather signals that splash
 * pages don't carry. Verified against real UK locksmith competitor sites:
 *   - /about-us, /about: nationwide claims, MLA / DBS / insurance copy
 *   - /pricing, /prices, /price-list: price anchors (homepages rarely have prices)
 *   - /locksmith-services, /services: service-area scope
 *   - /locations, /service-areas, /areas-we-cover: city pages
 *   - /contact, /contact-us: phone numbers, call-tracking widgets
 *
 * Tried in order until INNER_PAGE_LIMIT successful (HTTP 200 + non-empty)
 * fetches are collected. Each fetch obeys REQUEST_DELAY_MS.
 */
const INNER_PAGE_CANDIDATES = [
  "/about-us/", "/about/", "/about-us", "/about",
  "/pricing/", "/pricing", "/prices/", "/prices", "/price-list",
  "/locksmith-services/", "/services/", "/services",
  "/locations/", "/locations", "/service-areas/", "/areas-we-cover/", "/coverage/",
  "/contact/", "/contact-us/",
];
const INNER_PAGE_LIMIT = 4;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorFingerprint {
  domain: string;
  scannedAt: Date;
  /** HTTP status code of the homepage fetch. */
  httpStatus: number;
  /**
   * True if the fetch failed (network/timeout) or returned a Cloudflare
   * challenge / bot-block / JS-only shell with no usable content. When
   * blocked=true, all signal flags are false because we never saw the real
   * page — don't interpret as "the competitor has no MLA / no PPC tracking".
   */
  blocked: boolean;
  /** If blocked, the reason — for ops alerting / fallback routing. */
  blockReason?:
    | "network_error"
    | "http_error"
    | "cloudflare_challenge"
    | "js_only_shell"
    | "non_html"
    | "empty_response";

  /**
   * Raw plain text from title + meta + h1 (lowercased, whitespace-normalised).
   * Used by the cross-validator for phrase / substring matching that doesn't
   * suffer from the tokenisation's length filter (e.g. "24/7" survives here
   * even though it's lost by tokenise()).
   */
  searchableText: string;

  // ── Keyword signals ───────────────────────────────────────────────────────
  /** Keywords found in <title> tag. */
  titleKeywords: string[];
  /** Keywords found in meta description. */
  metaKeywords: string[];
  /** Keywords found in first H1. */
  h1Keywords: string[];

  // ── Service area signals ──────────────────────────────────────────────────
  /** UK cities/regions mentioned anywhere on the homepage. */
  serviceAreas: string[];
  /** True if the domain has sub-paths like /locksmith-london. */
  hasDedicatedCityPages: boolean;
  /** Whether they mention nationwide / UK-wide coverage. */
  claimsNationwide: boolean;

  // ── PPC / paid ad signals ─────────────────────────────────────────────────
  /** True if CallRail, WhatConverts, or similar tracking script found. */
  hasPpcTracking: boolean;
  /** True if a Google Ads conversion tag (AW-xxxxx) detected in page source. */
  hasGoogleAdsTag: boolean;
  /** True if Google Tag Manager script detected. */
  hasGoogleTagManager: boolean;
  /** Google Ads conversion IDs found (e.g. ["AW-123456789"]). */
  googleAdsIds: string[];

  // ── Trust / accreditation signals ─────────────────────────────────────────
  /** Master Locksmiths Association membership mentioned or logo detected. */
  isMlaApproved: boolean;
  /** DBS checked / police vetted mentioned. */
  isDbsChecked: boolean;
  /** Which-Trusted-Trader or similar badge detected. */
  hasWhichTrusted: boolean;
  /** Free-text list of trust badges / accreditations found. */
  trustBadges: string[];

  // ── Pricing signals ───────────────────────────────────────────────────────
  /** Price strings found in page text, e.g. "from £49", "£65 call-out". */
  priceAnchors: string[];
  /** Lowest price anchor in GBP, or null if none detected. */
  lowestPriceGbp: number | null;

  // ── Messaging signals ─────────────────────────────────────────────────────
  /** True if "24/7", "24 hour", "around the clock" mentioned. */
  emphasises24h: boolean;
  /** True if "emergency" is in title or first H1. */
  leadsWithEmergency: boolean;
  /** True if "no call-out fee", "free call-out" mentioned. */
  noCallOutFee: boolean;
}

// ── City patterns (for service area detection) ────────────────────────────────

const UK_CITIES_LOWER = [
  "london", "birmingham", "manchester", "leeds", "sheffield", "liverpool",
  "bristol", "leicester", "nottingham", "coventry", "hull", "bradford",
  "stoke", "wolverhampton", "derby", "reading", "luton", "milton keynes",
  "southampton", "plymouth", "edinburgh", "glasgow", "cardiff", "belfast",
  "oxford", "cambridge", "exeter", "bath", "portsmouth", "sunderland",
  "newcastle", "middlesbrough", "york", "peterborough", "norwich", "ipswich",
  "gloucester", "cheltenham", "colchester", "guildford", "brighton", "worthing",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip HTML tags and decode common HTML entities. */
export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Extract text content of the first occurrence of a tag. */
function extractTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m  = re.exec(html);
  return m ? stripTags(m[1]) : "";
}

/** Extract a meta tag's content attribute by name or property. */
function extractMeta(html: string, nameOrProperty: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m1 = re.exec(html);
  if (m1) return m1[1];
  // Try reversed attribute order
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProperty}["']`,
    "i",
  );
  const m2 = re2.exec(html);
  return m2 ? m2[1] : "";
}

/** Tokenise text into lowercase words, dedup. */
function tokenise(text: string): string[] {
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )];
}

/** Extract price strings like "£49", "from £65", "£120 call-out". */
export function extractPriceAnchors(text: string): string[] {
  const priceRe = /(?:from\s+)?£\s*\d+(?:\.\d{2})?(?:\s*(?:call[-\s]?out|per\s+job|inc\.?|ex\.?|vat))?/gi;
  const matches = text.match(priceRe) ?? [];
  return [...new Set(matches.map((p) => p.trim()))];
}

/** Parse the lowest GBP value from a list of price anchor strings. */
export function lowestGbpFromAnchors(anchors: string[]): number | null {
  const values = anchors
    .map((a) => parseFloat(a.replace(/[^0-9.]/g, "")))
    .filter((n) => !isNaN(n) && n > 0);
  return values.length > 0 ? Math.min(...values) : null;
}

// ── Parsing functions (exported for unit testing) ─────────────────────────────

export function detectPpcTracking(html: string): boolean {
  const patterns = [
    /callrail/i,
    /whatconverts/i,
    /calltracking/i,
    /phonexa/i,
    /ringba/i,
    /invoca/i,
    /marchex/i,
    /infinity-tracking/i,
    /wpengine.*call-tracking/i,
    /call-tracking-metrics/i,
  ];
  return patterns.some((p) => p.test(html));
}

export function extractGoogleAdsIds(html: string): string[] {
  // Google Ads conversion tags: gtag('config', 'AW-XXXXXXXXX') or AW-XXXXXXXXX in scripts
  const awRe = /AW-\d{7,12}/g;
  const matches = html.match(awRe) ?? [];
  return [...new Set(matches)];
}

export function detectGoogleTagManager(html: string): boolean {
  return /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,8}/i.test(html);
}

export function detectMla(html: string): boolean {
  return /master\s+locksmiths?\s+association|MLA\s+approved|MLA\s+member|mlalocksmiths\.co\.uk/i.test(html);
}

export function detectDbs(html: string): boolean {
  return /DBS\s+(?:checked|check|cleared|vetted)|police\s+(?:vetted|checked|DBS)/i.test(html);
}

export function extractServiceAreas(text: string): string[] {
  const lower = text.toLowerCase();
  return UK_CITIES_LOWER.filter((city) => lower.includes(city));
}

export function detectDedicatedCityPages(html: string): boolean {
  // Look for links that contain city names in path: /locksmith-london /emergency-birmingham etc.
  const cityPathRe = new RegExp(
    `href=["'][^"']*(?:${UK_CITIES_LOWER.slice(0, 20).join("|")})["']`,
    "i",
  );
  return cityPathRe.test(html);
}

export function extractTrustBadges(html: string): string[] {
  const badges: string[] = [];
  if (/which[- ]trusted|which\.co\.uk\/trusted/i.test(html)) badges.push("Which? Trusted Trader");
  if (detectMla(html)) badges.push("MLA Approved");
  if (detectDbs(html)) badges.push("DBS Checked");
  if (/gas\s+safe|gas-safe/i.test(html)) badges.push("Gas Safe");
  if (/trustpilot/i.test(html))           badges.push("Trustpilot");
  if (/checkatrade\.com/i.test(html))      badges.push("Checkatrade");
  if (/rated\s*people|ratedpeople/i.test(html)) badges.push("Rated People");
  if (/federation\s+of\s+master\s+builders|fmb\.org/i.test(html)) badges.push("FMB");
  return badges;
}

// ── Client class ─────────────────────────────────────────────────────────────

export class CompetitorFingerprintClient {
  /** In-memory cache: domain → fingerprint for this agent run. */
  private cache = new Map<string, CompetitorFingerprint>();

  /**
   * Classify a fetched homepage. Returns a blockReason if the response is not
   * a usable page (Cloudflare challenge, JS-only shell, non-HTML, empty),
   * otherwise null.
   */
  static classifyResponse(
    html: string,
    contentType: string,
    httpStatus: number,
  ): CompetitorFingerprint["blockReason"] | null {
    if (httpStatus >= 400) return "http_error";
    // Check content-type BEFORE length so a tiny JSON / XML body is
    // labelled non_html rather than misclassified as empty.
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return "non_html";
    }
    if (!html || html.length < 200) return "empty_response";
    if (/Just a moment\.\.\.|Checking your browser|cf-browser-verification|cdn-cgi\/challenge-platform|attention required/i
        .test(html)) {
      return "cloudflare_challenge";
    }
    // JS-only shell heuristic: very little visible text, but heavy script
    // payload. Typical of Next.js / React SSR-disabled landing pages where
    // the real content arrives via fetch after page load.
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[\s\S]*?<\/style>/gi, "");
    const visibleText = visible.replace(/<[^>]+>/g, " ").trim();
    if (visibleText.length < 300 && /<script/i.test(html)) {
      return "js_only_shell";
    }
    return null;
  }

  private async fetchPage(url: string): Promise<{
    html: string;
    status: number;
    contentType: string;
  }> {
    const res = await fetch(url, {
      headers: {
        // Real browser UA — many Cloudflare-protected sites 403 our bot UA.
        // We trade self-identification for actually getting the page; the
        // request rate (1.5 s delay) keeps us well-behaved.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.8",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    const html = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    await sleep(REQUEST_DELAY_MS);
    return { html, status: res.status, contentType };
  }

  /**
   * Fingerprint a competitor domain.
   * Results are cached for the duration of the current agent run.
   *
   * Never throws — network errors, Cloudflare challenges, and JS-only shells
   * all return a fingerprint with `blocked: true` and the reason, so the
   * caller can record the outcome without crashing the batch.
   *
   * In addition to the homepage, this also fetches a small set of inner
   * pages (about, pricing, services, locations, contact). Verified empirically:
   * splash homepages of UK locksmith chains carry almost none of the signals
   * we want — MLA / nationwide claims live on /about, prices on /pricing.
   * Homepage-only fingerprinting was systematically under-detecting.
   */
  async fingerprintDomain(domain: string): Promise<CompetitorFingerprint> {
    if (this.cache.has(domain)) return this.cache.get(domain)!;

    const url = `https://${domain}`;

    let html        = "";
    let status      = 0;
    let contentType = "";

    try {
      const result = await this.fetchPage(url);
      html        = result.html;
      status      = result.status;
      contentType = result.contentType;
    } catch (err) {
      console.warn(`[competitor-fingerprint] network error for ${domain}:`,
        err instanceof Error ? err.message : err);
      const blocked = emptyFingerprint(domain, 0, "network_error");
      this.cache.set(domain, blocked);
      return blocked;
    }

    // Classify the response BEFORE any parsing so we don't waste cycles or
    // emit misleading "isMlaApproved=false" verdicts based on a challenge page.
    const blockReason = CompetitorFingerprintClient.classifyResponse(html, contentType, status);
    if (blockReason) {
      console.warn(`[competitor-fingerprint] blocked ${domain} — reason=${blockReason}, status=${status}`);
      const blocked = emptyFingerprint(domain, status, blockReason);
      this.cache.set(domain, blocked);
      return blocked;
    }

    // ── Fetch inner pages, accumulating up to INNER_PAGE_LIMIT successes ──
    // Each page contributes additional HTML / plain text that the signal
    // detectors run over. We OR every detection across pages — homepage +
    // inner pages produce the union of available signals.
    const innerHtmls: string[] = [];
    for (const path of INNER_PAGE_CANDIDATES) {
      if (innerHtmls.length >= INNER_PAGE_LIMIT) break;
      try {
        const r = await this.fetchPage(`https://${domain}${path}`);
        // Only accept healthy HTML responses — skip 404s, redirects to home, etc.
        if (r.status === 200 && r.html.length > 1_000 &&
            !CompetitorFingerprintClient.classifyResponse(r.html, r.contentType, r.status)) {
          innerHtmls.push(r.html);
        }
      } catch {
        // Per-page network failures are silent — main fingerprint is already
        // built from the homepage.
      }
    }

    // The aggregated "evidence" is homepage HTML + every successful inner-page
    // HTML, joined with a separator. Detectors (regex-based) just run over
    // this combined string. A signal present on /about-us trickles up to the
    // top-level fingerprint exactly as if it had been on the homepage.
    const combinedHtml = [html, ...innerHtmls].join("\n<!-- page break -->\n");

    const plainText = stripTags(combinedHtml);
    const title     = extractTag(html, "title");
    const metaDesc  = extractMeta(html, "description");
    const h1Text    = extractTag(html, "h1");

    // All signal detection uses the COMBINED HTML/plain-text so an inner
    // page (e.g. /pricing) can contribute its prices to the homepage
    // fingerprint. Title / meta / h1 keywords still come from the homepage
    // only, since those are scoped to it.
    const priceAnchors = extractPriceAnchors(plainText);
    const googleAdsIds = extractGoogleAdsIds(combinedHtml);
    const trustBadges  = extractTrustBadges(combinedHtml);
    const serviceAreas = extractServiceAreas(plainText);

    // Build the searchable text the cross-validator uses for
    // synonym-aware phrase matching. Keeps "24/7" and other short / punctuated
    // tokens that tokenise() drops. Includes meta description because real
    // homepages put high-signal phrases ("nationwide", "trusted across UK")
    // there rather than in body text.
    const searchableText = (`${title} ${metaDesc} ${h1Text} ${plainText.slice(0, 4_000)}`)
      .toLowerCase()
      .replace(/\s{2,}/g, " ")
      .trim();

    const fingerprint: CompetitorFingerprint = {
      domain,
      scannedAt:  new Date(),
      httpStatus: status,
      blocked:    false,
      searchableText,

      titleKeywords: tokenise(title),
      metaKeywords:  tokenise(metaDesc),
      h1Keywords:    tokenise(h1Text),

      serviceAreas,
      hasDedicatedCityPages: detectDedicatedCityPages(combinedHtml),
      // Check both plainText AND meta description — meta often carries
      // "Nationwide locksmiths trusted across the UK"-style claims that
      // never appear in body copy.
      claimsNationwide: /nationwide|uk.?wide|whole\s+of\s+(?:the\s+)?uk|across\s+(?:the\s+)?uk/i
        .test(`${plainText} ${metaDesc}`),

      hasPpcTracking:    detectPpcTracking(combinedHtml),
      hasGoogleAdsTag:   googleAdsIds.length > 0,
      hasGoogleTagManager: detectGoogleTagManager(combinedHtml),
      googleAdsIds,

      isMlaApproved: detectMla(combinedHtml),
      isDbsChecked:  detectDbs(combinedHtml),
      hasWhichTrusted: /which[- ]trusted|which\.co\.uk\/trusted/i.test(combinedHtml),
      trustBadges,

      priceAnchors,
      lowestPriceGbp: lowestGbpFromAnchors(priceAnchors),

      emphasises24h:    /24\s*\/\s*7|24\s*hour|around\s+the\s+clock|day\s+and\s+night/i.test(plainText),
      leadsWithEmergency: /emergency/i.test(title) || /emergency/i.test(h1Text),
      noCallOutFee: /no\s+call.?out\s+fee|free\s+call.?out/i.test(plainText),
    };

    this.cache.set(domain, fingerprint);
    return fingerprint;
  }

  /** Fingerprint multiple domains with polite delays between each. */
  async fingerprintAll(domains: string[]): Promise<Map<string, CompetitorFingerprint>> {
    const result = new Map<string, CompetitorFingerprint>();
    for (const domain of domains) {
      const fp = await this.fingerprintDomain(domain);
      result.set(domain, fp);
    }
    return result;
  }
}

function emptyFingerprint(
  domain: string,
  status: number,
  blockReason?: CompetitorFingerprint["blockReason"],
): CompetitorFingerprint {
  return {
    domain,
    scannedAt:  new Date(),
    httpStatus: status,
    blocked:    !!blockReason,
    blockReason,
    searchableText: "",
    titleKeywords: [], metaKeywords: [], h1Keywords: [],
    serviceAreas: [], hasDedicatedCityPages: false, claimsNationwide: false,
    hasPpcTracking: false, hasGoogleAdsTag: false, hasGoogleTagManager: false, googleAdsIds: [],
    isMlaApproved: false, isDbsChecked: false, hasWhichTrusted: false, trustBadges: [],
    priceAnchors: [], lowestPriceGbp: null,
    emphasises24h: false, leadsWithEmergency: false, noCallOutFee: false,
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function getCompetitorFingerprintClient(): CompetitorFingerprintClient {
  return new CompetitorFingerprintClient();
}
