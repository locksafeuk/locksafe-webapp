/**
 * enrich-emails.ts
 *
 * Standalone email enrichment pass.
 * Finds all LocksmithLead records that have a website but no email,
 * visits those websites to extract contact emails, and saves them to DB.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node --project scripts/tsconfig.scripts.json scripts/enrich-emails.ts
 *
 * Optional: pass a city filter (partial match, case-insensitive):
 *   ... scripts/enrich-emails.ts --city Birmingham
 */

import { PrismaClient } from "@prisma/client";
import * as https from "https";
import * as http from "http";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    const timeout = setTimeout(() => resolve(""), 8000);
    try {
      const req = protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timeout);
          fetchHtml(res.headers.location).then(resolve);
          return;
        }
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => { clearTimeout(timeout); resolve(data); });
        res.on("error", () => { clearTimeout(timeout); resolve(""); });
      });
      req.on("error", () => { clearTimeout(timeout); resolve(""); });
    } catch {
      clearTimeout(timeout);
      resolve("");
    }
  });
}

function extractEmailsFromHtml(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const raw = html.match(re) || [];
  const exclude = /\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|ttf|eot)$/i;
  const stopwords = ["noreply", "no-reply", "donotreply", "example", "sentry", "sampleemail",
    "email@", "@email", "user@", "@domain", "test@", "@test", "info@info", "your@", "@your",
    "name@", "@name", "@company", "@domain.com"];
  return [...new Set(raw.filter(e =>
    !exclude.test(e) && !stopwords.some(w => e.toLowerCase().includes(w))
  ))];
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

async function main() {
  const cityArg = process.argv.includes("--city")
    ? process.argv[process.argv.indexOf("--city") + 1]
    : undefined;

  const where: Record<string, unknown> = {
    email: null,
    website: { not: null },
  };

  if (cityArg) {
    where.city = { contains: cityArg, mode: "insensitive" };
    console.log(`\n📧  Email enrichment — city filter: ${cityArg}\n`);
  } else {
    console.log("\n📧  Email enrichment — all leads with website but no email\n");
  }

  type Target = { id: string; name: string; website: string | null };
  const targets = await (prisma as any).locksmithLead.findMany({
    where,
    select: { id: true, name: true, website: true },
  }) as Target[];

  console.log(`   Found: ${targets.length} leads to enrich\n`);
  if (targets.length === 0) {
    console.log("   Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (i % 20 === 0) console.log(`   Progress: ${i}/${targets.length} (enriched so far: ${enriched})`);

    try {
      const email = await extractEmailFromWebsite(t.website!);
      if (email) {
        await (prisma as any).locksmithLead.update({
          where: { id: t.id },
          data: { email },
        });
        console.log(`   ✅ ${t.name} → ${email}`);
        enriched++;
      }
    } catch (err) {
      failed++;
      console.error(`   ❌ ${t.name}: ${(err as Error).message}`);
    }

    await sleep(300);
  }

  console.log(`\n══════════════════════════════`);
  console.log(`   Total processed : ${targets.length}`);
  console.log(`   Emails found    : ${enriched}`);
  console.log(`   Skipped (no email on site) : ${targets.length - enriched - failed}`);
  console.log(`   Errors          : ${failed}`);
  console.log(`══════════════════════════════\n`);
  console.log("✅  Enrichment complete!");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
