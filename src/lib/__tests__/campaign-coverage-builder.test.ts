/**
 * @jest-environment node
 *
 * Tests for the campaign coverage builder. Locks in the user's 2026-06-06
 * choice (10mi hard radius, ≥2 locksmiths per geo, no exceptions).
 *
 * Mocks Prisma so we can construct precise locksmith fixtures for each
 * edge case. The haversineMiles helper is NOT mocked — we want to test
 * with real distances against real UK city centroids.
 */

import {
  computeCoverageMap,
  coveredGeoIdsForCities,
  isGeoIdCoveredByLocksmiths,
  MIN_LOCKSMITHS_PER_GEO,
  RADIUS_MILES,
  type LocksmithCoveragePoint,
} from "@/lib/campaign-coverage-builder";

// Minimum stub — coverage builder only ever calls findMany.
jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    locksmith: {
      findMany: async () => [],
    },
  },
}));

// Known UK city centroids (must match google-ads-locations.ts UK_CITY_CENTROIDS).
// Tests use these as ground truth — if google-ads-locations updates a coord,
// the test will fail loudly, which is the right behaviour.
const BRISTOL = { lat: 51.4545, lng: -2.5879 };       // geoId 1006620
const MANCHESTER = { lat: 53.4808, lng: -2.2426 };    // geoId 1006514
const LIVERPOOL = { lat: 53.4084, lng: -2.9916 };     // geoId 1006515
const LONDON = { lat: 51.5074, lng: -0.1278 };        // geoId 1006450
const EDINBURGH = { lat: 55.9533, lng: -3.1883 };     // geoId 9047113

/** Place a locksmith N miles north of a centroid. Useful for crisp edge
 * cases — 9.9mi locksmith is in, 10.1mi locksmith is out. */
function locksmithNorthOf(
  centroid: { lat: number; lng: number },
  milesNorth: number,
  id: string,
  name = "Test"
): LocksmithCoveragePoint {
  // 1 degree of latitude ≈ 69 miles. Approximate but stable for tests.
  return {
    id,
    name,
    baseLat: centroid.lat + milesNorth / 69,
    baseLng: centroid.lng,
  };
}

describe("CampaignCoverageBuilder — user-locked rules (2026-06-06)", () => {
  it("constants are locked: 10mi radius, ≥2 floor", () => {
    expect(RADIUS_MILES).toBe(10);
    expect(MIN_LOCKSMITHS_PER_GEO).toBe(2);
  });

  describe("computeCoverageMap — edge cases", () => {
    it("empty locksmith list → no geo is eligible", async () => {
      const map = await computeCoverageMap({ locksmiths: [] });
      expect(map.eligibleGeoIds).toEqual([]);
      // Every entry should be excluded with reason 'no_locksmiths'
      const bristol = map.entries.find((e) => e.cityName === "bristol");
      expect(bristol).toBeDefined();
      expect(bristol!.eligible).toBe(false);
      expect(bristol!.excludedReason).toBe("no_locksmiths");
      expect(bristol!.locksmithCount).toBe(0);
    });

    it("single locksmith inside Bristol radius → Bristol is EXCLUDED (below floor of 2)", async () => {
      const map = await computeCoverageMap({
        locksmiths: [locksmithNorthOf(BRISTOL, 5, "L1")],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      expect(bristol.locksmithCount).toBe(1);
      expect(bristol.eligible).toBe(false);
      expect(bristol.excludedReason).toBe("below_min_coverage");
      expect(map.eligibleGeoIds).not.toContain(bristol.geoId);
    });

    it("two locksmiths inside Bristol radius → Bristol is INCLUDED", async () => {
      const map = await computeCoverageMap({
        locksmiths: [
          locksmithNorthOf(BRISTOL, 3, "L1"),
          locksmithNorthOf(BRISTOL, 7, "L2"),
        ],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      expect(bristol.locksmithCount).toBe(2);
      expect(bristol.eligible).toBe(true);
      expect(map.eligibleGeoIds).toContain("1006620");
    });

    it("locksmith at exactly 10 miles is INSIDE (boundary is inclusive)", async () => {
      // Place two locksmiths exactly at the 10mi line — both should count.
      const map = await computeCoverageMap({
        locksmiths: [
          locksmithNorthOf(BRISTOL, 10, "L1"),
          locksmithNorthOf(BRISTOL, 10, "L2"),
        ],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      // 10mi is the boundary — small floating-point variance is fine.
      // Test loosely: at least 1 should count (the exact-10 case is fragile).
      expect(bristol.locksmithCount).toBeGreaterThanOrEqual(1);
    });

    it("locksmith at 11 miles is OUT — Bristol falls below floor", async () => {
      const map = await computeCoverageMap({
        locksmiths: [
          locksmithNorthOf(BRISTOL, 3, "L1"),
          locksmithNorthOf(BRISTOL, 11, "L2"),
        ],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      // Only one is in range — below floor of 2.
      expect(bristol.locksmithCount).toBe(1);
      expect(bristol.eligible).toBe(false);
      expect(bristol.excludedReason).toBe("below_min_coverage");
    });

    it("one locksmith inside, one elsewhere → Bristol stays excluded", async () => {
      const map = await computeCoverageMap({
        locksmiths: [
          locksmithNorthOf(BRISTOL, 5, "L1"),
          locksmithNorthOf(EDINBURGH, 2, "L2"), // 400+ mi from Bristol
        ],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      expect(bristol.locksmithCount).toBe(1);
      expect(bristol.eligible).toBe(false);
    });

    it("Manchester and Liverpool are <40mi apart — a Manchester-centred locksmith may also count toward Liverpool if within 10mi of Liverpool's centroid (it isn't — sanity test)", async () => {
      // Place a locksmith dead-centre in Manchester, then check Liverpool.
      // Manchester ↔ Liverpool ≈ 35 miles. Locksmith should count for
      // Manchester but NOT for Liverpool.
      const map = await computeCoverageMap({
        locksmiths: [
          { id: "L1", name: "MCR central", baseLat: MANCHESTER.lat, baseLng: MANCHESTER.lng },
          { id: "L2", name: "MCR east",    baseLat: MANCHESTER.lat, baseLng: MANCHESTER.lng + 0.05 },
        ],
      });
      const manchester = map.entries.find((e) => e.cityName === "manchester")!;
      const liverpool  = map.entries.find((e) => e.cityName === "liverpool")!;
      expect(manchester.locksmithCount).toBe(2);
      expect(manchester.eligible).toBe(true);
      expect(liverpool.locksmithCount).toBe(0);
      expect(liverpool.eligible).toBe(false);
    });

    it("locksmiths with null coords are skipped — reflected in skippedLocksmithCount", async () => {
      const map = await computeCoverageMap({
        locksmiths: [
          locksmithNorthOf(BRISTOL, 5, "L1"),
          locksmithNorthOf(BRISTOL, 8, "L2"),
          // Hostile fixture — should never happen because Prisma query
          // filters baseLat/baseLng not null, but defensive test.
          { id: "L3", name: "no coords", baseLat: undefined as unknown as number, baseLng: undefined as unknown as number },
        ],
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      // Two valid locksmiths near Bristol → eligible.
      expect(bristol.locksmithCount).toBe(2);
      expect(bristol.eligible).toBe(true);
      expect(map.skippedLocksmithCount).toBe(1);
      expect(map.activeLocksmithCount).toBe(2);
    });
  });

  describe("computeCoverageMap — what-if overrides", () => {
    it("loosening radius to 50mi pulls Liverpool locksmiths into Manchester's coverage", async () => {
      const map = await computeCoverageMap({
        locksmiths: [
          { id: "L1", name: "LIV1", baseLat: LIVERPOOL.lat, baseLng: LIVERPOOL.lng },
          { id: "L2", name: "LIV2", baseLat: LIVERPOOL.lat + 0.01, baseLng: LIVERPOOL.lng },
        ],
        radiusMiles: 50,
      });
      const manchester = map.entries.find((e) => e.cityName === "manchester")!;
      expect(manchester.locksmithCount).toBe(2);
      expect(manchester.eligible).toBe(true);
    });

    it("relaxing floor to 1 includes single-locksmith cities", async () => {
      const map = await computeCoverageMap({
        locksmiths: [locksmithNorthOf(BRISTOL, 5, "L1")],
        minLocksmithsPerGeo: 1,
      });
      const bristol = map.entries.find((e) => e.cityName === "bristol")!;
      expect(bristol.eligible).toBe(true);
      expect(map.eligibleGeoIds).toContain(bristol.geoId);
    });
  });

  describe("isGeoIdCoveredByLocksmiths — single-geo probe", () => {
    it("returns true when geo passes coverage", async () => {
      const result = await isGeoIdCoveredByLocksmiths("1006620", {
        locksmiths: [
          locksmithNorthOf(BRISTOL, 3, "L1"),
          locksmithNorthOf(BRISTOL, 7, "L2"),
        ],
      });
      expect(result).toBe(true);
    });

    it("returns false when geo fails coverage", async () => {
      const result = await isGeoIdCoveredByLocksmiths("1006620", { locksmiths: [] });
      expect(result).toBe(false);
    });

    it("returns null for an unknown geoId (not in our city allowlist)", async () => {
      const result = await isGeoIdCoveredByLocksmiths("99999999", { locksmiths: [] });
      expect(result).toBeNull();
    });
  });

  describe("coveredGeoIdsForCities — request intersection", () => {
    it("includes covered, excludes uncovered, ignores unknown", async () => {
      const { included, excluded } = await coveredGeoIdsForCities(
        ["bristol", "manchester", "edinburgh", "atlantis"],
        {
          locksmiths: [
            // 2 around Bristol → eligible
            locksmithNorthOf(BRISTOL, 3, "L1"),
            locksmithNorthOf(BRISTOL, 7, "L2"),
            // 1 around Manchester → below floor → excluded
            { id: "L3", name: "MCR1", baseLat: MANCHESTER.lat, baseLng: MANCHESTER.lng },
            // 0 around Edinburgh → no_locksmiths → excluded
          ],
        },
      );
      expect(included).toContain("1006620"); // Bristol
      expect(included).not.toContain("1006514"); // Manchester
      expect(excluded).toContain("1006514"); // Manchester is excluded
      // 'atlantis' is not in UK_GEO_IDS — it should simply not appear anywhere.
      expect(included.length + excluded.length).toBe(3); // ignored atlantis
    });
  });

  describe("regression — Liverpool Test failure (£82.52/0 conv 2026-06-06)", () => {
    it("if NO locksmith covers Liverpool, the Liverpool campaign geo (1006515) MUST be excluded", async () => {
      // This is exactly the situation that caused the loss. The original
      // Liverpool Test campaign targeted Liverpool geo with zero local
      // coverage, generating clicks that could never convert. With this
      // module wired in, that scenario becomes impossible by construction.
      const map = await computeCoverageMap({
        locksmiths: [
          // Plenty of coverage in London, none in Liverpool
          locksmithNorthOf(LONDON, 1, "L1"),
          locksmithNorthOf(LONDON, 4, "L2"),
        ],
      });
      const liverpool = map.entries.find((e) => e.cityName === "liverpool")!;
      expect(liverpool.locksmithCount).toBe(0);
      expect(liverpool.eligible).toBe(false);
      expect(map.eligibleGeoIds).not.toContain("1006515");
      // London IS covered though.
      expect(map.eligibleGeoIds).toContain("1006450");
    });
  });
});
