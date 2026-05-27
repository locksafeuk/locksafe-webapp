/**
 * Content Validator
 *
 * Defends the page from:
 *   • Banned phrases (template tells + false trust claims)
 *   • Malformed JSON
 *   • Missing required blocks
 *
 * Pure, fully unit-testable. The generator calls this AFTER the LLM
 * returns; on failure it retries once with the offending phrases
 * appended to the prompt's forbidden list.
 */

// ── Public types ────────────────────────────────────────────────────────────

export interface RawContent {
  heroHeadline:       string;
  heroSubcopy:        string;
  introParagraph:     string;
  coverageNarrative:  string;
  whyChooseUs:        string;
  faqs:               Array<{ question: string; answer: string }>;
  localTrustAnchors:  string[];
}

export interface ValidationResult {
  ok:          boolean;
  bannedHits:  string[];   // which forbidden phrases appeared
  missing:     string[];   // which required blocks are missing/empty
  malformed?:  boolean;    // true when input wasn't valid JSON shape
  parsed?:     RawContent; // only when ok=true
}

// ── Forbidden phrases ──────────────────────────────────────────────────────

/**
 * Phrases the LLM must NEVER produce. Two categories:
 *
 * (a) FALSE TRUST CLAIMS — LockSafe doesn't hold these accreditations.
 *     Using them in copy is misrepresentation under UK consumer law.
 *
 * (b) TEMPLATE TELLS — generic SEO phrases Google's quality classifier
 *     recognises as doorway/boilerplate. Avoiding these is what makes
 *     the page read as a real local business, not programmatic SEO.
 */
export const BANNED_PHRASES = [
  // (a) False trust claims — re-enable individual entries here ONLY when
  // LockSafe actually holds the accreditation.
  "mla",
  "mla-approved",
  "mla approved",
  "mla member",
  "mla licensed",
  "master locksmiths association",
  "master locksmith",  // banned because it implies MLA membership
  "which? trusted trader",
  "which trusted trader",
  "checkatrade",
  "trustmark",
  "trustmark approved",
  "trading standards approved",
  "trading-standards-approved",

  // (b) Template tells (Google quality-classifier signals)
  "need a locksmith in",
  "verified locksmiths covering all",
  "look no further",
  "don't hesitate",
  "do not hesitate",
  "best locksmith in",
  "leading locksmith",
  "premier locksmith",
  "top-rated locksmith",
  "trusted by thousands",
  "click here",
  "call now!",
  "affordable prices",
  "competitive prices",
  "wide range of services",
];

const BANNED_RE_CACHE = new Map<string, RegExp>();
function bannedRegex(phrase: string): RegExp {
  let re = BANNED_RE_CACHE.get(phrase);
  if (!re) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    BANNED_RE_CACHE.set(phrase, re);
  }
  return re;
}

// ── Validators ─────────────────────────────────────────────────────────────

/** Find every banned-phrase hit across all text in the content. */
export function scanForBannedPhrases(content: RawContent): string[] {
  const allText = [
    content.heroHeadline,
    content.heroSubcopy,
    content.introParagraph,
    content.coverageNarrative,
    content.whyChooseUs,
    ...content.faqs.flatMap((f) => [f.question, f.answer]),
    ...content.localTrustAnchors,
  ].join(" ").toLowerCase();

  const hits: string[] = [];
  for (const phrase of BANNED_PHRASES) {
    if (bannedRegex(phrase).test(allText)) hits.push(phrase);
  }
  return hits;
}

/**
 * Detect FALSE "no call-out fee" claims. LockSafe DOES charge a call-out fee,
 * so any copy denying it is misrepresentation. Catches both the split Q&A form
 * ("Do you charge for call-outs?" → "No, ...") and explicit body denials.
 * Deliberately does NOT flag "no hidden fees" (true — the call-out is disclosed).
 */
export function findFalseCallOutClaim(content: RawContent): string[] {
  const hits: string[] = [];

  for (const f of content.faqs ?? []) {
    const q = String(f?.question ?? "");
    const a = String(f?.answer ?? "");
    if (/call[\s-]?out/i.test(q) && /^\s*no\b/i.test(a)) {
      hits.push('faq: "No" answer to a call-out-charge question (false — LockSafe charges a call-out fee)');
    }
  }

  const body = [
    content.heroSubcopy, content.introParagraph,
    content.coverageNarrative, content.whyChooseUs,
    ...(content.faqs ?? []).flatMap((f) => [f?.answer ?? ""]),
  ].join("  ");
  const explicitDenial =
    /\bno\s+call[\s-]?out\s+(?:fee|charge|cost)/i.test(body) ||
    /\bfree\s+call[\s-]?out/i.test(body) ||
    /\bcall[\s-]?out[^.]*\bis\s+free\b/i.test(body);
  if (explicitDenial) {
    hits.push("no call-out fee (false — LockSafe charges a call-out fee)");
  }

  return hits;
}

/** Check every required block is non-empty. */
export function findMissingBlocks(content: RawContent): string[] {
  const missing: string[] = [];
  const requireText = (key: keyof RawContent, val: unknown): void => {
    if (typeof val !== "string" || val.trim().length < 10) missing.push(key);
  };
  requireText("heroHeadline",      content.heroHeadline);
  requireText("heroSubcopy",       content.heroSubcopy);
  requireText("introParagraph",    content.introParagraph);
  requireText("coverageNarrative", content.coverageNarrative);
  requireText("whyChooseUs",       content.whyChooseUs);

  if (!Array.isArray(content.faqs) || content.faqs.length < 3) {
    missing.push("faqs");
  } else {
    const badFaqIdx = content.faqs.findIndex(
      (f) => typeof f.question !== "string" || typeof f.answer !== "string"
        || f.question.trim().length < 5 || f.answer.trim().length < 10,
    );
    if (badFaqIdx >= 0) missing.push(`faqs[${badFaqIdx}]`);
  }

  if (!Array.isArray(content.localTrustAnchors) || content.localTrustAnchors.length < 3) {
    missing.push("localTrustAnchors");
  }
  return missing;
}

/**
 * Parse + validate raw LLM output. Returns a fully-typed result with
 * either the parsed content or a list of failure reasons.
 */
export function validateLLMOutput(rawJson: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, bannedHits: [], missing: [], malformed: true };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, bannedHits: [], missing: [], malformed: true };
  }
  const content = parsed as RawContent;

  const missing    = findMissingBlocks(content);
  const bannedHits = [
    ...scanForBannedPhrases(content),
    ...findFalseCallOutClaim(content),
  ];
  const ok         = missing.length === 0 && bannedHits.length === 0;

  return { ok, bannedHits, missing, parsed: ok ? content : undefined };
}
