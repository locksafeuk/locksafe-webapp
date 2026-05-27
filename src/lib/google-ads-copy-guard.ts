/**
 * Ad-copy compliance guard for Google Ads RSA copy.
 *
 * LockSafe DOES charge a call-out fee, so any copy implying "no fee" / "free
 * call-out" / "no surprise fees" is FALSE and must never ship — it misleads
 * customers and risks Google disapproval. We also block superlative price
 * claims ("cheapest", "guaranteed lowest") which Google forbids without proof.
 *
 * Two entry points:
 *   • scrubForbiddenAdCopy(lines)  — drops offending lines (used at generation
 *     time, so a bad LLM line or stale template silently falls away rather than
 *     failing the whole draft).
 *   • assertAdCopyClean(headlines, descriptions) — throws AdCopyPreflightError
 *     (used at publish time, so even a hand-edited draft can't go live with a
 *     false claim — defence in depth alongside assertLandingPageReady()).
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
 * High-confidence false-claim / policy-violation patterns. Kept tight to avoid
 * false positives — e.g. we DON'T block "no hidden fees" (the disclosed call-out
 * fee is not hidden) or "see prices upfront" (true). We only block copy that
 * denies the existence of a fee or makes an unprovable superlative price claim.
 */
const FORBIDDEN_AD_CLAIMS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bno\s+(surprise\s+)?(call[\s-]?out\s+)?fees?\b/i, label: "false 'no fees / no call-out fee' claim" },
  { pattern: /\bno\s+call[\s-]?out\s+(fee|charge|cost)\b/i, label: "false 'no call-out fee' claim" },
  { pattern: /\bfree\s+call[\s-]?out\b/i, label: "false 'free call-out' claim" },
  { pattern: /\bzero\s+(call[\s-]?out\s+)?fees?\b/i, label: "false 'zero fees' claim" },
  { pattern: /\bfee[\s-]?free\b/i, label: "false 'fee-free' claim" },
  { pattern: /\bcheapest\b/i, label: "unprovable 'cheapest' superlative" },
  { pattern: /\bguaranteed\s+lowest\b/i, label: "unprovable 'guaranteed lowest' superlative" },
  { pattern: /\blowest\s+price(s)?\s+guaranteed\b/i, label: "unprovable 'lowest price guaranteed' superlative" },
];

/** Returns the first matching forbidden-claim label for a line, or null. */
export function findForbiddenClaim(text: string): string | null {
  if (!text) return null;
  for (const { pattern, label } of FORBIDDEN_AD_CLAIMS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** Drop any line that contains a forbidden claim. Order-preserving. */
export function scrubForbiddenAdCopy(lines: string[]): string[] {
  return lines.filter((line) => findForbiddenClaim(line) === null);
}

/**
 * Throw if any headline or description contains a forbidden claim.
 * Call at publish time, before any Google mutation.
 */
export function assertAdCopyClean(headlines: string[], descriptions: string[]): void {
  const offending: AdCopyPreflightError["offending"] = [];
  for (const text of headlines) {
    const label = findForbiddenClaim(text);
    if (label) offending.push({ field: "headline", text, label });
  }
  for (const text of descriptions) {
    const label = findForbiddenClaim(text);
    if (label) offending.push({ field: "description", text, label });
  }
  if (offending.length > 0) {
    throw new AdCopyPreflightError(offending);
  }
}
