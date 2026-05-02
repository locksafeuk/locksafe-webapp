/**
 * Direct-Response Copywriting Engine
 *
 * Structured framework + brand-voice guard layer that the CMO agent uses
 * to produce on-brand, character-limit-safe Facebook ad copy.
 *
 * Inspired by Neil Patel (AIDA, value-stacked headlines) and Ryan Deiss
 * (Problem-Agitate-Solution, before-after-bridge). Every request emits
 * exactly N variants (default 4), one per `Angle`, validated against:
 *   - Meta character limits (primary text ≤ 125, headline ≤ 40, description ≤ 30)
 *   - Banned-phrase list (no fake urgency, no "guaranteed cheapest" etc.)
 *   - LockSafe brand voice constants
 */

import { z } from "zod";
import { getServiceBySlug, type ServiceEntry, type ServiceSlug } from "@/lib/services-catalog";

// ---------- Frameworks & angles ----------

export const FRAMEWORKS = ["PAS", "AIDA", "BAB", "FOUR_US"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const ANGLES = [
  "urgency",
  "social_proof",
  "risk_reversal",
  "authority",
  "loss_aversion",
  "curiosity",
] as const;
export type Angle = (typeof ANGLES)[number];

export const DEFAULT_ANGLES: Angle[] = [
  "urgency",
  "social_proof",
  "risk_reversal",
  "authority",
];

/**
 * The emotional state of the viewer when the ad lands. Drives hook tone.
 * Mapped from each catalog slug.
 */
export const EMOTIONAL_STATES = [
  "locked_out_panic",
  "burglary_fear",
  "lost_keys_frustration",
  "landlord_compliance",
  "commercial_downtime",
  "key_snapped_stress",
  "general_security",
] as const;
export type EmotionalState = (typeof EMOTIONAL_STATES)[number];

export const STATE_BY_SLUG: Record<ServiceSlug, EmotionalState> = {
  "emergency-locksmith": "locked_out_panic",
  "locked-out": "locked_out_panic",
  "lock-change": "general_security",
  "broken-key-extraction": "key_snapped_stress",
  "upvc-door-lock-repair": "general_security",
  "burglary-lock-repair": "burglary_fear",
  "car-key-replacement": "lost_keys_frustration",
  "safe-opening": "lost_keys_frustration",
  "landlord-lock-change": "landlord_compliance",
  "commercial-locksmith": "commercial_downtime",
};

// ---------- Brand voice ----------

export const LOCKSAFE_VOICE = {
  brand: "LockSafe UK",
  promise: "See the price before any work starts.",
  proofPoints: [
    "Verified, ID-checked locksmiths only",
    "Quote-before-work — no surprise bills",
    "BS3621 insurance-approved locks",
    "Average response under 30 minutes",
    "Card payment after the job is done",
  ],
  // Words/phrases the AI must NEVER produce. Validation rejects + retries once.
  bannedPhrases: [
    "guaranteed cheapest",
    "lowest price ever",
    "100% satisfaction guaranteed",
    "act now or lose forever",
    "limited time only",
    "while supplies last",
    "miracle",
    "secret",
    "you won't believe",
    "shocking",
    "doctors hate",
    "one weird trick",
  ],
  // Phrases to gently prefer where natural (not hard-required).
  preferredPhrases: [
    "verified locksmith",
    "see the price first",
    "no hidden fees",
    "quote before any work",
    "BS3621",
  ],
  language: "en-GB",
} as const;

// ---------- Meta character limits ----------

export const META_LIMITS = {
  primaryText: 125,
  headline: 40,
  description: 30,
} as const;

// ---------- Output schema ----------

const ctaEnum = z.enum([
  "GET_QUOTE",
  "LEARN_MORE",
  "CONTACT_US",
  "BOOK_NOW",
  "GET_OFFER",
]);

export const adVariantSchema = z.object({
  primaryText: z.string().min(1).max(META_LIMITS.primaryText * 2), // soft upper for retry
  headline: z.string().min(1).max(META_LIMITS.headline * 2),
  description: z.string().min(1).max(META_LIMITS.description * 2),
  cta: ctaEnum,
  framework: z.enum(FRAMEWORKS),
  angle: z.enum(ANGLES),
  hookScore: z.number().int().min(1).max(10),
  reasoning: z.string().min(1).max(400),
});

export type AdVariant = z.infer<typeof adVariantSchema>;

// ---------- Prompt builder ----------

interface PromptOptions {
  service: ServiceEntry;
  angles: Angle[];
  city?: string;
}

const FRAMEWORK_BY_ANGLE: Record<Angle, Framework> = {
  urgency: "PAS",
  social_proof: "AIDA",
  risk_reversal: "BAB",
  authority: "FOUR_US",
  loss_aversion: "PAS",
  curiosity: "AIDA",
};

const ANGLE_BRIEFS: Record<Angle, string> = {
  urgency:
    "Pattern-interrupt hook acknowledging the problem in the first 5 words. Use Problem-Agitate-Solution. Do not invent fake countdowns or false scarcity — urgency comes from the situation itself (locked out, key snapped, etc).",
  social_proof:
    "Lead with a third-party-style stat or social proof (e.g. '4.9★ from local homeowners', '8 in 10 callers quoted under £X'). Use AIDA — Attention, Interest, Desire, Action.",
  risk_reversal:
    "Use Before-After-Bridge. The bridge is LockSafe's quote-before-work promise — emphasise no surprise bills, no upfront payment, the locksmith is paid after the job.",
  authority:
    "Use the 4 Us — Useful, Urgent, Unique, Ultra-specific. Reference verified-locksmith vetting, BS3621 insurance compliance, and the credentials we check (DBS / Public Liability / ID).",
  loss_aversion:
    "Frame the cost of waiting or hiring a non-vetted locksmith. Cite real risks (over-billing, damaged door frame, voided home insurance). Then provide LockSafe as the safe path. Use PAS.",
  curiosity:
    "Open with a curiosity gap or unexpected fact. Avoid clickbait clichés (no 'you won't believe'). Use AIDA. Resolve the curiosity by line 3.",
};

export function buildSystemPrompt(): string {
  return [
    `You are a senior UK direct-response copywriter producing Facebook & Instagram ad copy for ${LOCKSAFE_VOICE.brand}.`,
    "",
    "Brand voice:",
    `- Promise: ${LOCKSAFE_VOICE.promise}`,
    `- Language: ${LOCKSAFE_VOICE.language} (UK English spelling, GBP).`,
    "- Tone: calm, competent, reassuring. We sell trust, not panic.",
    "",
    "Hard rules — output that violates any of these will be rejected:",
    `1. Primary text ≤ ${META_LIMITS.primaryText} characters.`,
    `2. Headline ≤ ${META_LIMITS.headline} characters.`,
    `3. Description ≤ ${META_LIMITS.description} characters.`,
    "4. No emojis in the headline. Up to 1 emoji in primary text is fine.",
    "5. No fabricated stats. Only use proof points from the brand context.",
    "6. No banned phrases (listed below).",
    "7. UK English: 'colour', 'specialise', 'whilst' — not US spelling.",
    "8. Every variant must use a different angle and produce its own framework structure.",
    "",
    "Banned phrases (case-insensitive, never use any):",
    LOCKSAFE_VOICE.bannedPhrases.map((p) => `  - "${p}"`).join("\n"),
    "",
    "Approved proof points (use only these — do not invent numbers):",
    LOCKSAFE_VOICE.proofPoints.map((p) => `  - ${p}`).join("\n"),
    "",
    "Frameworks:",
    "- PAS (Ryan Deiss): Problem → Agitate → Solution. The agitation is the cost of inaction.",
    "- AIDA (Neil Patel): Attention → Interest → Desire → Action.",
    "- BAB: Before (pain) → After (relief) → Bridge (LockSafe's mechanism).",
    "- 4 Us: Useful, Urgent, Unique, Ultra-specific (works best for headlines).",
  ].join("\n");
}

export function buildUserPrompt(opts: PromptOptions): string {
  const { service, angles, city } = opts;
  const state = STATE_BY_SLUG[service.id as ServiceSlug] ?? "general_security";

  const angleBlock = angles
    .map((angle, i) => {
      const fw = FRAMEWORK_BY_ANGLE[angle];
      return [
        `Variant ${i + 1}: angle="${angle}" framework="${fw}"`,
        `  Brief: ${ANGLE_BRIEFS[angle]}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Produce ${angles.length} ad variants for the service "${service.title}" (catalog slug: ${service.id}).`,
    city ? `Targeting: ${city}, UK.` : "Targeting: United Kingdom.",
    `Viewer emotional state: ${state}.`,
    "",
    "Service context:",
    `- Subhead: ${service.subhead}`,
    `- What's included: ${service.whatsIncluded.join("; ")}`,
    `- Long description: ${service.longDescription.join(" ")}`,
    `- Price hint: ${service.priceHint ?? "see website"}`,
    "",
    "Produce variants in this order, one per angle:",
    "",
    angleBlock,
    "",
    "Return strict JSON of shape:",
    `{ "variants": [ { "primaryText": string, "headline": string, "description": string, "cta": "GET_QUOTE"|"LEARN_MORE"|"CONTACT_US"|"BOOK_NOW"|"GET_OFFER", "framework": "PAS"|"AIDA"|"BAB"|"FOUR_US", "angle": string, "hookScore": integer 1-10, "reasoning": string ≤ 240 chars } ] }`,
    "",
    `hookScore = your honest 1–10 self-rating against the 4Us rubric (Useful, Urgent, Unique, Ultra-specific). Be strict; reserve 9–10 for copy you'd stake budget on.`,
    "Return ONLY the JSON object, no markdown.",
  ].join("\n");
}

// ---------- Validation ----------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  cleaned?: AdVariant;
}

const banned = LOCKSAFE_VOICE.bannedPhrases.map((p) => p.toLowerCase());

function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const p of banned) if (lower.includes(p)) return p;
  return null;
}

export function validateVariant(raw: unknown, expectedAngle: Angle): ValidationResult {
  const parsed = adVariantSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`),
    };
  }
  const v = parsed.data;
  const errors: string[] = [];

  if (v.angle !== expectedAngle) {
    errors.push(`angle mismatch: expected ${expectedAngle}, got ${v.angle}`);
  }

  if (v.primaryText.length > META_LIMITS.primaryText) {
    errors.push(`primaryText length ${v.primaryText.length} > ${META_LIMITS.primaryText}`);
  }
  if (v.headline.length > META_LIMITS.headline) {
    errors.push(`headline length ${v.headline.length} > ${META_LIMITS.headline}`);
  }
  if (v.description.length > META_LIMITS.description) {
    errors.push(`description length ${v.description.length} > ${META_LIMITS.description}`);
  }

  // Banned-phrase scan across all copy fields.
  for (const [field, text] of Object.entries({
    primaryText: v.primaryText,
    headline: v.headline,
    description: v.description,
  })) {
    const hit = containsBannedPhrase(text);
    if (hit) errors.push(`banned phrase "${hit}" found in ${field}`);
  }

  // Headline emoji guard (very basic — unicode range matching the most common ranges).
  // eslint-disable-next-line no-control-regex
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  if (emojiRe.test(v.headline)) errors.push("headline contains emoji (not allowed)");

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], cleaned: v };
}

// ---------- Convenience ----------

export function getServiceForCopy(slug: string): ServiceEntry | null {
  return getServiceBySlug(slug) ?? null;
}
