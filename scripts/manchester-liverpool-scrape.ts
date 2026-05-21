/**
 * manchester-liverpool-scrape.ts
 *
 * Hyper-local locksmith scraper for Greater Manchester & Merseyside.
 * Combines:
 *   1. Text searches for 100+ neighbourhood names × 7 query types
 *   2. Coordinate grid-search across 30 points covering both metro areas
 *
 * All results are upserted into DB; existing place IDs are never overwritten
 * with lower-quality data and are deduplicated in memory.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... DATABASE_URL=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/manchester-liverpool-scrape.ts
 *
 * Optional flags:
 *   --resume   Skip areas already recorded in the progress file
 *   --enrich   After scraping, visit websites to extract missing emails
 */

import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

process.on("uncaughtException",  (err)    => console.error("💥 uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("💥 unhandledRejection:", reason));

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error("❌  GOOGLE_PLACES_API_KEY not set"); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// Named areas — Greater Manchester (city / borough / district level)
// ─────────────────────────────────────────────────────────────────────────────
const MCR_AREAS = [
  // ── Manchester City Neighbourhoods ──────────────────────────────────────
  "Manchester City Centre",
  "Ancoats Manchester",
  "Ardwick Manchester",
  "Beswick Manchester",
  "Bradford Manchester",
  "Burnage Manchester",
  "Chorlton Manchester",
  "Chorlton-cum-Hardy Manchester",
  "Clayton Manchester",
  "Collyhurst Manchester",
  "Crumpsall Manchester",
  "Didsbury Manchester",
  "Fallowfield Manchester",
  "Gorton Manchester",
  "Hulme Manchester",
  "Levenshulme Manchester",
  "Longsight Manchester",
  "Moston Manchester",
  "Moss Side Manchester",
  "Newton Heath Manchester",
  "Northern Quarter Manchester",
  "Openshaw Manchester",
  "Rusholme Manchester",
  "Whalley Range Manchester",
  "Withington Manchester",
  "Wythenshawe Manchester",

  // ── Salford ─────────────────────────────────────────────────────────────
  "Salford City Centre",
  "Eccles Salford",
  "Swinton Salford",
  "Worsley Salford",
  "Irlam Salford",
  "Little Hulton Salford",
  "Pendleton Salford",
  "Weaste Salford",
  "Monton Salford",
  "Pendlebury Salford",

  // ── Trafford ─────────────────────────────────────────────────────────────
  "Old Trafford",
  "Altrincham",
  "Sale Greater Manchester",
  "Stretford Trafford",
  "Urmston Trafford",
  "Partington Trafford",
  "Bowdon Trafford",
  "Hale Altrincham",
  "Timperley Altrincham",

  // ── Stockport ────────────────────────────────────────────────────────────
  "Stockport Town Centre",
  "Cheadle Stockport",
  "Hazel Grove Stockport",
  "Romiley Stockport",
  "Marple Stockport",
  "Bramhall Stockport",

  // ── Bury ─────────────────────────────────────────────────────────────────
  "Bury Greater Manchester",
  "Radcliffe Bury",
  "Ramsbottom Bury",
  "Prestwich Bury",
  "Whitefield Bury",
  "Tottington Bury",

  // ── Bolton ──────────────────────────────────────────────────────────────
  "Bolton Town Centre",
  "Farnworth Bolton",
  "Horwich Bolton",
  "Westhoughton Bolton",
  "Little Lever Bolton",
  "Kearsley Bolton",

  // ── Oldham ──────────────────────────────────────────────────────────────
  "Oldham Town Centre",
  "Chadderton Oldham",
  "Royton Oldham",
  "Saddleworth Oldham",
  "Shaw Oldham",
  "Failsworth Oldham",

  // ── Rochdale ────────────────────────────────────────────────────────────
  "Rochdale Town Centre",
  "Heywood Rochdale",
  "Middleton Greater Manchester",
  "Milnrow Rochdale",
  "Norden Rochdale",

  // ── Tameside ────────────────────────────────────────────────────────────
  "Ashton-under-Lyne",
  "Stalybridge Tameside",
  "Hyde Tameside",
  "Denton Tameside",
  "Droylsden Tameside",
  "Dukinfield Tameside",
  "Mossley Tameside",

  // ── Wigan ────────────────────────────────────────────────────────────────
  "Wigan Town Centre",
  "Leigh Greater Manchester",
  "Hindley Wigan",
  "Atherton Wigan",
  "Golborne Wigan",
];

// ─────────────────────────────────────────────────────────────────────────────
// Named areas — Merseyside / Liverpool
// ─────────────────────────────────────────────────────────────────────────────
const LIV_AREAS = [
  // ── Liverpool City ───────────────────────────────────────────────────────
  "Liverpool City Centre",
  "Toxteth Liverpool",
  "Aigburth Liverpool",
  "Allerton Liverpool",
  "Anfield Liverpool",
  "Belle Vale Liverpool",
  "Childwall Liverpool",
  "Clubmoor Liverpool",
  "Croxteth Liverpool",
  "Edge Hill Liverpool",
  "Everton Liverpool",
  "Fazakerley Liverpool",
  "Garston Liverpool",
  "Grassendale Liverpool",
  "Kensington Liverpool",
  "Kirkdale Liverpool",
  "Mossley Hill Liverpool",
  "Norris Green Liverpool",
  "Old Swan Liverpool",
  "Speke Liverpool",
  "Tuebrook Liverpool",
  "Walton Liverpool",
  "Wavertree Liverpool",
  "West Derby Liverpool",
  "Woolton Liverpool",
  "Dingle Liverpool",

  // ── Knowsley ─────────────────────────────────────────────────────────────
  "Kirkby Merseyside",
  "Huyton Knowsley",
  "Prescot Merseyside",
  "Halewood Liverpool",

  // ── Sefton ──────────────────────────────────────────────────────────────
  "Bootle Merseyside",
  "Crosby Merseyside",
  "Maghull Sefton",
  "Waterloo Merseyside",
  "Formby Sefton",
  "Southport Merseyside",

  // ── Wirral ──────────────────────────────────────────────────────────────
  "Birkenhead Wirral",
  "Wallasey Wirral",
  "Heswall Wirral",
  "Bebington Wirral",
  "Bromborough Wirral",
  "West Kirby Wirral",
  "Prenton Birkenhead",

  // ── St Helens ────────────────────────────────────────────────────────────
  "St Helens Merseyside",
  "Newton-le-Willows",
  "Haydock St Helens",

  // ── Halton ──────────────────────────────────────────────────────────────
  "Runcorn Cheshire",
  "Widnes Cheshire",
];

const ALL_AREAS = [...MCR_AREAS, ...LIV_AREAS];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid — 30 points covering Greater Manchester + Merseyside
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // ── Manchester core ─────────────────────────────────────────────────────
  { label: "Manchester City Centre",      lat: 53.4808, lng: -2.2426 },
  { label: "Salford",                     lat: 53.4875, lng: -2.2901 },
  { label: "Old Trafford / Stretford",    lat: 53.4607, lng: -2.2890 },
  { label: "Chorlton / Didsbury",         lat: 53.4300, lng: -2.2400 },
  { label: "Wythenshawe",                 lat: 53.3900, lng: -2.2700 },
  { label: "Gorton / Openshaw",           lat: 53.4700, lng: -2.1700 },
  { label: "Newton Heath / Moston",       lat: 53.5050, lng: -2.1850 },
  { label: "Crumpsall / Collyhurst",      lat: 53.5100, lng: -2.2300 },

  // ── Trafford belt ────────────────────────────────────────────────────────
  { label: "Altrincham / Sale",           lat: 53.4050, lng: -2.3350 },
  { label: "Urmston / Irlam",             lat: 53.4450, lng: -2.3730 },

  // ── Salford outer ────────────────────────────────────────────────────────
  { label: "Eccles / Swinton",            lat: 53.4850, lng: -2.3350 },
  { label: "Worsley / Little Hulton",     lat: 53.5100, lng: -2.3800 },

  // ── Bolton ────────────────────────────────────────────────────────────────
  { label: "Bolton",                      lat: 53.5778, lng: -2.4282 },
  { label: "Farnworth / Kearsley",        lat: 53.5350, lng: -2.3750 },
  { label: "Horwich / Westhoughton",      lat: 53.5900, lng: -2.5200 },

  // ── Bury ──────────────────────────────────────────────────────────────────
  { label: "Bury",                        lat: 53.5933, lng: -2.2984 },
  { label: "Prestwich / Whitefield",      lat: 53.5450, lng: -2.2750 },
  { label: "Radcliffe / Ramsbottom",      lat: 53.5700, lng: -2.3250 },

  // ── Oldham / Tameside ─────────────────────────────────────────────────────
  { label: "Oldham",                      lat: 53.5409, lng: -2.1114 },
  { label: "Ashton-under-Lyne",           lat: 53.4901, lng: -2.0939 },
  { label: "Hyde / Denton",               lat: 53.4550, lng: -2.0800 },

  // ── Stockport ─────────────────────────────────────────────────────────────
  { label: "Stockport South",             lat: 53.4000, lng: -2.1600 },
  { label: "Cheadle / Bramhall",          lat: 53.3750, lng: -2.2100 },

  // ── Liverpool core ───────────────────────────────────────────────────────
  { label: "Liverpool City Centre",       lat: 53.4084, lng: -2.9916 },
  { label: "Toxteth / Aigburth",          lat: 53.3800, lng: -2.9700 },
  { label: "Walton / Kirkdale",           lat: 53.4425, lng: -2.9620 },
  { label: "West Derby / Norris Green",   lat: 53.4350, lng: -2.9200 },
  { label: "Speke / Garston",             lat: 53.3600, lng: -2.8750 },
  { label: "Bootle / Crosby",             lat: 53.4700, lng: -3.0100 },

  // ── Merseyside wider ─────────────────────────────────────────────────────
  { label: "Kirkby / Huyton",             lat: 53.4900, lng: -2.8950 },
  { label: "Birkenhead / Wallasey",       lat: 53.3950, lng: -3.0300 },
  { label: "St Helens",                   lat: 53.4550, lng: -2.7350 },
  { label: "Runcorn / Widnes",            lat: 53.3400, lng: -2.7200 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Query builders — same 7 types as Birmingham scraper
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
// Chain / franchise filter
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
  "mr. speedy", "mr speedy", "key cutting",
];

function isChain(name: string): boolean {
  return CHAIN_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places helpers
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
      if (attempt < retries) {
        const delay = Math.min(5000 * attempt, 20000);
        console.warn(`  ⚠  timeout (attempt ${attempt}/${retries}), retrying in ${delay / 1000}s…`);
        await sleep(delay);
      } else { throw err; }
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
  const data = await res.json() as any;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  Places: ${data.status}`);
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
  const data = await res.json() as any;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  Nearby: ${data.status}`);
  return { results: data.results || [], nextPageToken: data.next_page_token };
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL(`${BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status");
  url.searchParams.set("key", API_KEY!);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  if (data.status !== "OK") return null;
  return data.result ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction (with proper socket destroy on timeout)
// ─────────────────────────────────────────────────────────────────────────────
import * as https from "https";
import * as http from "http";

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
          clearTimeout(timer);
          res.resume();
          fetchHtml(res.headers.location, redirects + 1).then(done);
          return;
        }
        let data = "";
        res.on("data", (c: any) => { data += c; if (data.length > 500_000) { try { req?.destroy(); } catch {} done(data); } });
        res.on("end", () => { clearTimeout(timer); done(data); });
        res.on("error", () => { clearTimeout(timer); done(""); });
      });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); done(""); });
      req.on("error", () => { clearTimeout(timer); done(""); });
    } catch { clearTimeout(timer); done(""); }
  });
}

const EMAIL_BLOCKLIST = [
  "noreply", "no-reply", "donotreply", "example", "sentry", "sampleemail",
  "email@", "@email", "user@", "@domain", "test@", "@test", "info@info",
  "your@", "@your", "name@", "@name", "@company", "@domain.com",
  "wixpress", "squarespace", "wordpress.com", "amazonaws", "cloudflare",
  "googletagmanager", "doubleclick", "sendgrid", "mailchimp", "newsletter",
  "webmaster", "postmaster", "schema.org", "w3.org",
];

function extractEmails(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const raw: string[] = html.match(re) ?? [];
  return [...new Set(raw.filter((e) =>
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
    if (!html) { await sleep(100); continue; }
    const emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
    await sleep(150);
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_FILE = "/tmp/mcr-liv-scrape-progress.json";

function loadCompleted(): string[] {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {}
  return [];
}

function markDone(area: string, completed: string[]) {
  completed.push(area);
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(completed, null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Counters
// ─────────────────────────────────────────────────────────────────────────────
let totalSaved = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Process a batch of Place results — saves each lead immediately
// ─────────────────────────────────────────────────────────────────────────────
async function processBatch(results: PlaceResult[], areaLabel: string, seen: Set<string>) {
  for (const place of results) {
    if (seen.has(place.place_id)) continue;
    if (isChain(place.name)) { console.log(`   ⛔ Chain: ${place.name}`); continue; }
    seen.add(place.place_id);
    await sleep(150);
    const details = await getDetails(place.place_id);
    if (!details) continue;
    if (details.business_status === "CLOSED_PERMANENTLY") continue;

    const phone = details.formatted_phone_number || details.international_phone_number || "";
    const email = await extractEmailFromWebsite(details.website || "");
    const tag = email ? `📧 ${email}` : "—";
    console.log(`   ✅ ${details.name} | ${phone || "no phone"} | ${tag}`);

    try {
      await (prisma as any).locksmithLead.upsert({
        where: { googlePlaceId: place.place_id },
        update: {
          name: details.name, city: areaLabel,
          address: details.formatted_address || place.formatted_address,
          phone: phone || null, email: email || null,
          website: details.website || null,
          rating: details.rating || 0, reviewCount: details.user_ratings_total || 0,
        },
        create: {
          googlePlaceId: place.place_id, name: details.name, city: areaLabel,
          address: details.formatted_address || place.formatted_address,
          phone: phone || null, email: email || null,
          website: details.website || null,
          rating: details.rating || 0, reviewCount: details.user_ratings_total || 0,
          status: "new",
        },
      });
      totalSaved++;
    } catch (e) {
      console.warn(`   ⚠  DB save failed for ${details.name}: ${e}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const doEnrich = process.argv.includes("--enrich");
  const isResume = process.argv.includes("--resume");

  console.log("🏙  Greater Manchester & Merseyside hyper-local locksmith scrape\n");
  console.log(`   Areas:       ${ALL_AREAS.length} named areas × 7 query types`);
  console.log(`   Grid points: ${GRID_POINTS.length} coordinate points × nearby search`);
  console.log(`   Enrichment:  ${doEnrich ? "enabled" : "disabled (pass --enrich to enable)"}`);
  console.log(`   Resume:      ${isResume ? "yes" : "no (pass --resume to skip completed areas)"}\n`);

  const completed = isResume ? loadCompleted() : [];
  const existingIds = new Set<string>();
  const seen = new Set<string>();

  // Pre-load existing place IDs
  const existing = await (prisma as any).locksmithLead.findMany({ select: { googlePlaceId: true } });
  for (const r of existing) { existingIds.add(r.googlePlaceId); seen.add(r.googlePlaceId); }
  console.log(`   Existing DB records: ${existingIds.size} (will skip these place IDs)\n`);

  // ── PHASE 1: Named area text searches ────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1 — Named area text searches");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const area of ALL_AREAS) {
    if (isResume && completed.includes(area)) {
      console.log(`   ⏭  Skipping (done): ${area}`);
      continue;
    }
    console.log(`\n📍 ${area}`);
    try {
      for (const buildQuery of SEARCH_QUERIES) {
        const query = buildQuery(area);
        let pageToken: string | undefined;
        do {
          const { results, nextPageToken } = await textSearch(query, pageToken);
          await processBatch(results, area, seen);
          pageToken = nextPageToken;
          if (pageToken) await sleep(2200);
        } while (pageToken);
        await sleep(300);
      }
      markDone(area, completed);
    } catch (err) {
      console.error(`   ❌ Area failed: ${area} — ${err}`);
    }
  }

  // ── PHASE 2: Coordinate grid nearby search ────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PHASE 2 — Coordinate grid nearby search");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const point of GRID_POINTS) {
    const key = `GRID:${point.label}`;
    if (isResume && completed.includes(key)) {
      console.log(`   ⏭  Skipping (done): ${point.label}`);
      continue;
    }
    console.log(`\n📡 ${point.label} (${point.lat}, ${point.lng})`);
    try {
      let pageToken: string | undefined;
      let page = 0;
      do {
        const { results, nextPageToken } = await nearbySearch(point.lat, point.lng, pageToken);
        await processBatch(results, point.label, seen);
        pageToken = nextPageToken;
        page++;
        if (pageToken) await sleep(2200);
      } while (pageToken && page < 3);
      markDone(key, completed);
    } catch (err) {
      console.error(`   ❌ Grid point failed: ${point.label} — ${err}`);
    }
  }

  const dbTotal = await (prisma as any).locksmithLead.count();
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`   Saved this run : ${totalSaved}`);
  console.log(`   DB total now   : ${dbTotal}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Optional email enrichment ─────────────────────────────────────────────
  if (doEnrich) {
    console.log("\n📧  Email enrichment — scanning websites of newly saved leads…\n");
    const targets = await (prisma as any).locksmithLead.findMany({
      where: { email: { equals: null }, website: { not: null } },
      select: { id: true, name: true, website: true },
    });
    console.log(`   ${targets.length} leads with website but no email.`);
    let enriched = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (i % 20 === 0) console.log(`   Progress: ${i}/${targets.length}…`);
      try {
        const email = await extractEmailFromWebsite(t.website);
        if (email) {
          await (prisma as any).locksmithLead.update({ where: { id: t.id }, data: { email } });
          console.log(`   ✅ ${t.name} → ${email}`);
          enriched++;
        }
      } catch {}
      await sleep(300);
    }
    console.log(`\n   Enriched: ${enriched} leads`);
  }

  console.log("🎉  Manchester + Liverpool deep scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
