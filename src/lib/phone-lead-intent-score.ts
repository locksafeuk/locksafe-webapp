/**
 * Phone-Lead Intent Score (0–100)
 *
 * Ranks a candidate keyword by its likelihood of producing a PHONE CALL
 * (not a web form fill). This is the central metric the opportunity scout
 * uses to promote candidates out of KeywordSeed → GoogleAdsCampaignDraft.
 *
 * WHY THIS METRIC EXISTS
 * ──────────────────────
 * LockSafe's positioning is anti-shark: real-engineer, fixed-price, picks
 * up the phone. Our economics work when the click → call → completed-job
 * funnel is short. Web traffic that turns into a £15 lock-change quote
 * costs us more than the bid — that's the vanity-conversion trap.
 *
 * The score is a transparent composite of four signals. Each contributes
 * a bounded amount, every adjustment carries a `reason` string, and the
 * function is PURE — no DB, no clock, deterministic. That makes it easy
 * to audit when a keyword unexpectedly ranks high or low.
 *
 * SCORE COMPOSITION (max 100)
 * ───────────────────────────
 *   familyWeight         0–30  — which template family produced this seed
 *   tokenIntent          0–35  — phone-urgent tokens (emergency, 24/7, locked out)
 *   geoSpecificity       0–20  — postcode district > city > generic
 *   historicalWinRate    0–15  — past performance (shrinks toward neutral on small N)
 *
 * The Wilson-ish shrinkage on the historical component prevents a single
 * win or loss from dominating the score — a brand-new keyword scores at
 * the neutral midpoint until it accumulates enough evidence.
 */

import type { SeedCategory } from "@/agents/core/seed-bank";

// ── Public types ────────────────────────────────────────────────────────────

export interface PhoneLeadIntentInput {
  /** The candidate keyword string. Normalised internally — case-insensitive. */
  keyword:    string;
  /** Seed family from the postcode generator (drives familyWeight). */
  category?:  SeedCategory;
  /** Wins from previous campaigns referencing this seed. Default 0. */
  winCount?:  number;
  /** Losses from previous campaigns referencing this seed. Default 0. */
  lossCount?: number;
}

export interface PhoneLeadIntentScore {
  /** Final composite score, clamped to [0, 100]. */
  score: number;

  /** Breakdown for debugging / audit. */
  components: {
    familyWeight:      number;
    tokenIntent:       number;
    geoSpecificity:    number;
    historicalWinRate: number;
  };

  /**
   * Human-readable list of every adjustment that contributed to the score.
   * Each entry is short ("+15 emergency token", "-8 research framing").
   * Useful when an ops person asks "why did this keyword rank above that one?"
   */
  reasons: string[];
}

// ── Configuration (exported for tests + ops review) ─────────────────────────

/**
 * Family → baseline phone-call propensity. The opportunity scout's whole
 * thesis is that postcode_local is the most phone-loaded family because
 * a searcher typing "locksmith RG1" is mid-emergency, phone-in-hand.
 * trust_signal is close behind: an informed buyer who's been burned
 * before will phone to verify rather than book online.
 */
export const FAMILY_BASELINE: Record<string, number> = {
  postcode_local:    30,
  trust_signal:      25,
  b2b_specialist:    20,
  service_long_tail: 18,
  competitor:        12,
  baseline:          12,
  learned:           12,
  experimental:      10,
  research_intent:    5,
  negative:           0,
};

/**
 * Token clusters → intent boost. A keyword can match at most ONE token from
 * each cluster (we don't double-count "emergency" + "urgent" — they signal
 * the same thing). Negative clusters subtract.
 */
interface TokenCluster {
  name:    string;
  tokens:  string[];        // matched as whole words / hyphenated phrases
  boost:   number;          // points contributed (can be negative)
  reason:  string;          // human-readable
}

export const INTENT_CLUSTERS: TokenCluster[] = [
  // Positive — phone-urgent intent
  {
    name:   "emergency",
    tokens: ["emergency", "urgent", "asap", "callout", "call-out"],
    boost:  15,
    reason: "emergency intent",
  },
  {
    name:   "locked-out",
    tokens: ["locked", "lockout", "locked-out", "lockedout", "lock-out", "locked out"],
    boost:  12,
    reason: "locked-out intent",
  },
  {
    name:   "24-hour",
    tokens: ["24", "24/7", "247", "24hr", "24-hour", "24hour", "overnight",
             "anytime", "around-the-clock"],
    boost:  10,
    reason: "after-hours / 24h intent",
  },
  {
    name:   "now",
    tokens: ["now", "today", "tonight", "immediately", "right-now"],
    boost:  8,
    reason: "immediate-action intent",
  },

  // Mid-intent — informed/trust buyer (still calls, but less time-pressured)
  {
    name:   "b2b",
    tokens: ["landlord", "commercial", "business", "office", "shop", "letting"],
    boost:  5,
    reason: "B2B framing",
  },

  // Negative — lower phone-call intent
  {
    name:   "research",
    tokens: ["best", "top", "review", "reviews", "cheap", "cheapest", "compare"],
    boost: -8,
    reason: "research framing",
  },
  {
    name:   "diy",
    tokens: ["how-to", "how", "diy", "tutorial", "youtube"],
    boost: -15,
    reason: "DIY / informational intent",
  },
];

/** UK postcode-district outcode regex. Matches RG1, SK4, SW1A, M1, EC1A etc. */
export const UK_POSTCODE_DISTRICT_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\b/i;

/**
 * Curated UK city names — used to award the mid-tier geo-specificity boost
 * when the keyword names a city without a postcode (e.g. "emergency
 * locksmith manchester"). Conservative: only the locksmith-relevant top
 * ~50 by population. Lowercased for case-insensitive matching.
 */
export const UK_CITY_TOKENS = new Set([
  "london", "manchester", "birmingham", "leeds", "glasgow", "liverpool",
  "edinburgh", "bristol", "sheffield", "cardiff", "belfast", "newcastle",
  "nottingham", "leicester", "coventry", "bradford", "stoke", "wolverhampton",
  "plymouth", "derby", "swansea", "southampton", "salford", "portsmouth",
  "york", "peterborough", "oxford", "cambridge", "reading", "brighton",
  "hull", "preston", "milton-keynes", "northampton", "luton", "sunderland",
  "wakefield", "lincoln", "exeter", "gloucester", "chester", "carlisle",
  "bath", "norwich", "ipswich", "dundee", "aberdeen", "swindon", "blackpool",
  "bournemouth", "middlesbrough", "warrington",
]);

/** Generic-geo markers — small boost when no city / postcode is present. */
export const GENERIC_GEO_TOKENS = new Set([
  "near-me", "near", "local", "nearby", "around-me",
]);

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Returns the first matching cluster (or null) for a keyword's token set.
 *
 * Word-boundary matching prevents "lockoutshop" from triggering the
 * locked-out cluster. The token list contains both space-separated phrases
 * (e.g. "locked out") and hyphenated equivalents ("locked-out") — for
 * phrase tokens we check substring, for single tokens we check word
 * boundaries.
 */
function clusterMatch(haystack: string, cluster: TokenCluster): boolean {
  for (const token of cluster.tokens) {
    // Multi-word phrase → check raw substring presence
    if (token.includes(" ")) {
      if (haystack.includes(token)) return true;
      continue;
    }
    // Single token → word-boundary match (escape any regex special chars)
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    if (re.test(haystack)) return true;
  }
  return false;
}

/**
 * UK postcode district detection. Returns the matched outcode (uppercase)
 * when the keyword contains one, or null otherwise.
 */
export function detectPostcodeDistrict(keyword: string): string | null {
  const m = keyword.match(UK_POSTCODE_DISTRICT_RE);
  if (!m) return null;
  // Filter false positives — single-letter outcodes don't exist
  const token = m[0].toUpperCase();
  if (token.length < 2) return null;
  return token;
}

/** UK city detection. Returns the matched city (lowercase) or null. */
export function detectCity(keyword: string): string | null {
  const lower = keyword.toLowerCase();
  for (const city of UK_CITY_TOKENS) {
    // Word-boundary check so "york" doesn't match "yorkshire"
    const re = new RegExp(`(^|[^a-z])${city}([^a-z]|$)`, "i");
    if (re.test(lower)) return city;
  }
  return null;
}

/**
 * Wilson-shrunk win rate. Shrinks toward the neutral midpoint when N
 * (total observations) is small.
 *
 * For N=0 it returns 0.5 exactly (neutral) — a brand-new seed gets no
 * win/loss credit. The shrinkage decays smoothly with N so a seed with
 * 50 observations is much closer to its raw rate than one with 5.
 */
export function shrunkWinRate(wins: number, losses: number): number {
  const n = wins + losses;
  if (n === 0) return 0.5;
  // Beta(2, 2) prior → equivalent to "+1 win, +1 loss" smoothing
  return (wins + 1) / (n + 2);
}

// ── Main scorer ─────────────────────────────────────────────────────────────

/**
 * Score a keyword for phone-call lead intent.
 *
 * Determinism: same input → same output. No clock, no DB, no Math.random.
 */
export function scorePhoneLeadIntent(input: PhoneLeadIntentInput): PhoneLeadIntentScore {
  const reasons: string[] = [];
  const haystack = input.keyword.toLowerCase().trim();

  // ── 1. Family weight ─────────────────────────────────────────────────
  const familyKey = input.category ?? "baseline";
  const familyWeight = FAMILY_BASELINE[familyKey] ?? 12;
  reasons.push(`+${familyWeight} family:${familyKey}`);

  // ── 2. Token-intent boosts ───────────────────────────────────────────
  let tokenIntent = 0;
  for (const cluster of INTENT_CLUSTERS) {
    if (clusterMatch(haystack, cluster)) {
      tokenIntent += cluster.boost;
      const sign = cluster.boost >= 0 ? "+" : "";
      reasons.push(`${sign}${cluster.boost} ${cluster.reason}`);
    }
  }
  // Cap the token component to its design bound. The cluster list is
  // intentionally fat — we want every contributing signal in the audit
  // trail — but we don't want a single keyword that ticks every box to
  // dominate the family signal.
  tokenIntent = Math.max(-25, Math.min(35, tokenIntent));

  // ── 3. Geo specificity ───────────────────────────────────────────────
  let geoSpecificity = 0;
  const district = detectPostcodeDistrict(input.keyword);
  if (district) {
    geoSpecificity = 20;
    reasons.push(`+20 postcode district:${district}`);
  } else {
    const city = detectCity(input.keyword);
    if (city) {
      geoSpecificity = 10;
      reasons.push(`+10 UK city:${city}`);
    } else {
      // Generic-geo markers ("near me") give a small boost
      for (const marker of GENERIC_GEO_TOKENS) {
        if (haystack.includes(marker.replace(/-/g, " ")) ||
            haystack.includes(marker)) {
          geoSpecificity = 5;
          reasons.push(`+5 generic-geo:${marker}`);
          break;
        }
      }
    }
  }

  // ── 4. Historical win rate (shrunk) ──────────────────────────────────
  const wins   = input.winCount  ?? 0;
  const losses = input.lossCount ?? 0;
  const n      = wins + losses;
  const rate   = shrunkWinRate(wins, losses);          // 0–1
  const historicalWinRate = Math.round(rate * 15);     // 0–15
  if (n === 0) {
    reasons.push(`+${historicalWinRate} historical:neutral (no data)`);
  } else {
    reasons.push(`+${historicalWinRate} historical:${wins}w/${losses}l (rate=${rate.toFixed(2)})`);
  }

  // ── Compose + clamp ──────────────────────────────────────────────────
  const raw = familyWeight + tokenIntent + geoSpecificity + historicalWinRate;
  const score = Math.max(0, Math.min(100, raw));

  return {
    score,
    components: { familyWeight, tokenIntent, geoSpecificity, historicalWinRate },
    reasons,
  };
}

// ── Convenience: rank a batch ───────────────────────────────────────────────

/**
 * Rank a batch of candidates by phone-lead intent score, highest first.
 * Stable: ties broken by lower-cased keyword string.
 */
export function rankByPhoneLeadIntent<T extends PhoneLeadIntentInput>(
  candidates: T[],
): Array<T & { phoneLeadIntent: PhoneLeadIntentScore }> {
  return candidates
    .map((c) => ({ ...c, phoneLeadIntent: scorePhoneLeadIntent(c) }))
    .sort((a, b) => {
      if (b.phoneLeadIntent.score !== a.phoneLeadIntent.score) {
        return b.phoneLeadIntent.score - a.phoneLeadIntent.score;
      }
      return a.keyword.toLowerCase().localeCompare(b.keyword.toLowerCase());
    });
}
