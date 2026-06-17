/**
 * Ad-copy compliance guard for Google Ads RSA copy.
 *
 * LockSafe DOES charge a call-out fee, so any copy implying "no fee" / "free
 * call-out" / "no surprise fees" / "no hidden fees" is FALSE and must never
 * ship — it misleads customers and risks Google disapproval. We also block
 * superlative price claims ("cheapest", "guaranteed lowest") which Google
 * forbids without proof, and any numeric review-count claim not backed by
 * `trustpilotReviewCount >= 50` on the campaign config (§30, GODMODE plan
 * 2026-06-17). LockSafe has under 100 Trustpilot reviews — competitors have
 * 4,000-6,000 — so fabricating a review count is the easiest way to draw an
 * ASA complaint.
 *
 * Three entry points:
 *   • scrubForbiddenAdCopy(lines)  — drops offending lines (used at generation
 *     time, so a bad LLM line or stale template silently falls away rather than
 *     failing the whole draft).
 *   • assertAdCopyClean(headlines, descriptions, context?) — throws
 *     AdCopyPreflightError (used at publish time, so even a hand-edited draft
 *     can't go live with a false claim — defence in depth alongside
 *     assertLandingPageReady()). The optional `context` carries
 *     `trustpilotReviewCount`: if the headline mentions a review count, it
 *     must not exceed the substantiated count; if the count is < 50, ALL
 *     "Trustpilot N reviews" copy is rejected.
 *   • GODMODE_PRIMARY_HEADLINES — the playbook §30 recommended primary lines
 *     (MLA + DBS + fixed-price-agreed-before-any-work + verified-Trustpilot)
 *     exported so the draft generator + onboarding flow can inject them.
 */

export class AdCopyPreflightError extends Error {
  public readonly offending: Array<{ field: "headline" | "description"; text: string; label: string }>;
  constructor(offending: AdCopyPreflightError["offending"]) {
    const summary = offending
      .map((o) => `${o.field} "${o.text}" → ${o.label}`)
      .join("; ");
    super(`Ad copy contains forbidden claim(s): ${summary}`);
    this.name = "AdCopyPreflightError";
    this.offending = offending;
  }
}

/**
 * §30 (2026-06-17, GODMODE plan) — recommended primary RSA headlines, ranked.
 *
 * The pivot away from the (forbidden) "no call-out fee" angle is the most
 * important copy decision this codebase makes. These five lines are the
 * playbook's compliance-first replacement stack:
 *
 *   1. MLA accreditation — only meaningful trust signal a sub-100-review
 *      account can credibly claim (Master Locksmiths Association).
 *   2. DBS-checked & uniformed — Keytek's volume signal, ASA-safe.
 *   3. Fixed price agreed before any work starts — the legal substitute for
 *      "no call-out fee" claim. Matches what we actually do.
 *   4. Verified Trustpilot reviews — included ONLY when the campaign config
 *      reports `trustpilotReviewCount >= 50`. Below 50 the guard refuses any
 *      Trustpilot copy at persist + publish time.
 *   5. Geo lead — the existing "[district] locksmith" headline pattern stays.
 *      Highest CTR signal we have. Slot kept at #5 so the trust signals lead.
 *
 * These are EXPORTED for the generator to inject. They are NOT auto-injected
 * by the guard — too easy to clobber a human-curated set. The generator (or
 * an admin tool) should call `applyGodmodePrimaryHeadlines(...)` before
 * handing the draft to the persist site.
 */
export const GODMODE_PRIMARY_HEADLINES: Array<{
  text: string;
  rank: number;
  requires?: "trustpilotReviewCount>=50";
}> = [
  { text: "MLA-Approved Locksmith Engineers", rank: 1 },
  { text: "DBS-Checked & Uniformed",          rank: 2 },
  {
    text: "Fixed Price Agreed Before Any Work Starts",
    rank: 3,
  },
  {
    text: "Verified Trustpilot Reviews",
    rank: 4,
    requires: "trustpilotReviewCount>=50",
  },
  // Rank 5 is the geo lead, e.g. "[district] Locksmith" — kept as a
  // generator-side substitution because [district] is per-draft.
];

/**
 * Inject the §30 primary headlines into a draft's headline list, respecting
 * the gating rule for the Trustpilot line. Returns a deduplicated array;
 * existing headlines retain their order, the §30 lines are prepended.
 *
 * Use at draft-generation time (NOT at publish — too late by then). The
 * persist guard will still reject any unsubstantiated review-count claims
 * regardless of how the headlines were assembled.
 */
export function applyGodmodePrimaryHeadlines(
  existing: string[],
  context: { trustpilotReviewCount?: number } = {},
): string[] {
  const trustpilotReviewCount = context.trustpilotReviewCount ?? 0;
  const primaries: string[] = [];
  for (const p of GODMODE_PRIMARY_HEADLINES) {
    if (p.requires === "trustpilotReviewCount>=50" && trustpilotReviewCount < 50) {
      continue;
    }
    primaries.push(p.text);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...primaries, ...existing]) {
    const key = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/**
 * High-confidence false-claim / policy-violation patterns. Kept tight to avoid
 * false positives. §30 (2026-06-17) hardened: we now ALSO block "no hidden
 * fees" — the call-out fee is *disclosed* but customers reasonably interpret
 * the phrase as "no surprise charges," and on a vertical where Google has
 * called locksmiths a "duress vertical" (2025 lawsuit) the safer answer is
 * to ban the family entirely and lead with the affirmative claim
 * "Fixed Price Agreed Before Any Work Starts" instead.
 */
const FORBIDDEN_AD_CLAIMS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bno\s+(surprise\s+)?(call[\s-]?out\s+)?fees?\b/i, label: "false 'no fees / no call-out fee' claim" },
  { pattern: /\bno\s+call[\s-]?out\s+(fee|charge|cost)\b/i,      label: "false 'no call-out fee' claim" },
  { pattern: /\bfree\s+call[\s-]?out\b/i,                         label: "false 'free call-out' claim" },
  { pattern: /\bzero\s+(call[\s-]?out\s+)?fees?\b/i,              label: "false 'zero fees' claim" },
  { pattern: /\bfee[\s-]?free\b/i,                                label: "false 'fee-free' claim" },
  { pattern: /\bno\s+hidden\s+(fees?|charges?|costs?)\b/i,        label: "§30 banned — 'no hidden fees' implies no surprise charges (use 'Fixed Price Agreed Before Any Work Starts')" },
  { pattern: /\bno\s+surprise\s+(fees?|charges?|costs?)\b/i,      label: "§30 banned — 'no surprise fees' (use 'Fixed Price Agreed Before Any Work Starts')" },
  { pattern: /\bcheapest\b/i,                                     label: "unprovable 'cheapest' superlative" },
  { pattern: /\bguaranteed\s+lowest\b/i,                          label: "unprovable 'guaranteed lowest' superlative" },
  { pattern: /\blowest\s+price(s)?\s+guaranteed\b/i,              label: "unprovable 'lowest price guaranteed' superlative" },
];

/**
 * Numeric review-count claim detector (§30, 2026-06-17). Captures patterns
 * like:
 *   "1,200+ Trustpilot Reviews"
 *   "Rated 4.9 by 800 customers"
 *   "5,000 5-star ratings"
 *   "300+ five-star reviews"
 *
 * Returns the asserted count (parsed integer) when matched, otherwise null.
 * The publish guard then compares this against the substantiated count.
 */
export function detectReviewCountClaim(text: string): number | null {
  if (!text) return null;
  // Look for a number adjacent to "review", "rating", "trustpilot", "stars",
  // or "happy customers". Allow commas, "+" suffix, "k" suffix, and up to 3
  // intermediate adjective words (e.g. "500 verified reviews",
  // "1,200 five-star Trustpilot reviews", "300+ genuine ratings").
  const numericPattern =
    /([\d,]+(?:\.\d+)?\s*k?)\s*\+?\s+(?:[\w-]+\s+){0,3}(?:reviews?|ratings?|happy\s+customers?|stars?)\b/i;
  const m = text.match(numericPattern);
  if (!m) return null;
  let raw = m[1].replace(/,/g, "").trim().toLowerCase();
  let multiplier = 1;
  if (raw.endsWith("k")) {
    multiplier = 1000;
    raw = raw.slice(0, -1).trim();
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Sub-2 ratings (e.g. "4.9 stars") are an average score, not a count — skip.
  if (multiplier === 1 && n < 5) return null;
  return Math.round(n * multiplier);
}

/**
 * Returns the first matching forbidden-claim label for a line, or null.
 *
 * Optional `context.trustpilotReviewCount` lets the caller substantiate a
 * review-count claim. When the claim's asserted count exceeds the
 * substantiated count (or the substantiated count is < 50), the line is
 * rejected with a §30 label.
 */
export function findForbiddenClaim(
  text: string,
  context: { trustpilotReviewCount?: number } = {},
): string | null {
  if (!text) return null;
  for (const { pattern, label } of FORBIDDEN_AD_CLAIMS) {
    if (pattern.test(text)) return label;
  }
  // §30 — review-count substantiation gate. We treat the absence of an
  // explicit substantiated count as "0 substantiated" (the safe default).
  const claimedCount = detectReviewCountClaim(text);
  if (claimedCount !== null) {
    const substantiated = context.trustpilotReviewCount ?? 0;
    if (substantiated < 50) {
      return `§30 banned — review-count claim "${claimedCount}" but campaign has no substantiated Trustpilot count ≥50`;
    }
    if (claimedCount > substantiated) {
      return `§30 banned — review-count claim "${claimedCount}" exceeds substantiated Trustpilot count ${substantiated}`;
    }
  }
  return null;
}

/** Drop any line that contains a forbidden claim. Order-preserving. */
export function scrubForbiddenAdCopy(
  lines: string[],
  context: { trustpilotReviewCount?: number } = {},
): string[] {
  return lines.filter((line) => findForbiddenClaim(line, context) === null);
}

/**
 * Throw if any headline or description contains a forbidden claim.
 * Call at publish time, before any Google mutation.
 *
 * `context.trustpilotReviewCount` is the substantiated number stored on the
 * campaign config (when absent, treated as 0 — the safe default).
 */
export function assertAdCopyClean(
  headlines: string[],
  descriptions: string[],
  context: { trustpilotReviewCount?: number } = {},
): void {
  const offending: AdCopyPreflightError["offending"] = [];
  for (const text of headlines) {
    const label = findForbiddenClaim(text, context);
    if (label) offending.push({ field: "headline", text, label });
  }
  for (const text of descriptions) {
    const label = findForbiddenClaim(text, context);
    if (label) offending.push({ field: "description", text, label });
  }
  if (offending.length > 0) {
    throw new AdCopyPreflightError(offending);
  }
}
