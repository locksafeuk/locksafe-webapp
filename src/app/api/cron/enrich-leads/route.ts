/**
 * /api/cron/enrich-leads — Email Enrichment for Locksmith Leads
 *
 * Runs every 4 hours via Vercel Cron. Each invocation:
 *   1. Fetches up to 60 leads that have a website but no email address.
 *   2. For each lead, fetches the website HTML (3s timeout) and extracts
 *      any email address found via regex.
 *   3. Saves the email back to the LocksmithLead record.
 *
 * Kept separate from the scraper cron so the 300s budget is not shared.
 * Processing 60 leads × ~3s each = ~180s well within budget.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Max leads to enrich per invocation. 60 × ~3s = ~180s, well within 300s. */
const BATCH_SIZE = 60;

/** Per-website fetch timeout in ms. */
const FETCH_TIMEOUT_MS = 4000;

/** Domains to skip — these are spam/fake websites that appear on many leads. */
const SKIP_DOMAINS = new Set([
  "eldriclocksmith.shop",
  "lockexpderby.shop",
  "pointlocklocksmith.shop",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Regex that matches most real email addresses. */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Domains we never want to capture (noreply, example, etc.) */
const JUNK_EMAIL_DOMAINS = [
  "example.com", "sentry.io", "w3.org", "schema.org",
  "wixpress.com", "squarespace.com", "wordpress.com",
  "cloudflare.com", "google.com", "facebook.com",
  "noreply", "no-reply", "donotreply",
];

function extractEmail(html: string): string | null {
  const matches = html.match(EMAIL_REGEX);
  if (!matches) return null;

  for (const candidate of matches) {
    const lower = candidate.toLowerCase();
    if (JUNK_EMAIL_DOMAINS.some((d) => lower.includes(d))) continue;
    // Prefer addresses with common business TLDs
    if (lower.endsWith(".co.uk") || lower.endsWith(".com") ||
        lower.endsWith(".uk") || lower.endsWith(".net") ||
        lower.endsWith(".org") || lower.endsWith(".io")) {
      return candidate.toLowerCase();
    }
  }
  // Return first non-junk match as fallback
  return matches.find((m) => !JUNK_EMAIL_DOMAINS.some((d) => m.toLowerCase().includes(d)))?.toLowerCase() ?? null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchEmailFromWebsite(website: string): Promise<string | null> {
  const domain = getDomain(website);
  if (!domain || SKIP_DOMAINS.has(domain)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(website, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LockSafe-Bot/1.0; +https://locksafe.uk)",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const email = extractEmail(html);

    // Also check /contact page if nothing found on homepage
    if (!email && !website.includes("/contact")) {
      const contactUrl = website.replace(/\/$/, "") + "/contact";
      const r2 = await fetch(contactUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LockSafe-Bot/1.0; +https://locksafe.uk)",
        },
      }).catch(() => null);
      if (r2?.ok) {
        const html2 = await r2.text().catch(() => "");
        return extractEmail(html2);
      }
    }

    return email;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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

  // Fetch leads that have a website but no email. Leads already checked with
  // no email found carry an "[enrich] no-email-found" marker in notes — skip
  // them so we don't re-fetch the same site every run.
  type LeadRow = { id: string; name: string; website: string; notes: string | null };
  const leads = (await (
    prisma as unknown as {
      locksmithLead: { findMany: (a: unknown) => Promise<LeadRow[]> };
    }
  ).locksmithLead.findMany({
    where: {
      website: { not: null },
      email: null,
      status: { not: "not_interested" },
      NOT: { notes: { contains: "[enrich] no-email-found" } },
    },
    select: { id: true, name: true, website: true, notes: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "desc" }, // newest first — most recently scraped leads get enriched first
  })) as LeadRow[];

  console.log(`[enrich-leads] ${leads.length} leads to enrich.`);

  let enriched = 0;
  let failed = 0;

  for (const lead of leads) {
    // Hard stop at 240s to stay safe
    if (elapsed() > 240_000) {
      console.log(`[enrich-leads] Time limit approaching, stopping at ${enriched} enriched.`);
      break;
    }

    const email = await fetchEmailFromWebsite(lead.website);

    if (email) {
      try {
        await (
          prisma as unknown as {
            locksmithLead: { update: (a: unknown) => Promise<unknown> };
          }
        ).locksmithLead.update({
          where: { id: lead.id },
          data: { email },
        });
        enriched++;
        console.log(`[enrich-leads] ✓ ${lead.name} → ${email}`);
      } catch {
        failed++;
      }
    } else {
      // Mark website as checked but no email found. The sentinel goes in the
      // NOTES field (appended, never overwriting outreach history) — NOT the
      // email column. The old code wrote "no-email-found@locksafe.internal"
      // into email, which inflated email-contactable counts and would have
      // bounced; the query above skips leads carrying this marker.
      try {
        const marker = "[enrich] no-email-found";
        const newNotes = lead.notes ? `${lead.notes}\n${marker}` : marker;
        await (
          prisma as unknown as {
            locksmithLead: { update: (a: unknown) => Promise<unknown> };
          }
        ).locksmithLead.update({
          where: { id: lead.id },
          data: { notes: newNotes },
        });
      } catch {
        // ignore
      }
      failed++;
    }
  }

  console.log(
    `[enrich-leads] Done. Enriched: ${enriched} / ${leads.length}. Failed/no-email: ${failed}. Time: ${Math.round(elapsed() / 1000)}s`,
  );

  return NextResponse.json({
    status: "ok",
    leadsProcessed: leads.length,
    emailsFound: enriched,
    noEmailFound: failed,
    elapsedSeconds: Math.round(elapsed() / 1000),
  });
}
