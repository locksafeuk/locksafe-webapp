/**
 * Pure-helper tests for assemble-facts.
 *
 * The full assembleDistrictFacts function does Prisma + postcodes.io
 * calls — those are exercised via the end-to-end test in
 * conversion-loop-e2e.test.ts. Here we just pin the deterministic
 * helpers (extractBaseLocation, estimateTravelMins).
 */

import {
  extractBaseLocation,
  estimateTravelMins,
  NoCoverageError,
} from "@/lib/district-landing/assemble-facts";

describe("extractBaseLocation", () => {
  it("pulls the area from a full UK address", () => {
    expect(extractBaseLocation("12 Spring Rd, Caversham, Reading, RG4 5AB"))
      .toBe("Caversham");
  });

  it("handles 'UK' suffix", () => {
    expect(extractBaseLocation("12 Spring Rd, Caversham, Reading, RG4 5AB, UK"))
      .toBe("Caversham");
  });

  it("handles 'United Kingdom' suffix", () => {
    expect(extractBaseLocation("12 High Street, Stockport, SK1 2AB, United Kingdom"))
      .toBe("Stockport");
  });

  it("returns the first segment when only one comma exists", () => {
    expect(extractBaseLocation("Manchester, M1 1AA")).toBe("Manchester");
  });

  it("returns null for empty/missing input", () => {
    expect(extractBaseLocation(null)).toBeNull();
    expect(extractBaseLocation(undefined)).toBeNull();
    expect(extractBaseLocation("")).toBeNull();
  });

  it("strips trailing postcode-only segments", () => {
    expect(extractBaseLocation("17 Park Lane, Mayfair, W1K 1QA"))
      .toBe("Mayfair");
  });
});

describe("estimateTravelMins", () => {
  it("returns null for zero or null radius", () => {
    expect(estimateTravelMins(0)).toBeNull();
    expect(estimateTravelMins(null)).toBeNull();
    expect(estimateTravelMins(undefined)).toBeNull();
  });

  it("uses tighter bands at smaller radii", () => {
    expect(estimateTravelMins(3)).toMatch(/under 10/);
    expect(estimateTravelMins(8)).toMatch(/around 15/);
    expect(estimateTravelMins(12)).toMatch(/under 25/);
    expect(estimateTravelMins(20)).toMatch(/under 35/);
    expect(estimateTravelMins(40)).toMatch(/under 45/);
  });
});

describe("NoCoverageError", () => {
  it("carries the structured reason payload", () => {
    const err = new NoCoverageError({
      reason:   "no_coverage",
      district: "ZZ99",
      details:  "test",
    });
    expect(err.name).toBe("NoCoverageError");
    expect(err.reason).toBe("no_coverage");
    expect(err.district).toBe("ZZ99");
    expect(err.details).toBe("test");
    expect(err.message).toMatch(/ZZ99/);
  });
});
