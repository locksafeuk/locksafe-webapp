/**
 * enrich-all-leads.ts
 *
 * Visits websites of existing leads that have no email address and extracts one.
 * Run this in parallel with any scraper to maximise email coverage for the
 * outreach cron (which requires email to send).
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/enrich-all-leads.ts
 */

import * as https from "https";
import * as http from "http";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

process.on("uncaughtException",  (err)    => console.error("💥 uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("💥 unhandledRejection:", reason));

const prisma = new PrismaClient();

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 3 || !url) return Promise.resolve("");
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    let settled = false;
    const done = (val: string) => { if (!settled) { settled = true; resolve(val); } };
    let req: any;
    const timer = setTimeout(() => { try { req?.destroy(); } catch {} done(""); }, 7000);
    try {
      req = protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LockSafeBot/1.0)" }, timeout: 7000 }, (res: any) => {
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
      req.on("error", () => { clearTimeout(timer); done(""); });
    } catch { clearTimeout(timer); done(""); }
  });
}

const EMAIL_BLOCKLIST = [
  "noreply", "no-reply", "donotreply", "example", "sentry",
  "wixpress", "squarespace", "wordpress.com", "amazonaws", "cloudflare",
  "googletagmanager", "doubleclick", "sendgrid", "mailchimp", "newsletter",
  "webmaster", "postmaster", "schema.org", "w3.org",
  "email@", "@email", "user@", "@domain", "test@", "@test",
  "name@", "@company", "your@", "info@info", "webador",
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
    try {
      const html = await fetchHtml(pageUrl);
      if (!html) { await sleep(80); continue; }
      const emails = extractEmails(html);
      if (emails.length > 0) return emails[0];
      await sleep(120);
    } catch {}
  }
  return "";
}

async function main() {
  const targets = await (prisma as any).locksmithLead.findMany({
    where: { email: { equals: null }, website: { not: null } },
    select: { id: true, name: true, city: true, website: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`📧  Enriching ${targets.length} leads (have website, no email)\n`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const lead = targets[i];
    if (i % 50 === 0 && i > 0) {
      console.log(`\n   ── Progress: ${i}/${targets.length} | enriched: ${enriched} | failed: ${failed} ──\n`);
    }
    try {
      const email = await extractEmailFromWebsite(lead.website);
      if (email) {
        await (prisma as any).locksmithLead.update({
          where: { id: lead.id },
          data: { email },
        });
        console.log(`   ✅ ${lead.name} (${lead.city}) → ${email}`);
        enriched++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await sleep(200);
  }

  const finalCount = await (prisma as any).locksmithLead.count({ where: { email: { not: null }, status: "new" } });
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`   Enriched this run : ${enriched}`);
  console.log(`   No email found    : ${failed}`);
  console.log(`   New leads w/email : ${finalCount}`);
  console.log(`═══════════════════════════════════════════════════════\n`);
  console.log("🎉  Enrichment complete!\n");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
