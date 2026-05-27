import {
  findForbiddenClaim,
  scrubForbiddenAdCopy,
  assertAdCopyClean,
  AdCopyPreflightError,
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
    expect(findForbiddenClaim("No hidden fees — see the price up front")).toBeNull();
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
