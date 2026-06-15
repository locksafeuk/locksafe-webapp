/**
 * Intent landing data layer — locksmith adaptation of the Mademoiselle
 * Atelier IntentLanding model. Stored as static TS rather than DB rows so
 * the entire programmatic SEO surface is built at compile time.
 *
 * An IntentLanding is a high-intent, problem-aware landing page (e.g.
 * "I'm locked out at night and don't know who to trust"). It carries:
 *   - hero copy with A/B emotional hook variants
 *   - pillar keyword + intent tags for clustering
 *   - service filter (which catalog services apply)
 *   - FAQs (FAQPage schema)
 *   - rich `blocks`: segments, AI-search Q&A, trust modules, social proof,
 *     related-intent clusters
 */

import type { ServiceSlug } from "@/lib/services-catalog";

// ---------------------------------------------------------------------------
// Filters & faqs (analogous to mademoiselle's productFilter / faqs JSON fields)
// ---------------------------------------------------------------------------

export interface IntentServiceFilter {
  /** Catalog service slugs that match this intent. */
  serviceSlugs?: ServiceSlug[];
  /** Keyword tags (free-form, matched against service.keywords). */
  keywords?: string[];
  /** Urgency floor (0–10). */
  minUrgency?: number;
  /** Price band hint (display only). */
  minPrice?: number;
  maxPrice?: number;
}

export interface IntentFaqItem {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Rich blocks — mirrors mademoiselle's IntentBlocks 1:1 with locksmith
// vocabulary (`styleConfidence` → `trustConfidence`).
// ---------------------------------------------------------------------------

/** Emotional sub-block, e.g. "If you're locked out", "If you've been burgled". */
export interface IntentSegment {
  id: string;                          // slug-form, used as in-page anchor
  label: string;                       // tab nav label + H2
  emotionalAngle: string;              // 1–2 sentences setting the mood
  serviceFilter: IntentServiceFilter;  // resolves to a real service subset
  ctaLabel?: string;                   // override "See locksmiths" button text
}

/** Conversational Q&A for AI Overview / Copilot / voice search. */
export interface IntentAiSearchItem {
  question: string;
  answer: string;
}

/** Trust-reassurance module reducing customer hesitation.
 *
 * Locksmith analogue of mademoiselle's `styleConfidence` modules. */
export interface IntentTrustItem {
  topic:
    | "verification"     // DBS-checked, ID-verified locksmiths
    | "pricing"          // Price agreed before any work starts
    | "paper-trail"      // GPS, photos, digital signatures
    | "response-time"    // 15–30 min nationwide
    | "guarantee"        // Money-back / dispute resolution
    | "insurance";       // Insurance-ready documentation
  title: string;
  body: string;
}

/** Curated grid surfaced as social validation. */
export interface IntentSocialProofCluster {
  label:
    | "most-booked"
    | "customer-favourite"
    | "real-jobs"
    | "verified-pro"
    | "editor-pick";
  heading: string;
  serviceFilter: IntentServiceFilter;
  /**
   * When set, the renderer resolves services dynamically from real booking
   * data. Static implementation here returns the curated list; the field
   * exists so future DB-backed versions can swap behaviour without API churn.
   */
  dynamicSource?: "top-booked-30d" | null;
}

/** Grouped related landings ("Continue with", "Related scenarios"). */
export interface IntentRelatedCluster {
  heading: string;
  slugs: string[];
}

export interface IntentBlocks {
  segments: IntentSegment[];
  aiSearchQA: IntentAiSearchItem[];
  trustConfidence: IntentTrustItem[];
  socialProofClusters: IntentSocialProofCluster[];
  relatedClusters: IntentRelatedCluster[];
}

// ---------------------------------------------------------------------------
// IntentLanding record (the equivalent of mademoiselle's Prisma model)
// ---------------------------------------------------------------------------

export interface IntentLanding {
  slug: string;                     // e.g. "locked-out-at-night"
  title: string;                    // "Locked Out at Night — What to Do"
  h1: string;
  metaTitle?: string;
  metaDescription?: string;
  intro?: string;                   // Short above-the-fold copy
  seoCopy?: string;                 // Editorial HTML body (300–700 words)
  heroImageUrl?: string;

  // Emotional hero hooks (A is canonical; B is A/B-test variant)
  emotionalHook?: string;
  heroSubcopy?: string;
  emotionalHookB?: string;
  heroSubcopyB?: string;

  // Clustering / topical authority
  pillarKeyword?: string;           // e.g. "emergency-locksmith"
  intentTags: string[];             // e.g. ["locked-out", "night", "urgent"]

  // What products/services this intent surfaces
  serviceFilter: IntentServiceFilter;

  // Embedded FAQs (FAQPage schema)
  faqs: IntentFaqItem[];

  // Rich block content
  blocks: IntentBlocks;

  // Legacy flat related list (kept for parity with mademoiselle)
  relatedSlugs?: string[];

  isActive: boolean;
  position: number;
  publishedAt?: string;             // ISO
  updatedAt?: string;               // ISO
}

// ---------------------------------------------------------------------------
// Helpers — parity with mademoiselle's parse* / build* signatures so future
// DB migration is a drop-in (replace static array reads with prisma calls).
// ---------------------------------------------------------------------------

export function parseIntentBlocks(raw: unknown): IntentBlocks {
  const empty: IntentBlocks = {
    segments: [],
    aiSearchQA: [],
    trustConfidence: [],
    socialProofClusters: [],
    relatedClusters: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Partial<IntentBlocks>;
  return {
    segments: Array.isArray(r.segments) ? r.segments : [],
    aiSearchQA: Array.isArray(r.aiSearchQA) ? r.aiSearchQA : [],
    trustConfidence: Array.isArray(r.trustConfidence) ? r.trustConfidence : [],
    socialProofClusters: Array.isArray(r.socialProofClusters) ? r.socialProofClusters : [],
    relatedClusters: Array.isArray(r.relatedClusters) ? r.relatedClusters : [],
  };
}

export function hasIntentBlocks(b: IntentBlocks): boolean {
  return (
    b.segments.length > 0 ||
    b.aiSearchQA.length > 0 ||
    b.trustConfidence.length > 0 ||
    b.socialProofClusters.length > 0 ||
    b.relatedClusters.length > 0
  );
}
