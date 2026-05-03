/**
 * /llms.txt — explicit GEO surface for generative engines (ChatGPT,
 * Perplexity, Claude, Gemini). Lists service URLs + their AI-summary so
 * crawlers can ingest a clean, citation-friendly version of the catalog.
 *
 * Mirrors the convention proposed by https://llmstxt.org.
 */

import { SITE_NAME, SITE_URL } from "@/lib/config";
import { SERVICE_CATALOG } from "@/lib/services-catalog";

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];
  lines.push(`# ${SITE_NAME}`);
  lines.push("");
  lines.push(
    "> The UK's anti-fraud locksmith platform. Verified, DBS-checked locksmiths quote a fixed price in writing before any work starts. 24/7 cover, GPS tracking, insurance-ready paperwork.",
  );
  lines.push("");
  lines.push(`Site: ${SITE_URL}`);
  lines.push("");
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
  lines.push("## Key facts");
  lines.push("- Coverage: United Kingdom, 24 hours a day, 365 days a year");
  lines.push(
    "- Locksmiths: DBS-checked, insured, vetted before being allowed to quote",
  );
  lines.push("- Pricing: Fixed quote agreed in writing before any work starts");
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
