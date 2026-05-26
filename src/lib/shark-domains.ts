/**
 * Shark Domain library — known UK locksmith call-centre / scam-pattern
 * operators. Used by the competitor-intel agent and opportunity scout to
 * deprioritise keywords saturated by these domains.
 *
 * SOURCES — only operators flagged by multiple independent public sources:
 *   • BBC investigations into locksmith scams (Watchdog, Rip Off Britain)
 *   • Which? exposés (e.g. 2019, 2022 reports)
 *   • Trading Standards UK warnings
 *   • Master Locksmiths Association (MLA) public "report a scam" lists
 *   • Trustpilot 1-star aggregations >100 reviews with consistent
 *     "quoted £49, charged £600+" complaints
 *
 * Inclusion criteria (need TWO of):
 *   1. No MLA membership, no DBS verification, no visible engineer photos
 *   2. National coverage from a single phone number (call-centre dispatch)
 *   3. >50 documented "bait quote vs final charge" complaints
 *   4. Featured in a published consumer-protection investigation
 *
 * This is research-team-curated and conservative. The point isn't to
 * accuse — it's to flag commercial patterns where honest operators
 * structurally lose the bidding auction.
 *
 * Note: we deliberately do NOT include sharks here directly in code. The
 * actual list lives in MongoDB (SharkDomain table) so ops can refine it
 * via the admin UI without code deploys. This file just provides the
 * INITIAL seed set + the matching helpers.
 */

/**
 * Initial seed list — added on first `seedSharkDomains()` invocation.
 * Conservative — only the most documented operators. Ops should expand
 * this in the database via the admin UI as new patterns emerge.
 *
 * Each entry includes the pattern flags so future audits know WHY it
 * was flagged. We do NOT include unverified rumours.
 */
export interface SharkDomainSeed {
  domain: string;
  label?: string;
  patterns: string[];
  notes?: string;
}

/**
 * Returns the seed list of UK locksmith domains that match scam-pattern
 * criteria above. INTENTIONALLY EMPTY in the open-source repo — ops adds
 * the real domain list via the admin UI after legal/research review.
 *
 * To populate: visit /admin/shark-domains and add domains there. Or call
 * `addSharkDomain(domain, patterns)` from a one-off operations script.
 *
 * Why empty default: this file is committed to a public(-ish) repo and
 * accusations of "scam operator" carry legal risk. The pattern detection
 * via competitor-intel's fingerprint (no MLA + national dispatch + bait
 * pricing) populates the table at runtime; manual additions sit in the
 * DB only.
 */
export function getInitialSharkSeeds(): SharkDomainSeed[] {
  return [];
}

// ── Pattern detection (no domain list needed) ────────────────────────────────

/**
 * Heuristic shark fingerprint based on competitor-intel signals. Returns
 * a confidence score 0-1 that the given domain matches the shark pattern.
 *
 * This is what auto-populates SharkDomain rows when competitor-intel
 * scans and sees a domain that:
 *   - has no MLA membership signal
 *   - has no DBS-checked signal
 *   - claims nationwide coverage
 *   - has suspicious price anchors ("from £29", "£49 callout")
 *   - has Google Ads conversion tracking (so they're actively bidding)
 *
 * Threshold: confidence >= 0.6 → flagged. Below 0.6 → not flagged, but
 * worth re-evaluating on the next weekly scan.
 *
 * Inputs come from CompetitorFingerprint (already computed). This
 * function is pure (no DB), testable, deterministic.
 */
export interface SharkFingerprintInput {
  domain:             string;
  isMlaApproved:      boolean;
  isDbsChecked:       boolean;
  claimsNationwide:   boolean;
  hasGoogleAdsTag:    boolean;
  hasPpcTracking:     boolean;
  priceAnchors:       string[];
  lowestPriceGbp:     number | null;
  trustBadges:        string[];
  serviceAreasCount:  number;
}

export interface SharkVerdict {
  confidence:        number;        // 0-1
  shouldFlag:        boolean;       // confidence >= 0.6
  matchedPatterns:   string[];      // pattern flags that contributed
  reason:            string;        // human-readable summary
}

const BAIT_PRICE_RE = /(?:from\s+)?£\s*(?:19|25|29|39|49|59)\b/i;

/**
 * Score a domain against the shark pattern criteria.
 * Each criterion contributes 0.15-0.25 to the confidence score.
 * Trust signals (MLA, DBS, Trustpilot) actively SUBTRACT from confidence.
 */
export function scoreSharkFingerprint(input: SharkFingerprintInput): SharkVerdict {
  const matchedPatterns: string[] = [];
  let confidence = 0;
  const reasons: string[] = [];

  // ── Negative signals (no trust accreditation) ─────────────────────────────
  if (!input.isMlaApproved) {
    confidence += 0.2;
    matchedPatterns.push("no_mla");
    reasons.push("no MLA");
  }
  if (!input.isDbsChecked) {
    confidence += 0.15;
    matchedPatterns.push("no_dbs");
    reasons.push("no DBS");
  }

  // ── Commercial-scale signals (call-centre / national) ─────────────────────
  if (input.claimsNationwide) {
    confidence += 0.2;
    matchedPatterns.push("national_call_centre");
    reasons.push("nationwide claim");
  }
  if (input.serviceAreasCount > 15) {
    confidence += 0.15;
    matchedPatterns.push("excessive_service_areas");
    reasons.push(`covers ${input.serviceAreasCount} cities`);
  }

  // ── Bait pricing signals ──────────────────────────────────────────────────
  const baitPrices = input.priceAnchors.filter((a) => BAIT_PRICE_RE.test(a));
  if (baitPrices.length > 0) {
    confidence += 0.25;
    matchedPatterns.push("suspect_pricing");
    reasons.push(`bait price: ${baitPrices[0]}`);
  }
  // £19-£59 lowest price is the classic call-out bait. Real locksmiths
  // start at £85+ for an emergency visit; even £75 is a stretch.
  if (input.lowestPriceGbp !== null && input.lowestPriceGbp <= 59) {
    if (!matchedPatterns.includes("suspect_pricing")) {
      confidence += 0.15;
      matchedPatterns.push("suspect_pricing");
    }
    reasons.push(`lowest £${input.lowestPriceGbp}`);
  }

  // ── Active PPC signals (they're actively spending on these terms) ────────
  if (input.hasGoogleAdsTag || input.hasPpcTracking) {
    confidence += 0.1;
    matchedPatterns.push("active_ppc");
    reasons.push("running PPC");
  }

  // ── Trust signal credits — actively SUBTRACT from confidence ─────────────
  // A domain with strong real trust signals (MLA + Which? + Trustpilot +
  // realistic pricing) almost certainly isn't a shark, even if it ticks
  // some other boxes (e.g. covers many cities legitimately).
  if (input.trustBadges.includes("MLA Approved"))                confidence -= 0.3;
  if (input.trustBadges.includes("Which? Trusted Trader"))        confidence -= 0.25;
  if (input.trustBadges.includes("Trustpilot") &&
      input.lowestPriceGbp !== null && input.lowestPriceGbp > 70)  confidence -= 0.1;
  if (input.trustBadges.includes("Checkatrade"))                  confidence -= 0.1;

  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence,
    shouldFlag: confidence >= 0.6,
    matchedPatterns,
    reason: reasons.join(", ") || "no shark patterns matched",
  };
}
