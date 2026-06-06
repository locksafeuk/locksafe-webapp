/**
 * scrape-focus.ts — Immediate, targeted locksmith-lead scrape for a specific
 * set of cities/regions. Use this when you need supply in an area NOW and don't
 * want to wait for the 2-hourly cron to cycle round to it.
 *
 * It mirrors the calibrated cron pipeline (Serper.dev places, multi-query,
 * strict-locksmith + UK checks, KEEP phone-only leads, best-effort email) and
 * upserts into LocksmithLead with status "new" so the outreach sequence (email
 * + Zadarma SMS) picks them up on its next run.
 *
 * Usage:
 *   npm run scrape:focus                       # default = Scotland + North England
 *   npm run scrape:focus -- "Dundee,Glasgow"   # custom comma-separated city list
 *
 * Reads SERPER_API_KEY (or SCRAPER_SERPER_API_KEY) and DATABASE_URL from .env /
 * .env.vercel.prod. Read-only on everything except inserting/updating leads.
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
// Load base env, then prod env (prod wins) so SERPER_API_KEY / DATABASE_URL resolve.
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });
dotenvConfig({ path: path.resolve(__dirname, "..", ".env.vercel.prod"), override: false });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Default target region: Scotland + North East England (+ Carlisle) ────────
const DEFAULT_CITIES = [
  // Scotland
  "Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness",
  "Perth", "Stirling", "Falkirk", "Livingston", "Kilmarnock",
  "Paisley", "Motherwell", "Hamilton", "Ayr", "Dunfermline",
  "Kirkcaldy", "Cumbernauld", "Airdrie", "Coatbridge", "Greenock",
  "Irvine", "Dumfries",
  // North East England
  "Newcastle upon Tyne", "Sunderland", "Gateshead", "Hartlepool",
  "Stockton-on-Tees", "Darlington", "Durham", "South Shields",
  "Jarrow", "Hexham", "Middlesbrough", "Carlisle",
];

const QUERY_BUILDERS: Array<(c: string) => string> = [
  (c) => `locksmith ${c} UK`,
  (c) => `emergency locksmith ${c} UK`,
  (c) => `independent locksmith ${c} UK`,
];

const SERP_MIN_INTERVAL_MS = 400;
const EMAIL_LOOKUP_TIMEOUT_MS = 6000;

// ── Filters (ported from the cron) ───────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham", "chubb", "yale",
  "securitas", "g4s", "keyfax", "fast keys", "locksmith network", "multilock",
  "assa abloy", "ingersoll", "locksmiths24", "locksmiths 24", "lockforce",
  "keytek", "lockrite", "auto locksmith network", "locksafe",
];
const LOCKSMITH_STRONG = [
  /locksmith(s)?/i, /lock/i, /\blocks?\b/i, /\bkey\s*cut(ting)?\b/i,
  /\bauto\s*locksmith\b/i, /\bcar\s*keys?\b/i, /\block\s*out\b/i,
  /\block\s*change\b/i, /\bupvc\b/i,
];
const NON_LOCKSMITH = [
  /\bplumb(er|ing)?\b/i, /\belectric(ian|al)?\b/i, /\bbathroom\b/i,
  /\bkitchen\b/i, /\bglazi(er|ng)?\b/i, /\btil(e|ing)\b/i, /\bcarpet\b/i,
  /\bpainting\b/i, /\bdecorat(or|ing)\b/i, /\broof(ing|er)?\b/i,
  /\bdentist\b/i, /\bsurgery\b/i,
];
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;
const NON_UK_COUNTRY = [/\baustralia\b/i, /\bcanada\b/i, /\busa\b/i, /\bunited states\b/i, /\bnew zealand\b/i];
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const EMAIL_BLOCKLIST = [
  "example.com", "sentry.io", "wixpress.com", "squarespace.com", "wordpress.com",
  "cloudflare.com", "noreply", "no-reply", "postmaster", "webmaster",
  // placeholder/template junk seen in real scrapes
  "email.com", "domain.com", "yourdomain", "locksafe.internal", "@2x", "your@",
];
/** Retina image filenames (logo@2x.png) match the email regex — reject them. */
const EMAIL_FILE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?)$/i;

const isChain = (name: string) => CHAIN_KEYWORDS.some((k) => name.toLowerCase().includes(k));
const hasStrong = (t: string) => LOCKSMITH_STRONG.some((p) => p.test(t));
const hasNeg = (t: string) => NON_LOCKSMITH.some((p) => p.test(t));
const nonUkPhone = (phone: string) => {
  const c = phone.replace(/[^\d+]/g, "");
  if (!c) return false;
  if (c.startsWith("+")) return !c.startsWith("+44");
  if (c.startsWith("00")) return !c.startsWith("0044");
  // NANP-style 10-digit local number, e.g. "(949) 998-3899" — US/Canada.
  // UK national numbers always start with 0. This was the leak that admitted
  // Irvine CA / Hamilton AL / Cambridge MA locksmiths as "UK" leads.
  if (/^[2-9]\d{9}$/.test(c)) return true;
  return false;
};
function looksLocksmith(name: string, address: string, website: string): boolean {
  const t = `${name} ${address} ${website}`;
  return hasStrong(t) && !hasNeg(t);
}
function looksUk(_city: string, address: string, phone: string, website: string): boolean {
  if (NON_UK_COUNTRY.some((p) => p.test(address)) || nonUkPhone(phone)) return false;
  // Require POSITIVE UK evidence. City-name-in-address is NOT enough — many UK
  // city names exist in the US (Irvine, Hamilton, Cambridge, Oxford…).
  const compact = phone.replace(/[^\d+]/g, "");
  const ukPhone = /^(\+44|0044|0)\d/.test(compact);
  return UK_POSTCODE.test(address) || /\.co\.uk\b|\.uk\b/i.test(website) || ukPhone;
}

interface SerperPlace {
  title?: string; address?: string; phoneNumber?: string;
  website?: string; rating?: number; ratingCount?: number;
  cid?: string; placeId?: string;
}
interface Lead {
  placeId: string; name: string; city: string; address: string;
  phone: string; website: string; email: string; rating: number; reviewCount: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function serper(city: string, query: string, apiKey: string): Promise<Lead[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "uk", hl: "en" }),
    });
    if (!res.ok) {
      console.error(`  ! Serper ${res.status} for "${query}"`);
      return [];
    }
    const data = (await res.json()) as { places?: SerperPlace[] };
    const out: Lead[] = [];
    for (const p of data.places ?? []) {
      if (!p.title || isChain(p.title)) continue;
      const placeId =
        p.placeId ||
        (p.cid ? `cid-${p.cid}` : `serper-${Buffer.from(`${p.title}|${p.address ?? ""}`).toString("base64").slice(0, 24)}`);
      out.push({
        placeId, name: p.title, city, address: p.address ?? "",
        phone: p.phoneNumber ?? "", website: p.website ?? "", email: "",
        rating: p.rating ?? 0, reviewCount: p.ratingCount ?? 0,
      });
    }
    return out;
  } catch (e) {
    console.error(`  ! Serper request failed for "${query}":`, e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function findEmail(website: string): Promise<string> {
  if (!website) return "";
  const base = (website.startsWith("http") ? website : `https://${website}`).replace(/\/$/, "");
  for (const url of [base, `${base}/contact`, `${base}/contact-us`]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), EMAIL_LOOKUP_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "LocksafeBot/1.0 (+https://www.locksafe.uk)" } });
      clearTimeout(t);
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 300_000);
      const emails = [...new Set((html.match(EMAIL_REGEX) ?? [])
        .map((m) => m.toLowerCase().trim().replace(/[),.;]+$/, ""))
        .filter((e) =>
          e.includes("@") &&
          !EMAIL_FILE_EXT.test(e) &&
          !EMAIL_BLOCKLIST.some((b) => e.includes(b))))];
      if (emails.length) return emails[0];
    } catch { /* ignore */ }
  }
  return "";
}

async function main() {
  const apiKey = process.env.SERPER_API_KEY || process.env.SCRAPER_SERPER_API_KEY;
  if (!apiKey) {
    console.error("✗ No SERPER_API_KEY / SCRAPER_SERPER_API_KEY found in .env or .env.vercel.prod");
    process.exit(1);
  }

  const argCities = process.argv.slice(2).join(" ").trim();
  const cities = argCities
    ? argCities.split(",").map((c) => c.trim()).filter(Boolean)
    : DEFAULT_CITIES;

  console.log(`\n=== Focus scrape: ${cities.length} cities ===`);
  console.log(cities.join(", ") + "\n");

  // Pre-load existing place IDs for dedup.
  const existing = (await prisma.locksmithLead.findMany({ select: { googlePlaceId: true } })) as { googlePlaceId: string }[];
  const seen = new Set(existing.map((l) => l.googlePlaceId));

  let saved = 0, savedNoEmail = 0, skippedDedup = 0, skippedFilter = 0;

  for (const city of cities) {
    const cityScoped = new Set<string>();
    let cityKept = 0;
    for (const buildQ of QUERY_BUILDERS) {
      const places = await serper(city, buildQ(city), apiKey);
      for (const lead of places) {
        if (cityScoped.has(lead.placeId)) continue;
        cityScoped.add(lead.placeId);
        if (seen.has(lead.placeId)) { skippedDedup++; continue; }
        if (!looksLocksmith(lead.name, lead.address, lead.website)) { skippedFilter++; continue; }
        if (!looksUk(city, lead.address, lead.phone, lead.website)) { skippedFilter++; continue; }
        if (!lead.phone && !lead.website) { skippedFilter++; continue; }

        if (lead.website) lead.email = await findEmail(lead.website);

        try {
          await prisma.locksmithLead.upsert({
            where: { googlePlaceId: lead.placeId },
            update: {
              name: lead.name, city: lead.city, address: lead.address,
              phone: lead.phone || null, website: lead.website || null,
              email: lead.email || null, rating: lead.rating, reviewCount: lead.reviewCount,
            },
            create: {
              googlePlaceId: lead.placeId, name: lead.name, city: lead.city,
              address: lead.address, phone: lead.phone || null, website: lead.website || null,
              email: lead.email || null, rating: lead.rating, reviewCount: lead.reviewCount,
              status: "new",
            },
          });
          seen.add(lead.placeId);
          saved++; cityKept++;
          if (!lead.email) savedNoEmail++;
        } catch { /* dup / constraint — skip */ }
      }
      await sleep(SERP_MIN_INTERVAL_MS);
    }
    console.log(`  ${city.padEnd(22)} +${cityKept} new`);
  }

  console.log(`\n=== Done ===`);
  console.log(`  saved (new leads):   ${saved}`);
  console.log(`  ...of which no email: ${savedNoEmail}  (will be SMS-contacted)`);
  console.log(`  skipped (already in DB): ${skippedDedup}`);
  console.log(`  skipped (filtered out):  ${skippedFilter}`);
  console.log(`\nThese are status="new" — the outreach sequence will pick them up on its next run.\n`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
