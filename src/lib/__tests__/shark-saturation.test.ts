/**
 * Shark-Saturation Filter — unit tests.
 *
 * Pins the demotion contract that protects the budget from
 * shark-dominated keywords. Tests cover both flag-source forms
 * (Set<string> + Map<string, SharkVerdict>), threshold tuning,
 * and the partition / annotate / filter wrappers.
 */

import {
  analyseSharkSaturation,
  annotateSharkSaturation,
  partitionBySharkSaturation,
  filterOutSharkSaturated,
  SHARK_SATURATION_DEFAULTS,
} from "@/lib/shark-saturation";
import type { IntelKeyword } from "@/lib/competitor-cross-validate";
import type { SharkVerdict } from "@/lib/shark-domains";

// ── Helpers for building fixtures ────────────────────────────────────────────

function kw(overrides: Partial<IntelKeyword>): IntelKeyword {
  return {
    keyword:              "emergency locksmith rg1",
    cpcGbp:               2.5,
    monthlyClicks:        100,
    competitionIndex:     60,
    avgPosition:          2,
    serpConfirmed:        true,
    fingerprintConfirmed: true,
    dualConfirmed:        true,
    geoCount:             1,
    geos:                 ["reading"],
    competitorCount:      0,
    adCopyVariants:       2,
    isEntering:           true,
    isExiting:            false,
    serpDomains:          [],
    fingerprintDomains:   [],
    ...overrides,
  };
}

function flagVerdict(shouldFlag = true): SharkVerdict {
  return {
    confidence:      shouldFlag ? 0.85 : 0.2,
    shouldFlag,
    matchedPatterns: shouldFlag ? ["no_mla", "national_call_centre"] : [],
    reason:          shouldFlag ? "test shark" : "test clean",
  };
}

// ── Single-keyword verdict ───────────────────────────────────────────────────

describe("analyseSharkSaturation — verdict shape", () => {
  it("returns saturated=true when both gates trip (count + ratio)", () => {
    const v = analyseSharkSaturation(
      ["shark-a.co.uk", "shark-b.co.uk", "independent.co.uk"],
      new Set(["shark-a.co.uk", "shark-b.co.uk"]),
    );
    expect(v.saturated).toBe(true);
    expect(v.flaggedCount).toBe(2);
    expect(v.totalDomains).toBe(3);
    expect(v.ratio).toBeCloseTo(2 / 3);
    expect(v.reason).toMatch(/saturated/);
  });

  it("returns saturated=false when only one shark is present", () => {
    const v = analyseSharkSaturation(
      ["shark-a.co.uk", "independent-a.co.uk", "independent-b.co.uk"],
      new Set(["shark-a.co.uk"]),
    );
    expect(v.saturated).toBe(false);
    expect(v.flaggedCount).toBe(1);
    expect(v.reason).toMatch(/below count gate/);
  });

  it("returns saturated=false when count gate trips but ratio gate doesn't", () => {
    // 2 sharks in a 10-domain SERP — count OK, ratio only 20%
    const domains = [
      "shark-a.co.uk", "shark-b.co.uk",
      ...Array.from({ length: 8 }, (_, i) => `clean-${i}.co.uk`),
    ];
    const v = analyseSharkSaturation(domains, new Set(["shark-a.co.uk", "shark-b.co.uk"]));
    expect(v.saturated).toBe(false);
    expect(v.flaggedCount).toBe(2);
    expect(v.ratio).toBeCloseTo(0.2);
    expect(v.reason).toMatch(/below ratio gate/);
  });

  it("returns saturated=false with no shark flags at all", () => {
    const v = analyseSharkSaturation(
      ["a.co.uk", "b.co.uk"],
      new Set(),
    );
    expect(v.saturated).toBe(false);
    expect(v.flaggedCount).toBe(0);
    expect(v.reason).toMatch(/no shark/i);
  });

  it("returns zeros when SERP has no domains", () => {
    const v = analyseSharkSaturation([], new Set(["shark.co.uk"]));
    expect(v.saturated).toBe(false);
    expect(v.totalDomains).toBe(0);
    expect(v.ratio).toBe(0);
    expect(v.reason).toMatch(/no SERP domains/);
  });

  it("dedupes the same domain repeated across geos", () => {
    const v = analyseSharkSaturation(
      ["shark-a.co.uk", "shark-a.co.uk", "shark-b.co.uk", "shark-b.co.uk"],
      new Set(["shark-a.co.uk", "shark-b.co.uk"]),
    );
    expect(v.totalDomains).toBe(2);     // not 4
    expect(v.flaggedCount).toBe(2);
    expect(v.ratio).toBe(1);
    expect(v.saturated).toBe(true);
  });
});

// ── Flag-source forms ────────────────────────────────────────────────────────

describe("analyseSharkSaturation — flag source forms", () => {
  it("accepts a Set<string> of flagged domain names", () => {
    const v = analyseSharkSaturation(
      ["a.co.uk", "b.co.uk", "c.co.uk"],
      new Set(["a.co.uk", "b.co.uk"]),
    );
    expect(v.saturated).toBe(true);
  });

  it("accepts a Map<string, SharkVerdict> and only counts shouldFlag=true", () => {
    const verdicts = new Map<string, SharkVerdict>([
      ["a.co.uk", flagVerdict(true)],
      ["b.co.uk", flagVerdict(true)],
      ["c.co.uk", flagVerdict(false)],   // present but NOT flagged
    ]);
    const v = analyseSharkSaturation(
      ["a.co.uk", "b.co.uk", "c.co.uk", "d.co.uk"],
      verdicts,
    );
    expect(v.flaggedCount).toBe(2);
    expect(v.totalDomains).toBe(4);
    expect(v.ratio).toBeCloseTo(0.5);
    expect(v.saturated).toBe(true);
  });

  it("treats a domain absent from the verdict map as not flagged", () => {
    const verdicts = new Map<string, SharkVerdict>([
      ["shark.co.uk", flagVerdict(true)],
    ]);
    const v = analyseSharkSaturation(
      ["shark.co.uk", "unknown.co.uk", "another.co.uk"],
      verdicts,
    );
    expect(v.flaggedCount).toBe(1);
    expect(v.saturated).toBe(false);
  });
});

// ── Threshold tuning ─────────────────────────────────────────────────────────

describe("analyseSharkSaturation — threshold overrides", () => {
  it("exposes the defaults", () => {
    expect(SHARK_SATURATION_DEFAULTS.minFlaggedCount).toBeGreaterThanOrEqual(1);
    expect(SHARK_SATURATION_DEFAULTS.minSaturationRatio).toBeGreaterThan(0);
    expect(SHARK_SATURATION_DEFAULTS.minSaturationRatio).toBeLessThanOrEqual(1);
  });

  it("respects a stricter count gate", () => {
    const v = analyseSharkSaturation(
      ["a.co.uk", "b.co.uk"],
      new Set(["a.co.uk", "b.co.uk"]),
      { minFlaggedCount: 3 },
    );
    expect(v.saturated).toBe(false);
    expect(v.reason).toMatch(/below count gate \(3\)/);
  });

  it("respects a looser ratio gate", () => {
    // 1 shark out of 4 — default ratio 0.5 fails; ratio 0.2 passes if count
    // gate also lowered
    const v = analyseSharkSaturation(
      ["shark.co.uk", "a.co.uk", "b.co.uk", "c.co.uk"],
      new Set(["shark.co.uk"]),
      { minFlaggedCount: 1, minSaturationRatio: 0.2 },
    );
    expect(v.saturated).toBe(true);
  });
});

// ── annotateSharkSaturation / partition / filter wrappers ────────────────────

describe("annotateSharkSaturation", () => {
  it("attaches a sharkSaturation verdict to every keyword", () => {
    const annotated = annotateSharkSaturation(
      [
        kw({ keyword: "k1", serpDomains: ["shark.co.uk", "shark2.co.uk"] }),
        kw({ keyword: "k2", serpDomains: ["clean.co.uk"] }),
      ],
      new Set(["shark.co.uk", "shark2.co.uk"]),
    );
    expect(annotated[0].sharkSaturation.saturated).toBe(true);
    expect(annotated[1].sharkSaturation.saturated).toBe(false);
    // Original fields preserved
    expect(annotated[0].keyword).toBe("k1");
    expect(annotated[1].keyword).toBe("k2");
  });

  it("does not mutate the input keywords", () => {
    const input = kw({ serpDomains: ["x.co.uk"] });
    const before = { ...input };
    annotateSharkSaturation([input], new Set(["x.co.uk"]));
    expect(input).toEqual(before);
  });
});

describe("partitionBySharkSaturation", () => {
  it("splits keywords into clean + saturated buckets", () => {
    const flagged = new Set(["shark-a.co.uk", "shark-b.co.uk"]);
    const result = partitionBySharkSaturation(
      [
        kw({ keyword: "saturated-1", serpDomains: ["shark-a.co.uk", "shark-b.co.uk"] }),
        kw({ keyword: "clean-1",     serpDomains: ["clean-a.co.uk", "clean-b.co.uk"] }),
        kw({ keyword: "borderline",  serpDomains: ["shark-a.co.uk", "clean.co.uk", "clean2.co.uk"] }),
      ],
      flagged,
    );
    expect(result.saturated.map((k) => k.keyword)).toEqual(["saturated-1"]);
    expect(result.clean.map((k) => k.keyword)).toEqual(
      expect.arrayContaining(["clean-1", "borderline"]),
    );
  });

  it("returns empty arrays for empty input", () => {
    const r = partitionBySharkSaturation([], new Set());
    expect(r.clean).toEqual([]);
    expect(r.saturated).toEqual([]);
  });
});

describe("filterOutSharkSaturated", () => {
  it("returns only the clean keywords", () => {
    const result = filterOutSharkSaturated(
      [
        kw({ keyword: "k1", serpDomains: ["shark-a.co.uk", "shark-b.co.uk"] }),
        kw({ keyword: "k2", serpDomains: ["independent.co.uk"] }),
      ],
      new Set(["shark-a.co.uk", "shark-b.co.uk"]),
    );
    expect(result.map((k) => k.keyword)).toEqual(["k2"]);
  });

  it("returns all keywords when none are saturated", () => {
    const result = filterOutSharkSaturated(
      [
        kw({ keyword: "k1", serpDomains: ["a.co.uk"] }),
        kw({ keyword: "k2", serpDomains: ["b.co.uk"] }),
      ],
      new Set(),
    );
    expect(result).toHaveLength(2);
  });
});

// ── Realistic end-to-end shape ───────────────────────────────────────────────

describe("Realistic SERP scenarios", () => {
  it("demotes a shark-dominated emergency keyword", () => {
    const keyword = kw({
      keyword:     "emergency locksmith london",
      serpDomains: [
        "callcentre-locks.co.uk",   // shark
        "national-247.co.uk",        // shark
        "uk-locksmiths-247.co.uk",   // shark
        "honest-locks-london.co.uk", // clean
      ],
    });
    const flagged = new Set([
      "callcentre-locks.co.uk",
      "national-247.co.uk",
      "uk-locksmiths-247.co.uk",
    ]);
    const verdict = analyseSharkSaturation(keyword.serpDomains, flagged);
    expect(verdict.saturated).toBe(true);
    expect(verdict.ratio).toBeCloseTo(0.75);
  });

  it("does NOT demote a trust-led keyword where independents dominate", () => {
    const keyword = kw({
      keyword:     "mla locksmith leeds",
      serpDomains: [
        "leeds-locks-mla.co.uk",      // clean
        "honest-locks-yorkshire.co.uk", // clean
        "callcentre-locks.co.uk",      // shark
      ],
    });
    const flagged = new Set(["callcentre-locks.co.uk"]);
    const verdict = analyseSharkSaturation(keyword.serpDomains, flagged);
    expect(verdict.saturated).toBe(false);
    expect(verdict.flaggedCount).toBe(1);
  });
});
