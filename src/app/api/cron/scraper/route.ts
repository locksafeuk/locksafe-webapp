/**
 * /api/cron/scraper — Continuous UK Locksmith Lead Scraper
 *
 * Runs every 2 hours via Vercel Cron. Each invocation:
 *   1. Loads coverage data from DB to identify which UK cities have no
 *      active locksmiths (highest priority targets).
 *   2. Loads or creates a ScraperProgress record for the current cycle.
 *   3. Scrapes the next N priority cities (Google Places + SerpAPI fallback)
 *      until approaching Vercel's 300-second function limit.
 *   4. Upserts discovered leads into LocksmithLead, updates progress in DB.
 *   5. When all cities are done the cycle resets automatically.
 *   6. Notifies /api/admin/leads/intake so new leads enter the outreach pipeline.
 *
 * Email extraction is deliberately skipped here (too slow for 300s budget).
 * Run `npx ts-node scripts/deep-locksmith-scraper.ts --enrich` for enrichment.
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
  "locksmiths24", "locksmiths 24", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
];

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw));
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
  rating: number;
  reviewCount: number;
  source: "google_places" | "serpapi";
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Google Places API
// ─────────────────────────────────────────────────────────────────────────────
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

async function placesTextSearch(
  query: string,
  apiKey: string,
): Promise<PlaceResult[]> {
  const url = new URL(`${PLACES_BASE}/textsearch/json`);
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("region", "gb");

  const data = await fetchJson<{
    results: PlaceResult[];
    status: string;
  }>(url.toString());
  return data?.results ?? [];
}

async function placesNearbySearch(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<PlaceResult[]> {
  const url = new URL(`${PLACES_BASE}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "5000");
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("key", apiKey);

  const data = await fetchJson<{
    results: PlaceResult[];
    status: string;
  }>(url.toString());
  return data?.results ?? [];
}

async function placesGetDetails(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetails | null> {
  const url = new URL(`${PLACES_BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status",
  );
  url.searchParams.set("key", apiKey);

  const data = await fetchJson<{ result?: PlaceDetails; status: string }>(
    url.toString(),
  );
  return data?.result ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI — google_maps engine returns structured local results with place IDs
// ─────────────────────────────────────────────────────────────────────────────
async function serpSearch(
  city: string,
  apiKey: string,
): Promise<ScrapedLead[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", `locksmith ${city} UK`);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("api_key", apiKey);

  const data = await fetchJson<{ local_results?: SerpLocalResult[] }>(
    url.toString(),
    15000,
  );
  if (!data?.local_results?.length) return [];

  const leads: ScrapedLead[] = [];
  for (const r of data.local_results) {
    if (!r.title || isChain(r.title)) continue;
    // Use SerpAPI's place_id if present so we can dedup with Google Places results
    const placeId = r.place_id
      ? r.place_id
      : `serp-${Buffer.from(`${r.title}|${r.address ?? ""}`)
          .toString("base64")
          .slice(0, 24)}`;

    leads.push({
      placeId,
      name: r.title,
      city,
      address: r.address ?? "",
      phone: r.phone ?? "",
      website: r.links?.website ?? r.website ?? "",
      rating: r.rating ?? 0,
      reviewCount: r.reviews ?? 0,
      source: "serpapi",
    });
  }
  return leads;
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

// ─────────────────────────────────────────────────────────────────────────────
// City scraper — Google Places + optional SerpAPI fallback
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeCity(
  city: string,
  seen: Set<string>,
  googleKey: string,
  serpKey: string | null,
): Promise<ScrapedLead[]> {
  const leads: ScrapedLead[] = [];

  // 1. Google Places text searches (one page each — fast for cron)
  let googleCount = 0;
  for (const buildQuery of SEARCH_QUERIES) {
    const results = await placesTextSearch(buildQuery(city), googleKey);
    for (const place of results) {
      if (seen.has(place.place_id) || isChain(place.name)) continue;
      seen.add(place.place_id);
      await sleep(80);
      const details = await placesGetDetails(place.place_id, googleKey);
      if (!details || details.business_status === "CLOSED_PERMANENTLY") continue;
      leads.push({
        placeId: place.place_id,
        name: details.name,
        city,
        address: details.formatted_address || place.formatted_address,
        phone:
          details.formatted_phone_number ||
          details.international_phone_number ||
          "",
        website: details.website || "",
        rating: details.rating || 0,
        reviewCount: details.user_ratings_total || 0,
        source: "google_places",
      });
      googleCount++;
    }
    await sleep(200);
  }

  // 2. Nearby search (if we have coords for this city)
  const coords = CITY_COORDS[city];
  if (coords) {
    const nearby = await placesNearbySearch(coords.lat, coords.lng, googleKey);
    for (const place of nearby) {
      if (seen.has(place.place_id) || isChain(place.name)) continue;
      seen.add(place.place_id);
      await sleep(80);
      const details = await placesGetDetails(place.place_id, googleKey);
      if (!details || details.business_status === "CLOSED_PERMANENTLY") continue;
      leads.push({
        placeId: place.place_id,
        name: details.name,
        city,
        address: details.formatted_address || place.formatted_address,
        phone:
          details.formatted_phone_number ||
          details.international_phone_number ||
          "",
        website: details.website || "",
        rating: details.rating || 0,
        reviewCount: details.user_ratings_total || 0,
        source: "google_places",
      });
      googleCount++;
    }
    await sleep(200);
  }

  // 3. SerpAPI — run if we have a key AND Google returned fewer than 5 results
  //    (sparse areas often miss local listings in Places API)
  if (serpKey && (googleCount < 5 || serpKey)) {
    const serpLeads = await serpSearch(city, serpKey);
    for (const lead of serpLeads) {
      if (seen.has(lead.placeId) || isChain(lead.name)) continue;
      seen.add(lead.placeId);
      leads.push(lead);
    }
    await sleep(300); // SerpAPI rate limit courtesy
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

  const googleKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "";
  if (!googleKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 },
    );
  }
  const serpKey = process.env.SERPAPI_KEY || null;
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
      `[scraper-cron] New cycle started. ${prioritizedCities.length} cities queued. ` +
        `${recruitTargets.size} RECRUIT targets, ` +
        `${prioritizedCities.length - coveredCities.size} uncovered cities.`,
    );
  }

  const completedSet = new Set(progress.completedCities);
  const remaining = prioritizedCities.filter((c) => !completedSet.has(c));

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
        `All ${prioritizedCities.length} UK cities scraped.\n` +
        `Leads found: ${progress.totalLeadsFound} | Saved: ${progress.totalLeadsSaved}\n` +
        `Starting fresh on next run.`,
      severity: "info",
    });

    return NextResponse.json({
      status: "cycle_complete",
      citiesTotal: prioritizedCities.length,
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

    const cityLeads = await scrapeCity(city, seen, googleKey, serpKey);
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
  const cycleComplete = newCompletedCities.length >= prioritizedCities.length;

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

  console.log(
    `[scraper-cron] Run complete. Cities: ${completedThisRun.length}. ` +
      `Leads: ${leadsFoundThisRun} found / ${leadsSavedThisRun} saved. ` +
      `Remaining in cycle: ${remainingAfter}. ` +
      `Time: ${Math.round(elapsed() / 1000)}s`,
  );

  if (cycleComplete) {
    await sendAdminAlert({
      title: "🔁 Scraper Cycle Complete",
      message:
        `All ${prioritizedCities.length} UK cities scraped.\n` +
        `Leads found: ${newTotal} | Saved: ${newSaved}`,
      severity: "info",
    });
  }

  return NextResponse.json({
    status: cycleComplete ? "cycle_complete" : "running",
    citiesProcessedThisRun: completedThisRun.length,
    citiesRemainingInCycle: remainingAfter,
    citiesCompletedInCycle: newCompletedCities.length,
    citiesTotalInCycle: prioritizedCities.length,
    leadsFoundThisRun,
    leadsSavedThisRun,
    totalLeadsInCycle: newTotal,
    elapsedSeconds: Math.round(elapsed() / 1000),
    uncoveredCities: prioritizedCities.length - coveredCities.size,
    recruitTargets: recruitTargets.size,
  });
}
