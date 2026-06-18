import {
  findForbiddenClaim,
  scrubForbiddenAdCopy,
  assertAdCopyClean,
  AdCopyPreflightError,
  GODMODE_PRIMARY_HEADLINES,
  GODMODE_RECOMMENDED_SITELINKS,
  GODMODE_RECOMMENDED_CALLOUTS,
  applyGodmodePrimaryHeadlines,
  applyGodmodeRecommendedSitelinks,
  applyGodmodeRecommendedCallouts,
  isSitelinkAsset,
  isCalloutAsset,
  detectReviewCountClaim,
} from "../google-ads-copy-guard";

describe("ad-copy false-claim guard", () => {
  it("flags the 'no surprise fees' headline (LockSafe DOES charge a call-out fee)", () => {
    expect(findForbiddenClaim("No Surprise Fees. Ever.")).toMatch(/fee/i);
    expect(findForbiddenClaim("No Call-Out Fee")).toMatch(/call-out fee/i);
    expect(findForbiddenClaim("Free callout 24/7")).toMatch(/free.*call/i);
    expect(findForbiddenClaim("Zero fees, fast service")).toMatch(/fee/i);
    expect(findForbiddenClaim("Fee-free emergency locksmith")).toMatch(/fee-free/i);
  });

  it("flags unprovable price superlatives", () => {
    expect(findForbiddenClaim("Cheapest locksmith in town")).toMatch(/cheapest/i);
    expect(findForbiddenClaim("Guaranteed Lowest Price")).toMatch(/guaranteed lowest/i);
    expect(findForbiddenClaim("Lowest prices guaranteed!")).toMatch(/lowest price/i);
  });

  it("does NOT flag truthful, compliant copy", () => {
    expect(findForbiddenClaim("Upfront Fixed Pricing")).toBeNull();
    expect(findForbiddenClaim("See Prices Before Booking")).toBeNull();
    expect(findForbiddenClaim("Fixed Price Lock Change")).toBeNull();
    // (Removed 2026-06-17: "No hidden fees …" is now BANNED by §30 — see the
    // dedicated rejection test in the §30 block below. Compliant replacement
    // is the affirmative phrasing "Fixed Price Agreed Before Any Work Starts.")
    expect(findForbiddenClaim("See the full price up front before any work starts.")).toBeNull();
    expect(findForbiddenClaim("Vetted & Insured Locksmiths")).toBeNull();
  });

  it("scrubForbiddenAdCopy drops only the offending lines, preserving order", () => {
    const input = [
      "Liverpool Locksmith — 24/7",
      "No Surprise Fees. Ever.",
      "Anti-Fraud Booking Guarantee",
      "Cheapest in town",
      "Upfront Fixed Pricing",
    ];
    expect(scrubForbiddenAdCopy(input)).toEqual([
      "Liverpool Locksmith — 24/7",
      "Anti-Fraud Booking Guarantee",
      "Upfront Fixed Pricing",
    ]);
  });

  it("assertAdCopyClean throws AdCopyPreflightError listing every offending line", () => {
    expect(() =>
      assertAdCopyClean(
        ["Vetted & Insured", "No Call-Out Fee"],
        ["See upfront prices with no surprise call-out fees."],
      ),
    ).toThrow(AdCopyPreflightError);

    try {
      assertAdCopyClean(["No Call-Out Fee"], ["Cheapest service around"]);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AdCopyPreflightError);
      const e = err as AdCopyPreflightError;
      expect(e.offending).toHaveLength(2);
      expect(e.offending[0]).toMatchObject({ field: "headline" });
      expect(e.offending[1]).toMatchObject({ field: "description" });
    }
  });

  it("assertAdCopyClean is a no-op for compliant copy", () => {
    expect(() =>
      assertAdCopyClean(
        ["Upfront Fixed Pricing", "Vetted & Insured Locksmiths"],
        ["See the full price up front before any work starts."],
      ),
    ).not.toThrow();
  });
});

describe("§30 — ad-copy stack rebuild (2026-06-17 GODMODE plan)", () => {
  describe("HARD ban — the new persist-time enforcers", () => {
    it("rejects 'no call out fee' (the exact failing variant)", () => {
      expect(() =>
        assertAdCopyClean(["No call out fee"], ["Lorem ipsum."]),
      ).toThrow(AdCopyPreflightError);
    });

    it("rejects 'no surprise fees'", () => {
      expect(() =>
        assertAdCopyClean(["No Surprise Fees Ever"], ["Lorem ipsum."]),
      ).toThrow(AdCopyPreflightError);
    });

    it("rejects 'no hidden fees' (§30 hardened)", () => {
      expect(() =>
        assertAdCopyClean(["No hidden fees on any job"], ["Lorem ipsum."]),
      ).toThrow(AdCopyPreflightError);
    });

    it("rejects the description-level version too", () => {
      expect(() =>
        assertAdCopyClean(
          ["Fixed Price Lock Change"],
          ["Truly no call out fee or hidden charges."],
        ),
      ).toThrow(AdCopyPreflightError);
    });
  });

  describe("review-count substantiation gate", () => {
    it("rejects '1,200 Trustpilot Reviews' with no substantiated count", () => {
      expect(() =>
        assertAdCopyClean(["1,200 Trustpilot Reviews"], ["Lorem ipsum."]),
      ).toThrow(AdCopyPreflightError);
    });

    it("rejects '500+ Five-Star Reviews' with substantiated count = 30", () => {
      expect(() =>
        assertAdCopyClean(
          ["500+ Five-Star Reviews"],
          ["Lorem ipsum."],
          { trustpilotReviewCount: 30 },
        ),
      ).toThrow(AdCopyPreflightError);
    });

    it("accepts '50+ Trustpilot Reviews' when substantiated count = 60", () => {
      expect(() =>
        assertAdCopyClean(
          ["50+ Trustpilot Reviews"],
          ["Lorem ipsum."],
          { trustpilotReviewCount: 60 },
        ),
      ).not.toThrow();
    });

    it("rejects '500 reviews' when substantiated count = 80 (overstates)", () => {
      expect(() =>
        assertAdCopyClean(
          ["500 verified reviews"],
          ["Lorem ipsum."],
          { trustpilotReviewCount: 80 },
        ),
      ).toThrow(AdCopyPreflightError);
    });
  });

  describe("detectReviewCountClaim — numeric review detection", () => {
    it("parses comma-separated counts", () => {
      expect(detectReviewCountClaim("1,200 Trustpilot Reviews")).toBe(1200);
      expect(detectReviewCountClaim("5,000 5-star ratings")).toBe(5000);
    });
    it("parses k suffix", () => {
      expect(detectReviewCountClaim("4k happy customers")).toBe(4000);
    });
    it("ignores rating averages like '4.9 stars'", () => {
      expect(detectReviewCountClaim("4.9 stars on Trustpilot")).toBeNull();
    });
    it("returns null on copy with no review mention", () => {
      expect(detectReviewCountClaim("Upfront Fixed Pricing")).toBeNull();
    });
  });

  describe("GODMODE_PRIMARY_HEADLINES — the recommended stack", () => {
    it("ranks #1 = MLA, #2 = DBS, #3 = Fixed Price, #4 = Trustpilot (gated)", () => {
      expect(GODMODE_PRIMARY_HEADLINES[0]?.text).toMatch(/MLA/);
      expect(GODMODE_PRIMARY_HEADLINES[1]?.text).toMatch(/DBS/);
      expect(GODMODE_PRIMARY_HEADLINES[2]?.text).toMatch(/Fixed Price/);
      expect(GODMODE_PRIMARY_HEADLINES[3]?.text).toMatch(/Trustpilot/);
      expect(GODMODE_PRIMARY_HEADLINES[3]?.requires).toBe(
        "trustpilotReviewCount>=50",
      );
    });
  });

  describe("§36 — mandatory sitelinks + callouts (2026-06-18)", () => {
    describe("GODMODE_RECOMMENDED_SITELINKS shape", () => {
      it("exports exactly 4 ASA-compliant entries", () => {
        expect(GODMODE_RECOMMENDED_SITELINKS.length).toBe(4);
      });
      it("uses safe top-level URLs (no /locksmith-in/ — Local Services classifier risk)", () => {
        for (const s of GODMODE_RECOMMENDED_SITELINKS) {
          expect(s.finalUrl.startsWith("/")).toBe(true);
          expect(s.finalUrl).not.toMatch(/locksmith/i);
          expect(s.linkText.length).toBeLessThanOrEqual(25);
        }
      });
      it("includes the expected 4 link texts in the playbook order", () => {
        const texts = GODMODE_RECOMMENDED_SITELINKS.map((s) => s.linkText);
        expect(texts).toEqual([
          "24/7 Emergency Help",
          "How It Works",
          "Our Services",
          "Fixed Pricing",
        ]);
      });
      it("none of the link texts trip the forbidden-claims guard", () => {
        for (const s of GODMODE_RECOMMENDED_SITELINKS) {
          expect(findForbiddenClaim(s.linkText)).toBeNull();
        }
      });
    });

    describe("GODMODE_RECOMMENDED_CALLOUTS shape", () => {
      it("exports exactly 6 ASA-compliant entries (≥4 floor + 2 spares)", () => {
        expect(GODMODE_RECOMMENDED_CALLOUTS.length).toBe(6);
      });
      it("every callout ≤25 chars (Google limit)", () => {
        for (const c of GODMODE_RECOMMENDED_CALLOUTS) {
          expect(c.length).toBeLessThanOrEqual(25);
        }
      });
      it("none of the callouts trip the forbidden-claims guard", () => {
        for (const c of GODMODE_RECOMMENDED_CALLOUTS) {
          expect(findForbiddenClaim(c)).toBeNull();
        }
      });
    });

    describe("applyGodmodeRecommendedSitelinks", () => {
      it("appends all 4 recommended sitelinks to an empty asset list", () => {
        const out = applyGodmodeRecommendedSitelinks([]);
        const sitelinks = out.filter(isSitelinkAsset);
        expect(sitelinks.length).toBe(4);
      });
      it("does not duplicate an existing sitelink by linkText (case-insensitive)", () => {
        const existing = [
          { type: "SITELINK", linkText: "24/7 Emergency Help", finalUrl: "/x" },
        ];
        const out = applyGodmodeRecommendedSitelinks(existing);
        const sitelinks = out.filter(isSitelinkAsset);
        expect(sitelinks.length).toBe(4);
        const helps = sitelinks.filter((s) => /24\/7/i.test(s.linkText));
        expect(helps.length).toBe(1);
        expect(helps[0]?.finalUrl).toBe("/x");
      });
      it("preserves non-sitelink assets untouched", () => {
        const existing = [
          { type: "CALL", phoneNumber: "+44 20 0000 0000", countryCode: "GB" },
        ];
        const out = applyGodmodeRecommendedSitelinks(existing);
        expect(out.find((a) => (a as { type: string }).type === "CALL")).toBeDefined();
        expect(out.filter(isSitelinkAsset).length).toBe(4);
      });
    });

    describe("applyGodmodeRecommendedCallouts", () => {
      it("appends all 6 recommended callouts to an empty asset list", () => {
        const out = applyGodmodeRecommendedCallouts([]);
        const callouts = out.filter(isCalloutAsset);
        expect(callouts.length).toBe(6);
      });
      it("does not duplicate an existing callout by text", () => {
        const existing = [
          { type: "CALLOUT", text: "MLA-Approved Engineers" },
        ];
        const out = applyGodmodeRecommendedCallouts(existing);
        const callouts = out.filter(isCalloutAsset);
        expect(callouts.length).toBe(6);
      });
    });

    describe("assertAdCopyClean with sitelinks + callouts (§36 defence-in-depth)", () => {
      it("rejects a banned phrase in a sitelink linkText", () => {
        expect(() =>
          assertAdCopyClean(
            ["MLA-Approved Engineers"],
            ["Lorem ipsum."],
            {
              sitelinks: [{ linkText: "No Call-Out Fee", description1: "tap" }],
            },
          ),
        ).toThrow(AdCopyPreflightError);
      });
      it("rejects a banned phrase in a sitelink description", () => {
        expect(() =>
          assertAdCopyClean(
            ["MLA-Approved Engineers"],
            ["Lorem ipsum."],
            {
              sitelinks: [
                { linkText: "Emergency Help", description1: "No hidden fees on any job" },
              ],
            },
          ),
        ).toThrow(AdCopyPreflightError);
      });
      it("rejects a banned phrase in a callout", () => {
        expect(() =>
          assertAdCopyClean(
            ["MLA-Approved Engineers"],
            ["Lorem ipsum."],
            { callouts: [{ text: "No surprise fees" }] },
          ),
        ).toThrow(AdCopyPreflightError);
      });
      it("accepts clean GODMODE_RECOMMENDED_SITELINKS + GODMODE_RECOMMENDED_CALLOUTS", () => {
        expect(() =>
          assertAdCopyClean(
            ["MLA-Approved Engineers"],
            ["Lorem ipsum."],
            {
              sitelinks: GODMODE_RECOMMENDED_SITELINKS.map((s) => ({ linkText: s.linkText })),
              callouts: GODMODE_RECOMMENDED_CALLOUTS.map((text) => ({ text })),
            },
          ),
        ).not.toThrow();
      });
    });
  });

  describe("applyGodmodePrimaryHeadlines — injection", () => {
    it("drops the Trustpilot line when count is below the floor", () => {
      const out = applyGodmodePrimaryHeadlines(["Existing headline"], {
        trustpilotReviewCount: 10,
      });
      expect(out).toContain("MLA-Approved Locksmith Engineers");
      expect(out).toContain("DBS-Checked & Uniformed");
      expect(out).toContain("Fixed Price Agreed Before Any Work Starts");
      expect(out.some((h) => /Trustpilot/i.test(h))).toBe(false);
    });

    it("includes the Trustpilot line when count >= 50", () => {
      const out = applyGodmodePrimaryHeadlines([], { trustpilotReviewCount: 60 });
      expect(out.some((h) => /Trustpilot/i.test(h))).toBe(true);
    });

    it("dedupes against existing headlines", () => {
      const out = applyGodmodePrimaryHeadlines([
        "MLA-Approved Locksmith Engineers",
        "Existing",
      ]);
      const count = out.filter(
        (h) => h.toLowerCase() === "mla-approved locksmith engineers",
      ).length;
      expect(count).toBe(1);
    });
  });
});
