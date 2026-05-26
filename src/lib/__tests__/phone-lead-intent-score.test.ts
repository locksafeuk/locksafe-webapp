/**
 * Phone-Lead Intent Score — unit tests.
 *
 * Pins down the scoring CONTRACT so ops can audit "why did this keyword
 * rank above that one?" The score is a transparent composite of four
 * components; this suite verifies each component independently AND in
 * combination.
 *
 * If you change a weight in phone-lead-intent-score.ts, expect to update
 * the relevant numeric assertion here deliberately.
 */

import {
  scorePhoneLeadIntent,
  rankByPhoneLeadIntent,
  detectPostcodeDistrict,
  detectCity,
  shrunkWinRate,
  FAMILY_BASELINE,
  INTENT_CLUSTERS,
} from "@/lib/phone-lead-intent-score";

// ── Component: family weight ─────────────────────────────────────────────────

describe("scorePhoneLeadIntent — family weight", () => {
  it("ranks postcode_local highest among the Phase 2a families", () => {
    expect(FAMILY_BASELINE.postcode_local).toBeGreaterThan(FAMILY_BASELINE.trust_signal);
    expect(FAMILY_BASELINE.postcode_local).toBeGreaterThan(FAMILY_BASELINE.service_long_tail);
    expect(FAMILY_BASELINE.postcode_local).toBeGreaterThan(FAMILY_BASELINE.b2b_specialist);
  });

  it("ranks negative as zero (we never want to seed negatives)", () => {
    expect(FAMILY_BASELINE.negative).toBe(0);
  });

  it("falls back to 12 (neutral) when category is unknown", () => {
    const result = scorePhoneLeadIntent({
      keyword:  "some unfamiliar query",
      // intentionally cast to bypass the SeedCategory type guard — we want
      // to verify the runtime fallback for unrecognised categories
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: "alien-category" as any,
    });
    expect(result.components.familyWeight).toBe(12);
  });

  it("applies the postcode_local family weight to a plain district keyword", () => {
    const result = scorePhoneLeadIntent({
      keyword:  "locksmith rg1",
      category: "postcode_local",
    });
    expect(result.components.familyWeight).toBe(30);
  });
});

// ── Component: token intent ──────────────────────────────────────────────────

describe("scorePhoneLeadIntent — token intent boosts", () => {
  it("boosts an emergency keyword", () => {
    const r = scorePhoneLeadIntent({ keyword: "emergency locksmith near me" });
    expect(r.components.tokenIntent).toBeGreaterThanOrEqual(15);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/emergency/)]));
  });

  it("boosts a locked-out keyword via the locked-out cluster", () => {
    const r = scorePhoneLeadIntent({ keyword: "locked out of my house" });
    expect(r.components.tokenIntent).toBeGreaterThanOrEqual(12);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/locked-out/)]));
  });

  it("treats 'lockout' (one word) the same as 'locked out'", () => {
    const a = scorePhoneLeadIntent({ keyword: "lockout london" });
    const b = scorePhoneLeadIntent({ keyword: "locked out london" });
    expect(a.components.tokenIntent).toBe(b.components.tokenIntent);
  });

  it("boosts 24/7 + emergency together but caps the sum at 35", () => {
    const r = scorePhoneLeadIntent({
      keyword: "24 hour emergency locksmith locked out near me now",
    });
    expect(r.components.tokenIntent).toBeLessThanOrEqual(35);
    expect(r.components.tokenIntent).toBeGreaterThan(25);  // multiple clusters fire
  });

  it("subtracts for DIY / informational framing", () => {
    const r = scorePhoneLeadIntent({ keyword: "how to pick a lock diy youtube tutorial" });
    expect(r.components.tokenIntent).toBeLessThan(0);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/DIY/i)]));
  });

  it("subtracts for research framing (best/cheapest/review)", () => {
    const r = scorePhoneLeadIntent({ keyword: "best locksmith reviews london" });
    expect(r.components.tokenIntent).toBeLessThanOrEqual(-3);  // -8 research + 0 boost
  });

  it("recognises B2B framing", () => {
    const r = scorePhoneLeadIntent({ keyword: "commercial locksmith manchester" });
    expect(r.components.tokenIntent).toBeGreaterThan(0);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/B2B/i)]));
  });

  it("does NOT match substrings of unrelated words", () => {
    // "nowadays" should not fire the "now" cluster
    const r = scorePhoneLeadIntent({ keyword: "nowadays locks need replacing" });
    expect(r.reasons.find((s) => s.includes("immediate-action"))).toBeUndefined();
  });

  it("matches hyphenated phrases (locked-out)", () => {
    const r = scorePhoneLeadIntent({ keyword: "locked-out service" });
    expect(r.components.tokenIntent).toBeGreaterThanOrEqual(12);
  });

  it("does not double-count synonymous tokens from the same cluster", () => {
    // emergency + callout are in the same cluster — should fire once
    const single = scorePhoneLeadIntent({ keyword: "emergency locksmith" });
    const double = scorePhoneLeadIntent({ keyword: "emergency callout urgent locksmith" });
    expect(double.components.tokenIntent).toBe(single.components.tokenIntent);
  });

  it("every cluster has a non-empty token list (catch accidental wipes)", () => {
    for (const c of INTENT_CLUSTERS) {
      expect(c.tokens.length).toBeGreaterThan(0);
      expect(typeof c.reason).toBe("string");
    }
  });
});

// ── Component: geo specificity ───────────────────────────────────────────────

describe("scorePhoneLeadIntent — geo specificity", () => {
  it.each([
    "RG1", "SK4", "M1", "SW1A", "EC1A", "B1", "L1",
  ])("detects %s as a UK postcode district", (district) => {
    expect(detectPostcodeDistrict(`locksmith ${district}`)).toBe(district);
  });

  it("postcode district beats city — only the higher boost is counted", () => {
    const result = scorePhoneLeadIntent({ keyword: "locksmith manchester m1" });
    expect(result.components.geoSpecificity).toBe(20);  // postcode wins
  });

  it("UK city gets the mid-tier boost", () => {
    const r = scorePhoneLeadIntent({ keyword: "locksmith manchester" });
    expect(r.components.geoSpecificity).toBe(10);
    expect(detectCity("locksmith manchester")).toBe("manchester");
  });

  it("'near me' gets the small generic boost", () => {
    const r = scorePhoneLeadIntent({ keyword: "locksmith near me" });
    expect(r.components.geoSpecificity).toBe(5);
  });

  it("no geo signal at all → 0", () => {
    const r = scorePhoneLeadIntent({ keyword: "locksmith services" });
    expect(r.components.geoSpecificity).toBe(0);
  });

  it("'york' as a word matches but 'yorkshire' does not (word-boundary)", () => {
    expect(detectCity("locksmith york")).toBe("york");
    expect(detectCity("yorkshire locksmiths ltd")).toBeNull();
  });
});

// ── Component: historical win rate shrinkage ─────────────────────────────────

describe("shrunkWinRate — Wilson-ish smoothing", () => {
  it("returns 0.5 exactly when no observations", () => {
    expect(shrunkWinRate(0, 0)).toBe(0.5);
  });

  it("shrinks small-sample evidence toward 0.5", () => {
    // 1 win, 0 losses — would be 1.0 raw, but shrinkage pulls it down
    expect(shrunkWinRate(1, 0)).toBeLessThan(0.9);
    expect(shrunkWinRate(1, 0)).toBeGreaterThan(0.5);
  });

  it("approaches the true rate as N grows", () => {
    expect(shrunkWinRate(100, 0)).toBeGreaterThan(0.95);
    expect(shrunkWinRate(0, 100)).toBeLessThan(0.05);
  });
});

describe("scorePhoneLeadIntent — historical component", () => {
  it("returns neutral 7-8 points for no history (rounded from 0.5*15=7.5)", () => {
    const r = scorePhoneLeadIntent({ keyword: "locksmith" });
    expect(r.components.historicalWinRate).toBeGreaterThanOrEqual(7);
    expect(r.components.historicalWinRate).toBeLessThanOrEqual(8);
  });

  it("rewards proven winners", () => {
    const r = scorePhoneLeadIntent({
      keyword:   "locksmith rg1",
      winCount:  50,
      lossCount: 5,
    });
    expect(r.components.historicalWinRate).toBeGreaterThanOrEqual(12);
  });

  it("penalises proven losers", () => {
    const r = scorePhoneLeadIntent({
      keyword:   "locksmith rg1",
      winCount:  2,
      lossCount: 30,
    });
    expect(r.components.historicalWinRate).toBeLessThanOrEqual(3);
  });
});

// ── Composite scores ─────────────────────────────────────────────────────────

describe("scorePhoneLeadIntent — composite outputs", () => {
  it("a canonical postcode emergency query scores very high", () => {
    const r = scorePhoneLeadIntent({
      keyword:  "emergency locksmith rg1",
      category: "postcode_local",
    });
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("a DIY-research query with no geo scores very low", () => {
    const r = scorePhoneLeadIntent({
      keyword:  "how to pick a yale lock diy",
      category: "research_intent",
    });
    expect(r.score).toBeLessThanOrEqual(15);
  });

  it("ranks postcode_local + emergency above service_long_tail planned work", () => {
    const fast = scorePhoneLeadIntent({
      keyword:  "emergency locksmith sk4",
      category: "postcode_local",
    });
    const planned = scorePhoneLeadIntent({
      keyword:  "lock change manchester",
      category: "service_long_tail",
    });
    expect(fast.score).toBeGreaterThan(planned.score);
  });

  it("clamps the final score to [0, 100]", () => {
    // Stack every penalty
    const bottom = scorePhoneLeadIntent({
      keyword:   "how to diy youtube tutorial best cheap review",
      category:  "negative",
      winCount:  0,
      lossCount: 100,
    });
    expect(bottom.score).toBeGreaterThanOrEqual(0);
    expect(bottom.score).toBeLessThanOrEqual(100);

    // Stack every boost
    const top = scorePhoneLeadIntent({
      keyword:   "24 hour emergency locked out locksmith rg1 now",
      category:  "postcode_local",
      winCount:  100,
      lossCount: 0,
    });
    expect(top.score).toBeGreaterThanOrEqual(0);
    expect(top.score).toBeLessThanOrEqual(100);
  });

  it("emits a non-empty reasons array for every score", () => {
    const r = scorePhoneLeadIntent({ keyword: "anything" });
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("is deterministic — same input → same output", () => {
    const a = scorePhoneLeadIntent({
      keyword:  "emergency locksmith manchester",
      category: "postcode_local",
      winCount: 10, lossCount: 2,
    });
    const b = scorePhoneLeadIntent({
      keyword:  "emergency locksmith manchester",
      category: "postcode_local",
      winCount: 10, lossCount: 2,
    });
    expect(a).toEqual(b);
  });
});

// ── Batch ranking ────────────────────────────────────────────────────────────

describe("rankByPhoneLeadIntent", () => {
  it("orders highest score first", () => {
    const ranked = rankByPhoneLeadIntent([
      { keyword: "how to pick a lock diy",       category: "research_intent" },
      { keyword: "emergency locksmith rg1",       category: "postcode_local" },
      { keyword: "commercial locksmith bristol",  category: "b2b_specialist" },
    ]);
    expect(ranked[0].keyword).toBe("emergency locksmith rg1");
    expect(ranked[ranked.length - 1].keyword).toBe("how to pick a lock diy");
  });

  it("breaks ties stably by alphabetised keyword", () => {
    // Two identical keywords-up-to-casing produce identical scores
    const a = { keyword: "locksmith rg1", category: "postcode_local" as const };
    const b = { keyword: "locksmith sk4", category: "postcode_local" as const };
    const ranked = rankByPhoneLeadIntent([b, a]);
    // Scores should match → sort alphabetically
    expect(ranked[0].phoneLeadIntent.score).toBe(ranked[1].phoneLeadIntent.score);
    expect(ranked[0].keyword).toBe("locksmith rg1");
  });

  it("attaches a phoneLeadIntent field to each ranked entry", () => {
    const ranked = rankByPhoneLeadIntent([{ keyword: "locksmith rg1" }]);
    expect(ranked[0].phoneLeadIntent).toBeDefined();
    expect(ranked[0].phoneLeadIntent.score).toBeGreaterThan(0);
  });

  it("returns an empty array for empty input", () => {
    expect(rankByPhoneLeadIntent([])).toEqual([]);
  });
});
