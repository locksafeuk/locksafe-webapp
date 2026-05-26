/**
 * Ensure a DistrictLandingPage row exists for the given district.
 *
 * Behaviour matrix:
 *   • No coverage          → throw NoCoverageError (caller skips the campaign draft)
 *   • Existing + manual_override → return as-is (NEVER overwrite human edits)
 *   • Existing + ai_generated + fresh → return as-is
 *   • Existing + ai_generated + stale (> REGENERATE_AFTER_DAYS) → regenerate
 *   • Existing + needs_refresh → regenerate
 *   • New                  → assemble facts → LLM → persist → return
 *
 * Concurrency: two parallel calls for the same district may both hit
 * the LLM. We accept this minor waste because Mongo's atomic upsert
 * resolves the persistence race cleanly and the LLM is idempotent at
 * the row level (last write wins, but both writes produce equivalent
 * content because the facts are identical).
 */

import { prisma as _prisma } from "@/lib/db";
import {
  assembleDistrictFacts,
  NoCoverageError,
} from "@/lib/district-landing/assemble-facts";
import { generateDistrictContent } from "@/lib/district-landing/generate-content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Configuration ──────────────────────────────────────────────────────────

/**
 * Default regeneration cadence. Pages older than this get refreshed
 * by the next ensure() call. Manual overrides are NEVER regenerated.
 *
 * 90 days = roughly one quarter — long enough for local conditions to
 * have meaningfully shifted (locksmith roster changes, coverage radius
 * adjustments) but short enough that Google's "freshness" signal stays
 * positive on the page.
 */
export const REGENERATE_AFTER_DAYS = Number(
  process.env["DISTRICT_LANDING_REGENERATE_DAYS"] ?? "90",
);

// ── Public types ───────────────────────────────────────────────────────────

export interface EnsureResult {
  district:           string;
  slug:               string;
  action:             "created" | "reused" | "regenerated" | "kept_manual";
  contentSource:      string;
  modelUsed?:         string;
  reason?:            string;
}

// ── Helper: build the slug from a district ─────────────────────────────────

export function districtSlug(district: string): string {
  return district.trim().toLowerCase();
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function ensureDistrictLandingPage(
  rawDistrict: string,
): Promise<EnsureResult> {
  const district = rawDistrict.trim().toUpperCase();
  const slug     = districtSlug(district);

  // ── 1. Look up existing row ────────────────────────────────────────
  const existing: {
    id:             string;
    district:       string;
    slug:           string;
    contentSource:  string;
    generatedAt:    Date | null;
    llmModel:       string | null;
    isPublished:    boolean;
  } | null = await prisma.districtLandingPage.findUnique({
    where:  { district },
    select: {
      id: true, district: true, slug: true, contentSource: true,
      generatedAt: true, llmModel: true, isPublished: true,
    },
  });

  // ── 2. Manual-override protection ──────────────────────────────────
  if (existing?.contentSource === "manual_override") {
    return {
      district, slug,
      action:        "kept_manual",
      contentSource: existing.contentSource,
      modelUsed:     existing.llmModel ?? undefined,
      reason:        "manual_override never overwritten by automated ensure()",
    };
  }

  // ── 3. Fresh AI row → reuse ────────────────────────────────────────
  if (existing?.contentSource === "ai_generated" && existing.generatedAt) {
    const ageMs = Date.now() - existing.generatedAt.getTime();
    const staleMs = REGENERATE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs < staleMs) {
      return {
        district, slug,
        action:        "reused",
        contentSource: existing.contentSource,
        modelUsed:     existing.llmModel ?? undefined,
        reason:        `last generated ${Math.floor(ageMs / (24*60*60*1000))} days ago, under ${REGENERATE_AFTER_DAYS}-day threshold`,
      };
    }
  }

  // ── 4. Assemble facts (throws if no coverage) ──────────────────────
  // We let NoCoverageError bubble up — the campaign orchestrator
  // catches it and skips the draft.
  const facts = await assembleDistrictFacts(district);

  // ── 5. Generate content (throws on 2× validation failure) ──────────
  const generation = await generateDistrictContent(facts);

  // ── 6. Persist (upsert resolves concurrent races) ──────────────────
  const isNew = !existing;
  await prisma.districtLandingPage.upsert({
    where:  { district },
    create: {
      district,
      slug,

      // Facts
      anchorTown:           facts.anchorTown,
      region:               facts.region,
      lat:                  facts.lat,
      lng:                  facts.lng,
      nearbyOutcodes:       facts.nearbyOutcodes,
      locksmithIds:         [],  // we no longer carry the IDs on the row — facts are enough
      featuredLocksmithId:  null,
      featuredEngineerName: facts.featuredEngineerBaseLocation,  // stored as base-location (the only "engineer" field we use in copy)

      // Generated content
      heroHeadline:       generation.content.heroHeadline,
      heroSubcopy:        generation.content.heroSubcopy,
      introParagraph:     generation.content.introParagraph,
      coverageNarrative:  generation.content.coverageNarrative,
      whyChooseUs:        generation.content.whyChooseUs,
      faqs:               generation.content.faqs,
      localTrustAnchors:  generation.content.localTrustAnchors,

      // Provenance
      contentSource: "ai_generated",
      llmModel:      generation.modelUsed,
      isPublished:   true,

      generatedAt:   new Date(),
      publishedAt:   new Date(),
    },
    update: {
      // Regeneration: overwrite content + facts, keep provenance keys.
      // We do NOT touch contentSource if it became "manual_override"
      // between our read and write — but step 2 already handled that.
      anchorTown:           facts.anchorTown,
      region:               facts.region,
      lat:                  facts.lat,
      lng:                  facts.lng,
      nearbyOutcodes:       facts.nearbyOutcodes,
      featuredEngineerName: facts.featuredEngineerBaseLocation,

      heroHeadline:       generation.content.heroHeadline,
      heroSubcopy:        generation.content.heroSubcopy,
      introParagraph:     generation.content.introParagraph,
      coverageNarrative:  generation.content.coverageNarrative,
      whyChooseUs:        generation.content.whyChooseUs,
      faqs:               generation.content.faqs,
      localTrustAnchors:  generation.content.localTrustAnchors,

      llmModel:      generation.modelUsed,
      generatedAt:   new Date(),
      // Auto-republish on regeneration unless admin had set isPublished=false
      ...(existing?.isPublished === false ? {} : { isPublished: true, publishedAt: new Date() }),
    },
  });

  return {
    district, slug,
    action:        isNew ? "created" : "regenerated",
    contentSource: "ai_generated",
    modelUsed:     generation.modelUsed,
    reason:        isNew
      ? "first generation"
      : `regenerated after ${REGENERATE_AFTER_DAYS}-day staleness`,
  };
}

// ── Convenience: safe wrapper for campaign orchestrator ────────────────────

export interface EnsureOrSkipResult {
  ok:        boolean;
  district:  string;
  result?:   EnsureResult;
  skipReason?: string;
}

/**
 * Wrapper the campaign orchestrator uses: returns ok=false (rather
 * than throwing) when the district has no coverage, so the loop can
 * skip the draft cleanly and log the reason.
 *
 * LLM/network errors STILL throw — those represent infrastructure
 * problems, not a routine skip condition.
 */
export async function ensureOrSkip(rawDistrict: string): Promise<EnsureOrSkipResult> {
  const district = rawDistrict.trim().toUpperCase();
  try {
    const result = await ensureDistrictLandingPage(district);
    return { ok: true, district, result };
  } catch (err) {
    if (err instanceof NoCoverageError) {
      return {
        ok: false,
        district,
        skipReason: `${err.reason}: ${err.details ?? "no coverage"}`,
      };
    }
    throw err;
  }
}
