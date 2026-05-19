/**
 * birmingham-deep-scrape.ts
 *
 * Hyper-local locksmith scraper for the Greater Birmingham & West Midlands area.
 * Combines:
 *   1. Text searches for 60+ Birmingham neighbourhood / suburb names (7 query types each)
 *   2. Coordinate grid-search across 25 points covering the entire metro area (5 km radius each)
 *
 * All results are upserted into the DB; existing records are skipped (never overwritten with
 * a lower-quality value) and existing place IDs are deduplicated.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... \
 *   npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' \
 *     scripts/birmingham-deep-scrape.ts
 *
 * Optional flag:
 *   --enrich   After scraping, visit websites to find missing emails
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

// ─────────────────────────────────────────────────────────────────────────────
// Birmingham & surrounds — neighbourhood / suburb search terms
// ─────────────────────────────────────────────────────────────────────────────
const BHAM_AREAS = [
  // ── City Core ──────────────────────────────────────────────────────────────
  "Birmingham City Centre",
  "Digbeth Birmingham",
  "Aston Birmingham",
  "Nechells Birmingham",
  "Newtown Birmingham",
  "Hockley Birmingham",
  "Ladywood Birmingham",
  "Edgbaston Birmingham",
  "Bordesley Birmingham",

  // ── North Birmingham ───────────────────────────────────────────────────────
  "Erdington Birmingham",
  "Kingstanding Birmingham",
  "Perry Barr Birmingham",
  "Great Barr Birmingham",
  "Handsworth Birmingham",
  "Witton Birmingham",
  "Gravelly Hill Birmingham",
  "Stockland Green Birmingham",
  "Pype Hayes Birmingham",
  "Chester Road Birmingham",
  "Oscott Birmingham",

  // ── Sutton Coldfield ──────────────────────────────────────────────────────
  "Sutton Coldfield",
  "Four Oaks Sutton Coldfield",
  "Mere Green Sutton Coldfield",
  "Wylde Green Sutton Coldfield",
  "Boldmere Sutton Coldfield",
  "Streetly Birmingham",

  // ── South Birmingham ──────────────────────────────────────────────────────
  "Selly Oak Birmingham",
  "Bournville Birmingham",
  "Kings Heath Birmingham",
  "Moseley Birmingham",
  "Hall Green Birmingham",
  "Stirchley Birmingham",
  "Northfield Birmingham",
  "Kings Norton Birmingham",
  "Longbridge Birmingham",
  "Rubery Birmingham",
  "Rednal Birmingham",
  "Cotteridge Birmingham",
  "Brandwood Birmingham",

  // ── East Birmingham ───────────────────────────────────────────────────────
  "Yardley Birmingham",
  "Acocks Green Birmingham",
  "Sparkhill Birmingham",
  "Sparkbrook Birmingham",
  "Small Heath Birmingham",
  "Tyseley Birmingham",
  "Sheldon Birmingham",
  "Garretts Green Birmingham",
  "Stechford Birmingham",
  "Ward End Birmingham",
  "Hodge Hill Birmingham",
  "Bordesley Green Birmingham",

  // ── West Birmingham ───────────────────────────────────────────────────────
  "Harborne Birmingham",
  "Quinton Birmingham",
  "Bartley Green Birmingham",
  "Weoley Castle Birmingham",
  "Selly Park Birmingham",

  // ── West Midlands Metro ───────────────────────────────────────────────────
  "Solihull",
  "Shirley Solihull",
  "Dorridge Solihull",
  "Knowle Solihull",
  "Balsall Common",
  "Castle Bromwich Birmingham",
  "Chelmsley Wood Birmingham",
  "Water Orton Birmingham",
  "Coleshill Birmingham",
  "Marston Green Birmingham",

  // ── Black Country Borders ─────────────────────────────────────────────────
  "Halesowen",
  "Oldbury West Midlands",
  "Smethwick",
  "Tipton West Midlands",
  "Wednesbury West Midlands",
  "Willenhall West Midlands",

  // ── South of Birmingham ───────────────────────────────────────────────────
  "Bromsgrove",
  "Redditch",
  "Alvechurch",
];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid — 25 points covering the entire Greater Birmingham metro area
// Each point uses a 5 km radius.  Points are spaced ~7–8 km apart so circles overlap.
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // Inner core
  { label: "Birmingham City Centre",    lat: 52.4862, lng: -1.8904 },
  { label: "Aston / Nechells",          lat: 52.5050, lng: -1.8750 },
  { label: "Edgbaston",                 lat: 52.4700, lng: -1.9150 },
  { label: "Small Heath / Sparkhill",   lat: 52.4680, lng: -1.8620 },
  { label: "Bordesley / Yardley W",     lat: 52.4750, lng: -1.8300 },

  // North Birmingham
  { label: "Handsworth / Perry Barr",   lat: 52.5150, lng: -1.9200 },
  { label: "Erdington",                 lat: 52.5250, lng: -1.8450 },
  { label: "Kingstanding",              lat: 52.5450, lng: -1.8900 },
  { label: "Great Barr",                lat: 52.5450, lng: -1.9350 },

  // Sutton Coldfield belt
  { label: "Sutton Coldfield South",    lat: 52.5550, lng: -1.8350 },
  { label: "Sutton Coldfield Centre",   lat: 52.5700, lng: -1.8200 },
  { label: "Four Oaks / Streetly",      lat: 52.5850, lng: -1.8600 },

  // South Birmingham
  { label: "Selly Oak / Harborne",      lat: 52.4500, lng: -1.9350 },
  { label: "Moseley / Kings Heath",     lat: 52.4400, lng: -1.8850 },
  { label: "Northfield",                lat: 52.4100, lng: -1.9600 },
  { label: "Kings Norton",              lat: 52.3950, lng: -1.9200 },
  { label: "Longbridge / Rubery",       lat: 52.3850, lng: -2.0000 },

  // East Birmingham
  { label: "Stechford / Hodge Hill",    lat: 52.4900, lng: -1.8000 },
  { label: "Sheldon / Garretts Green",  lat: 52.4600, lng: -1.7850 },
  { label: "Castle Bromwich",           lat: 52.5050, lng: -1.7700 },
  { label: "Chelmsley Wood",            lat: 52.5000, lng: -1.7400 },

  // West Birmingham / Black Country fringe
  { label: "Quinton / Bartley Green",   lat: 52.4650, lng: -1.9800 },
  { label: "Smethwick / Oldbury",       lat: 52.4900, lng: -1.9700 },

  // Wider area
  { label: "Solihull",                  lat: 52.4120, lng: -1.7780 },
  { label: "Bromsgrove",                lat: 52.3350, lng: -2.0550 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Query builders (same 7 types as main scraper)
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
// Chain / franchise filter (same as main scraper)
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

async function fetchWithRetry(url: string, timeoutMs = 30000, retries = 4): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError" || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
      if (isTimeout && attempt < retries) {
        const delay = Math.min(5000 * attempt, 20000);
        console.warn(`  ⚠  timeout (attempt ${attempt}/${retries}), retrying in ${delay / 1000}s…`);
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
  const data = await res.json() as { results: PlaceResult[]; next_page_token?: string; status: string };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") console.warn(`  ⚠  Nearby: ${data.status}`);
  return { results: data.results || [], nextPageToken: data.next_page_token };
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
  return EMAIL_BLOCKLIST.some((b) => email.toLowerCase().includes(b));
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
  MAILTO_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAILTO_REGEX.exec(html)) !== null) {
    const email = m[1].toLowerCase().trim();
    if (!isJunkEmail(email) && email.includes("@")) found.add(email);
  }
  EMAIL_REGEX.lastIndex = 0;
  for (const e of (html.match(EMAIL_REGEX) || [])) {
    const email = e.toLowerCase();
    if (!isJunkEmail(email)) found.add(email);
  }
  return [...found];
}

async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/about-us`, `${base}/get-in-touch`];
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
// Lead type
// ─────────────────────────────────────────────────────────────────────────────
interface Lead {
  placeId: string; name: string; city: string; address: string;
  phone: string; email: string; website: string; rating: number; reviewCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process a batch of Place results
// ─────────────────────────────────────────────────────────────────────────────
async function processBatch(
  results: PlaceResult[],
  areaLabel: string,
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
      placeId: place.place_id,
      name: details.name,
      city: areaLabel,
      address: details.formatted_address || place.formatted_address,
      phone,
      email,
      website: details.website || "",
      rating: details.rating || 0,
      reviewCount: details.user_ratings_total || 0,
    });
    const tag = email ? `📧 ${email}` : "—";
    console.log(`   ✅ ${details.name} | ${phone || "no phone"} | ${tag}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const doEnrich = process.argv.includes("--enrich");

  console.log("🏙  Birmingham & West Midlands hyper-local locksmith scrape\n");
  console.log(`   Areas:       ${BHAM_AREAS.length} named areas × 7 query types`);
  console.log(`   Grid points: ${GRID_POINTS.length} coordinate points × nearby search`);
  console.log(`   Enrichment:  ${doEnrich ? "enabled" : "disabled (pass --enrich to enable)"}\n`);

  // Load existing place IDs so we don't double-process
  type R = { googlePlaceId: string };
  const existing = await (prisma as unknown as { locksmithLead: { findMany: (a: unknown) => Promise<R[]> } }).locksmithLead.findMany({
    select: { googlePlaceId: true },
  }) as R[];
  const seen = new Set<string>(existing.map((e) => e.googlePlaceId));
  console.log(`   Existing DB records: ${seen.size} (will skip these place IDs)\n`);

  const leads: Lead[] = [];
  let phase1done = 0;

  // ── Phase 1: Named area text searches ────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1 — Named area text searches");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const area of BHAM_AREAS) {
    console.log(`\n📍 ${area}`);
    for (const buildQuery of SEARCH_QUERIES) {
      const query = buildQuery(area);
      let pageToken: string | undefined;
      let page = 0;
      do {
        if (page > 0) await sleep(2500);
        const { results, nextPageToken } = await textSearch(query, pageToken);
        pageToken = nextPageToken;
        page++;
        await processBatch(results, area, seen, leads);
      } while (pageToken && page < 3);
      await sleep(400);
    }
    phase1done++;
    console.log(`   → ${leads.length} new leads so far (${phase1done}/${BHAM_AREAS.length} areas done)`);
  }

  // ── Phase 2: Coordinate grid nearby searches ─────────────────────────────
  console.log("\n\n═══════════════════════════════════════════════════════");
  console.log("  PHASE 2 — Coordinate grid nearby searches");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const point of GRID_POINTS) {
    console.log(`\n🗺  ${point.label} (${point.lat}, ${point.lng})`);
    let pageToken: string | undefined;
    let page = 0;
    do {
      if (page > 0) await sleep(2500);
      const { results, nextPageToken } = await nearbySearch(point.lat, point.lng, pageToken);
      pageToken = nextPageToken;
      page++;
      await processBatch(results, point.label, seen, leads);
    } while (pageToken && page < 3);
    console.log(`   → ${leads.length} new leads so far`);
  }

  console.log(`\n\n✨  Found ${leads.length} new Birmingham-area locksmiths.\n`);

  // ── Save to DB ─────────────────────────────────────────────────────────────
  console.log("💾  Saving to database…");
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
  console.log(`   Saved: ${saved}  |  Skipped (errors): ${skipped}`);

  // ── Optional email enrichment ─────────────────────────────────────────────
  if (doEnrich) {
    console.log("\n📧  Email enrichment — scanning websites of newly saved leads…\n");
    type NoEmail = { id: string; name: string; website: string | null };
    const targets = await (prisma as unknown as { locksmithLead: { findMany: (a: unknown) => Promise<NoEmail[]> } }).locksmithLead.findMany({
      where: {
        email: null,
        website: { not: null },
        city: { in: [...BHAM_AREAS, ...GRID_POINTS.map((p) => p.label)] },
      },
      select: { id: true, name: true, website: true },
    }) as NoEmail[];
    console.log(`   ${targets.length} leads with website but no email.`);
    let enriched = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (i % 20 === 0) console.log(`   Progress: ${i}/${targets.length}…`);
      const email = await extractEmailFromWebsite(t.website!);
      if (email) {
        await (prisma as unknown as { locksmithLead: { update: (a: unknown) => Promise<unknown> } }).locksmithLead.update({
          where: { id: t.id },
          data: { email },
        });
        console.log(`   ✅ ${t.name} → ${email}`);
        enriched++;
      }
      await sleep(300);
    }
    console.log(`\n   Enriched: ${enriched} leads`);
  }

  console.log("\n🎉  Birmingham deep scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
