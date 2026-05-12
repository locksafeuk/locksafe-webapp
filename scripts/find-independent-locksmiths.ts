/**
 * find-independent-locksmiths.ts
 *
 * Searches Google Places API for independent locksmiths across major UK cities.
 * Filters out known chains, deduplicates, and outputs:
 *   1. CSV file:  data/locksmith-leads.csv
 *   2. Database:  LocksmithLead collection (via Prisma)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/find-independent-locksmiths.ts
 *
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_API_KEY is not set in .env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// UK cities to search across
// ---------------------------------------------------------------------------
const UK_CITIES = [
  "London", "Birmingham", "Manchester", "Leeds", "Glasgow",
  "Sheffield", "Bradford", "Liverpool", "Edinburgh", "Bristol",
  "Cardiff", "Leicester", "Coventry", "Nottingham", "Newcastle upon Tyne",
  "Sunderland", "Brighton", "Hull", "Plymouth", "Stoke-on-Trent",
  "Wolverhampton", "Southampton", "Portsmouth", "Reading", "Derby",
  "Luton", "Preston", "Aberdeen", "Swansea", "Milton Keynes",
  "Northampton", "Norwich", "Oxford", "Cambridge", "Exeter",
  "York", "Peterborough", "Ipswich", "Chelmsford", "Gloucester",
  "Bournemouth", "Swindon", "Blackpool", "Dundee", "Middlesbrough",
  "Slough", "Huddersfield", "Poole", "Eastbourne", "Telford",
];

// ---------------------------------------------------------------------------
// Known chains / franchises to exclude
// ---------------------------------------------------------------------------
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24", "local locksmith", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",  // exclude ourselves
];

// ---------------------------------------------------------------------------
// Google Places API helpers
// ---------------------------------------------------------------------------
const BASE = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Email scraping helpers
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EMAIL_BLOCKLIST = [
  "sentry.io", "example.com", "domain.com", "yourname", "user@", "name@",
  "test@", ".png", ".jpg", ".gif", "schema.org", "w3.org", "placeholder",
  "wixpress.com", "squarespace.com", "wordpress.com", "amazonaws.com",
  "cloudflare.com", "googletagmanager", "doubleclick",
];

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return EMAIL_BLOCKLIST.some((b) => lower.includes(b));
}

async function fetchHtml(rawUrl: string, timeoutMs = 8000): Promise<string> {
  try {
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    new URL(url); // validate
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LockSafeBot/1.0; +https://locksafe.uk)" },
      });
      const text = await res.text();
      return text.slice(0, 400_000);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}

async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`];
  for (const pageUrl of pages) {
    try {
      const html = await fetchHtml(pageUrl);
      const matches = html.match(EMAIL_REGEX) || [];
      const valid = matches.map(e => e.toLowerCase()).filter(e => !isJunkEmail(e));
      if (valid.length > 0) return valid[0];
    } catch { /* continue */ }
    await sleep(300);
  }
  return "";
}

async function textSearch(query: string, pageToken?: string): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const url = new URL(`${BASE}/textsearch/json`);
  url.searchParams.set("query", query);
  url.searchParams.set("key", API_KEY!);
  url.searchParams.set("type", "locksmith");
  url.searchParams.set("region", "gb");
  if (pageToken) url.searchParams.set("pagetoken", pageToken);

  const res = await fetch(url.toString());
  const data = await res.json() as { results: PlaceResult[]; next_page_token?: string; status: string };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`  ⚠ Places API status: ${data.status}`);
  }

  return { results: data.results || [], nextPageToken: data.next_page_token };
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL(`${BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status");
  url.searchParams.set("key", API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json() as { result?: PlaceDetails; status: string };

  if (data.status !== "OK") return null;
  return data.result ?? null;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------
function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
interface Lead {
  placeId: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  reviewCount: number;
}

async function main() {
  console.log("🔍  Searching for independent locksmiths across the UK...\n");

  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const city of UK_CITIES) {
    const query = `independent locksmith ${city} UK`;
    console.log(`📍 ${city}...`);

    let pageToken: string | undefined;
    let page = 0;

    do {
      if (page > 0) await sleep(2500); // wait for next_page_token to activate
      const { results, nextPageToken } = await textSearch(query, pageToken);
      pageToken = nextPageToken;
      page++;

      for (const place of results) {
        if (seen.has(place.place_id)) continue;
        if (isChain(place.name)) {
          console.log(`   ⛔ Skipping chain: ${place.name}`);
          continue;
        }
        seen.add(place.place_id);

        // Rate-limit detail calls
        await sleep(150);
        const details = await getDetails(place.place_id);
        if (!details) continue;

        const phone = details.formatted_phone_number || details.international_phone_number || "";
        const email = await extractEmailFromWebsite(details.website || "");
        leads.push({
          placeId: place.place_id,
          name: details.name,
          city,
          address: details.formatted_address || place.formatted_address,
          phone,
          email,
          website: details.website || "",
          rating: details.rating || 0,
          reviewCount: details.user_ratings_total || 0,
        });

        const tag = email ? `📧 ${email}` : "no email";
        console.log(`   ✅ ${details.name} | ${phone || "no phone"} | ${tag}`);
      }
    } while (pageToken && page < 3); // max 3 pages = ~60 results per city
  }

  console.log(`\n✨  Found ${leads.length} independent locksmiths.\n`);

  // ---------------------------------------------------------------------------
  // Write CSV
  // ---------------------------------------------------------------------------
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const csvPath = path.join(dataDir, "locksmith-leads.csv");
  const header = "Name,Email,Phone,City,Address,Website,Rating,Reviews,Google Place ID\n";
  const rows = leads
    .map((l) =>
      [l.name, l.email, l.phone, l.city, l.address, l.website, l.rating, l.reviewCount, l.placeId]
        .map(escapeCsv)
        .join(",")
    )
    .join("\n");

  fs.writeFileSync(csvPath, header + rows, "utf8");
  console.log(`📄  CSV → ${csvPath}`);
  console.log(`    With email: ${leads.filter(l => l.email).length} / ${leads.length}`);
  console.log(`    With phone: ${leads.filter(l => l.phone).length} / ${leads.length}`);

  // ---------------------------------------------------------------------------
  // Save to database
  // ---------------------------------------------------------------------------
  console.log("\n💾  Saving to database...");
  let saved = 0;
  let skipped = 0;

  for (const lead of leads) {
    try {
      await (prisma as unknown as { locksmithLead: { upsert: (args: unknown) => Promise<unknown> } }).locksmithLead.upsert({
        where: { googlePlaceId: lead.placeId },
        update: {
          name: lead.name,
          city: lead.city,
          address: lead.address,
          phone: lead.phone || null,
          email: lead.email || null,
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
          email: lead.email || null,
          website: lead.website || null,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          status: "new",
        },
      });
      saved++;
    } catch {
      skipped++;
    }
  }

  console.log(`✅  Database: ${saved} saved, ${skipped} skipped.`);
  await prisma.$disconnect();
  console.log("\n🎉  Done! Run the admin dashboard to view & contact leads at /admin/leads");
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
