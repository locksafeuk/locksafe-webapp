/**
 * Shark-Saturated SERP Filter
 *
 * Demotes keywords where shark-flagged domains dominate the paid-ad SERP.
 * The thesis: if a keyword's top results are already controlled by
 * call-centre operators bidding aggressively on bait pricing, LockSafe
 * cannot win the auction on price alone — and trying just funds the
 * shark race. Better to redirect that budget toward keywords where
 * sharks are absent or outnumbered.
 *
 * INPUT: an IntelKeyword's serpDomains list (who showed in paid ads)
 *        plus a flag-set / verdict map produced by scoreSharkFingerprint.
 *
 * OUTPUT: a SharkSaturationVerdict per keyword + helpers to partition,
 *         annotate, or filter the keyword stream.
 *
 * DEFAULT THRESHOLDS (overridable per call):
 *   MIN_FLAGGED_COUNT   = 2     ≥2 flagged domains must be present
 *   MIN_SATURATION_RATIO = 0.5  ≥50% of SERP domains are flagged
 *
 * Both gates must trip together. One flagged domain on a 5-domain SERP
 * doesn't make the keyword "saturated" — it makes it competitive. Two
 * flagged domains on a 3-domain SERP DOES make it saturated.
 *
 * Pure module: no DB, no clock, deterministic.
 */

import type { IntelKeyword } from "@/lib/competitor-cross-validate";
import type { SharkVerdict } from "@/lib/shark-domains";

// ── Configuration ───────────────────────────────────────────────────────────

/** Default thresholds. Exported so ops + tests can reference them. */
export const SHARK_SATURATION_DEFAULTS = {
  /** Minimum count of shark-flagged domains required to consider saturation. */
  minFlaggedCount:     2,
  /** Minimum fraction of SERP domains that must be flagged. */
  minSaturationRatio:  0.5,
} as const;

export interface SaturationOptions {
  minFlaggedCount?:    number;
  minSaturationRatio?: number;
}

// ── Public types ────────────────────────────────────────────────────────────

export interface SharkSaturationVerdict {
  /** Final flag — true when both thresholds are met. */
  saturated:        boolean;
  /** Domains the verdict acted on. */
  flaggedDomains:   string[];
  /** Count of flagged domains in the SERP set. */
  flaggedCount:     number;
  /** Total count of SERP domains evaluated. */
  totalDomains:     number;
  /** flaggedCount / totalDomains, or 0 if totalDomains is 0. */
  ratio:            number;
  /** Human-readable explanation for the audit trail. */
  reason:           string;
}

/**
 * Adapter type so callers can pass either:
 *   • a plain Set<string> of flagged domain names, OR
 *   • a Map<string, SharkVerdict> from scoreSharkFingerprint
 *
 * The Map form is nicer because it lets us expose WHICH patterns
 * triggered each shark verdict in the saturation reason text.
 */
export type SharkFlagSource = Set<string> | Map<string, SharkVerdict>;

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Normalise the flag-source to a single isFlagged() predicate. */
function makeFlagPredicate(source: SharkFlagSource): (domain: string) => boolean {
  if (source instanceof Set) {
    return (d) => source.has(d);
  }
  // Map<string, SharkVerdict> — only treat shouldFlag=true as a hit
  return (d) => {
    const verdict = source.get(d);
    return !!verdict && verdict.shouldFlag === true;
  };
}

// ── Core analyser ───────────────────────────────────────────────────────────

/**
 * Evaluate saturation for a single keyword.
 *
 * The returned verdict carries enough information for the opportunity
 * scout to log WHY a keyword was demoted — not just that it was. This
 * matters because shark-flag thresholds may need tuning, and we want
 * easy retrieval of borderline cases.
 */
export function analyseSharkSaturation(
  serpDomains: string[],
  flagSource:  SharkFlagSource,
  options:     SaturationOptions = {},
): SharkSaturationVerdict {
  const minFlaggedCount    = options.minFlaggedCount    ?? SHARK_SATURATION_DEFAULTS.minFlaggedCount;
  const minSaturationRatio = options.minSaturationRatio ?? SHARK_SATURATION_DEFAULTS.minSaturationRatio;

  // Deduplicate domains — a keyword scanned across many geos might list
  // the same domain multiple times in raw input
  const uniqueDomains = Array.from(new Set(serpDomains));
  const totalDomains  = uniqueDomains.length;

  if (totalDomains === 0) {
    return {
      saturated:      false,
      flaggedDomains: [],
      flaggedCount:   0,
      totalDomains:   0,
      ratio:          0,
      reason:         "no SERP domains to evaluate",
    };
  }

  const isFlagged       = makeFlagPredicate(flagSource);
  const flaggedDomains  = uniqueDomains.filter(isFlagged);
  const flaggedCount    = flaggedDomains.length;
  const ratio           = flaggedCount / totalDomains;

  const meetsCountGate  = flaggedCount >= minFlaggedCount;
  const meetsRatioGate  = ratio        >= minSaturationRatio;
  const saturated       = meetsCountGate && meetsRatioGate;

  let reason: string;
  if (saturated) {
    reason = `${flaggedCount}/${totalDomains} shark-flagged domains (${(ratio * 100).toFixed(0)}%) — saturated`;
  } else if (flaggedCount === 0) {
    reason = "no shark-flagged domains in SERP";
  } else if (!meetsCountGate) {
    reason = `only ${flaggedCount} shark-flagged domain — below count gate (${minFlaggedCount})`;
  } else {
    reason = `${(ratio * 100).toFixed(0)}% shark density — below ratio gate (${(minSaturationRatio * 100).toFixed(0)}%)`;
  }

  return {
    saturated,
    flaggedDomains,
    flaggedCount,
    totalDomains,
    ratio,
    reason,
  };
}

// ── Convenience wrappers over IntelKeyword[] ─────────────────────────────────

export interface AnnotatedIntelKeyword extends IntelKeyword {
  sharkSaturation: SharkSaturationVerdict;
}

/**
 * Annotate every IntelKeyword with its saturation verdict. Non-destructive
 * — original keyword fields are preserved, the verdict lives on a new
 * `sharkSaturation` field.
 */
export function annotateSharkSaturation(
  keywords:   IntelKeyword[],
  flagSource: SharkFlagSource,
  options:    SaturationOptions = {},
): AnnotatedIntelKeyword[] {
  return keywords.map((kw) => ({
    ...kw,
    sharkSaturation: analyseSharkSaturation(kw.serpDomains, flagSource, options),
  }));
}

/**
 * Partition a keyword stream into `clean` (safe to promote) and
 * `saturated` (demote/skip) sets. The opportunity scout calls this
 * after merging IntelKeywords but before scoring + ranking.
 */
export function partitionBySharkSaturation(
  keywords:   IntelKeyword[],
  flagSource: SharkFlagSource,
  options:    SaturationOptions = {},
): {
  clean:      AnnotatedIntelKeyword[];
  saturated:  AnnotatedIntelKeyword[];
} {
  const annotated = annotateSharkSaturation(keywords, flagSource, options);
  const clean:     AnnotatedIntelKeyword[] = [];
  const saturated: AnnotatedIntelKeyword[] = [];
  for (const kw of annotated) {
    if (kw.sharkSaturation.saturated) saturated.push(kw);
    else                              clean.push(kw);
  }
  return { clean, saturated };
}

/**
 * One-shot filter: returns ONLY the clean keywords. Drops saturated
 * entries silently. Use when the caller doesn't need to log demotion
 * reasons (the opportunity scout's main path uses partition instead,
 * so demotions land in the agent log).
 */
export function filterOutSharkSaturated(
  keywords:   IntelKeyword[],
  flagSource: SharkFlagSource,
  options:    SaturationOptions = {},
): IntelKeyword[] {
  return partitionBySharkSaturation(keywords, flagSource, options).clean;
}
