/**
 * missing-areas-scrape.ts
 *
 * Covers the major UK cities/regions that are under-represented in the DB:
 *   - Wolverhampton + Black Country (Dudley, West Bromwich, Cannock)
 *   - Derby + Derbyshire
 *   - Exeter + Devon
 *   - Swansea + South/West Wales
 *   - Cambridge + Cambridgeshire
 *   - Northampton + Northamptonshire
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... DATABASE_URL=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/missing-areas-scrape.ts
 *
 * Optional flags:
 *   --resume   Skip areas already recorded in the progress file
 *   --enrich   After scraping, visit websites to extract missing emails
 */

import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

process.on("uncaughtException",  (err)    => console.error("💥 uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("💥 unhandledRejection:", reason));

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error("❌  GOOGLE_PLACES_API_KEY not set"); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// Named areas by region
// ─────────────────────────────────────────────────────────────────────────────

const WOLVERHAMPTON_AREAS = [
  "Wolverhampton City Centre",
  "Bilston Wolverhampton",
  "Wednesfield Wolverhampton",
  "Penn Wolverhampton",
  "Tettenhall Wolverhampton",
  "Bushbury Wolverhampton",
  "Fallings Park Wolverhampton",
  "Heath Town Wolverhampton",
  "Whitmore Reans Wolverhampton",
  "Blakenhall Wolverhampton",
  "Finchfield Wolverhampton",
  "Merry Hill Wolverhampton",
  "Low Hill Wolverhampton",
  "Oxley Wolverhampton",
  "Fordhouses Wolverhampton",
  // Black Country
  "Dudley West Midlands",
  "Brierley Hill Dudley",
  "Halesowen West Midlands",
  "Stourbridge West Midlands",
  "West Bromwich",
  "Wednesbury West Midlands",
  "Tipton West Midlands",
  "Willenhall West Midlands",
  "Cannock Staffordshire",
  "Burntwood Staffordshire",
  "Tamworth Staffordshire",
  "Lichfield Staffordshire",
];

const DERBY_AREAS = [
  "Derby City Centre",
  "Allenton Derby",
  "Alvaston Derby",
  "Chaddesden Derby",
  "Chellaston Derby",
  "Littleover Derby",
  "Mackworth Derby",
  "Mickleover Derby",
  "Normanton Derby",
  "Spondon Derby",
  "Sunnyhill Derby",
  "Oakwood Derby",
  "Alfreton Derbyshire",
  "Belper Derbyshire",
  "Burton upon Trent",
  "Ilkeston Derbyshire",
  "Long Eaton Derbyshire",
  "Matlock Derbyshire",
  "Swadlincote Derbyshire",
  "Ripley Derbyshire",
  "Heanor Derbyshire",
  "Ashbourne Derbyshire",
  "Uttoxeter Staffordshire",
];

const EXETER_DEVON_AREAS = [
  "Exeter City Centre",
  "Heavitree Exeter",
  "St Thomas Exeter",
  "Pinhoe Exeter",
  "Exwick Exeter",
  "Wonford Exeter",
  "Exmouth Devon",
  "Newton Abbot Devon",
  "Paignton Devon",
  "Brixham Devon",
  "Totnes Devon",
  "Dawlish Devon",
  "Teignmouth Devon",
  "Honiton Devon",
  "Sidmouth Devon",
  "Crediton Devon",
  "Cullompton Devon",
  "Okehampton Devon",
  "Ivybridge Devon",
  "Tavistock Devon",
  "Kingsbridge Devon",
  "Salcombe Devon",
  "Axminster Devon",
];

const SWANSEA_WALES_AREAS = [
  "Swansea City Centre",
  "Morriston Swansea",
  "Sketty Swansea",
  "Uplands Swansea",
  "Llansamlet Swansea",
  "Gorseinon Swansea",
  "Pontardawe Swansea",
  "Neath",
  "Port Talbot",
  "Bridgend Wales",
  "Maesteg Bridgend",
  "Porthcawl Bridgend",
  "Llanelli Carmarthenshire",
  "Carmarthen",
  "Ammanford Carmarthenshire",
  "Haverfordwest Pembrokeshire",
  "Milford Haven Pembrokeshire",
  "Pembroke Dock",
  "Tenby Pembrokeshire",
  "Aberystwyth Ceredigion",
];

const CAMBRIDGE_AREAS = [
  "Cambridge City Centre",
  "Chesterton Cambridge",
  "Kings Hedges Cambridge",
  "Cherry Hinton Cambridge",
  "Trumpington Cambridge",
  "Arbury Cambridge",
  "Romsey Cambridge",
  "Newmarket Suffolk",
  "Ely Cambridgeshire",
  "Huntingdon Cambridgeshire",
  "St Ives Cambridgeshire",
  "Wisbech Cambridgeshire",
  "March Cambridgeshire",
  "Peterborough Cambridgeshire",
  "Royston Hertfordshire",
  "Saffron Walden Essex",
];

const NORTHAMPTON_AREAS = [
  "Northampton Town Centre",
  "Kingsthorpe Northampton",
  "Weston Favell Northampton",
  "Abington Northampton",
  "Delapre Northampton",
  "Duston Northampton",
  "Billing Northampton",
  "Wellingborough",
  "Kettering Northamptonshire",
  "Rushden Northamptonshire",
  "Daventry Northamptonshire",
  "Towcester Northamptonshire",
  "Brackley Northamptonshire",
  "Market Harborough Leicestershire",
  "Rugby Warwickshire",
  "Lutterworth Leicestershire",
];

const ALL_AREAS = [
  ...WOLVERHAMPTON_AREAS,
  ...DERBY_AREAS,
  ...EXETER_DEVON_AREAS,
  ...SWANSEA_WALES_AREAS,
  ...CAMBRIDGE_AREAS,
  ...NORTHAMPTON_AREAS,
];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid — one cluster per region
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // Wolverhampton / Black Country
  { label: "Wolverhampton Centre",         lat: 52.5862, lng: -2.1278 },
  { label: "Wolverhampton North",          lat: 52.6200, lng: -2.1200 },
  { label: "Wolverhampton South",          lat: 52.5500, lng: -2.1500 },
  { label: "Dudley",                       lat: 52.5079, lng: -2.0811 },
  { label: "West Bromwich",                lat: 52.5187, lng: -1.9845 },
  { label: "Stourbridge / Halesowen",      lat: 52.4550, lng: -2.1500 },
  { label: "Cannock",                      lat: 52.6900, lng: -2.0300 },
  { label: "Tamworth",                     lat: 52.6330, lng: -1.6930 },

  // Derby / Derbyshire
  { label: "Derby City Centre",            lat: 52.9225, lng: -1.4746 },
  { label: "Derby North",                  lat: 52.9600, lng: -1.4600 },
  { label: "Derby South",                  lat: 52.8850, lng: -1.4800 },
  { label: "Burton upon Trent",            lat: 52.8060, lng: -1.6380 },
  { label: "Ilkeston / Long Eaton",        lat: 52.9700, lng: -1.3100 },
  { label: "Chesterfield",                 lat: 53.2350, lng: -1.4210 },

  // Exeter / Devon
  { label: "Exeter City",                  lat: 50.7184, lng: -3.5339 },
  { label: "Exmouth / Dawlish",            lat: 50.6200, lng: -3.4100 },
  { label: "Newton Abbot / Torbay",        lat: 50.5270, lng: -3.6080 },
  { label: "Tiverton / Cullompton",        lat: 50.9000, lng: -3.4900 },
  { label: "Barnstaple",                   lat: 51.0820, lng: -4.0580 },
  { label: "Tavistock / Okehampton",       lat: 50.5500, lng: -4.1400 },

  // Swansea / South Wales
  { label: "Swansea City",                 lat: 51.6214, lng: -3.9436 },
  { label: "Neath / Port Talbot",          lat: 51.6500, lng: -3.7900 },
  { label: "Bridgend",                     lat: 51.5040, lng: -3.5780 },
  { label: "Llanelli",                     lat: 51.6820, lng: -4.1630 },
  { label: "Carmarthen",                   lat: 51.8590, lng: -4.3120 },
  { label: "Haverfordwest",                lat: 51.8020, lng: -4.9720 },
  { label: "Aberystwyth",                  lat: 52.4153, lng: -4.0829 },

  // Cambridge
  { label: "Cambridge City",               lat: 52.2053, lng:  0.1218 },
  { label: "Cambridge North",              lat: 52.2500, lng:  0.1400 },
  { label: "Ely / Newmarket",              lat: 52.3980, lng:  0.2630 },
  { label: "Huntingdon / St Ives",         lat: 52.3310, lng: -0.1870 },
  { label: "Wisbech / March",              lat: 52.6600, lng:  0.1600 },

  // Northampton
  { label: "Northampton Centre",           lat: 52.2405, lng: -0.9027 },
  { label: "Northampton North",            lat: 52.2900, lng: -0.9200 },
  { label: "Wellingborough / Kettering",   lat: 52.3000, lng: -0.7000 },
  { label: "Rugby",                        lat: 52.3700, lng: -1.2660 },
  { label: "Daventry / Towcester",         lat: 52.2600, lng: -1.1600 },
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
// Google Places helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult { place_id: string; name: string; formatted_address: string; }
interface PlaceDetails {
  name: string; formatted_address: string;
  formatted_phone_number?: string; international_phone_number?: string;
  website?: string; rating?: number; user_ratings_total?: number; business_status?: string;
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

async function textSearch(query: string, pageToken?: string) {
  const url = new URL(`${BASE}/textsearch/json`);
  url.searchParams.set("query", query);
  url.searchParams.set("key", API_KEY!);
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("region", "gb");
  if (pageToken) url.searchParams.set("pagetoken", pageToken);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  ${data.status}`);
  return { results: (data.results || []) as PlaceResult[], nextPageToken: data.next_page_token as string | undefined };
}

async function nearbySearch(lat: number, lng: number, pageToken?: string) {
  const url = new URL(`${BASE}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "5000");
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("key", API_KEY!);
  if (pageToken) url.searchParams.set("pagetoken", pageToken);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  ${data.status}`);
  return { results: (data.results || []) as PlaceResult[], nextPageToken: data.next_page_token as string | undefined };
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL(`${BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status");
  url.searchParams.set("key", API_KEY!);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as any;
  return data.status === "OK" ? data.result : null;
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
const PROGRESS_FILE = "/tmp/missing-areas-progress.json";
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

async function processBatch(results: PlaceResult[], areaLabel: string, seen: Set<string>) {
  for (const place of results) {
    if (seen.has(place.place_id)) continue;
    if (isChain(place.name)) { console.log(`   ⛔ Chain: ${place.name}`); continue; }
    seen.add(place.place_id);
    await sleep(150);
    const details = await getDetails(place.place_id);
    if (!details || details.business_status === "CLOSED_PERMANENTLY") continue;
    const phone = details.formatted_phone_number || details.international_phone_number || "";
    const email = await extractEmailFromWebsite(details.website || "");
    console.log(`   ✅ ${details.name} | ${phone || "no phone"} | ${email ? `📧 ${email}` : "—"}`);
    try {
      await (prisma as any).locksmithLead.upsert({
        where: { googlePlaceId: place.place_id },
        update: { name: details.name, city: areaLabel, address: details.formatted_address || place.formatted_address, phone: phone || null, email: email || null, website: details.website || null, rating: details.rating || 0, reviewCount: details.user_ratings_total || 0 },
        create: { googlePlaceId: place.place_id, name: details.name, city: areaLabel, address: details.formatted_address || place.formatted_address, phone: phone || null, email: email || null, website: details.website || null, rating: details.rating || 0, reviewCount: details.user_ratings_total || 0, status: "new" },
      });
      totalSaved++;
    } catch (e) { console.warn(`   ⚠  DB save failed for ${details.name}: ${e}`); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const doEnrich = process.argv.includes("--enrich");
  const isResume = process.argv.includes("--resume");

  const regions = [
    { name: "Wolverhampton + Black Country", count: WOLVERHAMPTON_AREAS.length },
    { name: "Derby + Derbyshire",            count: DERBY_AREAS.length },
    { name: "Exeter + Devon",                count: EXETER_DEVON_AREAS.length },
    { name: "Swansea + South/West Wales",    count: SWANSEA_WALES_AREAS.length },
    { name: "Cambridge + Cambridgeshire",    count: CAMBRIDGE_AREAS.length },
    { name: "Northampton + surrounds",       count: NORTHAMPTON_AREAS.length },
  ];

  console.log("🗺   Multi-region UK locksmith scrape\n");
  regions.forEach(r => console.log(`   ${r.name.padEnd(34)} ${r.count} areas`));
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
        let pageToken: string | undefined;
        do {
          const { results, nextPageToken } = await textSearch(buildQuery(area), pageToken);
          await processBatch(results, area, seen);
          pageToken = nextPageToken;
          if (pageToken) await sleep(2200);
        } while (pageToken);
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

  console.log("🎉  Multi-region scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
