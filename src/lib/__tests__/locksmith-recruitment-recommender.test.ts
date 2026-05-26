/**
 * Locksmith Recruitment Recommender — unit tests.
 *
 * Pins the strategic-ranking contract that drives where LockSafe should
 * recruit (or extend an existing locksmith into) next. Tests cover:
 *   • populationToDemandScore + regionToBoost + sharkSignalToBoost
 *   • coverage filter (covered outcodes never recommended)
 *   • new_hire vs radius_extend flip-over at 12mi threshold
 *   • region filter
 *   • limit + deterministic sort
 *   • haversineMiles correctness
 */

import {
  recommendRecruitmentTargets,
  populationToDemandScore,
  regionToBoost,
  sharkSignalToBoost,
  findNearestLocksmith,
  partitionRecommendations,
  UK_OUTCODES,
} from "@/lib/locksmith-recruitment-recommender";
import { haversineMiles, UK_OUTCODES_BY_CODE } from "@/lib/uk-outcodes-reference";

// ── populationToDemandScore ─────────────────────────────────────────────────

describe("populationToDemandScore", () => {
  it("returns 0 for empty/invalid population", () => {
    expect(populationToDemandScore(0)).toBe(0);
    expect(populationToDemandScore(-5)).toBe(0);
  });

  it("grows monotonically with population", () => {
    const a = populationToDemandScore(5_000);
    const b = populationToDemandScore(20_000);
    const c = populationToDemandScore(80_000);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("clamps at 40", () => {
    expect(populationToDemandScore(10_000_000)).toBeLessThanOrEqual(40);
  });

  it("uses a logarithmic curve (50k is NOT 10× 5k)", () => {
    const small = populationToDemandScore(5_000);
    const big   = populationToDemandScore(50_000);
    // Should grow but not 10× — log curve compresses
    expect(big).toBeLessThan(small * 5);
  });
});

// ── regionToBoost ───────────────────────────────────────────────────────────

describe("regionToBoost", () => {
  it("ranks commuter_belt highest", () => {
    expect(regionToBoost("commuter_belt")).toBeGreaterThan(regionToBoost("london"));
    expect(regionToBoost("commuter_belt")).toBeGreaterThan(regionToBoost("midlands"));
    expect(regionToBoost("commuter_belt")).toBeGreaterThan(regionToBoost("wales"));
  });

  it("ranks Northern Ireland lowest among defined regions", () => {
    expect(regionToBoost("northern_ireland")).toBeLessThan(regionToBoost("wales"));
  });

  it("returns finite values for every region tag", () => {
    const tags = ["london", "commuter_belt", "north_west", "north_east", "midlands",
                  "south_west", "south_east", "scotland", "wales", "northern_ireland"] as const;
    for (const tag of tags) {
      const v = regionToBoost(tag);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── sharkSignalToBoost ──────────────────────────────────────────────────────

describe("sharkSignalToBoost", () => {
  it("returns 0 when no signal is provided", () => {
    expect(sharkSignalToBoost(undefined)).toBe(0);
  });

  it("rewards high shark density", () => {
    const low  = sharkSignalToBoost({ outcode: "X1", meanShark: 0.1, topCpcGbp: null });
    const high = sharkSignalToBoost({ outcode: "X1", meanShark: 0.9, topCpcGbp: null });
    expect(high).toBeGreaterThan(low);
  });

  it("adds a CPC bonus when top CPC ≥ £4", () => {
    const baseDensity = { outcode: "X1", meanShark: 0.5 };
    const noCpc  = sharkSignalToBoost({ ...baseDensity, topCpcGbp: null });
    const midCpc = sharkSignalToBoost({ ...baseDensity, topCpcGbp: 3 });
    const hotCpc = sharkSignalToBoost({ ...baseDensity, topCpcGbp: 5 });
    expect(midCpc).toBeGreaterThan(noCpc);
    expect(hotCpc).toBeGreaterThan(midCpc);
  });

  it("clamps at 25", () => {
    expect(sharkSignalToBoost({ outcode: "X1", meanShark: 1, topCpcGbp: 999 }))
      .toBeLessThanOrEqual(25);
  });
});

// ── haversineMiles ──────────────────────────────────────────────────────────

describe("haversineMiles", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMiles(51.5, -0.1, 51.5, -0.1)).toBeCloseTo(0);
  });

  it("computes London-to-Manchester ≈ 163mi (within tolerance)", () => {
    // London 51.5074, -0.1278; Manchester 53.4808, -2.2426
    const d = haversineMiles(51.5074, -0.1278, 53.4808, -2.2426);
    expect(d).toBeGreaterThan(155);
    expect(d).toBeLessThan(170);
  });
});

// ── findNearestLocksmith ───────────────────────────────────────────────────

describe("findNearestLocksmith", () => {
  const rg1 = UK_OUTCODES_BY_CODE.get("RG1")!;

  it("returns null when no locksmith is within range", () => {
    const result = findNearestLocksmith(rg1, [
      { id: "a", name: "Far Locksmith", lat: 53.5, lng: -2.2, radiusMi: 5 },  // Manchester
    ], 10);
    expect(result).toBeNull();
  });

  it("returns the closest locksmith within range", () => {
    const result = findNearestLocksmith(rg1, [
      { id: "a", name: "Far Locksmith",  lat: 53.5, lng: -2.2,  radiusMi: 5 },
      { id: "b", name: "Near Locksmith", lat: 51.45, lng: -0.98, radiusMi: 5 },  // ~1mi from RG1
    ], 30);
    expect(result!.locksmith.id).toBe("b");
    expect(result!.distanceMi).toBeLessThan(5);
  });

  it("respects the maxMiles cap", () => {
    const closeButOutside = findNearestLocksmith(rg1, [
      { id: "a", name: "Just Out", lat: 51.20, lng: -0.55, radiusMi: 5 },  // ~25mi from RG1
    ], 10);
    expect(closeButOutside).toBeNull();
  });
});

// ── recommendRecruitmentTargets ─────────────────────────────────────────────

describe("recommendRecruitmentTargets", () => {
  it("excludes already-covered outcodes from the recommendation", () => {
    const recs = recommendRecruitmentTargets({
      coveredOutcodes: ["M1", "RG1"],
      limit: 100,
    });
    expect(recs.map((r) => r.outcode)).not.toContain("M1");
    expect(recs.map((r) => r.outcode)).not.toContain("RG1");
  });

  it("respects the limit", () => {
    const recs = recommendRecruitmentTargets({ coveredOutcodes: [], limit: 5 });
    expect(recs).toHaveLength(5);
  });

  it("respects the region filter", () => {
    const recs = recommendRecruitmentTargets({
      coveredOutcodes: [],
      regionFilter:    ["scotland"],
      limit: 50,
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.region === "scotland")).toBe(true);
  });

  it("flips to radius_extend when an existing locksmith is within 12 miles", () => {
    const rg1 = UK_OUTCODES_BY_CODE.get("RG1")!;
    const recs = recommendRecruitmentTargets({
      coveredOutcodes: [],
      existingLocksmithLocations: [{
        id:       "ls1",
        name:     "Berkshire Locks",
        lat:      rg1.lat + 0.02,    // very close to RG1
        lng:      rg1.lng + 0.02,
        radiusMi: 5,
      }],
      regionFilter: ["commuter_belt"],
      limit: 50,
    });
    const rg1Rec = recs.find((r) => r.outcode === "RG1");
    expect(rg1Rec).toBeDefined();
    expect(rg1Rec!.recommendation.action).toBe("radius_extend");
    expect(rg1Rec!.recommendation.locksmithId).toBe("ls1");
    expect(rg1Rec!.recommendation.distanceMi).toBeLessThan(5);
  });

  it("recommends new_hire when no existing locksmith is nearby", () => {
    const recs = recommendRecruitmentTargets({
      coveredOutcodes: [],
      existingLocksmithLocations: [{
        id:       "ls1",
        name:     "Edinburgh Locks",
        lat:      55.95, lng: -3.20,    // Edinburgh
        radiusMi: 5,
      }],
      // Look at NI — far from any existing locksmith
      regionFilter: ["northern_ireland"],
      limit: 5,
    });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.recommendation.action).toBe("new_hire");
    }
  });

  it("returns highest-score first (deterministic sort)", () => {
    const recs = recommendRecruitmentTargets({ coveredOutcodes: [], limit: 10 });
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].score).toBeLessThanOrEqual(recs[i - 1].score);
    }
  });

  it("emits at least one reason per recommendation", () => {
    const recs = recommendRecruitmentTargets({ coveredOutcodes: [], limit: 3 });
    for (const r of recs) {
      expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("applies shark pressure boost when signal is provided", () => {
    const without = recommendRecruitmentTargets({
      coveredOutcodes: [],
      regionFilter:    ["london"],
      limit: 50,
    });
    const withSig = recommendRecruitmentTargets({
      coveredOutcodes: [],
      regionFilter:    ["london"],
      sharkSignals:    [{ outcode: "SW1A", meanShark: 0.9, topCpcGbp: 6 }],
      limit: 50,
    });
    const noSig  = without.find((r) => r.outcode === "SW1A");
    const yesSig = withSig.find((r) => r.outcode === "SW1A");
    expect(yesSig!.score).toBeGreaterThan(noSig!.score);
    expect(yesSig!.components.sharkPressureBoost).toBeGreaterThan(0);
  });

  it("is deterministic — same input → same output", () => {
    const opts = {
      coveredOutcodes: ["M1", "RG1"],
      sharkSignals:    [{ outcode: "L1", meanShark: 0.6, topCpcGbp: 3.5 }],
      limit: 10,
    };
    const a = recommendRecruitmentTargets(opts);
    const b = recommendRecruitmentTargets(opts);
    expect(a).toEqual(b);
  });
});

// ── partitionRecommendations ────────────────────────────────────────────────

describe("partitionRecommendations", () => {
  it("splits new_hires and radius_extends cleanly", () => {
    const rg1 = UK_OUTCODES_BY_CODE.get("RG1")!;
    const recs = recommendRecruitmentTargets({
      coveredOutcodes: [],
      existingLocksmithLocations: [{
        id: "ls1", name: "Reading Locks",
        lat: rg1.lat + 0.01, lng: rg1.lng + 0.01,
        radiusMi: 5,
      }],
      limit: 50,
    });
    const { newHires, radiusExtends } = partitionRecommendations(recs);
    expect(newHires.length + radiusExtends.length).toBe(recs.length);
    expect(newHires.every((r) => r.recommendation.action === "new_hire")).toBe(true);
    expect(radiusExtends.every((r) => r.recommendation.action === "radius_extend")).toBe(true);
  });
});

// ── UK_OUTCODES reference integrity ─────────────────────────────────────────

describe("UK_OUTCODES reference data", () => {
  it("has at least 50 outcodes", () => {
    expect(UK_OUTCODES.length).toBeGreaterThanOrEqual(50);
  });

  it("every outcode has a valid population estimate", () => {
    for (const o of UK_OUTCODES) {
      expect(o.populationEst).toBeGreaterThan(0);
      expect(Number.isFinite(o.populationEst)).toBe(true);
    }
  });

  it("every outcode has finite lat/lng within UK bounds", () => {
    for (const o of UK_OUTCODES) {
      expect(o.lat).toBeGreaterThan(49);
      expect(o.lat).toBeLessThan(61);
      expect(o.lng).toBeGreaterThan(-9);
      expect(o.lng).toBeLessThan(2);
    }
  });

  it("has unique outcodes (no duplicates)", () => {
    const set = new Set(UK_OUTCODES.map((o) => o.outcode));
    expect(set.size).toBe(UK_OUTCODES.length);
  });

  it("uppercased lookup index resolves every outcode", () => {
    for (const o of UK_OUTCODES) {
      expect(UK_OUTCODES_BY_CODE.get(o.outcode.toUpperCase())).toBeDefined();
    }
  });
});
