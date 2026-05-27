/**
 * deep-locksmith-scraper.ts — v3 Coverage-Aware UK Locksmith Lead Scraper
 *
 * Improvements over v2:
 *   • Coverage-aware: queries DB to find UK cities with no active locksmiths
 *     and scrapes those first (highest-priority gaps for onboarding pipeline)
 *   • SerpAPI integration: runs google_maps SerpAPI search alongside Google
 *     Places for every city, catching leads that Places API misses
 *   • --coverage  — print coverage gap report and exit (no scraping)
 *
 * Unchanged from v2:
 *   • 200+ cities, 7 query types, coordinate-based nearby search
 *   • Email extraction (mailto + page crawl)
 *   • --enrich  — add missing emails to existing DB leads
 *   • --dedup   — flag duplicate leads with same phone number
 *   • --resume  — skip already-completed cities + already-in-DB place IDs
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' \
 *     scripts/deep-locksmith-scraper.ts [--resume] [--enrich] [--dedup] [--coverage]
 *
 * Env required: GOOGLE_PLACES_API_KEY
 * Env optional: SERPAPI_KEY (adds SerpAPI as supplementary lead source)
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("❌  GOOGLE_PLACES_API_KEY not set");
  process.exit(1);
}
const SERP_KEY = process.env.SERPAPI_KEY && process.env.SERPAPI_KEY !== "your_serpapi_key_here"
  ? process.env.SERPAPI_KEY
  : null;
if (SERP_KEY) {
  console.log("🔑  SerpAPI key detected — supplementary lead discovery enabled.");
} else {
  console.log("ℹ️   SERPAPI_KEY not set — running Google Places only.");
}

// ─────────────────────────────────────────────────────────────────────────────
// UK CITIES — 200+ towns, no duplicates
// ─────────────────────────────────────────────────────────────────────────────
const UK_CITIES = [
  // ── Major English Cities ──────────────────────────────────────────────────
  "London", "Birmingham", "Manchester", "Leeds", "Sheffield",
  "Bradford", "Liverpool", "Bristol", "Coventry", "Nottingham",
  "Newcastle upon Tyne", "Sunderland", "Brighton", "Hull", "Plymouth",
  "Stoke-on-Trent", "Wolverhampton", "Southampton", "Portsmouth", "Reading",
  "Derby", "Luton", "Preston", "Northampton", "Norwich",
  "Oxford", "Cambridge", "Exeter", "York", "Peterborough",
  "Ipswich", "Chelmsford", "Gloucester", "Bournemouth", "Swindon",
  "Blackpool", "Middlesbrough", "Slough", "Huddersfield", "Poole",
  "Eastbourne", "Telford",

  // ── North West ───────────────────────────────────────────────────────────
  "Warrington", "Wigan", "Oldham", "Rochdale", "Stockport",
  "Bolton", "Blackburn", "Burnley", "Salford", "Lancaster",
  "Southport", "Barrow-in-Furness", "Morecambe", "Accrington", "Chorley",
  "Crewe", "Macclesfield",

  // ── North East ───────────────────────────────────────────────────────────
  "Gateshead", "Hartlepool", "Stockton-on-Tees", "Darlington", "Durham",
  "South Shields", "Sunderland", "Middlesbrough", "Jarrow", "Hexham",

  // ── Yorkshire & Humber ───────────────────────────────────────────────────
  "Rotherham", "Barnsley", "Doncaster", "Wakefield", "Halifax",
  "Harrogate", "Scarborough", "Dewsbury", "Keighley", "Pontefract",
  "Scunthorpe", "Grimsby",

  // ── East Midlands ────────────────────────────────────────────────────────
  "Leicester", "Nottingham", "Derby", "Lincoln", "Mansfield",
  "Chesterfield", "Loughborough", "Corby", "Kettering", "Wellingborough",
  "Burton upon Trent", "Grantham",

  // ── West Midlands ────────────────────────────────────────────────────────
  "Walsall", "West Bromwich", "Solihull", "Nuneaton", "Rugby",
  "Shrewsbury", "Hereford", "Worcester", "Redditch", "Kidderminster",
  "Tamworth", "Lichfield", "Cannock", "Dudley",

  // ── East of England ──────────────────────────────────────────────────────
  "Colchester", "Southend-on-Sea", "Basildon", "Harlow",
  "St Albans", "Watford", "Hemel Hempstead", "Stevenage",
  "King's Lynn", "Great Yarmouth", "Lowestoft", "Bury St Edmunds",

  // ── South East ───────────────────────────────────────────────────────────
  "Maidstone", "Tunbridge Wells", "Canterbury", "Dover", "Folkestone",
  "Hastings", "Guildford", "Woking", "Basingstoke", "Andover",
  "Salisbury", "Medway", "Ashford", "Tonbridge", "Horsham",
  "Crawley", "Worthing", "Bognor Regis", "Chichester",

  // ── London Outer Areas ───────────────────────────────────────────────────
  "Croydon", "Barnet", "Enfield", "Ilford", "Romford",
  "Wembley", "Uxbridge", "Sutton", "Kingston upon Thames", "Richmond",
  "Bromley", "Lewisham", "Hackney", "Tottenham", "Ealing",

  // ── South / South West ───────────────────────────────────────────────────
  "Weymouth", "Dorchester", "Salisbury", "Bath",
  "Taunton", "Torquay", "Barnstaple", "Truro", "Yeovil",
  "Weston-super-Mare", "Bridgwater", "Tiverton", "Newquay",

  // ── Wales ────────────────────────────────────────────────────────────────
  "Cardiff", "Swansea", "Newport", "Wrexham",
  "Merthyr Tydfil", "Rhondda", "Llanelli", "Bridgend", "Neath",
  "Bangor", "Pontypool", "Barry",

  // ── Scotland ────────────────────────────────────────────────────────────
  "Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness",
  "Perth", "Stirling", "Falkirk", "Livingston", "Kilmarnock",
  "Paisley", "Motherwell", "Hamilton", "Ayr", "Dunfermline",
  "Kirkcaldy", "Cumbernauld", "Airdrie", "Coatbridge", "Greenock",
  "Irvine", "Dumfries",

  // ── Northern Ireland ─────────────────────────────────────────────────────
  "Belfast", "Derry", "Lisburn", "Newry", "Armagh",
  "Ballymena", "Newtownabbey", "Bangor",
];

// Deduplicate (some city names repeated above by accident)
const CITIES_DEDUPED = [...new Set(UK_CITIES)];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate-based nearby search for major cities
// ─────────────────────────────────────────────────────────────────────────────
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  London:              { lat: 51.5074,   lng: -0.1278  },
  Birmingham:          { lat: 52.4862,   lng: -1.8904  },
  Manchester:          { lat: 53.4808,   lng: -2.2426  },
  Leeds:               { lat: 53.8008,   lng: -1.5491  },
  Glasgow:             { lat: 55.8642,   lng: -4.2518  },
  Sheffield:           { lat: 53.3811,   lng: -1.4701  },
  Liverpool:           { lat: 53.4084,   lng: -2.9916  },
  Edinburgh:           { lat: 55.9533,   lng: -3.1883  },
  Bristol:             { lat: 51.4545,   lng: -2.5879  },
  Cardiff:             { lat: 51.4816,   lng: -3.1791  },
  Leicester:           { lat: 52.6369,   lng: -1.1398  },
  Coventry:            { lat: 52.4068,   lng: -1.5197  },
  Nottingham:          { lat: 52.9548,   lng: -1.1581  },
  "Newcastle upon Tyne": { lat: 54.9783, lng: -1.6178  },
  Bradford:            { lat: 53.7960,   lng: -1.7594  },
  Brighton:            { lat: 50.8229,   lng: -0.1363  },
  Hull:                { lat: 53.7457,   lng: -0.3367  },
  Plymouth:            { lat: 50.3755,   lng: -4.1427  },
  Southampton:         { lat: 50.9097,   lng: -1.4044  },
  Portsmouth:          { lat: 50.8198,   lng: -1.0880  },
  Reading:             { lat: 51.4543,   lng: -0.9781  },
  Wolverhampton:       { lat: 52.5862,   lng: -2.1291  },
  Derby:               { lat: 52.9225,   lng: -1.4746  },
  Luton:               { lat: 51.8787,   lng: -0.4200  },
  Aberdeen:            { lat: 57.1497,   lng: -2.0943  },
  Swansea:             { lat: 51.6214,   lng: -3.9436  },
  "Milton Keynes":     { lat: 52.0406,   lng: -0.7594  },
  Northampton:         { lat: 52.2405,   lng: -0.9027  },
  Norwich:             { lat: 52.6309,   lng: 1.2974   },
  Oxford:              { lat: 51.7520,   lng: -1.2577  },
  Cambridge:           { lat: 52.2053,   lng: 0.1218   },
  Exeter:              { lat: 50.7184,   lng: -3.5339  },
  York:                { lat: 53.9600,   lng: -1.0873  },
  Peterborough:        { lat: 52.5695,   lng: -0.2405  },
  Ipswich:             { lat: 52.0567,   lng: 1.1482   },
  Bournemouth:         { lat: 50.7192,   lng: -1.8808  },
  Swindon:             { lat: 51.5584,   lng: -1.7837  },
  Blackpool:           { lat: 53.8175,   lng: -3.0357  },
  Dundee:              { lat: 56.4620,   lng: -2.9707  },
  Middlesbrough:       { lat: 54.5742,   lng: -1.2350  },
  Stockport:           { lat: 53.4083,   lng: -2.1494  },
  Belfast:             { lat: 54.5973,   lng: -5.9301  },
  Croydon:             { lat: 51.3762,   lng: -0.0982  },
  Stoke:               { lat: 53.0027,   lng: -2.1794  },
  Walsall:             { lat: 52.5862,   lng: -1.9824  },
  Maidstone:           { lat: 51.2720,   lng: 0.5290   },
  Guildford:           { lat: 51.2362,   lng: -0.5704  },
  Chelmsford:          { lat: 51.7356,   lng: 0.4685   },
  Colchester:          { lat: 51.8959,   lng: 0.8919   },
  Worcester:           { lat: 52.1920,   lng: -2.2200  },
  Hereford:            { lat: 52.0565,   lng: -2.7160  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Search query builders — 7 types
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
// Chain / franchise filter
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
];

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places API
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
}

interface PlaceDetails {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, timeoutMs = 30000, retries = 4): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError" || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" || err?.cause?.code === "UND_ERR_SOCKET";
      if (isTimeout && attempt < retries) {
        const delay = Math.min(5000 * attempt, 30000);
        console.warn(`  ⚠  API timeout (attempt ${attempt}/${retries}), retrying in ${delay / 1000}s…`);
        await sleep(delay);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("fetchWithRetry: exhausted retries");
}

async function textSearch(query: string, pageToken?: string): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const url = new URL(`${BASE}/textsearch/json`);
  url.searchParams.set("query", query);
  url.searchParams.set("key", API_KEY!);
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("region", "gb");
  if (pageToken) url.searchParams.set("pagetoken", pageToken);

  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as { results: PlaceResult[]; next_page_token?: string; status: string };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`  ⚠  Places status: ${data.status}`);
  }
  return { results: data.results || [], nextPageToken: data.next_page_token };
}

async function nearbySearch(lat: number, lng: number, pageToken?: string): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const url = new URL(`${BASE}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "5000");
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("key", API_KEY!);
  if (pageToken) url.searchParams.set("pagetoken", pageToken);

  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as { results: PlaceResult[]; next_page_token?: string; status: string };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`  ⚠  Nearby status: ${data.status}`);
  }
  return { results: data.results || [], nextPageToken: data.next_page_token };
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI — google_maps engine: structured local results including place IDs
// ─────────────────────────────────────────────────────────────────────────────
interface SerpLocalResult {
  title?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  place_id?: string;
  links?: { website?: string };
}

interface SerpLead {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
}

async function serpSearch(city: string): Promise<SerpLead[]> {
  if (!SERP_KEY) return [];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", `locksmith ${city} UK`);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("api_key", SERP_KEY);

  try {
    const res = await fetchWithRetry(url.toString(), 20000, 2);
    const data = await res.json() as { local_results?: SerpLocalResult[] };
    if (!data?.local_results?.length) return [];

    return data.local_results
      .filter((r) => r.title && !isChain(r.title))
      .map((r): SerpLead => ({
        placeId: r.place_id ||
          `serp-${Buffer.from(`${r.title}|${r.address ?? ""}`)
            .toString("base64")
            .slice(0, 24)}`,
        name:        r.title ?? "",
        address:     r.address ?? "",
        phone:       r.phone ?? "",
        website:     r.links?.website ?? r.website ?? "",
        rating:      r.rating ?? 0,
        reviewCount: r.reviews ?? 0,
      }));
  } catch (err) {
    console.warn(`  ⚠  SerpAPI error for "${city}":`, err);
    return [];
  }
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL(`${BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status");
  url.searchParams.set("key", API_KEY!);

  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as { result?: PlaceDetails; status: string };
  if (data.status !== "OK") return null;
  return data.result ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /href=["']mailto:([^"'?\s]+)/gi;

const EMAIL_BLOCKLIST = [
  "sentry.io", "example.com", "sample.com", "domain.com", "yourname", "user@", "name@",
  "test@", "email@", ".png", ".jpg", ".gif", "schema.org", "w3.org", "placeholder",
  "wixpress.com", "squarespace.com", "wordpress.com", "amazonaws.com",
  "cloudflare.com", "googletagmanager", "doubleclick", "sendgrid",
  "mailchimp", "newsletter", "noreply", "no-reply", "postmaster",
  "webmaster", "admin@admin", "info@info", "contact@contact",
];

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return EMAIL_BLOCKLIST.some((b) => lower.includes(b));
}

async function fetchHtml(rawUrl: string, timeoutMs = 8000): Promise<string> {
  try {
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    new URL(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LockSafeBot/1.0; +https://locksafe.uk)" },
      });
      return (await res.text()).slice(0, 400_000);
    } finally { clearTimeout(timer); }
  } catch { return ""; }
}

function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();
  // mailto: links are most reliable
  let m: RegExpExecArray | null;
  MAILTO_REGEX.lastIndex = 0;
  while ((m = MAILTO_REGEX.exec(html)) !== null) {
    const email = m[1].toLowerCase().trim();
    if (!isJunkEmail(email) && email.includes("@")) found.add(email);
  }
  // fallback: general regex
  EMAIL_REGEX.lastIndex = 0;
  const matches = html.match(EMAIL_REGEX) || [];
  for (const e of matches) {
    const email = e.toLowerCase();
    if (!isJunkEmail(email)) found.add(email);
  }
  return [...found];
}

async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [
    base,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`,
    `${base}/get-in-touch`,
    `${base}/services`,
    `${base}/info`,
  ];
  for (const pageUrl of pages) {
    const html = await fetchHtml(pageUrl);
    if (!html) { await sleep(100); continue; }
    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) return emails[0];
    await sleep(150);
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────────────────────────────────────
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_FILE = "/tmp/deep-scraper-v2-progress.json";

interface Progress { completedCities: string[] }

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) as Progress;
  } catch { /* ignore */ }
  return { completedCities: [] };
}

function saveProgress(completedCities: string[]) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ completedCities }, null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone normalisation (for dedup)
// ─────────────────────────────────────────────────────────────────────────────
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // UK: 07xxx → +447xxx; 01/02xxx → +441/2xxx
  if (digits.startsWith("44")) return "+44" + digits.slice(2);
  if (digits.startsWith("0"))  return "+44" + digits.slice(1);
  return digits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --dedup — flag duplicate phone numbers in DB
// ─────────────────────────────────────────────────────────────────────────────
async function runDedup() {
  console.log("🔁  Deduplication pass — scanning for duplicate phone numbers…\n");

  type Lead = { id: string; name: string; phone: string | null; email: string | null; website: string | null; status: string; city: string; rating: number };
  const all = await (prisma as unknown as { locksmithLead: { findMany: (a: unknown) => Promise<Lead[]> } }).locksmithLead.findMany({
    select: { id: true, name: true, phone: true, email: true, website: true, status: true, city: true, rating: true },
  }) as Lead[];

  const byPhone = new Map<string, Lead[]>();
  for (const lead of all) {
    if (!lead.phone) continue;
    const norm = normalisePhone(lead.phone);
    if (!byPhone.has(norm)) byPhone.set(norm, []);
    byPhone.get(norm)!.push(lead);
  }

  const dupGroups = [...byPhone.entries()].filter(([, v]) => v.length > 1);
  console.log(`Found ${dupGroups.length} phone numbers with multiple leads.\n`);

  let flagged = 0;
  for (const [norm, leads] of dupGroups) {
    // Keep the "best" lead: prioritise email > website > rating
    const sorted = leads.sort((a, b) => {
      const score = (l: Lead) => (l.email ? 2 : 0) + (l.website ? 1 : 0) + (l.rating / 5);
      return score(b) - score(a);
    });
    const [keep, ...dupes] = sorted;
    console.log(`📞 ${norm}  — keeping "${keep.name}" (${keep.city}), flagging ${dupes.length} duplicate(s)`);

    for (const dup of dupes) {
      if (dup.status === "duplicate") continue;
      await (prisma as unknown as { locksmithLead: { update: (a: unknown) => Promise<unknown> } }).locksmithLead.update({
        where: { id: dup.id },
        data: { status: "duplicate", notes: `Duplicate of ${keep.id} (${keep.name})` },
      });
      flagged++;
    }
  }

  console.log(`\n✅  Flagged ${flagged} duplicate leads (status → "duplicate").\n`);
  await prisma.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --enrich — add missing emails to existing DB leads with a website
// ─────────────────────────────────────────────────────────────────────────────
async function runEnrich() {
  console.log("📧  Email enrichment — finding emails for leads with website but no email…\n");

  type Lead = { id: string; name: string; website: string | null };
  const targets = await (prisma as unknown as { locksmithLead: { findMany: (a: unknown) => Promise<Lead[]> } }).locksmithLead.findMany({
    where: { email: null, website: { not: null } },
    select: { id: true, name: true, website: true },
  }) as Lead[];

  console.log(`Found ${targets.length} leads with website but no email.\n`);

  let enriched = 0;
  for (let i = 0; i < targets.length; i++) {
    const lead = targets[i];
    if (i % 20 === 0) console.log(`  Progress: ${i}/${targets.length}…`);
    const email = await extractEmailFromWebsite(lead.website!);
    if (email) {
      await (prisma as unknown as { locksmithLead: { update: (a: unknown) => Promise<unknown> } }).locksmithLead.update({
        where: { id: lead.id },
        data: { email },
      });
      console.log(`  ✅ ${lead.name} → ${email}`);
      enriched++;
    }
    await sleep(300);
  }

  console.log(`\n✅  Enriched ${enriched} leads with email addresses.\n`);
  await prisma.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap helpers — prioritise cities with no active locksmiths
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the set of city names that already have at least one active locksmith
 *  in LocksmithCoverage. Used to sort the scrape order so uncovered areas run first. */
async function getCoveredCities(): Promise<Set<string>> {
  const rows = await (prisma as unknown as {
    locksmithCoverage: { findMany: (a: unknown) => Promise<{ city: string | null }[]> };
  }).locksmithCoverage.findMany({
    where: { isPaused: false, city: { not: null } },
    select: { city: true },
    distinct: ["city"],
  });
  return new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c)));
}

/** Returns city names flagged as RECRUIT targets in GoogleAdsOpportunity
 *  (kind=RECRUIT, locksmithCount=0) — highest-value onboarding gaps. */
async function getRecruitTargetCities(): Promise<Set<string>> {
  const rows = await (prisma as unknown as {
    googleAdsOpportunity: { findMany: (a: unknown) => Promise<{ geoLabel: string }[]> };
  }).googleAdsOpportunity.findMany({
    where: { kind: "RECRUIT", locksmithCount: 0 },
    select: { geoLabel: true },
    orderBy: { score: "desc" },
    take: 60,
  });
  return new Set(rows.map((r) => r.geoLabel));
}

/** Reorders cities: RECRUIT targets → uncovered cities → covered cities */
function buildPriorityOrder(
  cities: string[],
  covered: Set<string>,
  recruitTargets: Set<string>,
): string[] {
  return [...cities].sort((a, b) => {
    const scoreA = recruitTargets.has(a) ? 2 : !covered.has(a) ? 1 : 0;
    const scoreB = recruitTargets.has(b) ? 2 : !covered.has(b) ? 1 : 0;
    return scoreB - scoreA;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --coverage — print coverage gap report
// ─────────────────────────────────────────────────────────────────────────────
async function runCoverageReport() {
  console.log("📊  Coverage gap report\n");
  const [covered, recruitTargets] = await Promise.all([
    getCoveredCities(),
    getRecruitTargetCities(),
  ]);

  const uncovered = CITIES_DEDUPED.filter((c) => !covered.has(c));
  const priorityUncovered = uncovered.filter((c) => recruitTargets.has(c));
  const standardUncovered = uncovered.filter((c) => !recruitTargets.has(c));

  console.log(`Total cities in list:       ${CITIES_DEDUPED.length}`);
  console.log(`Cities WITH locksmiths:     ${covered.size}`);
  console.log(`Cities WITHOUT locksmiths:  ${uncovered.length}`);
  console.log(`  → RECRUIT targets (high-value gaps): ${priorityUncovered.length}`);
  console.log(`  → Standard uncovered:                ${standardUncovered.length}\n`);

  if (priorityUncovered.length > 0) {
    console.log("🎯  RECRUIT targets (prioritised):");
    for (const c of priorityUncovered) console.log(`   ${c}`);
    console.log();
  }

  if (standardUncovered.length > 0) {
    console.log("📍  Uncovered cities:");
    for (const c of standardUncovered.slice(0, 40)) console.log(`   ${c}`);
    if (standardUncovered.length > 40)
      console.log(`   … and ${standardUncovered.length - 40} more`);
  }

  await prisma.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: default / --resume — full scrape
// ─────────────────────────────────────────────────────────────────────────────
interface Lead {
  placeId: string; name: string; city: string; address: string;
  phone: string; email: string; website: string; rating: number; reviewCount: number;
}

async function processBatch(
  results: PlaceResult[],
  city: string,
  seen: Set<string>,
  leads: Lead[]
) {
  for (const place of results) {
    if (seen.has(place.place_id)) continue;
    if (isChain(place.name)) {
      console.log(`   ⛔ Chain: ${place.name}`);
      continue;
    }
    seen.add(place.place_id);
    await sleep(150);
    const details = await getDetails(place.place_id);
    if (!details) continue;
    if (details.business_status === "CLOSED_PERMANENTLY") continue;

    const phone = details.formatted_phone_number || details.international_phone_number || "";
    const email = await extractEmailFromWebsite(details.website || "");
    leads.push({
      placeId: place.place_id, name: details.name, city,
      address: details.formatted_address || place.formatted_address,
      phone, email, website: details.website || "",
      rating: details.rating || 0, reviewCount: details.user_ratings_total || 0,
    });
    const tag = email ? `📧 ${email}` : "—";
    console.log(`   ✅ ${details.name} | ${phone || "no phone"} | ${tag}`);
  }
}

async function runScrape(isResume: boolean) {
  console.log(`🔍  Deep UK locksmith scraper v3 — ${CITIES_DEDUPED.length} cities, 7 queries + nearby + SerpAPI\n`);

  const seen = new Set<string>();
  const leads: Lead[] = [];
  let completedCities: string[] = [];

  // ── Coverage-aware city ordering ─────────────────────────────────────────
  console.log("🗺   Loading coverage data to prioritise uncovered areas…");
  const [coveredCities, recruitTargets] = await Promise.all([
    getCoveredCities().catch(() => new Set<string>()),
    getRecruitTargetCities().catch(() => new Set<string>()),
  ]);
  const orderedCities = buildPriorityOrder(CITIES_DEDUPED, coveredCities, recruitTargets);
  const uncoveredCount = orderedCities.filter((c) => !coveredCities.has(c)).length;
  console.log(
    `   ${coveredCities.size} cities covered | ${uncoveredCount} uncovered (will run first) | ` +
    `${recruitTargets.size} RECRUIT targets\n`,
  );

  if (isResume) {
    console.log("▶️  Resume mode — loading existing place IDs from DB…");
    type R = { googlePlaceId: string };
    const existing = await (prisma as unknown as { locksmithLead: { findMany: (a: unknown) => Promise<R[]> } }).locksmithLead.findMany({
      select: { googlePlaceId: true },
    }) as R[];
    for (const { googlePlaceId } of existing) {
      if (!googlePlaceId.startsWith("mla-")) seen.add(googlePlaceId);
    }
    const prog = loadProgress();
    completedCities = prog.completedCities;
    console.log(`   Loaded ${seen.size} existing place IDs, ${completedCities.length} cities done.\n`);
  }

  for (const city of orderedCities) {
    if (completedCities.includes(city)) {
      console.log(`📍 ${city}… ⏭  skipped`);
      continue;
    }
    console.log(`\n📍 ${city}`);

    // 1. Text searches (7 query types, up to 3 pages each)
    for (const buildQuery of SEARCH_QUERIES) {
      const query = buildQuery(city);
      let pageToken: string | undefined;
      let page = 0;
      do {
        if (page > 0) await sleep(2500);
        const { results, nextPageToken } = await textSearch(query, pageToken);
        pageToken = nextPageToken;
        page++;
        await processBatch(results, city, seen, leads);
      } while (pageToken && page < 3);
      await sleep(400);
    }

    // 2. Coordinate-based nearby search (if we have coords for this city)
    const coords = CITY_COORDS[city];
    if (coords) {
      console.log(`   🗺  Nearby search (${coords.lat}, ${coords.lng})…`);
      let pageToken: string | undefined;
      let page = 0;
      do {
        if (page > 0) await sleep(2500);
        const { results, nextPageToken } = await nearbySearch(coords.lat, coords.lng, pageToken);
        pageToken = nextPageToken;
        page++;
        await processBatch(results, city, seen, leads);
      } while (pageToken && page < 3);
    }

    // 3. SerpAPI google_maps supplementary search
    if (SERP_KEY) {
      console.log(`   🌐  SerpAPI search for "${city}"…`);
      const serpLeads = await serpSearch(city);
      let serpNew = 0;
      for (const s of serpLeads) {
        if (seen.has(s.placeId) || isChain(s.name)) continue;
        seen.add(s.placeId);
        // Note: SerpAPI already provides structured fields — no details lookup needed
        // Email extraction deferred to --enrich pass
        leads.push({
          placeId: s.placeId, name: s.name, city,
          address: s.address, phone: s.phone, email: "",
          website: s.website, rating: s.rating, reviewCount: s.reviewCount,
        });
        console.log(`   🌐 ${s.name} | ${s.phone || "no phone"} [SERP]`);
        serpNew++;
      }
      if (serpNew) console.log(`   → ${serpNew} new leads from SerpAPI`);
      await sleep(500); // SerpAPI rate limit courtesy
    }

    completedCities.push(city);
    saveProgress(completedCities);
    const covLabel = coveredCities.has(city) ? "" : " 🔴 uncovered";
    console.log(`   → ${leads.length} total leads so far${covLabel}`);
  }

  try { fs.unlinkSync(PROGRESS_FILE); } catch { /* ignore */ }

  console.log(`\n✨  Found ${leads.length} independent locksmiths.\n`);

  // ── CSV export ────────────────────────────────────────────────────────────
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const csvPath = path.join(dataDir, "locksmith-leads-v3.csv");
  const header = "Name,Email,Phone,City,Address,Website,Rating,Reviews,Google Place ID\n";
  const rows = leads
    .map((l) => [l.name, l.email, l.phone, l.city, l.address, l.website, l.rating, l.reviewCount, l.placeId].map(escapeCsv).join(","))
    .join("\n");
  fs.writeFileSync(csvPath, header + rows, "utf8");
  console.log(`📄  CSV → ${csvPath}`);
  console.log(`    With email: ${leads.filter(l => l.email).length} / ${leads.length}`);
  console.log(`    With phone: ${leads.filter(l => l.phone).length} / ${leads.length}`);

  // ── Save to DB ─────────────────────────────────────────────────────────────
  console.log("\n💾  Saving to database…");
  let saved = 0, skipped = 0;

  for (const lead of leads) {
    try {
      await (prisma as unknown as { locksmithLead: { upsert: (a: unknown) => Promise<unknown> } }).locksmithLead.upsert({
        where: { googlePlaceId: lead.placeId },
        update: {
          name: lead.name, city: lead.city, address: lead.address,
          phone: lead.phone || null, email: lead.email || null,
          website: lead.website || null, rating: lead.rating, reviewCount: lead.reviewCount,
        },
        create: {
          googlePlaceId: lead.placeId, name: lead.name, city: lead.city, address: lead.address,
          phone: lead.phone || null, email: lead.email || null,
          website: lead.website || null, rating: lead.rating, reviewCount: lead.reviewCount,
          status: "new",
        },
      });
      saved++;
    } catch { skipped++; }
  }

  console.log(`\nDatabase: ${saved} saved, ${skipped} skipped`);

  // ── Notify agent of new batch ──────────────────────────────────────────────
  if (saved > 0) {
    const batchId = `scrape-${Date.now()}`;
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
      const cronSecret = process.env.CRON_SECRET || "dev-secret";
      
      const intakeRes = await fetch(`${siteUrl}/api/admin/leads/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({
          batchId,
          leadCount: saved,
          source: "scraper",
        }),
      });

      if (intakeRes.ok) {
        const intakeData = await intakeRes.json();
        console.log(`\n📡 Agent notified: ${intakeData.message}`);
      } else {
        console.warn(`⚠️  Agent notification failed: HTTP ${intakeRes.status}`);
      }
    } catch (err) {
      console.error("⚠️  Failed to notify agent:", err);
    }
  }

  console.log("\n🎉  Done!\n");
  await prisma.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--dedup")) {
  runDedup().catch(e => { console.error(e); process.exit(1); });
} else if (args.includes("--enrich")) {
  runEnrich().catch(e => { console.error(e); process.exit(1); });
} else if (args.includes("--coverage")) {
  runCoverageReport().catch(e => { console.error(e); process.exit(1); });
} else {
  runScrape(args.includes("--resume")).catch(e => { console.error(e); process.exit(1); });
}
