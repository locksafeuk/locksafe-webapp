/**
 * find-missing-emails.ts
 *
 * Goes through all LocksmithLead records in the DB that have a website but no email,
 * and tries to scrape an email from their website.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... DATABASE_URL=... npx ts-node \
 *     --compiler-options '{"module":"CommonJS","strict":false}' \
 *     scripts/find-missing-emails.ts
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EMAIL_BLOCKLIST = [
  "sentry.io", "example.com", "domain.com", "yourname", "user@", "name@",
  "test@", ".png", ".jpg", ".gif", "schema.org", "w3.org", "placeholder",
  "wixpress.com", "squarespace.com", "wordpress.com", "amazonaws.com",
  "cloudflare.com", "googletagmanager", "doubleclick", "your@email",
  "info@2x", "favicon@", "icon@",
];

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return EMAIL_BLOCKLIST.some((b) => lower.includes(b));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [
    base,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`,
    `${base}/get-in-touch`,
  ];
  for (const pageUrl of pages) {
    try {
      const html = await fetchHtml(pageUrl);
      const matches = html.match(EMAIL_REGEX) || [];
      const valid = matches.map(e => e.toLowerCase()).filter(e => !isJunkEmail(e));
      if (valid.length > 0) return valid[0];
    } catch { /* continue */ }
    await sleep(200);
  }
  return "";
}

async function main() {
  const leads = await prisma.locksmithLead.findMany({
    where: {
      website: { not: null },
      email: null,
    },
    select: { id: true, name: true, website: true },
  });

  console.log(`🔍  Found ${leads.length} leads with website but no email. Scraping...\n`);

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    process.stdout.write(`  [${i + 1}/${leads.length}] ${lead.name} → `);
    const email = await extractEmailFromWebsite(lead.website!);
    if (email) {
      await prisma.locksmithLead.update({
        where: { id: lead.id },
        data: { email },
      });
      console.log(`📧 ${email}`);
      updated++;
    } else {
      console.log("no email found");
      notFound++;
    }
    await sleep(300);
  }

  console.log(`\n✅  Updated ${updated} leads with email.`);
  console.log(`❌  ${notFound} leads still have no email.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
