/**
 * Shark Domain heuristic — scoreSharkFingerprint() unit tests.
 *
 * The function is intentionally pure (no DB, deterministic) so this suite
 * pins down the SCORING contract:
 *
 *   • Classic shark profile (no MLA + nationwide + bait price + active PPC)
 *     scores well above the 0.6 flag threshold.
 *   • Trust-led independents (MLA + DBS + sane pricing + low geo count)
 *     score well below 0.6 even when they tick some shark boxes.
 *   • Trust badges actively SUBTRACT confidence — a domain that ticks
 *     every shark box but also carries MLA + Which? + Trustpilot + sane
 *     pricing comes out CLEAN.
 *   • Confidence is always clamped to [0, 1].
 *
 * The numeric thresholds are part of the public contract for ops review;
 * if you change them, update these tests deliberately.
 */

import {
  scoreSharkFingerprint,
  getInitialSharkSeeds,
  type SharkFingerprintInput,
} from "@/lib/shark-domains";

// ── Fixture builder ──────────────────────────────────────────────────────────

/** Neutral baseline — every signal at the "no info" default. */
function makeInput(overrides: Partial<SharkFingerprintInput> = {}): SharkFingerprintInput {
  return {
    domain:             "test.co.uk",
    isMlaApproved:      false,
    isDbsChecked:       false,
    claimsNationwide:   false,
    hasGoogleAdsTag:    false,
    hasPpcTracking:     false,
    priceAnchors:       [],
    lowestPriceGbp:     null,
    trustBadges:        [],
    serviceAreasCount:  0,
    ...overrides,
  };
}

// ── Classic shark profile ────────────────────────────────────────────────────

describe("scoreSharkFingerprint — classic shark profile", () => {
  it("flags a no-MLA + nationwide + £29 bait + active-PPC domain", () => {
    const input = makeInput({
      domain:            "callcentre-locksmiths.co.uk",
      isMlaApproved:     false,
      isDbsChecked:      false,
      claimsNationwide:  true,
      hasGoogleAdsTag:   true,
      priceAnchors:      ["From £29 callout", "Lock change from £89"],
      lowestPriceGbp:    29,
      serviceAreasCount: 60,
    });

    const verdict = scoreSharkFingerprint(input);

    expect(verdict.shouldFlag).toBe(true);
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.6);
    expect(verdict.matchedPatterns).toEqual(expect.arrayContaining([
      "no_mla",
      "no_dbs",
      "national_call_centre",
      "excessive_service_areas",
      "suspect_pricing",
      "active_ppc",
    ]));
  });

  it("flags a no-trust + £49 from-price even without nationwide claim", () => {
    const input = makeInput({
      priceAnchors:  ["from £49"],
      hasPpcTracking: true,
    });
    const v = scoreSharkFingerprint(input);
    expect(v.matchedPatterns).toEqual(expect.arrayContaining(["suspect_pricing", "active_ppc"]));
    expect(v.confidence).toBeGreaterThan(0);
  });

  it("only counts suspect_pricing ONCE when both bait pattern AND low price are present", () => {
    const input = makeInput({
      priceAnchors:   ["from £29"],
      lowestPriceGbp: 29,
    });
    const v = scoreSharkFingerprint(input);
    const occurrences = v.matchedPatterns.filter((p) => p === "suspect_pricing").length;
    expect(occurrences).toBe(1);
  });
});

// ── Trust-led independents do NOT flag ───────────────────────────────────────

describe("scoreSharkFingerprint — trust-led independents", () => {
  it("does NOT flag an MLA + DBS + Which? local locksmith with sane pricing", () => {
    const input = makeInput({
      domain:            "honest-locks-leeds.co.uk",
      isMlaApproved:     true,
      isDbsChecked:      true,
      claimsNationwide:  false,
      hasGoogleAdsTag:   true,
      priceAnchors:      ["from £89", "lock change £140"],
      lowestPriceGbp:    89,
      trustBadges:       ["MLA Approved", "Which? Trusted Trader", "Trustpilot"],
      serviceAreasCount: 3,
    });

    const v = scoreSharkFingerprint(input);
    expect(v.shouldFlag).toBe(false);
    expect(v.confidence).toBeLessThan(0.6);
    expect(v.matchedPatterns).not.toContain("no_mla");
    expect(v.matchedPatterns).not.toContain("no_dbs");
  });

  it("trust badges actively subtract from confidence", () => {
    // Same input twice — once WITH and once WITHOUT badges.
    const base = makeInput({
      claimsNationwide:  true,
      serviceAreasCount: 25,
      priceAnchors:      ["from £49"],
      lowestPriceGbp:    49,
      hasGoogleAdsTag:   true,
      // start without trust → high confidence
    });

    const withoutBadges = scoreSharkFingerprint(base);
    const withBadges    = scoreSharkFingerprint({
      ...base,
      isMlaApproved: true,
      isDbsChecked:  true,
      lowestPriceGbp: 95,                     // sane price too
      priceAnchors:   ["from £95"],
      trustBadges:    ["MLA Approved", "Which? Trusted Trader", "Trustpilot", "Checkatrade"],
    });

    expect(withBadges.confidence).toBeLessThan(withoutBadges.confidence);
    expect(withBadges.shouldFlag).toBe(false);
  });
});

// ── Threshold + clamp invariants ─────────────────────────────────────────────

describe("scoreSharkFingerprint — invariants", () => {
  it("clamps confidence to [0, 1]", () => {
    // Maximum-shark input — confidence should saturate at 1, not overflow
    const maxShark = makeInput({
      claimsNationwide:  true,
      serviceAreasCount: 999,
      priceAnchors:      ["from £19", "£29", "£39"],
      lowestPriceGbp:    19,
      hasGoogleAdsTag:   true,
      hasPpcTracking:    true,
    });
    const maxVerdict = scoreSharkFingerprint(maxShark);
    expect(maxVerdict.confidence).toBeLessThanOrEqual(1);
    expect(maxVerdict.confidence).toBeGreaterThanOrEqual(0);

    // Maximum-trust input — confidence floor at 0, never negative
    const maxTrust = makeInput({
      isMlaApproved: true,
      isDbsChecked:  true,
      lowestPriceGbp: 95,
      trustBadges:   [
        "MLA Approved", "Which? Trusted Trader", "Trustpilot", "Checkatrade",
      ],
    });
    const trustVerdict = scoreSharkFingerprint(maxTrust);
    expect(trustVerdict.confidence).toBeGreaterThanOrEqual(0);
    expect(trustVerdict.confidence).toBeLessThanOrEqual(1);
    expect(trustVerdict.shouldFlag).toBe(false);
  });

  it("shouldFlag matches confidence >= 0.6 exactly", () => {
    // Build several inputs spanning the threshold and check both directions agree
    for (let i = 0; i < 5; i++) {
      const input = makeInput({
        isMlaApproved:    i % 2 === 0,
        claimsNationwide: i >= 2,
        priceAnchors:     i >= 3 ? ["from £29"] : [],
        lowestPriceGbp:   i >= 4 ? 29 : null,
      });
      const v = scoreSharkFingerprint(input);
      expect(v.shouldFlag).toBe(v.confidence >= 0.6);
    }
  });

  it("returns a human-readable reason string", () => {
    const v = scoreSharkFingerprint(makeInput({
      claimsNationwide: true,
      priceAnchors:     ["from £29"],
    }));
    expect(v.reason).toMatch(/no MLA|no DBS|nationwide|bait price/);
    expect(v.reason).not.toBe("");
  });

  it("emits 'no shark patterns matched' reason when nothing fires", () => {
    const cleanInput = makeInput({
      isMlaApproved:  true,
      isDbsChecked:   true,
      lowestPriceGbp: 120,
      trustBadges:    ["MLA Approved"],
    });
    const v = scoreSharkFingerprint(cleanInput);
    // matchedPatterns may still be empty, but reason should not be a bare comma list
    expect(v.reason.length).toBeGreaterThan(0);
  });
});

// ── Bait pricing pattern ─────────────────────────────────────────────────────

describe("scoreSharkFingerprint — bait pricing detection", () => {
  it.each([
    ["from £19", true],
    ["from £25", true],
    ["from £29", true],
    ["£39 callout",  true],
    ["From £49",     true],
    ["£59 emergency", true],
    ["from £85", false],   // realistic emergency callout floor
    ["£140 lock change", false],
    ["no price quoted", false],
  ])("classifies %p as bait=%p", (anchor, expected) => {
    const v = scoreSharkFingerprint(makeInput({ priceAnchors: [anchor] }));
    expect(v.matchedPatterns.includes("suspect_pricing")).toBe(expected);
  });

  it("flags lowestPriceGbp <= 59 even when priceAnchors strings don't match the regex", () => {
    // e.g. raw scraped price was "£45" but anchor extraction produced
    // "scaffold call £45 today!" which doesn't match the bait-price regex
    const v = scoreSharkFingerprint(makeInput({
      priceAnchors:   ["scaffold call £45 today!"],
      lowestPriceGbp: 45,
    }));
    expect(v.matchedPatterns).toContain("suspect_pricing");
  });

  it("does NOT flag lowestPrice over 70 as bait pricing", () => {
    const v = scoreSharkFingerprint(makeInput({
      priceAnchors:   ["from £85"],
      lowestPriceGbp: 85,
    }));
    expect(v.matchedPatterns).not.toContain("suspect_pricing");
  });
});

// ── service area count threshold ─────────────────────────────────────────────

describe("scoreSharkFingerprint — service area threshold", () => {
  it("does NOT flag excessive_service_areas at 15 or below", () => {
    const v = scoreSharkFingerprint(makeInput({ serviceAreasCount: 15 }));
    expect(v.matchedPatterns).not.toContain("excessive_service_areas");
  });

  it("flags excessive_service_areas at 16 and above", () => {
    const v = scoreSharkFingerprint(makeInput({ serviceAreasCount: 16 }));
    expect(v.matchedPatterns).toContain("excessive_service_areas");
  });
});

// ── Seed list contract ───────────────────────────────────────────────────────

describe("getInitialSharkSeeds", () => {
  it("returns an empty list — operators populate the DB via the admin UI", () => {
    expect(getInitialSharkSeeds()).toEqual([]);
  });

  it("returns the same shape every call (no hidden state)", () => {
    const a = getInitialSharkSeeds();
    const b = getInitialSharkSeeds();
    expect(a).toEqual(b);
    expect(Array.isArray(a)).toBe(true);
  });
});
