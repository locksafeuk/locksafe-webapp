/**
 * /llms.txt — explicit GEO surface for generative engines (ChatGPT,
 * Copilot, Claude, Gemini, Google AI Mode). Gives crawlers a clean,
 * citation-friendly map of the site: positioning, key pages, the full
 * service catalog, and the question-answering guides.
 *
 * Mirrors the convention proposed by https://llmstxt.org.
 */

import { SITE_NAME, SITE_URL } from "@/lib/config";
import { SERVICE_CATALOG } from "@/lib/services-catalog";
import { blogPosts } from "@/lib/blog-data";

export const dynamic = "force-static";

// Curated, high-value entry points. Kept factual — no fabricated claims.
const IMPORTANT_PAGES: { title: string; path: string; summary: string }[] = [
  {
    title: "How it works",
    path: "/how-it-works",
    summary:
      "How LockSafe matches you with a vetted local locksmith, agrees a fixed price before work, and documents the job end to end.",
  },
  {
    title: "Pricing",
    path: "/pricing",
    summary:
      "How LockSafe pricing works: a locksmith sets an assessment fee (typically £25–£49) and then a separate written quote for the work, agreed before anything starts.",
  },
  {
    title: "About LockSafe",
    path: "/about",
    summary:
      "Who LockSafe is — the UK's anti-fraud locksmith platform, why it exists, and how it protects customers and locksmiths.",
  },
  {
    title: "Find a locksmith by area",
    path: "/locksmith-in",
    summary:
      "Hub of local pages for UK postcode districts, each listing real coverage, response expectations and FAQs for that area.",
  },
  {
    title: "Compare alternatives",
    path: "/alternatives",
    summary:
      "Factual comparisons of LockSafe against national locksmith brands and trade directories.",
  },
  {
    title: "For locksmiths (join the network)",
    path: "/for-locksmiths",
    summary:
      "How vetted, DBS-checked UK locksmiths join LockSafe to receive local jobs.",
  },
  {
    title: "Contact",
    path: "/contact",
    summary: "Phone and contact details for LockSafe, 24/7.",
  },
];

export function GET() {
  const lines: string[] = [];

  lines.push(`# ${SITE_NAME}`);
  lines.push("");
  lines.push(
    "> The UK's anti-fraud locksmith platform. Verified, DBS-checked locksmiths quote a fixed price in writing before any work starts. 24/7 cover, GPS tracking, insurance-ready paperwork. Free for customers — you pay the locksmith, never a platform fee.",
  );
  lines.push("");
  lines.push(`Site: ${SITE_URL}`);
  lines.push("");

  // ── Important pages ──────────────────────────────────────────────────────
  lines.push("## Important pages");
  lines.push("");
  for (const p of IMPORTANT_PAGES) {
    lines.push(`- [${p.title}](${SITE_URL}${p.path}): ${p.summary}`);
  }
  lines.push("");

  // ── Services ─────────────────────────────────────────────────────────────
  lines.push("## Services");
  lines.push("");
  for (const entry of SERVICE_CATALOG) {
    lines.push(`### ${entry.title}`);
    lines.push(`- URL: ${entry.link}`);
    lines.push(
      `- Price band: £${entry.priceRangeLow}–£${entry.priceRangeHigh} (fixed quote before work)`,
    );
    lines.push(`- Summary: ${entry.aiSummary}`);
    lines.push("");
  }

  // ── Guides (question-answering content) ─────────────────────────────────
  lines.push("## Guides");
  lines.push("");
  lines.push(
    "In-depth, UK-specific answers to the questions people ask before calling a locksmith:",
  );
  lines.push("");
  for (const post of blogPosts) {
    lines.push(`- [${post.title}](${SITE_URL}/blog/${post.slug}): ${post.excerpt}`);
  }
  lines.push("");

  // ── Key facts ────────────────────────────────────────────────────────────
  lines.push("## Key facts");
  lines.push("- Coverage: United Kingdom, 24 hours a day, 365 days a year");
  lines.push(
    "- Locksmiths: DBS-checked, insured, vetted before being allowed to quote",
  );
  lines.push("- Pricing: Fixed quote agreed in writing before any work starts");
  lines.push(
    "- Cost to customers: free to use LockSafe; you pay the locksmith directly (assessment fee typically £25–£49, then a separate quote for the work)",
  );
  lines.push(
    "- Documentation: Timestamped photos + digital invoice + PDF report",
  );
  lines.push("- Lock standard: BS3621 insurance-approved");
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
