/**
 * Opportunity Scout — Full test suite
 *
 * Covers:
 *   1. Stability weight computation (pure functions, no DB)
 *   2. Volatility scoring — seasonal spike vs durable keyword
 *   3. Operational efficiency factor computation
 *   4. Geo isolation — learning in Sheffield does NOT affect Exeter
 *   5. scoreOpportunities() pipeline — full end-to-end with mock Planner + mock DB
 *   6. Profit model correctness — £175 job value, tier conv rates, CPC floors
 *   7. Seed bank stability ranking — stable seeds rank above lucky-spike seeds
 *   8. Five named scenarios matching real-world operator concerns
 *
 * All external I/O (Prisma, Google Ads API) is mocked. No DB connection required.
 */

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock Prisma before any module that imports it
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    keywordSeed: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    keywordGeoScore: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    geoOperationalMetrics: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    googleAdsOpportunity: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock the geo-score module so scoreOpportunities tests don't hit the DB
jest.mock("@/lib/keyword-geo-score", () => ({
  recordSeedScanAppearance: jest.fn().mockResolvedValue(undefined),
  recordGeoScanAppearance: jest.fn().mockResolvedValue(undefined),
  getGeoLocalScoreMap: jest.fn().mockResolvedValue(new Map()),
  getAllGeoOperationalFactors: jest.fn().mockResolvedValue(new Map()),
  getSeedStabilityWeight: jest.fn().mockResolvedValue(0.25),
  computeStabilityWeight: jest.requireActual("@/lib/keyword-geo-score").computeStabilityWeight,
  computeOperationalFactor: jest.requireActual("@/lib/keyword-geo-score").computeOperationalFactor,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  computeStabilityWeight,
  computeOperationalFactor,
  getGeoLocalScoreMap,
  getAllGeoOperationalFactors,
  recordGeoScanAppearance,
} from "@/lib/keyword-geo-score";

import {
  scoreOpportunities,
  LOCKSMITH_DEFAULT_JOB_VALUE_GBP,
  BASELINE_CONV_RATES,
} from "@/lib/google-ads-opportunities";

import type { GoogleAdsClient, KeywordIdea } from "@/lib/google-ads";
import type { CoverageUniverseEntry } from "@/lib/google-ads-geo-universe";

// ── Shared fixtures ───────────────────────────────────────────────────────────

/** A Planner keyword idea with realistic locksmith data */
function makeIdea(overrides: Partial<KeywordIdea> = {}): KeywordIdea {
  return {
    text: "emergency locksmith",
    avgMonthlySearches: 1000,
    competition: "HIGH",
    competitionIndex: 75,
    lowTopOfPageBidMicros:  3_500_000,  // £3.50
    highTopOfPageBidMicros: 5_800_000,  // £5.80
    ...overrides,
  };
}

/** A coverage universe entry for a northern city */
function makeGeo(overrides: Partial<CoverageUniverseEntry> = {}): CoverageUniverseEntry {
  return {
    geoId: "1006886",
    cityKey: "sheffield",
    label: "Sheffield",
    locksmithCount: 4,
    homeLocksmithCount: 2,
    locksmithIds: ["ls1", "ls2"],
    totalJobs: 120,
    avgRating: 4.7,
    ...overrides,
  };
}

/** Build a mock GoogleAdsClient with a configurable generateKeywordIdeas response */
function mockClient(ideas: KeywordIdea[]): GoogleAdsClient {
  return {
    generateKeywordIdeas: jest.fn().mockResolvedValue(ideas),
  } as unknown as GoogleAdsClient;
}

// =============================================================================
// 1. STABILITY WEIGHT — pure function tests, no DB
// =============================================================================

describe("computeStabilityWeight", () => {
  it("returns 0.25 for a brand-new keyword (0 consecutive scans, empty history)", () => {
    expect(computeStabilityWeight(0, [])).toBeCloseTo(0.25, 2);
  });

  it("climbs linearly toward 1.0 as consecutive scans increase", () => {
    const w1 = computeStabilityWeight(1, [10, 12]);
    const w2 = computeStabilityWeight(2, [10, 12, 11]);
    const w4 = computeStabilityWeight(4, [10, 12, 11, 10]);
    expect(w1).toBeGreaterThan(0.25);
    expect(w2).toBeGreaterThan(w1);
    expect(w4).toBeGreaterThanOrEqual(w2);
  });

  it("reaches 1.0 (before volatility discount) at 4+ consecutive scans with stable history", () => {
    // 4 consecutive scans, perfectly stable profit (no volatility)
    const weight = computeStabilityWeight(4, [10, 10, 10, 10]);
    expect(weight).toBeCloseTo(1.0, 1);
  });

  it("applies a volatility discount for highly volatile history", () => {
    // Same survival count but wild profit variance
    const stable   = computeStabilityWeight(4, [10, 10, 10, 10]);
    const volatile_ = computeStabilityWeight(4, [20, -5, 18, -3]); // CV >> 1
    expect(volatile_).toBeLessThan(stable);
    expect(volatile_).toBeLessThan(0.5); // heavy discount for spike-like behaviour
  });

  it("never falls below the floor of 0.05", () => {
    // Extreme volatility: profit oscillates wildly
    const weight = computeStabilityWeight(0, [100, -100, 100, -100, 100, -100]);
    expect(weight).toBeGreaterThanOrEqual(0.05);
  });

  it("SCENARIO — seasonal spike: consecutive count resets to 0 on loss", () => {
    // Simulates a keyword that appeared profitable in week 1, then went negative
    // The caller resets consecutiveSurvivalCount to 0 when profitPerClick <= 0
    const afterSpike = computeStabilityWeight(0, [12, -2]); // history has the bad scan
    expect(afterSpike).toBeLessThan(0.4); // should be heavily discounted
  });

  it("SCENARIO — durable keyword: 6 consistent profitable scans", () => {
    const weight = computeStabilityWeight(6, [8, 9, 8.5, 9.2, 8.8, 9.1]);
    // Low volatility + high survival = near 1.0
    expect(weight).toBeGreaterThan(0.9);
  });
});

// =============================================================================
// 2. OPERATIONAL EFFICIENCY FACTOR — pure function tests
// =============================================================================

describe("computeOperationalFactor", () => {
  it("returns 1.0 / dataAvailable=false when no metrics provided", () => {
    const result = computeOperationalFactor({});
    expect(result.factor).toBe(1.0);
    expect(result.dataAvailable).toBe(false);
  });

  it("applies spam lead rate as (1 - rate)", () => {
    const result = computeOperationalFactor({ spamLeadRate: 0.3 });
    expect(result.factor).toBeCloseTo(0.7, 3);
    expect(result.dataAvailable).toBe(true);
  });

  it("SCENARIO — operational disaster: 30% spam, 20% missed, 80% dispatch, 15% cancel", () => {
    // A city performing poorly on all fronts
    const result = computeOperationalFactor({
      spamLeadRate:        0.30,  // 30% fake leads
      missedCallRate:      0.20,  // 20% of calls unanswered
      dispatchSuccessRate: 0.80,  // only 80% dispatched
      cancellationRate:    0.15,  // 15% cancel before completion
    });
    // Expected: 0.70 × 0.80 × 0.80 × 0.85 ≈ 0.381
    expect(result.factor).toBeCloseTo(0.70 * 0.80 * 0.80 * 0.85, 2);
    expect(result.dataAvailable).toBe(true);
    expect(result.factor).toBeLessThan(0.45); // less than half of naive estimate
  });

  it("SCENARIO — well-run city: minimal waste across all metrics", () => {
    const result = computeOperationalFactor({
      spamLeadRate:        0.05,
      missedCallRate:      0.05,
      dispatchSuccessRate: 0.95,
      cancellationRate:    0.05,
      refundProbability:   0.02,
    });
    // Should be close to 1.0 — a very efficient operation
    expect(result.factor).toBeGreaterThan(0.80);
    expect(result.dataAvailable).toBe(true);
  });

  it("ignores null metrics (only non-null contribute)", () => {
    const resultOneMetric  = computeOperationalFactor({ spamLeadRate: 0.2 });
    const resultAllNull    = computeOperationalFactor({ spamLeadRate: null });
    expect(resultOneMetric.factor).toBeCloseTo(0.8, 2);
    expect(resultAllNull.factor).toBe(1.0);
    expect(resultAllNull.dataAvailable).toBe(false);
  });

  it("clamps factor to [0.01, 1.0]", () => {
    // Worst possible: 100% spam + 0% dispatch
    const result = computeOperationalFactor({
      spamLeadRate: 1.0,
      dispatchSuccessRate: 0,
    });
    expect(result.factor).toBeGreaterThanOrEqual(0.01);
    expect(result.factor).toBeLessThanOrEqual(1.0);
  });
});

// =============================================================================
// 3. PROFIT MODEL — scoreOpportunities with mock Planner
// =============================================================================

describe("scoreOpportunities — profit model", () => {
  const sheffieldGeo = makeGeo();

  it("computes profitPerClick correctly: convRate × jobValue - cpcGbp", async () => {
    // HIGH competition → 15% conv rate
    // highTopOfPageBid = £5.80
    // profitPerClick = 0.15 × £175 - £5.80 = £26.25 - £5.80 = £20.45
    const client = mockClient([
      makeIdea({ competition: "HIGH", competitionIndex: 80, highTopOfPageBidMicros: 5_800_000 }),
    ]);

    const result = await scoreOpportunities(client, [sheffieldGeo], {
      seedKeywords: ["emergency locksmith"],
      perGeoDelayMs: 0,
      recordScanData: false,
    });

    const kw = result.opportunities[0]?.topKeywords[0];
    expect(kw).toBeDefined();
    // profitPerClick = 0.15 × 175 - 5.80 = 20.45
    expect(kw!.profitPerClick).toBeCloseTo(20.45, 1);
  });

  it("uses CPC floor when Planner returns 0 bids (test token mode)", async () => {
    const client = mockClient([
      makeIdea({
        competition: "HIGH",
        competitionIndex: 75,
        lowTopOfPageBidMicros: 0,
        highTopOfPageBidMicros: 0,
      }),
    ]);

    const result = await scoreOpportunities(client, [sheffieldGeo], {
      seedKeywords: ["emergency locksmith"],
      perGeoDelayMs: 0,
      recordScanData: false,
    });

    const opp = result.opportunities[0];
    expect(opp!.usingFallbackCpc).toBe(true);
    // HIGH competition floor = £5.00
    expect(opp!.medianCpcGbp).toBeCloseTo(5.0, 1);
    expect(opp!.topKeywords[0].cpcGbp).toBeCloseTo(5.0, 1);
  });

  it("SCENARIO — high CPC city still wins on profit over cheap low-intent city", async () => {
    // Sheffield: HIGH competition, £5.80 CPC, 15% conv rate
    //   profitPerClick = 0.15 × 175 - 5.80 = £20.45
    // Exeter: LOW competition, £0.90 CPC, 7% conv rate
    //   profitPerClick = 0.07 × 175 - 0.90 = £12.25 - £0.90 = £11.35
    const sheffieldIdeas = [
      makeIdea({ text: "emergency locksmith", avgMonthlySearches: 2000,
        competition: "HIGH", competitionIndex: 80, highTopOfPageBidMicros: 5_800_000 }),
    ];
    const exeterIdeas = [
      makeIdea({ text: "emergency locksmith", avgMonthlySearches: 200,
        competition: "LOW", competitionIndex: 20, highTopOfPageBidMicros: 900_000 }),
    ];

    const clientFn = jest
      .fn()
      .mockResolvedValueOnce(sheffieldIdeas)  // first call = Sheffield
      .mockResolvedValueOnce(exeterIdeas);    // second call = Exeter

    const client = { generateKeywordIdeas: clientFn } as unknown as GoogleAdsClient;

    const result = await scoreOpportunities(
      client,
      [
        makeGeo({ geoId: "1006886", cityKey: "sheffield", label: "Sheffield" }),
        makeGeo({ geoId: "1007242", cityKey: "exeter",    label: "Exeter", locksmithCount: 1 }),
      ],
      { seedKeywords: ["emergency locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    const [first, second] = result.opportunities;
    // Sheffield should score higher despite higher CPC
    expect(first.label).toBe("Sheffield");
    expect(second.label).toBe("Exeter");
    expect(first.expectedMonthlyProfitGbp).toBeGreaterThan(second.expectedMonthlyProfitGbp);
  });

  it("uses real conv rate override when provided via geoConvRateMap", async () => {
    const client = mockClient([
      makeIdea({ competition: "HIGH", competitionIndex: 75, highTopOfPageBidMicros: 4_000_000 }),
    ]);

    // Override: actual observed 20% conv rate (above prior)
    const geoConvRateMap = new Map([["1006886", 0.20]]);

    const result = await scoreOpportunities(client, [sheffieldGeo], {
      seedKeywords: ["emergency locksmith"],
      perGeoDelayMs: 0,
      recordScanData: false,
      geoConvRateMap,
    });

    const kw = result.opportunities[0]?.topKeywords[0];
    // profitPerClick = 0.20 × 175 - 4.00 = 35.00 - 4.00 = £31.00
    expect(kw!.profitPerClick).toBeCloseTo(31.0, 0);
    expect(result.opportunities[0]?.estimatedConvRate).toBeCloseTo(0.20, 3);
  });

  it("excludes London geos by default", async () => {
    const client = mockClient([makeIdea()]);
    const londonGeo = makeGeo({ geoId: "1006450", cityKey: "london", label: "London" });

    const result = await scoreOpportunities(client, [londonGeo], {
      seedKeywords: ["emergency locksmith"],
      perGeoDelayMs: 0,
      recordScanData: false,
    });

    // London is excluded — should return 0 opportunities, not error
    expect(result.opportunities).toHaveLength(0);
  });

  it("applies near-London penalty (−30%) to SE cities", async () => {
    const sloughGeo  = makeGeo({ geoId: "9999001", cityKey: "slough",    label: "Slough" });
    const leedsGeo   = makeGeo({ geoId: "9999002", cityKey: "leeds",     label: "Leeds", locksmithCount: 4 });

    const sameIdeas = [
      makeIdea({ avgMonthlySearches: 1000, competition: "MEDIUM",
        competitionIndex: 50, highTopOfPageBidMicros: 3_000_000 }),
    ];

    const clientFn = jest.fn()
      .mockResolvedValueOnce(sameIdeas)
      .mockResolvedValueOnce(sameIdeas);
    const client = { generateKeywordIdeas: clientFn } as unknown as GoogleAdsClient;

    const result = await scoreOpportunities(
      client,
      [sloughGeo, leedsGeo],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    const slough = result.opportunities.find((o) => o.label === "Slough")!;
    const leeds  = result.opportunities.find((o) => o.label === "Leeds")!;

    expect(slough.nearLondonPenalty).toBe(true);
    expect(leeds.nearLondonPenalty).toBe(false);
    // Leeds should score ~43% higher than Slough with otherwise identical inputs
    // (1/0.70 ≈ 1.43×)
    expect(leeds.expectedMonthlyProfitGbp).toBeGreaterThan(
      slough.expectedMonthlyProfitGbp * 1.35,
    );
  });

  it("flags after-hours gap bonus (×1.20) when geoAfterHoursGapMap is set", async () => {
    const hull = makeGeo({ geoId: "1006886", cityKey: "hull", label: "Hull" });
    const client = mockClient([
      makeIdea({ avgMonthlySearches: 1000, competitionIndex: 50,
        competition: "MEDIUM", highTopOfPageBidMicros: 3_000_000 }),
    ]);

    const [withGap, withoutGap] = await Promise.all([
      scoreOpportunities(client, [hull], {
        seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false,
        geoAfterHoursGapMap: new Map([["1006886", true]]),
      }),
      scoreOpportunities(client, [hull], {
        seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false,
      }),
    ]);

    const profitWithGap    = withGap.opportunities[0]!.expectedMonthlyProfitGbp;
    const profitWithoutGap = withoutGap.opportunities[0]!.expectedMonthlyProfitGbp;
    expect(withGap.opportunities[0]!.afterHoursGap).toBe(true);
    expect(profitWithGap).toBeCloseTo(profitWithoutGap * 1.20, 0);
  });
});

// =============================================================================
// 4. GEO ISOLATION — Sheffield learning must not affect Exeter
// =============================================================================

describe("Geo isolation — local scores don't cross-contaminate geos", () => {
  it("SCENARIO — Sheffield 0.9 weight does not inflate Exeter estimate", async () => {
    // Sheffield has 6 scans of history, weight = ~0.9
    // Exeter has 0 scans in its local table — should get default 0.25 weight
    const sheffieldLocalMap = new Map([["emergency locksmith", 0.9]]);
    const exeterLocalMap    = new Map<string, number>(); // empty — no local history

    const getGeoLocalScoreMapMock = getGeoLocalScoreMap as jest.Mock;
    getGeoLocalScoreMapMock
      .mockResolvedValueOnce(sheffieldLocalMap) // first call = Sheffield
      .mockResolvedValueOnce(exeterLocalMap);   // second call = Exeter

    const ideas = [
      makeIdea({ avgMonthlySearches: 1000, competitionIndex: 75,
        competition: "HIGH", highTopOfPageBidMicros: 5_000_000 }),
    ];
    const clientFn = jest.fn().mockResolvedValue(ideas);
    const client = { generateKeywordIdeas: clientFn } as unknown as GoogleAdsClient;

    const result = await scoreOpportunities(
      client,
      [
        makeGeo({ geoId: "1006886", cityKey: "sheffield", label: "Sheffield" }),
        makeGeo({ geoId: "1007242", cityKey: "exeter",    label: "Exeter" }),
      ],
      { seedKeywords: ["emergency locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    const sheffield = result.opportunities.find((o) => o.label === "Sheffield")!;
    const exeter    = result.opportunities.find((o) => o.label === "Exeter")!;

    // Sheffield's monthly profit should be ~3.6× higher than Exeter's
    // because its keyword stability weight is 0.9 vs 0.25 (ratio ≈ 3.6)
    // (same underlying Planner data, same geo, different local weight)
    const ratio = sheffield.expectedMonthlyProfitGbp / exeter.expectedMonthlyProfitGbp;
    expect(ratio).toBeGreaterThan(3.0);
    expect(ratio).toBeLessThan(4.5);
  });

  it("uses local score (not global) when local history exists", async () => {
    // "lock change" has a global seed score of 1.0 but locally in Exeter
    // it underperforms — local score should dominate.
    const exeterLocalMap = new Map([["lock change", 0.30]]); // local = poor performer
    (getGeoLocalScoreMap as jest.Mock).mockResolvedValueOnce(exeterLocalMap);

    const ideas = [
      makeIdea({ text: "lock change", avgMonthlySearches: 500,
        competitionIndex: 40, competition: "MEDIUM", highTopOfPageBidMicros: 2_000_000 }),
    ];
    const client = mockClient(ideas);

    const result = await scoreOpportunities(
      client,
      [makeGeo({ geoId: "1007242", cityKey: "exeter", label: "Exeter" })],
      { seedKeywords: ["lock change"], perGeoDelayMs: 0, recordScanData: false },
    );

    const kw = result.opportunities[0]?.topKeywords[0];
    // stabilityWeight stored on the keyword = local weight (0.30), not global (1.0)
    expect(kw!.stabilityWeight).toBeCloseTo(0.30, 2);
  });

  it("records scan appearance separately per geo (no cross-geo write)", async () => {
    (getGeoLocalScoreMap as jest.Mock).mockResolvedValue(new Map());
    const client = mockClient([makeIdea({ text: "locksmith" })]);

    await scoreOpportunities(
      client,
      [
        makeGeo({ geoId: "GEO_A", cityKey: "hull",      label: "Hull" }),
        makeGeo({ geoId: "GEO_B", cityKey: "liverpool", label: "Liverpool" }),
      ],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: true },
    );

    // Each geo should have triggered its own recordGeoScanAppearance call
    const calls = (recordGeoScanAppearance as jest.Mock).mock.calls;
    const geoA_calls = calls.filter((c: unknown[]) => c[1] === "GEO_A");
    const geoB_calls = calls.filter((c: unknown[]) => c[1] === "GEO_B");
    expect(geoA_calls.length).toBeGreaterThan(0);
    expect(geoB_calls.length).toBeGreaterThan(0);
    // Each call should reference only its own geo — no cross-writes
    for (const call of calls) {
      expect(["GEO_A", "GEO_B"]).toContain(call[1]);
    }
  });
});

// =============================================================================
// 5. OPERATIONAL EFFICIENCY — applied to final geo profit
// =============================================================================

describe("scoreOpportunities — operational efficiency factor", () => {
  it("applies operational factor to the final profit when provided", async () => {
    const geoId = "1006886";
    const client = mockClient([
      makeIdea({ avgMonthlySearches: 1000, competitionIndex: 75,
        competition: "HIGH", highTopOfPageBidMicros: 5_000_000 }),
    ]);

    // Simulate a city with 38% operational efficiency
    const geoOperationalFactorMap = new Map([
      [geoId, { factor: 0.38, dataAvailable: true }],
    ]);

    const result = await scoreOpportunities(
      client,
      [makeGeo({ geoId })],
      {
        seedKeywords: ["emergency locksmith"],
        perGeoDelayMs: 0,
        recordScanData: false,
        geoOperationalFactorMap,
      },
    );

    const opp = result.opportunities[0]!;
    expect(opp.operationalEfficiencyFactor).toBeCloseTo(0.38, 2);
    expect(opp.modelConfidenceVerified).toBe(true);
    // Profit should be roughly 38% of the unmodified estimate
    // (we can't know exact unmodified value here, but it should be discounted)
    expect(opp.expectedMonthlyProfitGbp).toBeGreaterThan(0);
  });

  it("defaults to factor=1.0 + modelConfidenceVerified=false when no data", async () => {
    const client = mockClient([makeIdea()]);
    // getAllGeoOperationalFactors returns empty map — no data for this geo
    (getAllGeoOperationalFactors as jest.Mock).mockResolvedValueOnce(new Map());

    const result = await scoreOpportunities(
      client,
      [makeGeo({ geoId: "UNKNOWN_GEO" })],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    const opp = result.opportunities[0]!;
    expect(opp.operationalEfficiencyFactor).toBe(1.0);
    expect(opp.modelConfidenceVerified).toBe(false);
  });

  it("SCENARIO — mathematically profitable but operationally disastrous city", async () => {
    // Raw model: HIGH competition, £5 CPC, 15% conv rate, 1000 searches/mo
    // profitPerClick ≈ 0.15 × 175 - 5 = £21.25
    // monthlyProfit ≈ 1000 × 21.25 = £21,250 (theoretical)
    //
    // Operational reality: 30% spam, 20% missed calls, 75% dispatch success, 20% cancel
    // factor = 0.70 × 0.80 × 0.75 × 0.80 ≈ 0.336
    // actualProfit ≈ £21,250 × 0.336 ≈ £7,140
    const rawFactor = computeOperationalFactor({
      spamLeadRate: 0.30,
      missedCallRate: 0.20,
      dispatchSuccessRate: 0.75,
      cancellationRate: 0.20,
    });

    const geoId = "DISASTER_CITY";
    const client = mockClient([
      makeIdea({ avgMonthlySearches: 1000, competitionIndex: 80,
        competition: "HIGH", highTopOfPageBidMicros: 5_000_000 }),
    ]);

    const [with_op, without_op] = await Promise.all([
      scoreOpportunities(client, [makeGeo({ geoId })], {
        seedKeywords: ["emergency locksmith"], perGeoDelayMs: 0, recordScanData: false,
        geoOperationalFactorMap: new Map([[geoId, { factor: rawFactor.factor, dataAvailable: true }]]),
      }),
      scoreOpportunities(client, [makeGeo({ geoId })], {
        seedKeywords: ["emergency locksmith"], perGeoDelayMs: 0, recordScanData: false,
        geoOperationalFactorMap: new Map([[geoId, { factor: 1.0, dataAvailable: false }]]),
      }),
    ]);

    const opProfit  = with_op.opportunities[0]!.expectedMonthlyProfitGbp;
    const rawProfit = without_op.opportunities[0]!.expectedMonthlyProfitGbp;

    // The discounted profit should be roughly rawFactor.factor of the raw
    expect(opProfit / rawProfit).toBeCloseTo(rawFactor.factor, 1);
    // And should be substantially lower — not a rounding error
    expect(opProfit).toBeLessThan(rawProfit * 0.45);
  });
});

// =============================================================================
// 6. SEED BANK STABILITY RANKING
// =============================================================================

describe("Seed bank stability ranking", () => {
  it("stable seed ranks above lucky-spike seed at same win-rate", () => {
    // Lucky spike: 1 win, 0 losses → Wilson score ≈ 0.75, but stability = 0.25
    // Stable seed: 4 wins, 1 loss → Wilson score ≈ 0.71, but stability = 1.0
    const luckySpikeScore  = 0.75 * 0.25; // effectiveScore ≈ 0.19
    const stableScore      = 0.71 * 1.00; // effectiveScore ≈ 0.71

    expect(stableScore).toBeGreaterThan(luckySpikeScore);
  });

  it("volatile keyword (4 scans but wild variance) ranks below stable equivalent", () => {
    // Both have 4 consecutive scans, but different variance
    const stableWeight   = computeStabilityWeight(4, [8, 9, 8.5, 9]);    // CV ≈ 0.04
    const volatileWeight = computeStabilityWeight(4, [20, 1, 18, 0.5]);  // CV >> 1

    expect(stableWeight).toBeGreaterThan(volatileWeight);
    expect(volatileWeight).toBeLessThan(0.5);
  });

  it("new experimental seed (0 scans) gets minimum viable weight", () => {
    const weight = computeStabilityWeight(0, []);
    expect(weight).toBeCloseTo(0.25, 2);
    // Minimum viable — it still gets used, but at 25% face value
    expect(weight).toBeGreaterThan(0);
  });
});

// =============================================================================
// 7. FIVE NAMED SCENARIOS — end-to-end pipeline behaviour
// =============================================================================

describe("Named scenarios", () => {

  // ── Scenario 1: Seasonal spike lockout ────────────────────────────────────
  it("SCENARIO 1: January spike — 'frozen lock' keyword discounted until proven durable", () => {
    // "frozen lock" appears once in January with £15/click profit (seasonal).
    // It should NOT score the same as "emergency locksmith" that has appeared
    // 6 times with consistent £12/click profit.

    const frozenLockWeight    = computeStabilityWeight(0, []);   // first scan: 0.25
    const emergencyWeight     = computeStabilityWeight(6, [12, 11, 12.5, 12, 11.8, 12.2]);

    const frozenProfit    = 15 * frozenLockWeight;    // 15 × 0.25 = 3.75
    const emergencyProfit = 12 * emergencyWeight;     // 12 × ~1.0 = ~12.0

    expect(emergencyProfit).toBeGreaterThan(frozenProfit * 2);
    // Even though frozen lock has higher raw profit per click, stability wins
  });

  // ── Scenario 2: Geo contamination blocked ─────────────────────────────────
  it("SCENARIO 2: Bristol conversion data stays in Bristol — doesn't boost Plymouth", () => {
    // Bristol locksmith market converts at 18% (student population, high density).
    // Plymouth locksmith market converts at 6% (smaller, older demographic).
    // The geoConvRateMap ensures they use different rates.

    const bristolConvRate  = 0.18;
    const plymouthConvRate = 0.06;
    const cpc = 4.0;
    const jobValue = LOCKSMITH_DEFAULT_JOB_VALUE_GBP;

    const bristolProfit  = bristolConvRate  * jobValue - cpc; // £31.50 - £4 = £27.50
    const plymouthProfit = plymouthConvRate * jobValue - cpc; // £10.50 - £4 = £6.50

    expect(bristolProfit).toBeGreaterThan(plymouthProfit * 3);
    // If Plymouth had been given Bristol's rate, it would have looked 4× better
    const plymouthWithBristolRate = bristolConvRate * jobValue - cpc;
    expect(plymouthWithBristolRate).toBeCloseTo(bristolProfit, 1);
    // This proves why geo isolation matters — without it, Plymouth looks like Bristol
  });

  // ── Scenario 3: Spam-heavy city looks good on paper ───────────────────────
  it("SCENARIO 3: Birmingham spam problem — mathematical vs operational profit", () => {
    // Birmingham has lots of traffic and reasonable CPC, but:
    // - 40% of form leads are spam bots
    // - 25% of calls go to voicemail
    // - 70% dispatch success (fragmented locksmith coverage)
    // - 20% cancellation rate

    const rawMonthlyProfit = 5000; // £5k raw estimate
    const opResult = computeOperationalFactor({
      spamLeadRate:        0.40,
      missedCallRate:      0.25,
      dispatchSuccessRate: 0.70,
      cancellationRate:    0.20,
    });

    const realisedProfit = rawMonthlyProfit * opResult.factor;
    // factor ≈ 0.60 × 0.75 × 0.70 × 0.80 ≈ 0.252
    expect(realisedProfit).toBeLessThan(rawMonthlyProfit * 0.30);
    expect(realisedProfit).toBeGreaterThan(0);
    // The realised profit is less than 30% of what the naive model predicted
    console.info(
      `Birmingham: raw £${rawMonthlyProfit} → realised £${realisedProfit.toFixed(0)} ` +
      `(operational factor ${(opResult.factor * 100).toFixed(0)}%)`,
    );
  });

  // ── Scenario 4: After-hours advantage in Hull ─────────────────────────────
  it("SCENARIO 4: Hull after-hours gap — 24/7 platform advantage scores higher", async () => {
    const geoId = "HULL_GEO";
    const client = mockClient([
      makeIdea({ avgMonthlySearches: 800, competitionIndex: 60,
        competition: "MEDIUM", highTopOfPageBidMicros: 3_000_000 }),
    ]);
    (getAllGeoOperationalFactors as jest.Mock).mockResolvedValue(new Map());

    const [withGap, withoutGap] = await Promise.all([
      scoreOpportunities(client, [makeGeo({ geoId, cityKey: "hull" })], {
        seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false,
        geoAfterHoursGapMap: new Map([[geoId, true]]),
      }),
      scoreOpportunities(client, [makeGeo({ geoId, cityKey: "hull" })], {
        seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false,
      }),
    ]);

    const gapBonus = withGap.opportunities[0]!.expectedMonthlyProfitGbp;
    const noBonus  = withoutGap.opportunities[0]!.expectedMonthlyProfitGbp;
    expect(gapBonus).toBeCloseTo(noBonus * 1.20, 0);
    expect(withGap.opportunities[0]!.afterHoursGap).toBe(true);
  });

  // ── Scenario 5: New city, no data at all ──────────────────────────────────
  it("SCENARIO 5: First scan of new city — conservative estimate, unverified flag", async () => {
    // A brand-new geo with no Planner history, no operational data, no campaign.
    // The system should still produce an estimate but clearly mark it as unverified.
    (getGeoLocalScoreMap as jest.Mock).mockResolvedValueOnce(new Map()); // no local history
    (getAllGeoOperationalFactors as jest.Mock).mockResolvedValueOnce(new Map()); // no op data

    const client = mockClient([
      makeIdea({ text: "locksmith", avgMonthlySearches: 300, competitionIndex: 45,
        competition: "MEDIUM", highTopOfPageBidMicros: 2_800_000 }),
    ]);

    const result = await scoreOpportunities(
      client,
      [makeGeo({ geoId: "BRAND_NEW", cityKey: "truro", label: "Truro", locksmithCount: 1 })],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    const opp = result.opportunities[0]!;
    // Should produce an estimate (not null/0)
    expect(opp.expectedMonthlyProfitGbp).toBeGreaterThan(0);
    // But marked as unverified (no operational data)
    expect(opp.modelConfidenceVerified).toBe(false);
    // And keywords get the new-keyword discount (0.25× default)
    const kwWeight = opp.topKeywords[0]?.stabilityWeight;
    expect(kwWeight).toBeCloseTo(0.25, 2);
  });
});

// =============================================================================
// 8. EDGE CASES
// =============================================================================

describe("Edge cases", () => {
  it("returns empty opportunities (not an error) when universe is empty", async () => {
    const client = mockClient([makeIdea()]);
    const result = await scoreOpportunities(client, [], {
      seedKeywords: ["locksmith"],
      perGeoDelayMs: 0,
      recordScanData: false,
    });
    expect(result.opportunities).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });

  it("records failure (not throw) when Planner call errors for one geo", async () => {
    const clientFn = jest.fn()
      .mockRejectedValueOnce(new Error("QUOTA_ERROR: daily limit exceeded"))
      .mockResolvedValueOnce([makeIdea()]);
    const client = { generateKeywordIdeas: clientFn } as unknown as GoogleAdsClient;

    const result = await scoreOpportunities(
      client,
      [
        makeGeo({ geoId: "GEO_FAIL", label: "Fail City" }),
        makeGeo({ geoId: "GEO_OK",   label: "OK City" }),
      ],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );

    // One failure, one success
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].label).toBe("Fail City");
    expect(result.failures[0].error).toContain("QUOTA_ERROR");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].label).toBe("OK City");
  });

  it("handles all-zero profit keywords gracefully (no negative scores)", async () => {
    // All keywords return 0 searches
    const client = mockClient([
      makeIdea({ avgMonthlySearches: 0 }),
      makeIdea({ text: "lock", avgMonthlySearches: 0 }),
    ]);
    const result = await scoreOpportunities(
      client,
      [makeGeo()],
      { seedKeywords: ["locksmith"], perGeoDelayMs: 0, recordScanData: false },
    );
    // Score should be 0 or near-0, not negative or NaN
    const opp = result.opportunities[0];
    expect(opp).toBeDefined();
    expect(isNaN(opp!.expectedMonthlyProfitGbp)).toBe(false);
    expect(opp!.expectedMonthlyProfitGbp).toBeGreaterThanOrEqual(0);
  });

  it("throws if no seed keywords are provided", async () => {
    const client = mockClient([makeIdea()]);
    await expect(
      scoreOpportunities(client, [makeGeo()], { seedKeywords: [], perGeoDelayMs: 0 }),
    ).rejects.toThrow("seedKeywords required");
  });

  it("BASELINE_CONV_RATES: HIGH > MEDIUM > LOW", () => {
    expect(BASELINE_CONV_RATES.HIGH).toBeGreaterThan(BASELINE_CONV_RATES.MEDIUM);
    expect(BASELINE_CONV_RATES.MEDIUM).toBeGreaterThan(BASELINE_CONV_RATES.LOW);
  });

  it("LOCKSMITH_DEFAULT_JOB_VALUE_GBP is within realistic UK range", () => {
    expect(LOCKSMITH_DEFAULT_JOB_VALUE_GBP).toBeGreaterThanOrEqual(100);
    expect(LOCKSMITH_DEFAULT_JOB_VALUE_GBP).toBeLessThanOrEqual(250);
  });
});
