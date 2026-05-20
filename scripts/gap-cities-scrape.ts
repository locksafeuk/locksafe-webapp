/**
 * gap-cities-scrape.ts
 *
 * Fills coverage gaps in under-represented UK cities:
 *   - Winchester + Hampshire (1–9 leads currently)
 *   - Carlisle + Cumbria
 *   - Shrewsbury + Shropshire
 *   - Cheltenham + Gloucestershire
 *   - Grimsby + Lincolnshire coast
 *   - Portsmouth + Hampshire coast
 *   - Guildford + Surrey
 *   - Hereford + Herefordshire
 *   - Burnley + East Lancashire
 *   - Scottish cities: Dundee, Inverness, Perth, Stirling
 *
 * Primary API  : Google Places (textsearch + nearbysearch)
 * Fallback API : SerpAPI Google Maps (kicks in on REQUEST_DENIED / quota exceeded)
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... SERPAPI_KEY=... DATABASE_URL=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/gap-cities-scrape.ts [--resume] [--enrich]
 */

import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

process.on("uncaughtException",  (err)    => console.error("💥 uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("💥 unhandledRejection:", reason));

const prisma = new PrismaClient();
const API_KEY   = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const SERP_KEY  = process.env.SERPAPI_KEY || "";

// Track whether Google Places is working — flip to false on REQUEST_DENIED
let googleAvailable = !!API_KEY;

if (!API_KEY && !SERP_KEY) {
  console.error("❌  Neither GOOGLE_PLACES_API_KEY nor SERPAPI_KEY is set"); process.exit(1);
}
console.log(`🔑  Google Places API : ${API_KEY  ? "✅ available" : "❌ not set"}`);
console.log(`🔑  SerpAPI           : ${SERP_KEY ? "✅ available" : "❌ not set"}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// Named areas by region
// ─────────────────────────────────────────────────────────────────────────────

const WINCHESTER_AREAS = [
  "Winchester City Centre",
  "Weeke Winchester",
  "Stanmore Winchester",
  "Winnall Winchester",
  "Badger Farm Winchester",
  "Basingstoke Hampshire",
  "Andover Hampshire",
  "Alton Hampshire",
  "Petersfield Hampshire",
  "Romsey Hampshire",
  "Eastleigh Hampshire",
  "Fareham Hampshire",
  "Gosport Hampshire",
  "Havant Hampshire",
  "Waterlooville Hampshire",
  "Fleet Hampshire",
  "Farnborough Hampshire",
  "Aldershot Hampshire",
];

const CARLISLE_AREAS = [
  "Carlisle City Centre",
  "Botchergate Carlisle",
  "Dalston Carlisle",
  "Longtown Carlisle",
  "Brampton Carlisle",
  "Penrith Cumbria",
  "Whitehaven Cumbria",
  "Workington Cumbria",
  "Barrow-in-Furness Cumbria",
  "Kendal Cumbria",
  "Ulverston Cumbria",
  "Maryport Cumbria",
  "Cockermouth Cumbria",
  "Keswick Cumbria",
  "Appleby-in-Westmorland Cumbria",
];

const SHREWSBURY_AREAS = [
  "Shrewsbury Town Centre",
  "Meole Brace Shrewsbury",
  "Harlescott Shrewsbury",
  "Monkmoor Shrewsbury",
  "Copthorne Shrewsbury",
  "Telford Shropshire",
  "Wellington Shropshire",
  "Madeley Telford",
  "Oakengates Telford",
  "Oswestry Shropshire",
  "Bridgnorth Shropshire",
  "Ludlow Shropshire",
  "Market Drayton Shropshire",
  "Whitchurch Shropshire",
  "Newport Shropshire",
];

const CHELTENHAM_AREAS = [
  "Cheltenham Town Centre",
  "Prestbury Cheltenham",
  "Leckhampton Cheltenham",
  "Charlton Kings Cheltenham",
  "Bishops Cleeve Cheltenham",
  "Gloucester City Centre",
  "Hucclecote Gloucester",
  "Quedgeley Gloucester",
  "Stroud Gloucestershire",
  "Nailsworth Gloucestershire",
  "Cirencester Gloucestershire",
  "Tewkesbury Gloucestershire",
  "Cheltenham surrounds Gloucestershire",
  "Moreton-in-Marsh Gloucestershire",
  "Stow-on-the-Wold Gloucestershire",
];

const GRIMSBY_AREAS = [
  "Grimsby Town Centre",
  "Cleethorpes Lincolnshire",
  "Immingham Lincolnshire",
  "Scunthorpe North Lincolnshire",
  "Brigg Lincolnshire",
  "Barton-upon-Humber Lincolnshire",
  "Gainsborough Lincolnshire",
  "Louth Lincolnshire",
  "Mablethorpe Lincolnshire",
  "Alford Lincolnshire",
  "Horncastle Lincolnshire",
  "Market Rasen Lincolnshire",
];

const PORTSMOUTH_AREAS = [
  "Portsmouth City Centre",
  "Southsea Portsmouth",
  "Cosham Portsmouth",
  "Paulsgrove Portsmouth",
  "Portchester Hampshire",
  "Fareham Town Centre Hampshire",
  "Gosport Town Centre Hampshire",
  "Havant Town Centre Hampshire",
  "Waterlooville Town Hampshire",
  "Emsworth Hampshire",
  "Chichester West Sussex",
  "Bognor Regis West Sussex",
  "Littlehampton West Sussex",
];

const GUILDFORD_AREAS = [
  "Guildford Town Centre",
  "Stoughton Guildford",
  "Burpham Guildford",
  "Merrow Guildford",
  "Park Barn Guildford",
  "Woking Surrey",
  "Farnham Surrey",
  "Camberley Surrey",
  "Aldershot Town Hampshire",
  "Godalming Surrey",
  "Cranleigh Surrey",
  "Leatherhead Surrey",
  "Dorking Surrey",
  "Reigate Surrey",
  "Redhill Surrey",
];

const HEREFORD_AREAS = [
  "Hereford City Centre",
  "Belmont Hereford",
  "Tupsley Hereford",
  "Bobblestock Hereford",
  "Ross-on-Wye Herefordshire",
  "Ledbury Herefordshire",
  "Leominster Herefordshire",
  "Bromyard Herefordshire",
  "Kington Herefordshire",
  "Pontypool Torfaen",
  "Abergavenny Monmouthshire",
];

const BURNLEY_AREAS = [
  "Burnley Town Centre",
  "Padiham Burnley",
  "Hapton Burnley",
  "Brierfield Burnley",
  "Nelson Lancashire",
  "Colne Lancashire",
  "Accrington Lancashire",
  "Great Harwood Lancashire",
  "Clitheroe Lancashire",
  "Rawtenstall Rossendale",
  "Bacup Rossendale",
  "Haslingden Rossendale",
  "Darwen Lancashire",
  "Ramsbottom Lancashire",
];

const DUNDEE_AREAS = [
  "Dundee City Centre",
  "Broughty Ferry Dundee",
  "Stobswell Dundee",
  "Lochee Dundee",
  "Monifieth Angus",
  "Carnoustie Angus",
  "Arbroath Angus",
  "Forfar Angus",
  "Brechin Angus",
  "Montrose Angus",
  "Kirriemuir Angus",
  "Blairgowrie Perthshire",
];

const INVERNESS_AREAS = [
  "Inverness City Centre",
  "Merkinch Inverness",
  "Dalneigh Inverness",
  "Raigmore Inverness",
  "Dingwall Ross-shire",
  "Nairn Highland",
  "Forres Moray",
  "Elgin Moray",
  "Aviemore Highland",
  "Fort William Highland",
  "Invergordon Highland",
  "Tain Highland",
  "Wick Highland",
  "Thurso Highland",
];

const PERTH_AREAS = [
  "Perth City Centre",
  "Kinnoull Perth",
  "Letham Perth",
  "Scone Perth",
  "Kinross Perthshire",
  "Crieff Perthshire",
  "Pitlochry Perthshire",
  "Aberfeldy Perthshire",
  "Auchterarder Perthshire",
  "Dundee Road Perth",
  "Coupar Angus Perthshire",
];

const STIRLING_AREAS = [
  "Stirling City Centre",
  "Bridge of Allan Stirling",
  "Bannockburn Stirling",
  "Cambusbarron Stirling",
  "Falkirk Town Centre",
  "Grangemouth Falkirk",
  "Bo'ness Falkirk",
  "Larbert Falkirk",
  "Denny Falkirk",
  "Alloa Clackmannanshire",
  "Tillicoultry Clackmannanshire",
  "Dollar Clackmannanshire",
  "Callander Stirling",
  "Dunblane Stirling",
];

const ALL_AREAS = [
  ...WINCHESTER_AREAS,
  ...CARLISLE_AREAS,
  ...SHREWSBURY_AREAS,
  ...CHELTENHAM_AREAS,
  ...GRIMSBY_AREAS,
  ...PORTSMOUTH_AREAS,
  ...GUILDFORD_AREAS,
  ...HEREFORD_AREAS,
  ...BURNLEY_AREAS,
  ...DUNDEE_AREAS,
  ...INVERNESS_AREAS,
  ...PERTH_AREAS,
  ...STIRLING_AREAS,
];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // Winchester / Hampshire
  { label: "Winchester",               lat: 51.0632, lng: -1.3080 },
  { label: "Basingstoke",              lat: 51.2665, lng: -1.0873 },
  { label: "Fareham / Gosport",        lat: 50.8520, lng: -1.1760 },
  { label: "Havant / Waterlooville",   lat: 50.8560, lng: -1.0490 },
  { label: "Aldershot / Farnborough",  lat: 51.2479, lng: -0.7598 },

  // Carlisle / Cumbria
  { label: "Carlisle City",            lat: 54.8951, lng: -2.9382 },
  { label: "Penrith",                  lat: 54.6640, lng: -2.7530 },
  { label: "Whitehaven",               lat: 54.5486, lng: -3.5875 },
  { label: "Barrow-in-Furness",        lat: 54.1108, lng: -3.2268 },
  { label: "Kendal",                   lat: 54.3230, lng: -2.7440 },
  { label: "Workington",               lat: 54.6430, lng: -3.5430 },

  // Shrewsbury / Shropshire
  { label: "Shrewsbury",               lat: 52.7080, lng: -2.7540 },
  { label: "Telford",                  lat: 52.6760, lng: -2.4490 },
  { label: "Oswestry",                 lat: 52.8600, lng: -3.0540 },
  { label: "Bridgnorth",               lat: 52.5340, lng: -2.4200 },

  // Cheltenham / Gloucester
  { label: "Cheltenham",               lat: 51.8994, lng: -2.0783 },
  { label: "Gloucester City",          lat: 51.8642, lng: -2.2385 },
  { label: "Stroud",                   lat: 51.7450, lng: -2.2160 },
  { label: "Cirencester",              lat: 51.7152, lng: -1.9659 },

  // Grimsby / Lincolnshire coast
  { label: "Grimsby",                  lat: 53.5668, lng: -0.0798 },
  { label: "Scunthorpe",               lat: 53.5810, lng: -0.6510 },
  { label: "Louth",                    lat: 53.3670, lng: -0.0050 },
  { label: "Gainsborough",             lat: 53.4010, lng: -0.7720 },

  // Portsmouth / Hampshire coast
  { label: "Portsmouth",               lat: 50.7989, lng: -1.0919 },
  { label: "Chichester",               lat: 50.8365, lng: -0.7792 },
  { label: "Bognor Regis",             lat: 50.7830, lng: -0.6780 },

  // Guildford / Surrey
  { label: "Guildford",                lat: 51.2362, lng: -0.5704 },
  { label: "Woking",                   lat: 51.3188, lng: -0.5581 },
  { label: "Farnham / Aldershot",      lat: 51.2150, lng: -0.7990 },
  { label: "Reigate / Redhill",        lat: 51.2370, lng: -0.1780 },
  { label: "Leatherhead / Dorking",    lat: 51.3000, lng: -0.3300 },

  // Hereford
  { label: "Hereford",                 lat: 52.0567, lng: -2.7160 },
  { label: "Ross-on-Wye",              lat: 51.9140, lng: -2.5880 },
  { label: "Leominster",               lat: 52.2270, lng: -2.7380 },

  // Burnley / East Lancashire
  { label: "Burnley",                  lat: 53.7890, lng: -2.2370 },
  { label: "Nelson / Colne",           lat: 53.8370, lng: -2.2090 },
  { label: "Accrington",               lat: 53.7530, lng: -2.3630 },
  { label: "Rawtenstall / Bacup",      lat: 53.7070, lng: -2.2900 },

  // Dundee / Angus
  { label: "Dundee City",              lat: 56.4620, lng: -2.9707 },
  { label: "Broughty Ferry",           lat: 56.4690, lng: -2.8690 },
  { label: "Arbroath",                 lat: 56.5574, lng: -2.5870 },
  { label: "Forfar / Kirriemuir",      lat: 56.6430, lng: -2.8890 },

  // Inverness / Highlands
  { label: "Inverness",                lat: 57.4778, lng: -4.2247 },
  { label: "Nairn / Forres",           lat: 57.5860, lng: -3.7530 },
  { label: "Elgin",                    lat: 57.6490, lng: -3.3120 },
  { label: "Fort William",             lat: 56.8198, lng: -5.1052 },
  { label: "Aviemore",                 lat: 57.1930, lng: -3.8280 },

  // Perth / Perthshire
  { label: "Perth City",               lat: 56.3950, lng: -3.4309 },
  { label: "Crieff / Auchterarder",    lat: 56.3720, lng: -3.8400 },
  { label: "Pitlochry",                lat: 56.7040, lng: -3.7340 },
  { label: "Kinross",                  lat: 56.2030, lng: -3.4250 },

  // Stirling / Central Scotland
  { label: "Stirling City",            lat: 56.1165, lng: -3.9369 },
  { label: "Falkirk",                  lat: 56.0020, lng: -3.7840 },
  { label: "Alloa",                    lat: 56.1150, lng: -3.7900 },
  { label: "Dunblane",                 lat: 56.1880, lng: -3.9630 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Query builders
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_QUERIES: Array<(area: string) => string> = [
  (a) => `locksmith ${a}`,
  (a) => `independent locksmith ${a} UK`,
  (a) => `emergency locksmith ${a} UK`,
  (a) => `auto locksmith ${a} UK`,
  (a) => `24 hour locksmith ${a}`,
  (a) => `residential locksmith ${a}`,
  (a) => `commercial locksmith ${a}`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Chain filter
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
  "mr. speedy", "mr speedy",
];
function isChain(name: string): boolean {
  return CHAIN_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────
interface PlaceResult { place_id: string; name: string; formatted_address: string; }
interface PlaceDetails {
  name: string; formatted_address: string;
  formatted_phone_number?: string; international_phone_number?: string;
  website?: string; rating?: number; user_ratings_total?: number; business_status?: string;
}
// Normalised result that may already contain full details (from SerpAPI)
interface NormalisedPlace {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  // When false we still need a getDetails call (Google Places path)
  detailsComplete: boolean;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = 4): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) { await sleep(Math.min(5000 * attempt, 20000)); }
      else throw err;
    }
  }
  throw new Error("exhausted retries");
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places API (primary)
// ─────────────────────────────────────────────────────────────────────────────
const GPLACES_BASE = "https://maps.googleapis.com/maps/api/place";

async function gPlacesTextSearch(query: string, pageToken?: string): Promise<{ results: NormalisedPlace[]; nextPageToken?: string; denied: boolean }> {
  if (!API_KEY) return { results: [], denied: true };
  const url = new URL(`${GPLACES_BASE}/textsearch/json`);
  url.searchParams.set("query", query);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("region", "gb");
  if (pageToken) url.searchParams.set("pagetoken", pageToken);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
    console.warn(`  ⚠  Google Places: ${data.status} — switching to SerpAPI fallback`);
    googleAvailable = false;
    return { results: [], denied: true };
  }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  Google: ${data.status}`);
  const results: NormalisedPlace[] = (data.results || []).map((r: any) => ({
    placeId: r.place_id, name: r.name, address: r.formatted_address,
    rating: r.rating, reviewCount: r.user_ratings_total, detailsComplete: false,
  }));
  return { results, nextPageToken: data.next_page_token, denied: false };
}

async function gPlacesNearbySearch(lat: number, lng: number, pageToken?: string): Promise<{ results: NormalisedPlace[]; nextPageToken?: string; denied: boolean }> {
  if (!API_KEY) return { results: [], denied: true };
  const url = new URL(`${GPLACES_BASE}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "5000");
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("key", API_KEY);
  if (pageToken) url.searchParams.set("pagetoken", pageToken);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
    console.warn(`  ⚠  Google Places: ${data.status} — switching to SerpAPI fallback`);
    googleAvailable = false;
    return { results: [], denied: true };
  }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  Google: ${data.status}`);
  const results: NormalisedPlace[] = (data.results || []).map((r: any) => ({
    placeId: r.place_id, name: r.name, address: r.formatted_address,
    rating: r.rating, reviewCount: r.user_ratings_total, detailsComplete: false,
  }));
  return { results, nextPageToken: data.next_page_token, denied: false };
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!API_KEY) return null;
  const url = new URL(`${GPLACES_BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status");
  url.searchParams.set("key", API_KEY);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  return data.status === "OK" ? data.result : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI Google Maps (fallback)
// ─────────────────────────────────────────────────────────────────────────────
const SERP_BASE = "https://serpapi.com/search.json";

function normaliseSerpResult(r: any): NormalisedPlace | null {
  const placeId = r.place_id || r.data_id || null;
  if (!placeId || !r.title) return null;
  return {
    placeId,
    name: r.title,
    address: r.address || "",
    phone: r.phone || undefined,
    website: r.website || undefined,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    reviewCount: typeof r.reviews === "number" ? r.reviews : undefined,
    detailsComplete: true, // SerpAPI includes phone + website in search results
  };
}

async function serpTextSearch(query: string, start = 0): Promise<{ results: NormalisedPlace[]; hasMore: boolean }> {
  if (!SERP_KEY) return { results: [], hasMore: false };
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  if (start > 0) url.searchParams.set("start", String(start));
  url.searchParams.set("api_key", SERP_KEY);
  try {
    const res = await fetchWithRetry(url.toString());
    const data = await res.json() as any;
    if (data.error) { console.warn(`  ⚠  SerpAPI: ${data.error}`); return { results: [], hasMore: false }; }
    const results = (data.local_results || []).map(normaliseSerpResult).filter(Boolean) as NormalisedPlace[];
    const hasMore = results.length === 20 && start < 40; // max 3 pages
    return { results, hasMore };
  } catch (err) {
    console.warn(`  ⚠  SerpAPI error: ${err}`);
    return { results: [], hasMore: false };
  }
}

async function serpNearbySearch(lat: number, lng: number, query = "locksmith"): Promise<{ results: NormalisedPlace[] }> {
  if (!SERP_KEY) return { results: [] };
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("ll", `@${lat},${lng},14z`);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("api_key", SERP_KEY);
  try {
    const res = await fetchWithRetry(url.toString());
    const data = await res.json() as any;
    if (data.error) { console.warn(`  ⚠  SerpAPI: ${data.error}`); return { results: [] }; }
    const results = (data.local_results || []).map(normaliseSerpResult).filter(Boolean) as NormalisedPlace[];
    return { results };
  } catch (err) {
    console.warn(`  ⚠  SerpAPI error: ${err}`);
    return { results: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified search wrappers — try Google first, fall back to SerpAPI
// ─────────────────────────────────────────────────────────────────────────────
async function textSearch(query: string): Promise<NormalisedPlace[]> {
  const all: NormalisedPlace[] = [];

  if (googleAvailable) {
    let pageToken: string | undefined;
    let page = 0;
    do {
      const { results, nextPageToken, denied } = await gPlacesTextSearch(query, pageToken);
      if (denied) break; // fall through to SerpAPI
      all.push(...results);
      pageToken = nextPageToken;
      page++;
      if (pageToken) await sleep(2200);
    } while (pageToken && page < 3);
    if (googleAvailable) return all; // Google worked fine
  }

  // SerpAPI fallback
  if (!SERP_KEY) return all;
  let start = 0;
  let hasMore = true;
  while (hasMore) {
    const { results, hasMore: more } = await serpTextSearch(query, start);
    all.push(...results);
    hasMore = more;
    start += 20;
    if (hasMore) await sleep(1000);
  }
  return all;
}

async function nearbySearch(lat: number, lng: number): Promise<NormalisedPlace[]> {
  const all: NormalisedPlace[] = [];

  if (googleAvailable) {
    let pageToken: string | undefined;
    let page = 0;
    do {
      const { results, nextPageToken, denied } = await gPlacesNearbySearch(lat, lng, pageToken);
      if (denied) break;
      all.push(...results);
      pageToken = nextPageToken;
      page++;
      if (pageToken) await sleep(2200);
    } while (pageToken && page < 3);
    if (googleAvailable) return all;
  }

  if (!SERP_KEY) return all;
  const { results } = await serpNearbySearch(lat, lng, "locksmith");
  all.push(...results);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction (socket-safe)
// ─────────────────────────────────────────────────────────────────────────────
function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 3 || !url) return Promise.resolve("");
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    let settled = false;
    const done = (val: string) => { if (!settled) { settled = true; resolve(val); } };
    let req: any;
    const timer = setTimeout(() => { try { req?.destroy(); } catch {} done(""); }, 7000);
    try {
      req = protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 7000 }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer); res.resume();
          fetchHtml(res.headers.location, redirects + 1).then(done); return;
        }
        let data = "";
        res.on("data", (c: any) => { data += c; if (data.length > 400_000) { try { req?.destroy(); } catch {} done(data); } });
        res.on("end", () => { clearTimeout(timer); done(data); });
        res.on("error", () => { clearTimeout(timer); done(""); });
      });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); done(""); });
      req.on("error",   () => { clearTimeout(timer); done(""); });
    } catch { clearTimeout(timer); done(""); }
  });
}

const EMAIL_BLOCKLIST = [
  "noreply","no-reply","donotreply","example","sentry","wixpress",
  "squarespace","wordpress.com","amazonaws","cloudflare","googletagmanager",
  "doubleclick","sendgrid","mailchimp","newsletter","webmaster","postmaster",
  "schema.org","w3.org","email@","@email","user@","@domain","test@","@test",
  "name@","@company","your@","info@info",
];
function extractEmails(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set((html.match(re) || []).filter(e =>
    !EMAIL_BLOCKLIST.some(b => e.toLowerCase().includes(b)) &&
    !/\.(png|jpg|gif|svg|css|js|woff|ttf)$/i.test(e)
  ))];
}
async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/get-in-touch`];
  for (const pageUrl of pages) {
    const html = await fetchHtml(pageUrl);
    const emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
    if (html) await sleep(150);
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_FILE = "/tmp/gap-cities-progress.json";
function loadCompleted(): string[] {
  try { if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")); }
  catch {}
  return [];
}
function markDone(area: string, completed: string[]) {
  completed.push(area);
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(completed, null, 2), "utf8");
}

let totalSaved = 0;

async function processBatch(results: NormalisedPlace[], areaLabel: string, seen: Set<string>) {
  for (const place of results) {
    if (seen.has(place.placeId)) continue;
    if (isChain(place.name)) { console.log(`   ⛔ Chain: ${place.name}`); continue; }
    seen.add(place.placeId);
    await sleep(150);

    let name    = place.name;
    let address = place.address;
    let phone   = place.phone || "";
    let website = place.website || "";
    let rating  = place.rating || 0;
    let reviews = place.reviewCount || 0;

    // Google Places path — need a details call for phone/website
    if (!place.detailsComplete && googleAvailable) {
      const details = await getDetails(place.placeId);
      if (!details || details.business_status === "CLOSED_PERMANENTLY") continue;
      name    = details.name;
      address = details.formatted_address || address;
      phone   = details.formatted_phone_number || details.international_phone_number || "";
      website = details.website || "";
      rating  = details.rating || 0;
      reviews = details.user_ratings_total || 0;
    }

    const email = await extractEmailFromWebsite(website);
    console.log(`   ✅ ${name} | ${phone || "no phone"} | ${email ? `📧 ${email}` : "—"}`);
    try {
      await (prisma as any).locksmithLead.upsert({
        where: { googlePlaceId: place.placeId },
        update: { name, city: areaLabel, address, phone: phone || null, email: email || null, website: website || null, rating, reviewCount: reviews },
        create: { googlePlaceId: place.placeId, name, city: areaLabel, address, phone: phone || null, email: email || null, website: website || null, rating, reviewCount: reviews, status: "new" },
      });
      totalSaved++;
    } catch (e) { console.warn(`   ⚠  DB save failed for ${name}: ${e}`); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const doEnrich = process.argv.includes("--enrich");
  const isResume = process.argv.includes("--resume");

  const regions = [
    { name: "Winchester + Hampshire",         count: WINCHESTER_AREAS.length },
    { name: "Carlisle + Cumbria",             count: CARLISLE_AREAS.length },
    { name: "Shrewsbury + Shropshire",        count: SHREWSBURY_AREAS.length },
    { name: "Cheltenham + Gloucestershire",   count: CHELTENHAM_AREAS.length },
    { name: "Grimsby + Lincolnshire coast",   count: GRIMSBY_AREAS.length },
    { name: "Portsmouth + Hampshire coast",   count: PORTSMOUTH_AREAS.length },
    { name: "Guildford + Surrey",             count: GUILDFORD_AREAS.length },
    { name: "Hereford + Herefordshire",       count: HEREFORD_AREAS.length },
    { name: "Burnley + East Lancashire",      count: BURNLEY_AREAS.length },
    { name: "Dundee + Angus",                 count: DUNDEE_AREAS.length },
    { name: "Inverness + Highlands",          count: INVERNESS_AREAS.length },
    { name: "Perth + Perthshire",             count: PERTH_AREAS.length },
    { name: "Stirling + Central Scotland",    count: STIRLING_AREAS.length },
  ];

  console.log("🗺   Gap Cities UK locksmith scrape\n");
  regions.forEach(r => console.log(`   ${r.name.padEnd(36)} ${r.count} areas`));
  console.log(`\n   Total named areas : ${ALL_AREAS.length} × 7 query types`);
  console.log(`   Grid points       : ${GRID_POINTS.length}`);
  console.log(`   Enrichment        : ${doEnrich ? "enabled" : "disabled (pass --enrich to enable)"}`);
  console.log(`   Resume            : ${isResume ? "yes" : "no (pass --resume to skip completed areas)"}\n`);

  const completed = isResume ? loadCompleted() : [];
  const seen = new Set<string>();
  const existing = await (prisma as any).locksmithLead.findMany({ select: { googlePlaceId: true } });
  for (const r of existing) seen.add(r.googlePlaceId);
  console.log(`   Existing DB records: ${seen.size} (will skip)\n`);

  // ── PHASE 1: Named area text searches ─────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1 — Named area text searches");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const area of ALL_AREAS) {
    if (isResume && completed.includes(area)) { console.log(`   ⏭  ${area}`); continue; }
    console.log(`\n📍 ${area}`);
    try {
      for (const buildQuery of SEARCH_QUERIES) {
        const results = await textSearch(buildQuery(area));
        await processBatch(results, area, seen);
        await sleep(300);
      }
      markDone(area, completed);
    } catch (err) { console.error(`   ❌ ${area}: ${err}`); }
  }

  // ── PHASE 2: Coordinate grid nearby search ────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PHASE 2 — Coordinate grid nearby search");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const point of GRID_POINTS) {
    const key = `GRID:${point.label}`;
    if (isResume && completed.includes(key)) { console.log(`   ⏭  ${point.label}`); continue; }
    console.log(`\n📡 ${point.label} (${point.lat}, ${point.lng})`);
    try {
      const results = await nearbySearch(point.lat, point.lng);
      await processBatch(results, point.label, seen);
      markDone(key, completed);
    } catch (err) { console.error(`   ❌ ${point.label}: ${err}`); }
  }

  const dbTotal = await (prisma as any).locksmithLead.count();
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`   Saved this run : ${totalSaved}`);
  console.log(`   DB total now   : ${dbTotal}`);
  console.log("═══════════════════════════════════════════════════════\n");

  if (doEnrich) {
    console.log("\n📧  Email enrichment…\n");
    const targets = await (prisma as any).locksmithLead.findMany({
      where: { email: { equals: null }, website: { not: null } },
      select: { id: true, name: true, website: true },
    });
    console.log(`   ${targets.length} leads to enrich`);
    let enriched = 0;
    for (let i = 0; i < targets.length; i++) {
      if (i % 20 === 0) console.log(`   ${i}/${targets.length}…`);
      try {
        const email = await extractEmailFromWebsite(targets[i].website);
        if (email) {
          await (prisma as any).locksmithLead.update({ where: { id: targets[i].id }, data: { email } });
          console.log(`   ✅ ${targets[i].name} → ${email}`);
          enriched++;
        }
      } catch {}
      await sleep(300);
    }
    console.log(`\n   Enriched: ${enriched} leads`);
  }

  console.log("🎉  Gap cities scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
