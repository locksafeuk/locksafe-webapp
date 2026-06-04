/**
 * /api/cron/scraper — Continuous UK Locksmith Lead Scraper
 *
 * Runs every 2 hours via Vercel Cron. Each invocation:
 *   1. Loads coverage data from DB to identify which UK cities have no
 *      active locksmiths (highest priority targets).
 *   2. Loads or creates a ScraperProgress record for the current cycle.
 *   3. Scrapes the next N priority cities (SERP.dev places)
 *      until approaching Vercel's 300-second function limit.
 *   4. Upserts discovered leads into LocksmithLead, updates progress in DB.
 *   5. When all cities are done the cycle resets automatically.
 *   6. Notifies /api/admin/leads/intake so new leads enter the outreach pipeline.
 *
 * Leads are kept only when strict locksmith and UK checks pass, and when an
 * email address can be extracted from the business website.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Leave 50 s buffer before Vercel's 300-second hard kill. */
const MAX_DURATION_MS = 245_000;

/** Cities to process per invocation. Capped conservatively so we never
 *  risk approaching the time limit even on slow API days. */
const MAX_CITIES_PER_RUN = 40;

/** Serper.dev hard cap per invocation. Serper bills per credit (1 credit per
 *  search), so this caps cost/run: ≤1 call per city × 40 cities = ≤40 credits,
 *  and this ceiling protects against config changes or repeated manual triggers. */
const SERP_MAX_CALLS_PER_RUN = 150;

/** Courtesy spacing between Serper.dev calls (ms). */
const SERP_MIN_INTERVAL_MS = 400;

/** Max website email lookups per invocation to keep runtime bounded. */
const EMAIL_LOOKUPS_PER_RUN = 90;

/**
 * How many of the 7 SEARCH_QUERIES variants to run per city. More variants =
 * deeper discovery of long-tail independents, but each variant is 1 Serper
 * credit per city. Default 4 (locksmith / independent / emergency / auto) is a
 * good cost/coverage balance; set SCRAPER_QUERY_VARIANTS=7 for maximum reach.
 * The SERP_MAX_CALLS_PER_RUN ceiling still bounds total cost per invocation.
 */
const QUERY_VARIANTS_PER_CITY = Math.max(
  1,
  Math.min(7, Number(process.env.SCRAPER_QUERY_VARIANTS ?? "4") || 4),
);

/** Credit-saver mode: scrape only uncovered/recruit-target cities by default. */
const SCRAPER_GAP_ONLY_MODE =
  (process.env.SCRAPER_GAP_ONLY_MODE ?? "true").toLowerCase() !== "false";

/** If every city is covered, sample a few covered cities for light maintenance checks. */
const MAINTENANCE_COVERED_CITY_SAMPLE = 6;

// ─────────────────────────────────────────────────────────────────────────────
// UK cities — identical list to deep-locksmith-scraper.ts
// ─────────────────────────────────────────────────────────────────────────────
const UK_CITIES_RAW = [
  // Major English cities
  "London", "Birmingham", "Manchester", "Leeds", "Sheffield",
  "Bradford", "Liverpool", "Bristol", "Coventry", "Nottingham",
  "Newcastle upon Tyne", "Sunderland", "Brighton", "Hull", "Plymouth",
  "Stoke-on-Trent", "Wolverhampton", "Southampton", "Portsmouth", "Reading",
  "Derby", "Luton", "Preston", "Northampton", "Norwich",
  "Oxford", "Cambridge", "Exeter", "York", "Peterborough",
  "Ipswich", "Chelmsford", "Gloucester", "Bournemouth", "Swindon",
  "Blackpool", "Middlesbrough", "Slough", "Huddersfield", "Poole",
  "Eastbourne", "Telford",
  // North West
  "Warrington", "Wigan", "Oldham", "Rochdale", "Stockport",
  "Bolton", "Blackburn", "Burnley", "Salford", "Lancaster",
  "Southport", "Barrow-in-Furness", "Morecambe", "Accrington", "Chorley",
  "Crewe", "Macclesfield",
  // North East
  "Gateshead", "Hartlepool", "Stockton-on-Tees", "Darlington", "Durham",
  "South Shields", "Jarrow", "Hexham",
  // Yorkshire & Humber
  "Rotherham", "Barnsley", "Doncaster", "Wakefield", "Halifax",
  "Harrogate", "Scarborough", "Dewsbury", "Keighley", "Pontefract",
  "Scunthorpe", "Grimsby",
  // East Midlands
  "Leicester", "Lincoln", "Mansfield", "Chesterfield", "Loughborough",
  "Corby", "Kettering", "Wellingborough", "Burton upon Trent", "Grantham",
  // West Midlands
  "Walsall", "West Bromwich", "Solihull", "Nuneaton", "Rugby",
  "Shrewsbury", "Hereford", "Worcester", "Redditch", "Kidderminster",
  "Tamworth", "Lichfield", "Cannock", "Dudley",
  // East of England
  "Colchester", "Southend-on-Sea", "Basildon", "Harlow",
  "St Albans", "Watford", "Hemel Hempstead", "Stevenage",
  "King's Lynn", "Great Yarmouth", "Lowestoft", "Bury St Edmunds",
  // South East
  "Maidstone", "Tunbridge Wells", "Canterbury", "Dover", "Folkestone",
  "Hastings", "Guildford", "Woking", "Basingstoke", "Andover",
  "Salisbury", "Medway", "Ashford", "Tonbridge", "Horsham",
  "Crawley", "Worthing", "Bognor Regis", "Chichester",
  // London outer areas
  "Croydon", "Barnet", "Enfield", "Ilford", "Romford",
  "Wembley", "Uxbridge", "Sutton", "Kingston upon Thames", "Richmond",
  "Bromley", "Lewisham", "Hackney", "Tottenham", "Ealing",
  // South / South West
  "Weymouth", "Dorchester", "Bath", "Taunton", "Torquay",
  "Barnstaple", "Truro", "Yeovil", "Weston-super-Mare",
  "Bridgwater", "Tiverton", "Newquay",
  // Wales
  "Cardiff", "Swansea", "Newport", "Wrexham",
  "Merthyr Tydfil", "Rhondda", "Llanelli", "Bridgend", "Neath",
  "Bangor", "Pontypool", "Barry",
  // Scotland
  "Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness",
  "Perth", "Stirling", "Falkirk", "Livingston", "Kilmarnock",
  "Paisley", "Motherwell", "Hamilton", "Ayr", "Dunfermline",
  "Kirkcaldy", "Cumbernauld", "Airdrie", "Coatbridge", "Greenock",
  "Irvine", "Dumfries",
  // Northern Ireland
  "Belfast", "Derry", "Lisburn", "Newry", "Armagh",
  "Ballymena", "Newtownabbey",
];
const UK_CITIES = [...new Set(UK_CITIES_RAW)];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate lookup for nearby search
// ─────────────────────────────────────────────────────────────────────────────
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  London:                { lat: 51.5074,  lng: -0.1278  },
  Birmingham:            { lat: 52.4862,  lng: -1.8904  },
  Manchester:            { lat: 53.4808,  lng: -2.2426  },
  Leeds:                 { lat: 53.8008,  lng: -1.5491  },
  Glasgow:               { lat: 55.8642,  lng: -4.2518  },
  Sheffield:             { lat: 53.3811,  lng: -1.4701  },
  Liverpool:             { lat: 53.4084,  lng: -2.9916  },
  Edinburgh:             { lat: 55.9533,  lng: -3.1883  },
  Bristol:               { lat: 51.4545,  lng: -2.5879  },
  Cardiff:               { lat: 51.4816,  lng: -3.1791  },
  Leicester:             { lat: 52.6369,  lng: -1.1398  },
  Coventry:              { lat: 52.4068,  lng: -1.5197  },
  Nottingham:            { lat: 52.9548,  lng: -1.1581  },
  "Newcastle upon Tyne": { lat: 54.9783,  lng: -1.6178  },
  Bradford:              { lat: 53.7960,  lng: -1.7594  },
  Brighton:              { lat: 50.8229,  lng: -0.1363  },
  Hull:                  { lat: 53.7457,  lng: -0.3367  },
  Plymouth:              { lat: 50.3755,  lng: -4.1427  },
  Southampton:           { lat: 50.9097,  lng: -1.4044  },
  Portsmouth:            { lat: 50.8198,  lng: -1.0880  },
  Reading:               { lat: 51.4543,  lng: -0.9781  },
  Wolverhampton:         { lat: 52.5862,  lng: -2.1291  },
  Derby:                 { lat: 52.9225,  lng: -1.4746  },
  Luton:                 { lat: 51.8787,  lng: -0.4200  },
  Aberdeen:              { lat: 57.1497,  lng: -2.0943  },
  Swansea:               { lat: 51.6214,  lng: -3.9436  },
  Northampton:           { lat: 52.2405,  lng: -0.9027  },
  Norwich:               { lat: 52.6309,  lng:  1.2974  },
  Oxford:                { lat: 51.7520,  lng: -1.2577  },
  Cambridge:             { lat: 52.2053,  lng:  0.1218  },
  Exeter:                { lat: 50.7184,  lng: -3.5339  },
  York:                  { lat: 53.9600,  lng: -1.0873  },
  Peterborough:          { lat: 52.5695,  lng: -0.2405  },
  Ipswich:               { lat: 52.0567,  lng:  1.1482  },
  Bournemouth:           { lat: 50.7192,  lng: -1.8808  },
  Swindon:               { lat: 51.5584,  lng: -1.7837  },
  Blackpool:             { lat: 53.8175,  lng: -3.0357  },
  Dundee:                { lat: 56.4620,  lng: -2.9707  },
  Middlesbrough:         { lat: 54.5742,  lng: -1.2350  },
  Stockport:             { lat: 53.4083,  lng: -2.1494  },
  Belfast:               { lat: 54.5973,  lng: -5.9301  },
  Croydon:               { lat: 51.3762,  lng: -0.0982  },
  Walsall:               { lat: 52.5862,  lng: -1.9824  },
  Maidstone:             { lat: 51.2720,  lng:  0.5290  },
  Guildford:             { lat: 51.2362,  lng: -0.5704  },
  Chelmsford:            { lat: 51.7356,  lng:  0.4685  },
  Colchester:            { lat: 51.8959,  lng:  0.8919  },
  Worcester:             { lat: 52.1920,  lng: -2.2200  },
  Hereford:              { lat: 52.0565,  lng: -2.7160  },
  Inverness:             { lat: 57.4778,  lng: -4.2247  },
  Bath:                  { lat: 51.3758,  lng: -2.3599  },
  Truro:                 { lat: 50.2660,  lng: -5.0527  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Chain / franchise filter
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24",
  "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
  // NOTE: removed broad tokens "national locksmith", "uk locksmith",
  // "emergency locksmiths ltd" — they were nuking legitimate independents
  // whose names happen to contain those generic words.
];

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Locksmith business validator — rejects non-locksmith results that slip
// through Google's type filter (shoe shops, cobblers, glaziers, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/** Google Place `types` values that confirm a locksmith business. */
const LOCKSMITH_TYPES = new Set(["locksmith"]);

/** Name keywords that strongly indicate a locksmith business. */
const LOCKSMITH_NAME_PATTERNS = [
  /lock/i,           // locksmith, locks, LockFit, Locktec …
  /\bkeys?\b/i,      // key, keys, car key, key cutting
  /\bsafe\b/i,       // safe engineer, safesmith
  /\bsafes\b/i,
  /deadbolt/i,
  /deadlock/i,
  /burglary/i,
  /upvc/i,
  /access[\s-]?control/i,
  /padlock/i,
  /auto[\s-]?locksmith/i,
  /car[\s-]?key/i,
];

/**
 * Returns true if the result is actually a locksmith business.
 * First checks Google's own `types` array (most reliable); falls back to
 * a name-keyword scan so legitimate businesses with no "lock" in the name
 * (e.g. "Page Security") are still accepted via the types path.
 */
function isLocksmithBusiness(name: string, types?: string[]): boolean {
  // Trust Google's types when present
  if (types && types.length > 0) {
    return types.some((t) => LOCKSMITH_TYPES.has(t));
  }
  // Fallback: name must contain at least one locksmith keyword
  return LOCKSMITH_NAME_PATTERNS.some((p) => p.test(name));
}

// ─────────────────────────────────────────────────────────────────────────────
// Query builders — 7 types (same as CLI scraper)
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_QUERIES: Array<(city: string) => string> = [
  (c) => `locksmith ${c}`,
  (c) => `independent locksmith ${c} UK`,
  (c) => `emergency locksmith ${c} UK`,
  (c) => `auto locksmith ${c} UK`,
  (c) => `24 hour locksmith ${c}`,
  (c) => `residential locksmith ${c}`,
  (c) => `commercial locksmith ${c}`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ScrapedLead {
  placeId: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  rating: number;
  reviewCount: number;
  source: "serper";
}

interface SerperPlace {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  cid?: string;
  placeId?: string;
}

/** Per-invocation engine state for SERP.dev scraping with run-level caps. */
interface ScrapeEngine {
  serpKey: string | null;
  serpCallsThisRun: number;
  serpCapPerRun: number;
  serpMinIntervalMs: number;
  emailLookupsThisRun: number;
  emailLookupCapPerRun: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const LOCKSMITH_STRONG_PATTERNS = [
  /locksmith(s)?/i,
  /lock/i,
  /\blocks?\b/i,
  /lock\s*(and|&)\s*key/i,
  /\block\s*specialist\b/i,
  /\block\s*safe\b/i,
  /\bkey\s*cut(ting)?\b/i,
  /\bauto\s*locksmith\b/i,
  /\bcar\s*keys?\b/i,
  /\bauto\s*key(s)?\b/i,
  /\block\s*out\b/i,
  /\block\s*change\b/i,
  /\bupvc\b/i,
];

const NON_LOCKSMITH_PATTERNS = [
  /\bplumb(er|ing)?\b/i,
  /\belectric(ian|al)?\b/i,
  /\bbathroom\b/i,
  /\bkitchen\b/i,
  /\bglazi(er|ng)?\b/i,
  /\btil(e|ing)\b/i,
  /\bcarpet\b/i,
  /\bpainting\b/i,
  /\bdecorat(or|ing)\b/i,
  /\broof(ing|er)?\b/i,
  /\bdentist\b/i,
  /\bsurgery\b/i,
];

const UK_POSTCODE_PATTERN = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

const NON_UK_COUNTRY_TERMS = [
  /\baustralia\b/i,
  /\bcanada\b/i,
  /\busa\b/i,
  /\bunited states\b/i,
  /\bnew zealand\b/i,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EMAIL_BLOCKLIST = [
  "example.com",
  "sentry.io",
  "wixpress.com",
  "squarespace.com",
  "wordpress.com",
  "cloudflare.com",
  "noreply",
  "no-reply",
  "postmaster",
  "webmaster",
];

function hasStrongLocksmithSignal(text: string): boolean {
  return LOCKSMITH_STRONG_PATTERNS.some((p) => p.test(text));
}

function hasNonLocksmithSignal(text: string): boolean {
  return NON_LOCKSMITH_PATTERNS.some((p) => p.test(text));
}

function isDefinitelyNonUkPhone(phone: string): boolean {
  const compact = phone.replace(/\s+/g, "").trim();
  if (!compact) return false;
  if (compact.startsWith("+")) return !compact.startsWith("+44");
  if (compact.startsWith("00")) return !compact.startsWith("0044");
  return false;
}

function looksUkEnough(city: string, address: string, phone: string, website: string): boolean {
  const lowerAddress = address.toLowerCase();
  const cityInAddress = city.length > 1 && lowerAddress.includes(city.toLowerCase());
  const hasUkPostcode = UK_POSTCODE_PATTERN.test(address);
  const hasUkDomain = /\.co\.uk\b|\.uk\b/i.test(website);
  const isUkPhone = Boolean(phone) && !isDefinitelyNonUkPhone(phone);
  const nonUkCountry = NON_UK_COUNTRY_TERMS.some((p) => p.test(address));

  if (nonUkCountry || isDefinitelyNonUkPhone(phone)) return false;
  return cityInAddress || hasUkPostcode || hasUkDomain || isUkPhone;
}

function looksLikeStrictLocksmith(lead: Pick<ScrapedLead, "name" | "address" | "website">): boolean {
  const text = `${lead.name} ${lead.address} ${lead.website}`;
  const positive = hasStrongLocksmithSignal(text);
  const negative = hasNonLocksmithSignal(text);
  return positive && !negative;
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[),.;]+$/, "");
}

function extractEmailsFromHtml(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) ?? [];
  const emails = matches
    .map((m) => sanitizeEmail(m))
    .filter((e) => e.includes("@") && !EMAIL_BLOCKLIST.some((b) => e.includes(b)));
  return [...new Set(emails)];
}

async function fetchHtml(url: string, timeoutMs = 7000): Promise<string> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    new URL(normalized);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(normalized, {
        signal: controller.signal,
        headers: { "User-Agent": "LocksafeBot/1.0 (+https://www.locksafe.uk)" },
      });
      if (!res.ok) return "";
      return (await res.text()).slice(0, 300_000);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}

async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";

  const base = (websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`];

  for (const page of pages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) return emails[0];
  }

  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Serper.dev — POST /places returns Google Maps business listings (name, phone,
// website, address, rating). Auth via X-API-KEY header. Errors are logged (not
// swallowed) so failures are visible in the Vercel logs.
// ─────────────────────────────────────────────────────────────────────────────
async function serpSearch(
  city: string,
  query: string,
  apiKey: string,
): Promise<ScrapedLead[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "uk", hl: "en" }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[scraper-cron] Serper error ${res.status} for "${query}": ${body.slice(0, 200)}`);
      return [];
    }

    const data = (await res.json()) as { places?: SerperPlace[] };
    const places = data?.places ?? [];
    if (places.length === 0) {
      console.warn(`[scraper-cron] Serper returned 0 places for "${query}"`);
      return [];
    }

    const leads: ScrapedLead[] = [];
    for (const p of places) {
      if (!p.title || isChain(p.title)) continue;
      // Prefer Google placeId (dedups with Google Places results); fall back to
      // the maps CID, then a synthetic hash.
      const placeId =
        p.placeId ||
        (p.cid
          ? `cid-${p.cid}`
          : `serper-${Buffer.from(`${p.title}|${p.address ?? ""}`).toString("base64").slice(0, 24)}`);

      leads.push({
        placeId,
        name: p.title,
        city,
        address: p.address ?? "",
        phone: p.phoneNumber ?? "",
        website: p.website ?? "",
        email: "",
        rating: p.rating ?? 0,
        reviewCount: p.ratingCount ?? 0,
        source: "serper",
      });
    }
    return leads;
  } catch (err) {
    console.error(`[scraper-cron] Serper request failed for ${city}:`, err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap detection
// ─────────────────────────────────────────────────────────────────────────────

/** Returns city names that already have at least one active locksmith. */
async function getCoveredCities(): Promise<Set<string>> {
  const rows = await (
    prisma as unknown as {
      locksmithCoverage: {
        findMany: (a: unknown) => Promise<{ city: string | null }[]>;
      };
    }
  ).locksmithCoverage.findMany({
    where: { isPaused: false, city: { not: null } },
    select: { city: true },
    distinct: ["city"],
  });

  return new Set(
    rows.map((r) => r.city).filter((c): c is string => Boolean(c)),
  );
}

/** Returns city names flagged as high-priority recruit targets in
 *  GoogleAdsOpportunity (kind=RECRUIT, zero locksmiths). */
async function getRecruitTargetCities(): Promise<Set<string>> {
  const rows = await (
    prisma as unknown as {
      googleAdsOpportunity: {
        findMany: (a: unknown) => Promise<{ geoLabel: string }[]>;
      };
    }
  ).googleAdsOpportunity.findMany({
    where: { kind: "RECRUIT", locksmithCount: 0 },
    select: { geoLabel: true },
    orderBy: { score: "desc" },
    take: 50,
  });

  return new Set(rows.map((r) => r.geoLabel));
}

/**
 * Sorts UK_CITIES to put the highest-priority targets first:
 *   1. Cities in GoogleAdsOpportunity RECRUIT list (high-value gaps)
 *   2. Cities with no locksmiths in LocksmithCoverage
 *   3. All other cities
 */
function prioritizeCities(
  cities: string[],
  coveredCities: Set<string>,
  recruitTargets: Set<string>,
): string[] {
  return [...cities].sort((a, b) => {
    const scoreA =
      recruitTargets.has(a) ? 2 : !coveredCities.has(a) ? 1 : 0;
    const scoreB =
      recruitTargets.has(b) ? 2 : !coveredCities.has(b) ? 1 : 0;
    return scoreB - scoreA; // higher score first
  });
}

function buildCityQueue(
  prioritizedCities: string[],
  coveredCities: Set<string>,
  recruitTargets: Set<string>,
): string[] {
  if (!SCRAPER_GAP_ONLY_MODE) return prioritizedCities;

  const gapCities = prioritizedCities.filter(
    (city) => recruitTargets.has(city) || !coveredCities.has(city),
  );
  if (gapCities.length > 0) return gapCities;

  const coveredOnly = prioritizedCities.filter((city) => coveredCities.has(city));
  return coveredOnly.slice(0, MAINTENANCE_COVERED_CITY_SAMPLE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-run skip/save accounting — surfaced in the response + Telegram so we can
// SEE which gate is dropping leads instead of guessing.
// ─────────────────────────────────────────────────────────────────────────────
interface FunnelStats {
  candidates: number;     // raw places returned by Serper (post-title)
  dedup: number;          // already in DB or seen this run
  chain: number;          // chain/franchise filtered
  notLocksmith: number;   // failed strict locksmith check
  nonUk: number;          // failed UK check
  noContact: number;      // no phone AND no website → uncontactable, dropped
  savedWithEmail: number;
  savedNoEmail: number;   // phone-only / no-email leads now KEPT (was dropped)
  emailLookups: number;
}

function newFunnelStats(): FunnelStats {
  return {
    candidates: 0, dedup: 0, chain: 0, notLocksmith: 0, nonUk: 0,
    noContact: 0, savedWithEmail: 0, savedNoEmail: 0, emailLookups: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// City scraper — SERP.dev, multi-query.
//
// Calibration (2026-06): runs several query variants per city (not just one
// generic "locksmith {city}") to surface the long-tail independents that the
// single query missed, and KEEPS phone-reachable leads even when no email can
// be extracted. Email is now best-effort enrichment, not a hard gate — the old
// email requirement was discarding ~99% of real locksmiths (1 of 1805 `new`
// leads had an email). Phone-only leads are contacted via the SMS sequence.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeCity(
  city: string,
  seen: Set<string>,
  engine: ScrapeEngine,
  queries: Array<(c: string) => string>,
  stats: FunnelStats,
): Promise<ScrapedLead[]> {
  const leads: ScrapedLead[] = [];
  const serpKey = engine.serpKey;
  if (!serpKey) return leads;

  // Dedup placeIds seen across this city's query variants (same business often
  // appears under several queries) so we only process each business once.
  const cityScopedSeen = new Set<string>();

  for (const buildQuery of queries) {
    if (engine.serpCallsThisRun >= engine.serpCapPerRun) break;
    engine.serpCallsThisRun++;

    const serpLeads = await serpSearch(city, buildQuery(city), serpKey);
    for (const lead of serpLeads) {
      if (cityScopedSeen.has(lead.placeId)) continue;
      cityScopedSeen.add(lead.placeId);
      stats.candidates++;

      if (seen.has(lead.placeId)) { stats.dedup++; continue; }
      if (isChain(lead.name)) { stats.chain++; continue; }
      if (!looksLikeStrictLocksmith(lead)) { stats.notLocksmith++; continue; }
      if (!looksUkEnough(city, lead.address, lead.phone, lead.website)) { stats.nonUk++; continue; }

      // Must be reachable some way. Phone is enough (SMS outreach); a website is
      // also acceptable (email enrichment can follow). Only drop if neither.
      if (!lead.phone && !lead.website) { stats.noContact++; continue; }

      // Best-effort email enrichment — NON-gating. If the lead has a website and
      // we're under the per-run lookup cap, try to grab an email; otherwise keep
      // the lead anyway with email empty (the enrich-leads cron retries later).
      if (lead.website && engine.emailLookupsThisRun < engine.emailLookupCapPerRun) {
        engine.emailLookupsThisRun++;
        stats.emailLookups++;
        const email = await extractEmailFromWebsite(lead.website);
        if (email) lead.email = email;
      }

      if (lead.email) stats.savedWithEmail++;
      else stats.savedNoEmail++;

      seen.add(lead.placeId);
      leads.push(lead);
    }

    await sleep(engine.serpMinIntervalMs); // rate-limit courtesy spacing
  }

  return leads;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notify intake API
// ─────────────────────────────────────────────────────────────────────────────
async function notifyIntake(
  batchId: string,
  leadCount: number,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  try {
    await fetch(`${siteUrl}/api/admin/leads/intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({ batchId, leadCount, source: "cron-scraper" }),
    });
  } catch {
    // Non-fatal — leads are already saved to DB
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const elapsed = () => Date.now() - startTime;

  const serpKey = process.env.SCRAPER_SERPER_API_KEY || process.env.SERPER_API_KEY || null;

  if (!serpKey) {
    return NextResponse.json(
      { error: "No scraper API key configured — set SCRAPER_SERPER_API_KEY or SERPER_API_KEY" },
      { status: 500 },
    );
  }

  const engine: ScrapeEngine = {
    serpKey,
    serpCallsThisRun: 0,
    serpCapPerRun: SERP_MAX_CALLS_PER_RUN,
    serpMinIntervalMs: SERP_MIN_INTERVAL_MS,
    emailLookupsThisRun: 0,
    emailLookupCapPerRun: EMAIL_LOOKUPS_PER_RUN,
  };
  console.log("[scraper-cron] Engine: Serper.dev (SERP-only mode)");
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
  const cronSecret = process.env.CRON_SECRET || "dev-secret";

  // ── Step 1: Load coverage data ──────────────────────────────────────────
  const [coveredCities, recruitTargets] = await Promise.all([
    getCoveredCities(),
    getRecruitTargetCities(),
  ]);

  const prioritizedCities = prioritizeCities(
    UK_CITIES,
    coveredCities,
    recruitTargets,
  );
  const cityQueue = buildCityQueue(prioritizedCities, coveredCities, recruitTargets);

  // ── Step 2: Load or create scraper progress ─────────────────────────────
  type ProgressRecord = {
    id: string;
    completedCities: string[];
    totalLeadsFound: number;
    totalLeadsSaved: number;
    isComplete: boolean;
  };

  let progress = (await (
    prisma as unknown as {
      scraperProgress: {
        findFirst: (a: unknown) => Promise<ProgressRecord | null>;
      };
    }
  ).scraperProgress.findFirst({
    where: { isComplete: false },
    orderBy: { createdAt: "desc" },
  })) as ProgressRecord | null;

  if (!progress) {
    // Start a new cycle
    progress = (await (
      prisma as unknown as {
        scraperProgress: {
          create: (a: unknown) => Promise<ProgressRecord>;
        };
      }
    ).scraperProgress.create({
      data: { completedCities: [], totalLeadsFound: 0, totalLeadsSaved: 0 },
    })) as ProgressRecord;

    console.log(
      `[scraper-cron] New cycle started. ${cityQueue.length} cities queued. ` +
        `${recruitTargets.size} RECRUIT targets, ` +
        `${prioritizedCities.length - coveredCities.size} uncovered cities.`,
    );
  }

  const completedSet = new Set(progress.completedCities);
  const remaining = cityQueue.filter((c) => !completedSet.has(c));

  if (remaining.length === 0) {
    // Cycle complete — mark done, next invocation starts fresh
    await (
      prisma as unknown as {
        scraperProgress: { update: (a: unknown) => Promise<unknown> };
      }
    ).scraperProgress.update({
      where: { id: progress.id },
      data: { isComplete: true },
    });

    await sendAdminAlert({
      title: "🔁 Scraper Cycle Complete",
      message:
        `All ${cityQueue.length} queued cities scraped.\n` +
        `Leads found: ${progress.totalLeadsFound} | Saved: ${progress.totalLeadsSaved}\n` +
        `Starting fresh on next run.`,
      severity: "info",
    });

    return NextResponse.json({
      status: "cycle_complete",
      citiesTotal: cityQueue.length,
      leadsFound: progress.totalLeadsFound,
      leadsSaved: progress.totalLeadsSaved,
    });
  }

  // ── Step 3: Pre-load existing place IDs for dedup ───────────────────────
  type LeadId = { googlePlaceId: string };
  const existingLeads = (await (
    prisma as unknown as {
      locksmithLead: { findMany: (a: unknown) => Promise<LeadId[]> };
    }
  ).locksmithLead.findMany({
    select: { googlePlaceId: true },
  })) as LeadId[];

  const seen = new Set<string>(existingLeads.map((l) => l.googlePlaceId));

  // ── Step 4: Scrape cities until time budget is exhausted ─────────────────
  const completedThisRun: string[] = [];
  let leadsFoundThisRun = 0;
  let leadsSavedThisRun = 0;

  // Active query variants for this run (multi-query discovery).
  const activeQueries = SEARCH_QUERIES.slice(0, QUERY_VARIANTS_PER_CITY);
  // Per-run funnel accounting so we can see WHICH gate drops leads.
  const funnel = newFunnelStats();

  for (const city of remaining) {
    // Stop if time is running short
    if (elapsed() > MAX_DURATION_MS) {
      console.log(
        `[scraper-cron] Time limit approaching (${Math.round(elapsed() / 1000)}s). Stopping after ${completedThisRun.length} cities.`,
      );
      break;
    }
    if (completedThisRun.length >= MAX_CITIES_PER_RUN) break;

    console.log(`[scraper-cron] Scraping: ${city}`);

    const cityLeads = await scrapeCity(city, seen, engine, activeQueries, funnel);
    leadsFoundThisRun += cityLeads.length;

    // Upsert leads to DB
    for (const lead of cityLeads) {
      try {
        await (
          prisma as unknown as {
            locksmithLead: { upsert: (a: unknown) => Promise<unknown> };
          }
        ).locksmithLead.upsert({
          where: { googlePlaceId: lead.placeId },
          update: {
            name: lead.name,
            city: lead.city,
            address: lead.address,
            phone: lead.phone || null,
            website: lead.website || null,
            email: lead.email || null,
            rating: lead.rating,
            reviewCount: lead.reviewCount,
          },
          create: {
            googlePlaceId: lead.placeId,
            name: lead.name,
            city: lead.city,
            address: lead.address,
            phone: lead.phone || null,
            website: lead.website || null,
            email: lead.email || null,
            rating: lead.rating,
            reviewCount: lead.reviewCount,
            status: "new",
          },
        });
        leadsSavedThisRun++;
      } catch {
        // Skip duplicates / constraint errors silently
      }
    }

    completedThisRun.push(city);
    console.log(
      `[scraper-cron] ${city}: ${cityLeads.length} leads. ` +
        `Elapsed: ${Math.round(elapsed() / 1000)}s`,
    );
  }

  // ── Step 5: Persist updated progress ────────────────────────────────────
  const newCompletedCities = [
    ...progress.completedCities,
    ...completedThisRun,
  ];
  const newTotal = progress.totalLeadsFound + leadsFoundThisRun;
  const newSaved = progress.totalLeadsSaved + leadsSavedThisRun;
  const cycleComplete = newCompletedCities.length >= cityQueue.length;

  await (
    prisma as unknown as {
      scraperProgress: { update: (a: unknown) => Promise<unknown> };
    }
  ).scraperProgress.update({
    where: { id: progress.id },
    data: {
      completedCities: newCompletedCities,
      totalLeadsFound: newTotal,
      totalLeadsSaved: newSaved,
      isComplete: cycleComplete,
      lastRunAt: new Date(),
    },
  });

  // ── Step 6: Notify intake if new leads were saved ────────────────────────
  if (leadsSavedThisRun > 0) {
    const batchId = `cron-${Date.now()}`;
    await notifyIntake(batchId, leadsSavedThisRun, siteUrl, cronSecret);
  }

  const remainingAfter = remaining.length - completedThisRun.length;

  const funnelLine =
    `candidates=${funnel.candidates} dedup=${funnel.dedup} chain=${funnel.chain} ` +
    `notLocksmith=${funnel.notLocksmith} nonUk=${funnel.nonUk} noContact=${funnel.noContact} ` +
    `saved(email=${funnel.savedWithEmail}/phone-only=${funnel.savedNoEmail})`;

  console.log(
    `[scraper-cron] Run complete. Cities: ${completedThisRun.length}. ` +
      `Leads: ${leadsFoundThisRun} found / ${leadsSavedThisRun} saved. ` +
      `Remaining in cycle: ${remainingAfter}. ` +
      `Time: ${Math.round(elapsed() / 1000)}s`,
  );
  console.log(`[scraper-cron] Funnel: ${funnelLine}`);

  if (cycleComplete) {
    await sendAdminAlert({
      title: "🔁 Scraper Cycle Complete",
      message:
        `All ${cityQueue.length} queued cities scraped.\n` +
        `Leads found: ${newTotal} | Saved: ${newSaved}\n` +
        `Last run funnel: ${funnelLine}`,
      severity: "info",
    });
  }

  return NextResponse.json({
    status: cycleComplete ? "cycle_complete" : "running",
    citiesProcessedThisRun: completedThisRun.length,
    citiesRemainingInCycle: remainingAfter,
    citiesCompletedInCycle: newCompletedCities.length,
    citiesTotalInCycle: cityQueue.length,
    leadsFoundThisRun,
    leadsSavedThisRun,
    totalLeadsInCycle: newTotal,
    elapsedSeconds: Math.round(elapsed() / 1000),
    uncoveredCities: prioritizedCities.length - coveredCities.size,
    scraperGapOnlyMode: SCRAPER_GAP_ONLY_MODE,
    recruitTargets: recruitTargets.size,
    queryVariantsPerCity: QUERY_VARIANTS_PER_CITY,
    serpCallsThisRun: engine.serpCallsThisRun,
    emailLookupsThisRun: engine.emailLookupsThisRun,
    funnel,
  });
}
