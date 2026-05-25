/**
 * Competitor Cross-Validation Engine
 *
 * Merges keyword intelligence from two live sources — SERP evidence and
 * competitor page fingerprints — into a single, confidence-scored keyword set.
 *
 * Replaces: crossValidateKeywords() from the old spyfu-client.ts
 *
 * HOW IT'S BETTER THAN SEMRUSH + SPYFU:
 *
 *   Old approach (SEMrush + SpyFu):
 *     - SEMrush: estimated keywords a domain bids on (crawl-based, days stale)
 *     - SpyFu:   historical keyword list (sometimes months stale)
 *     - Merge:   keyword in both → dualSource=true
 *
 *   New approach (SERP + Fingerprint):
 *     - SERP:         we DIRECTLY SAW the competitor's ad for this keyword today
 *     - Fingerprint:  we found the keyword in the competitor's own page copy
 *     - dualConfirmed: both evidence types agree → maximum confidence
 *
 *   Additional signals we add that neither API offers:
 *     - geoCount:        how many cities we observed this competitor bidding in
 *     - competitorCount: how many tracked competitors fight over this keyword
 *     - isEntering:      first time seen in the last 4 weeks → new opportunity/threat
 *     - isExiting:       absent for 2+ weeks after being a known keyword → weakening
 *     - adCopyVariants:  how many distinct ad headlines seen → testing intensity
 */

import type { SerpScanResult } from "@/lib/serp-intelligence-client";
import type { CompetitorFingerprint } from "@/lib/competitor-fingerprint";

// ── Types ────────────────────────────────────────────────────────────────────

export interface IntelKeyword {
  keyword: string;

  // ── Pricing & volume ──────────────────────────────────────────────────────
  /** CPC from Google Keyword Planner (already integrated in scout). */
  cpcGbp: number;
  /** Estimated monthly clicks (from SERP position × standard CTR curve). */
  monthlyClicks: number;
  /** Competition index 0–100. */
  competitionIndex: number;
  /** Average paid position across all scanned geos. */
  avgPosition: number;

  // ── Confidence signals ────────────────────────────────────────────────────
  /** Confirmed by a live SERP scan (ad was directly observed). */
  serpConfirmed: boolean;
  /** Confirmed by fingerprint scan (keyword in competitor's page copy). */
  fingerprintConfirmed: boolean;
  /**
   * Both evidence types agree → maximum confidence.
   * Equivalent to dualSource from the old spyfu-client crossValidate.
   */
  dualConfirmed: boolean;

  // ── Richness signals (what makes this better than SEMrush/SpyFu) ──────────
  /** How many UK cities we observed this competitor bidding in. */
  geoCount: number;
  /**
   * The actual cities (as raw `geo` strings from SerpScanResult.geo) where
   * this keyword appeared in ads. Needed by the agent to write
   * CompetitorGeoSignal rows — without it, detectGeos(kw.keyword) returns
   * empty for template-only keywords like "emergency locksmith" because
   * the city name lives in result.geo, not result.keyword.
   */
  geos: string[];
  /** How many of our tracked competitors appear in ads for this keyword. */
  competitorCount: number;
  /** How many distinct ad copy variants seen for this keyword across competitors. */
  adCopyVariants: number;
  /** True if first confirmed sighting is within the last 4 weeks. */
  isEntering: boolean;
  /** True if known from history but not seen in the last 2 weeks of scans. */
  isExiting: boolean;

  // ── Source metadata ───────────────────────────────────────────────────────
  /** Domains that appeared in paid ads for this keyword. */
  serpDomains: string[];
  /** Domains whose fingerprint contains this keyword. */
  fingerprintDomains: string[];
}

/** Lightweight prior — what we know about a keyword from previous agent runs. */
export interface KeywordPrior {
  keyword: string;
  firstSeenAt: Date;
  lastConfirmedAt: Date;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function normalise(keyword: string): string {
  return keyword.toLowerCase().trim().replace(/\s{2,}/g, " ");
}

/**
 * Synonym groups for fingerprint matching. Each token in a group is treated
 * as equivalent to the others. Keeps the merge step from missing dual
 * confirmation when a competitor uses "24/7" but the keyword says "24 hour",
 * or when they lead with "lockout" instead of "locked out".
 *
 * Conservative: only domain-specific synonyms a locksmith ops person would
 * agree are interchangeable in search intent. Not a thesaurus.
 */
const SYNONYM_GROUPS: Array<Set<string>> = [
  new Set(["24",     "24/7", "247",      "24hr",     "24-hour",
           "24hour", "twentyfour", "hour",  "hours",
           "around-the-clock", "anytime"]),
  new Set(["emergency", "urgent", "asap", "callout", "call-out", "emergencies"]),
  new Set(["locked", "locked-out", "lockedout", "lockout", "lockouts", "lock-out"]),
  new Set(["auto", "automotive", "car", "vehicle"]),
  new Set(["upvc", "u-pvc", "upvc-door", "composite", "composite-door"]),
  new Set(["replacement", "replace", "replacing"]),
  new Set(["change",      "changing", "changeover"]),
];

/** Return all synonyms of a token (including itself). */
export function synonymsOf(token: string): string[] {
  const lower = token.toLowerCase();
  for (const group of SYNONYM_GROUPS) {
    if (group.has(lower)) return [...group];
  }
  return [lower];
}

/**
 * Test whether a domain's fingerprint contains a keyword.
 *
 * The match is satisfied when, for every meaningful token of the keyword,
 * at least one of the token's synonyms is found in the domain's searchable
 * text. Direct substring of the full normalised phrase short-circuits to true.
 *
 * "Meaningful" excludes filler words (length < 2). The synonym map then
 * lets "24 hour locksmith" match a page that only says "24/7 locksmith".
 */
export function fingerprintMatchesKeyword(
  searchableText: string,
  normKeyword:    string,
): boolean {
  if (!searchableText || !normKeyword) return false;

  // Fast path: exact phrase appears somewhere in the searchable text.
  if (searchableText.includes(normKeyword)) return true;

  const kwTokens = normKeyword.split(/\s+/).filter((t) => t.length >= 2);
  if (kwTokens.length === 0) return false;

  return kwTokens.every((token) => {
    const variants = synonymsOf(token);
    // Word-boundary check: avoid spurious matches like "lockout" matching
    // "lockoutshop" (defensive — most page text already has spaces).
    return variants.some((v) => {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i")
        .test(searchableText);
    });
  });
}

/** Estimate monthly clicks from average position using standard PPC CTR curve. */
export function estimateMonthlyClicks(avgPosition: number, searchVolume: number): number {
  // Position-based CTR estimates (UK B2C search, emergency intent)
  const CTR_BY_POSITION: Record<number, number> = {
    1: 0.086,
    2: 0.055,
    3: 0.038,
    4: 0.028,
  };
  const ctr = CTR_BY_POSITION[Math.round(avgPosition)] ?? 0.02;
  return Math.round(searchVolume * ctr);
}

// ── Core merge function ───────────────────────────────────────────────────────

/**
 * Merge SERP scan results + competitor fingerprints into confidence-scored
 * IntelKeyword records.
 *
 * @param serpResults  - Array of SerpScanResult from SerpIntelligenceClient.scanBatch()
 * @param fingerprints - Map of domain → CompetitorFingerprint
 * @param priors       - Known keywords from previous agent runs (for entering/exiting logic)
 * @param cpcMap       - Map of normalised keyword → CPC in GBP (from Keyword Planner)
 * @param volumeMap    - Map of normalised keyword → monthly search volume
 */
export function mergeIntelKeywords(
  serpResults:  SerpScanResult[],
  fingerprints: Map<string, CompetitorFingerprint>,
  priors:       KeywordPrior[]            = [],
  cpcMap:       Map<string, number>       = new Map(),
  volumeMap:    Map<string, number>       = new Map(),
): IntelKeyword[] {

  // ── Build SERP evidence map ─────────────────────────────────────────────
  // keyword (normalised) → { domains, geos, positions, adCopyHeadlines }
  interface SerpEvidence {
    domains:    Set<string>;
    geos:       Set<string>;
    positions:  number[];
    headlines:  Set<string>;
  }
  const serpMap = new Map<string, SerpEvidence>();

  for (const result of serpResults) {
    const kwNorm = normalise(result.keyword);
    if (!serpMap.has(kwNorm)) {
      serpMap.set(kwNorm, {
        domains:   new Set(),
        geos:      new Set(),
        positions: [],
        headlines: new Set(),
      });
    }
    const ev = serpMap.get(kwNorm)!;
    ev.geos.add(result.geo);
    for (const ad of result.ads) {
      ev.domains.add(ad.domain);
      ev.positions.push(ad.position);
      if (ad.headline) ev.headlines.add(ad.headline.trim());
    }
  }

  // ── Build per-domain searchable text for synonym-aware matching ────────
  // We use the raw lowercased searchableText (title + meta + h1) rather
  // than the tokenised arrays, because tokenise() drops short tokens like
  // "24" and punctuated ones like "24/7" — losing exactly the words that
  // matter for "24 hour locksmith" matching. The synonym map in
  // fingerprintMatchesKeyword then bridges "24 hour" ↔ "24/7", etc.
  //
  // Blocked fingerprints (Cloudflare challenge, network error, JS shell)
  // are excluded — they have no real content to match against, so counting
  // them would silently mark every keyword as fingerprint-unconfirmed for
  // that domain, falsely demoting dualConfirmed status.
  const fpDomainText = new Map<string, string>();
  for (const [domain, fp] of fingerprints) {
    if (fp.blocked) continue;
    // Fall back to joining tokenised arrays when searchableText is missing
    // (older fingerprints persisted before this field was added, or test
    // fixtures that don't set it explicitly).
    const text = fp.searchableText && fp.searchableText.length > 0
      ? fp.searchableText
      : [...fp.titleKeywords, ...fp.metaKeywords, ...fp.h1Keywords].join(" ");
    fpDomainText.set(domain, text);
  }

  // ── Build priors map ────────────────────────────────────────────────────
  const priorMap = new Map<string, KeywordPrior>();
  for (const p of priors) priorMap.set(normalise(p.keyword), p);

  // ── Merge ────────────────────────────────────────────────────────────────
  // Iterate ONLY SERP-discovered keywords — those are the real search
  // queries we care about. Previously we also enumerated every fingerprint
  // token as a standalone "keyword", which produced single-word noise like
  // "emergency" / "locksmith" / "manchester" in the merged set and polluted
  // extractTopSeeds(). If a fingerprint-derived term ever needs to surface
  // as a keyword in its own right, that belongs in a separate discovery
  // function — not in confidence-scoring of known search queries.
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo  = new Date(Date.now() -  14 * 24 * 60 * 60 * 1000);
  const allNormKws   = new Set([...serpMap.keys()]);
  const results: IntelKeyword[] = [];

  for (const normKw of allNormKws) {
    const serpEv = serpMap.get(normKw);
    const prior  = priorMap.get(normKw);

    // Find every domain whose fingerprint searchableText contains the
    // keyword's tokens (with synonym expansion). See
    // fingerprintMatchesKeyword for the matching semantics.
    const fpDomains = new Set<string>();
    for (const [domain, text] of fpDomainText) {
      if (fingerprintMatchesKeyword(text, normKw)) {
        fpDomains.add(domain);
      }
    }

    const serpConfirmed       = !!serpEv && serpEv.domains.size > 0;
    const fingerprintConfirmed = fpDomains.size > 0;
    const dualConfirmed        = serpConfirmed && fingerprintConfirmed;

    const positions  = serpEv?.positions ?? [];
    const avgPosition = positions.length
      ? positions.reduce((a, b) => a + b, 0) / positions.length
      : 0;

    const volume         = volumeMap.get(normKw) ?? 0;
    const monthlyClicks  = avgPosition > 0 ? estimateMonthlyClicks(avgPosition, volume) : 0;

    // Restore original casing from SERP result if available, else use normalised
    const originalKw = serpEv
      ? serpResults.find((r) => normalise(r.keyword) === normKw)?.keyword ?? normKw
      : normKw;

    // isEntering: no prior record, or first seen within last 4 weeks
    const isEntering = !prior || prior.firstSeenAt >= fourWeeksAgo;

    // isExiting: has a prior record, was previously confirmed, but not seen in last 2 weeks
    const isExiting  = !!prior &&
      prior.lastConfirmedAt < twoWeeksAgo &&
      !serpConfirmed;

    results.push({
      keyword:            originalKw,
      cpcGbp:             cpcMap.get(normKw) ?? 0,
      monthlyClicks,
      competitionIndex:   0,          // Filled in by Keyword Planner integration
      avgPosition,
      serpConfirmed,
      fingerprintConfirmed,
      dualConfirmed,
      geoCount:           serpEv?.geos.size       ?? 0,
      geos:               [...(serpEv?.geos       ?? [])],
      competitorCount:    serpEv?.domains.size     ?? 0,
      adCopyVariants:     serpEv?.headlines.size   ?? 0,
      isEntering,
      isExiting,
      serpDomains:        [...(serpEv?.domains ?? [])],
      fingerprintDomains: [...fpDomains],
    });
  }

  // ── Sort: dualConfirmed first, then by geoCount + competitorCount desc ──
  return results.sort((a, b) => {
    if (a.dualConfirmed !== b.dualConfirmed) return a.dualConfirmed ? -1 : 1;
    const scoreA = a.geoCount * 2 + a.competitorCount;
    const scoreB = b.geoCount * 2 + b.competitorCount;
    return scoreB - scoreA;
  });
}

// ── Convenience: extract top seeds for the opportunity scout ─────────────────

/**
 * From a merged intel keyword list, return the top N keywords suitable for
 * seeding the opportunity scout's Keyword Planner expansion.
 *
 * Priority:
 *   1. dualConfirmed + high geoCount (best competitive intelligence)
 *   2. serpConfirmed + multi-competitor (several rivals fighting over it)
 *   3. fingerprintConfirmed (softer signal — competitor leads with it)
 */
export function extractTopSeeds(
  keywords: IntelKeyword[],
  limit     = 30,
): string[] {
  return keywords
    .filter((k) => k.serpConfirmed || k.fingerprintConfirmed)
    .slice(0, limit)
    .map((k) => k.keyword);
}

/**
 * Build a geo presence score map from SERP results.
 * geoId → fraction of target keywords where at least one competitor appeared.
 * Used to update CompetitorGeoSignal records in the database.
 */
export function buildGeoPresenceScores(
  serpResults: SerpScanResult[],
  totalKeywords: number,
): Map<string, number> {
  const geoKwCount = new Map<string, number>();
  for (const r of serpResults) {
    if (r.ads.length > 0) {
      geoKwCount.set(r.geo, (geoKwCount.get(r.geo) ?? 0) + 1);
    }
  }
  const scores = new Map<string, number>();
  for (const [geo, count] of geoKwCount) {
    scores.set(geo, Math.min(1, count / Math.max(1, totalKeywords)));
  }
  return scores;
}
