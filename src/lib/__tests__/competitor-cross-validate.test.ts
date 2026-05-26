/**
 * Competitor Cross-Validate — merge + synonym matching tests.
 *
 * Covers the production-critical paths:
 *   • dualConfirmed for multi-word keywords (the bug we fixed)
 *   • synonym-aware matching ("24 hour" ↔ "24/7", "lockout" ↔ "locked out")
 *   • blocked fingerprints are excluded from matching (no false negatives)
 *   • isEntering / isExiting given priors
 *   • extractTopSeeds + buildGeoPresenceScores
 */

import {
  mergeIntelKeywords,
  extractTopSeeds,
  buildGeoPresenceScores,
  fingerprintMatchesKeyword,
  synonymsOf,
  estimateMonthlyClicks,
  normalise,
  type KeywordPrior,
} from "@/lib/competitor-cross-validate";
import type { SerpScanResult } from "@/lib/serp-intelligence-client";
import type { CompetitorFingerprint } from "@/lib/competitor-fingerprint";

// ── Helpers for building fixtures ────────────────────────────────────────────

const fp = (overrides: Partial<CompetitorFingerprint>): CompetitorFingerprint => ({
  domain: "test.co.uk",
  scannedAt: new Date(),
  httpStatus: 200,
  blocked: false,
  searchableText: "",
  titleKeywords: [], metaKeywords: [], h1Keywords: [],
  serviceAreas: [], hasDedicatedCityPages: false, claimsNationwide: false,
  hasPpcTracking: false, hasGoogleAdsTag: false, hasGoogleTagManager: false, googleAdsIds: [],
  isMlaApproved: false, isDbsChecked: false, hasWhichTrusted: false, trustBadges: [],
  priceAnchors: [], lowestPriceGbp: null,
  emphasises24h: false, leadsWithEmergency: false, noCallOutFee: false,
  ...overrides,
});

const serp = (
  keyword: string,
  geo: string,
  adDomains: string[],
  headlines: string[] = [],
): SerpScanResult => ({
  keyword,
  geo,
  scannedAt: new Date(),
  ads: adDomains.map((d, i) => ({
    domain: d,
    position: i + 1,
    headline: headlines[i] ?? `Headline for ${d}`,
    description: `Description for ${d}`,
    displayUrl: d,
    sitelinks: [],
  })),
  organicDomains: [],
  query: `${keyword} ${geo}`,
  blocked: false,
});

// ── synonymsOf ──────────────────────────────────────────────────────────────

describe("synonymsOf", () => {
  it("returns 24/7 cluster for '24 hour' tokens", () => {
    const syns = synonymsOf("24");
    expect(syns).toEqual(expect.arrayContaining(["24/7", "247", "24hr", "24-hour", "hour"]));
  });

  it("treats 'lockout' and 'locked-out' as synonyms", () => {
    const syns = synonymsOf("lockout");
    expect(syns).toContain("locked-out");
    expect(syns).toContain("lockouts");
  });

  it("returns the token alone when no synonyms", () => {
    expect(synonymsOf("manchester")).toEqual(["manchester"]);
  });
});

// ── fingerprintMatchesKeyword ────────────────────────────────────────────────

describe("fingerprintMatchesKeyword — synonym-aware matching", () => {
  it("matches exact phrase", () => {
    expect(fingerprintMatchesKeyword(
      "emergency locksmith manchester | 24/7 service",
      "emergency locksmith manchester",
    )).toBe(true);
  });

  it("matches all tokens present even out of order", () => {
    expect(fingerprintMatchesKeyword(
      "locksmith in manchester offering emergency response",
      "emergency locksmith manchester",
    )).toBe(true);
  });

  it("bridges '24 hour' ↔ '24/7' via synonym map", () => {
    expect(fingerprintMatchesKeyword(
      "24/7 locksmith manchester — round-the-clock service",
      "24 hour locksmith manchester",
    )).toBe(true);
  });

  it("bridges 'lockout' ↔ 'locked out'", () => {
    expect(fingerprintMatchesKeyword(
      "locked out? we open uPVC doors fast in london",
      "lockout london",
    )).toBe(true);
  });

  it("returns false when a token is genuinely missing", () => {
    expect(fingerprintMatchesKeyword(
      "general building services in london",
      "emergency locksmith manchester",
    )).toBe(false);
  });

  it("does not match substrings of unrelated words", () => {
    // "lockoutshop" should not match "lockout" because of word boundaries
    expect(fingerprintMatchesKeyword(
      "we are lockoutshop limited, services across the uk",
      "lockout london",
    )).toBe(false);
  });

  it("returns false for empty inputs", () => {
    expect(fingerprintMatchesKeyword("", "anything")).toBe(false);
    expect(fingerprintMatchesKeyword("anything", "")).toBe(false);
  });
});

// ── mergeIntelKeywords — end-to-end ───────────────────────────────────────────

describe("mergeIntelKeywords", () => {
  it("dualConfirms a multi-word keyword when SERP + fingerprint both confirm", () => {
    const serpResults = [
      serp("emergency locksmith manchester", "manchester",
        ["lockforce.co.uk", "multiskilled.co.uk"]),
    ];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      domain: "lockforce.co.uk",
      searchableText: "emergency locksmith manchester | 24/7 | mla approved",
    }));
    fingerprints.set("multiskilled.co.uk", fp({
      domain: "multiskilled.co.uk",
      searchableText: "multi skilled trades general building services",
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged).toHaveLength(1);

    const kw = merged[0];
    expect(kw.serpConfirmed).toBe(true);
    expect(kw.fingerprintConfirmed).toBe(true);
    expect(kw.dualConfirmed).toBe(true);
    expect(kw.serpDomains).toEqual(expect.arrayContaining(
      ["lockforce.co.uk", "multiskilled.co.uk"],
    ));
    expect(kw.fingerprintDomains).toEqual(["lockforce.co.uk"]);
    expect(kw.competitorCount).toBe(2);
    expect(kw.geoCount).toBe(1);
  });

  it("uses synonym map: '24 hour locksmith london' matches fingerprint saying '24/7 locksmith london'", () => {
    const serpResults = [serp("24 hour locksmith london", "london", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "lockforce | 24/7 locksmith london | emergency response",
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].dualConfirmed).toBe(true);
  });

  it("excludes blocked fingerprints — keyword stays serp-only, not falsely demoted", () => {
    const serpResults = [serp("emergency locksmith leeds", "leeds", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      blocked: true,
      blockReason: "cloudflare_challenge",
      searchableText: "", // Cloudflare challenge — we never saw real content
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].serpConfirmed).toBe(true);
    expect(merged[0].fingerprintConfirmed).toBe(false);
    expect(merged[0].dualConfirmed).toBe(false);
    expect(merged[0].fingerprintDomains).toEqual([]);
  });

  it("captures a fingerprint-only domain (no SERP ad) as evidence", () => {
    const serpResults = [serp("emergency locksmith bristol", "bristol", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "lockforce | emergency locksmith covering bristol & bath",
    }));
    fingerprints.set("ghost.co.uk", fp({
      searchableText: "ghost emergency locksmith services across bristol",
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].fingerprintDomains).toEqual(expect.arrayContaining(
      ["lockforce.co.uk", "ghost.co.uk"],
    ));
    // Only one in SERP though
    expect(merged[0].serpDomains).toEqual(["lockforce.co.uk"]);
  });

  it("marks isEntering when no priors exist", () => {
    const serpResults = [serp("auto locksmith reading", "reading", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "auto locksmith services reading & oxford",
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints, []);
    expect(merged[0].isEntering).toBe(true);
    expect(merged[0].isExiting).toBe(false);
  });

  it("marks isExiting when prior exists but SERP no longer confirms", () => {
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const priors: KeywordPrior[] = [{
      keyword: "lock change birmingham",
      firstSeenAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      lastConfirmedAt: threeWeeksAgo,
    }];

    // SERP scan happened but found NO ads — competitor went silent
    const serpResults = [serp("lock change birmingham", "birmingham", [])];
    const merged = mergeIntelKeywords(serpResults, new Map(), priors);
    expect(merged[0].serpConfirmed).toBe(false);
    expect(merged[0].isExiting).toBe(true);
  });

  it("applies cpc and volume priors", () => {
    const serpResults = [serp("emergency locksmith london", "london", ["lockforce.co.uk"])];
    const cpc = new Map([["emergency locksmith london", 4.20]]);
    const vol = new Map([["emergency locksmith london", 1000]]);

    const merged = mergeIntelKeywords(serpResults, new Map(), [], cpc, vol);
    expect(merged[0].cpcGbp).toBe(4.20);
    expect(merged[0].monthlyClicks).toBeGreaterThan(0);
  });

  it("sorts dualConfirmed first, then by geo+competitor score", () => {
    const serpResults = [
      // Single-confirmed, single geo, single competitor
      serp("upvc door lock repair leeds", "leeds", ["lockforce.co.uk"]),
      // Dual-confirmed, 1 geo, 2 competitors — should rank first
      serp("emergency locksmith london", "london",
        ["lockforce.co.uk", "multiskilled.co.uk"]),
    ];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "emergency locksmith london | 24/7",
    }));

    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].keyword.toLowerCase()).toBe("emergency locksmith london");
    expect(merged[0].dualConfirmed).toBe(true);
  });

  it("preserves the original casing of the SERP keyword", () => {
    const serpResults = [serp("Emergency Locksmith Manchester", "manchester", ["x.co.uk"])];
    const merged = mergeIntelKeywords(serpResults, new Map());
    expect(merged[0].keyword).toBe("Emergency Locksmith Manchester");
  });

  it("returns empty array when no SERP results", () => {
    expect(mergeIntelKeywords([], new Map())).toEqual([]);
  });
});

// ── extractTopSeeds & buildGeoPresenceScores ──────────────────────────────────

describe("extractTopSeeds", () => {
  it("returns only keywords with at least one confirmation source", () => {
    const serpResults = [
      serp("a confirmed kw", "london", ["a.co.uk"]),
      serp("another kw", "london", []),  // no ads = no SERP confirmation
    ];
    const merged = mergeIntelKeywords(serpResults, new Map());
    const seeds = extractTopSeeds(merged, 10);
    expect(seeds).toContain("a confirmed kw");
    expect(seeds).not.toContain("another kw");
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      serp(`kw ${i}`, "london", ["a.co.uk"]),
    );
    const merged = mergeIntelKeywords(many, new Map());
    expect(extractTopSeeds(merged, 10)).toHaveLength(10);
  });
});

describe("buildGeoPresenceScores", () => {
  it("computes fraction of keywords-with-ads per geo", () => {
    const results = [
      serp("emergency locksmith manchester", "manchester", ["a.co.uk"]),
      serp("lock change manchester",        "manchester", ["b.co.uk"]),
      serp("upvc lock repair manchester",   "manchester", []),         // no ads
      serp("emergency locksmith leeds",     "leeds",      ["a.co.uk"]),
    ];
    const scores = buildGeoPresenceScores(results, 4);
    expect(scores.get("manchester")).toBeCloseTo(2 / 4);
    expect(scores.get("leeds")).toBeCloseTo(1 / 4);
  });

  it("caps the score at 1.0", () => {
    const r = serp("a kw", "london", ["x.co.uk"]);
    const scores = buildGeoPresenceScores([r], 0);
    expect(scores.get("london")).toBe(1);
  });
});

// ── estimateMonthlyClicks ────────────────────────────────────────────────────

describe("estimateMonthlyClicks", () => {
  it("uses CTR=8.6% at position 1", () => {
    expect(estimateMonthlyClicks(1, 1000)).toBe(86);
  });

  it("uses CTR=5.5% at position 2", () => {
    expect(estimateMonthlyClicks(2, 1000)).toBe(55);
  });

  it("falls back to 2% for positions ≥ 5", () => {
    expect(estimateMonthlyClicks(5, 1000)).toBe(20);
    expect(estimateMonthlyClicks(10, 1000)).toBe(20);
  });
});

// ── normalise ────────────────────────────────────────────────────────────────

describe("normalise", () => {
  it("lowercases, trims, collapses whitespace", () => {
    expect(normalise("  Emergency   LOCKSMITH    Manchester  "))
      .toBe("emergency locksmith manchester");
  });
});
