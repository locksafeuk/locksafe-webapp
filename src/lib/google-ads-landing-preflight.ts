/**
 * Landing-page pre-flight gate for Google Ads publishing.
 *
 * HARD CONDITION (per ops requirement): a campaign's Final URL must be
 *   1. present + well-formed,
 *   2. (for district pages) backed by a published DistrictLandingPage row
 *      whose content is clean — no LLM placeholders, junk regions, or known
 *      false claims, and the required copy blocks are present,
 *   3. LIVE — resolves to HTTP 200 (redirects allowed if the final page is 200),
 * BEFORE we hand the URL to Google. Otherwise Google disapproves the campaign
 * for a broken or policy-violating destination ("Destination not working").
 *
 * Throws LandingPagePreflightError (caught by the publish route → 422) when the
 * page is not ready, so the operator gets a precise, actionable reason.
 */

import prisma from "@/lib/db";

export class LandingPagePreflightError extends Error {
  public readonly finalUrl: string;
  public readonly reasonCode:
    | "malformed_url"
    | "page_missing"
    | "not_published"
    | "content_unclean"
    | "not_live";
  constructor(reasonCode: LandingPagePreflightError["reasonCode"], finalUrl: string, message: string) {
    super(message);
    this.name = "LandingPagePreflightError";
    this.reasonCode = reasonCode;
    this.finalUrl = finalUrl;
  }
}

const LIVENESS_TIMEOUT_MS = 15_000;

/**
 * High-confidence junk/placeholder/false-claim tokens that must never appear on
 * a page taking paid traffic. Kept deliberately tight to avoid false positives.
 */
const FORBIDDEN_SUBSTRINGS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[year\]/i, label: "[year] placeholder" },
  { pattern: /\[(town|city|service|district|area|x|name)\]/i, label: "bracketed placeholder" },
  { pattern: /\(pseudo\)/i, label: "(pseudo) region artifact" },
  { pattern: /\bundefined\b/, label: "literal 'undefined'" },
  { pattern: /UA\/MD|UA\/MD\/LB/i, label: "admin-region code artifact" },
  { pattern: /no callout fee/i, label: "false 'no callout fee' claim" },
  { pattern: /\bMLA\b|master locksmiths association/i, label: "unheld MLA accreditation" },
  { pattern: /checkatrade/i, label: "unheld Checkatrade claim" },
];

/** A region value that's actually stringified coordinates. */
function looksLikeCoordinate(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[+-]?\d{1,3}\.\d{3,}$/.test(value.trim());
}

/**
 * Assert the landing page behind `finalUrl` is ready to take paid traffic.
 * Resolves silently when ready; throws LandingPagePreflightError otherwise.
 */
export async function assertLandingPageReady(finalUrl: string): Promise<void> {
  if (!finalUrl || !/^https?:\/\/.+/i.test(finalUrl)) {
    throw new LandingPagePreflightError(
      "malformed_url",
      String(finalUrl),
      `Final URL is missing or malformed: "${finalUrl}". Set a valid https:// landing-page URL before publishing.`,
    );
  }

  // ── Content check for district landing pages ────────────────────────────
  // (Only /locksmith-in/{outcode} pages are backed by DistrictLandingPage rows;
  //  other URL shapes skip straight to the liveness check.)
  const districtMatch = finalUrl.match(/\/locksmith-in\/([a-z0-9]+)\/?(?:[?#].*)?$/i);
  if (districtMatch) {
    const district = districtMatch[1].toUpperCase();
    const page = await prisma.districtLandingPage.findUnique({
      where: { district },
      select: {
        isPublished: true,
        anchorTown: true,
        region: true,
        heroHeadline: true,
        heroSubcopy: true,
        introParagraph: true,
        coverageNarrative: true,
        whyChooseUs: true,
        faqs: true,
      },
    });

    if (!page) {
      throw new LandingPagePreflightError(
        "page_missing",
        finalUrl,
        `No landing page exists for district ${district}. Generate it first (admin → district-landing, or the generate-district-landings cron).`,
      );
    }
    if (!page.isPublished) {
      throw new LandingPagePreflightError(
        "not_published",
        finalUrl,
        `Landing page for ${district} exists but isPublished=false. Publish the page before sending it paid traffic.`,
      );
    }

    // Required copy blocks present
    if (!page.heroHeadline?.trim() || !page.introParagraph?.trim()) {
      throw new LandingPagePreflightError(
        "content_unclean",
        finalUrl,
        `Landing page for ${district} is missing required copy (hero headline / intro). Regenerate before publishing.`,
      );
    }

    // Junk / placeholder / false-claim scan
    const blob = [
      page.anchorTown, page.region, page.heroHeadline, page.heroSubcopy,
      page.introParagraph, page.coverageNarrative, page.whyChooseUs,
      JSON.stringify(page.faqs ?? []),
    ].filter(Boolean).join("  —  ");

    for (const { pattern, label } of FORBIDDEN_SUBSTRINGS) {
      if (pattern.test(blob)) {
        throw new LandingPagePreflightError(
          "content_unclean",
          finalUrl,
          `Landing page for ${district} contains ${label} — fix the copy before publishing (Google may disapprove and it misleads customers).`,
        );
      }
    }
    if (looksLikeCoordinate(page.region)) {
      throw new LandingPagePreflightError(
        "content_unclean",
        finalUrl,
        `Landing page for ${district} has a coordinate-shaped region ("${page.region}"). Fix the region before publishing.`,
      );
    }

    // Call-out-fee denial scan — LockSafe DOES charge a call-out fee, so any copy
    // that denies it is FALSE. The literal-substring scan above misses the split
    // Q&A form ("Do you charge for call-outs?" → "No, ..."), so check FAQ pairs
    // explicitly: a question about call-outs whose answer negates is a false claim.
    const faqList = Array.isArray(page.faqs)
      ? (page.faqs as Array<Record<string, unknown>>)
      : [];
    for (const f of faqList) {
      const q = String(f.question ?? f.q ?? "").trim();
      const a = String(f.answer ?? f.a ?? "").trim();
      const asksAboutCallOut = /call[\s-]?out/i.test(q);
      const answerDenies =
        /^\s*no\b/i.test(a) ||
        /\bno\s+call[\s-]?out\s+(fee|charge|cost)\b/i.test(a) ||
        /\b(?:don'?t|do not|never|no)\s+charge\b[^.]*\bcall[\s-]?out/i.test(a) ||
        /\bcall[\s-]?out[^.]*\b(?:is\s+)?free\b/i.test(a);
      if (asksAboutCallOut && answerDenies) {
        throw new LandingPagePreflightError(
          "content_unclean",
          finalUrl,
          `Landing page for ${district} FAQ falsely implies there is no call-out fee ("${q}" → "${a.slice(0, 80)}"). LockSafe charges a call-out fee — correct this answer before publishing.`,
        );
      }
    }
  }

  // ── Liveness check: the URL must resolve to HTTP 200 ─────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT_MS);
  let status: number;
  let resolvedUrl = finalUrl;
  let wasRedirected = false;
  try {
    const res = await fetch(finalUrl, {
      method: "GET",
      // Google accepts landing URLs that redirect to a working destination.
      // We only block when the resolved destination fails to load as 200.
      redirect: "follow",
      headers: { "User-Agent": "LockSafe-AdsPreflight/1.0" },
      signal: controller.signal,
    });
    status = res.status;
    resolvedUrl = res.url || finalUrl;
    wasRedirected = res.redirected;
  } catch (err) {
    throw new LandingPagePreflightError(
      "not_live",
      finalUrl,
      `Final URL ${finalUrl} is not reachable (${err instanceof Error ? err.message : String(err)}). Google rejects campaigns with broken destinations.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (status !== 200) {
    throw new LandingPagePreflightError(
      "not_live",
      finalUrl,
      wasRedirected
        ? `Final URL ${finalUrl} redirected to ${resolvedUrl} but returned HTTP ${status} (must resolve to 200). Google rejects campaigns whose destination doesn't load cleanly.`
        : `Final URL ${finalUrl} returned HTTP ${status} (must resolve to 200). Google rejects campaigns whose destination doesn't load cleanly.`,
    );
  }
}
