/**
 * Opportunity Scout — Standalone Scenario Test Runner
 *
 * Runs without Jest (no transform resolution issues). Execute with:
 *   npx ts-node -e "require('./src/lib/__tests__/run-scout-scenarios')"
 *
 * Or compile first:
 *   npx tsc --outDir /tmp/scout-test src/lib/__tests__/run-scout-scenarios.ts
 *
 * Tests pure functions from keyword-geo-score.ts and google-ads-opportunities.ts.
 * DB-backed functions are tested via lightweight in-memory stubs.
 */

export {};

// ── Tiny test runner ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, extra?: string): void {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    const msg = extra ? `${label}\n       ${extra}` : label;
    failures.push(msg);
    process.stdout.write(`  ✗ ${label}${extra ? `\n       ${extra}` : ""}\n`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, label, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertCloseTo(actual: number, expected: number, tolerance: number, label: string): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  assert(ok, label, ok ? undefined : `expected ~${expected} (±${tolerance}), got ${actual.toFixed(4)}`);
}

function assertGTE(actual: number, min: number, label: string): void {
  assert(actual >= min, label, `expected ≥${min}, got ${actual.toFixed(4)}`);
}

function assertLTE(actual: number, max: number, label: string): void {
  assert(actual <= max, label, `expected ≤${max}, got ${actual.toFixed(4)}`);
}

function section(name: string, fn: () => void): void {
  process.stdout.write(`\n📦 ${name}\n`);
  fn();
}

// ── Import pure functions ────────────────────────────────────────────────────

// Inline copies of the pure functions so this file is completely self-contained
// (avoids needing Prisma, Next.js path aliases, etc.)

// --------------------------------------------------------------------------
// computeStabilityWeight  (from keyword-geo-score.ts)
// --------------------------------------------------------------------------

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function volatilityScore(history: number[]): number {
  if (history.length < 2) return 0;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  if (Math.abs(mean) < 0.01) return 1;
  const cv = stddev(history) / Math.abs(mean);
  return Math.min(3, cv);
}

function computeStabilityWeight(
  consecutiveSurvivalCount: number,
  history: number[],
): number {
  const survivalWeight = Math.min(1, 0.25 + (consecutiveSurvivalCount / 4) * 0.75);
  const volScore = volatilityScore(history);
  const volDiscount = 1 / (1 + volScore);
  return Math.max(0.05, survivalWeight * volDiscount);
}

// --------------------------------------------------------------------------
// computeOperationalFactor  (from keyword-geo-score.ts)
// --------------------------------------------------------------------------

interface OperationalMetrics {
  spamLeadRate?: number | null;
  duplicateLeadRate?: number | null;
  dispatchSuccessRate?: number | null;
  cancellationRate?: number | null;
  missedCallRate?: number | null;
  refundProbability?: number | null;
}

function computeOperationalFactor(metrics: OperationalMetrics | null): {
  factor: number;
  dataAvailable: boolean;
} {
  if (!metrics) return { factor: 1.0, dataAvailable: false };

  const hasAny =
    metrics.spamLeadRate != null ||
    metrics.duplicateLeadRate != null ||
    metrics.dispatchSuccessRate != null ||
    metrics.cancellationRate != null ||
    metrics.missedCallRate != null ||
    metrics.refundProbability != null;

  if (!hasAny) return { factor: 1.0, dataAvailable: false };

  const spam     = metrics.spamLeadRate        ?? 0;
  const dup      = metrics.duplicateLeadRate   ?? 0;
  const dispatch = metrics.dispatchSuccessRate ?? 1;
  const cancel   = metrics.cancellationRate    ?? 0;
  const missed   = metrics.missedCallRate      ?? 0;
  const refund   = metrics.refundProbability   ?? 0;

  const factor =
    (1 - spam) * (1 - dup) * dispatch * (1 - cancel) * (1 - missed) * (1 - refund);

  return { factor: Math.max(0, Math.min(1, factor)), dataAvailable: true };
}

// --------------------------------------------------------------------------
// Profit model helpers  (from google-ads-opportunities.ts)
// --------------------------------------------------------------------------

const LOCKSMITH_DEFAULT_JOB_VALUE_GBP = 175;
const BASELINE_CONV_RATES = { LOW: 0.07, MEDIUM: 0.12, HIGH: 0.15, UNKNOWN: 0.10 };
type CompetitionTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

function locksmithCpcFloor(competitionIndex: number): number {
  if (competitionIndex >= 67) return 5.00;
  if (competitionIndex >= 34) return 2.80;
  if (competitionIndex > 0)   return 1.20;
  return 1.80;
}

function classifyTier(competitionIndex: number): CompetitionTier {
  if (competitionIndex >= 67) return "HIGH";
  if (competitionIndex >= 34) return "MEDIUM";
  if (competitionIndex > 0)   return "LOW";
  return "UNKNOWN";
}

function computeProfitPerClick(
  cpcGbp: number,
  competitionIndex: number,
  convRateOverride?: number,
): number {
  const tier = classifyTier(competitionIndex);
  const convRate = convRateOverride ?? BASELINE_CONV_RATES[tier];
  // Apply CPC floor: never use a CPC below the industry minimum for this tier.
  const effectiveCpc = Math.max(cpcGbp, locksmithCpcFloor(competitionIndex));
  return convRate * LOCKSMITH_DEFAULT_JOB_VALUE_GBP - effectiveCpc;
}

// ── DESCRIBE BLOCKS ────────────────────────────────────────────────────────

section("computeStabilityWeight — new keywords", () => {
  assert(
    computeStabilityWeight(0, []) === 0.25,
    "brand-new keyword with no history → 0.25",
  );
  assertCloseTo(
    computeStabilityWeight(0, [2.50]),
    0.25,
    0.001,
    "single scan, no volatility yet → 0.25",
  );
  assertCloseTo(
    computeStabilityWeight(2, [2.0, 2.5]),
    0.5625,
    0.02,
    "2 consecutive survival scans, stable history → ~0.56 (survivalWeight=0.625 × volDiscount≈0.90)",
  );
  assertCloseTo(
    computeStabilityWeight(4, [2.0, 2.1, 1.9, 2.2]),
    0.948,
    0.05,
    "4+ consecutive survival, stable history → ~0.95 (survivalWeight=1.0 × volDiscount≈0.95)",
  );
});

section("computeStabilityWeight — volatility discount", () => {
  // Wild variance: profits jumping from 0.5 → 8.0 (CV ≈ 0.91 → volDiscount ≈ 0.52)
  // survivalWeight=1.0, volDiscount=0.522 → weight ≈ 0.522
  const wildHistory = [0.5, 8.0, 0.3, 9.0];
  const wildWeight = computeStabilityWeight(4, wildHistory);
  assertLTE(wildWeight, 0.55, "wild history (CV≈0.91) gets discounted to ≈0.52 even with 4 survival scans");

  // Stable history
  const stableHistory = [2.0, 2.1, 2.0, 2.05, 1.95, 2.1];
  const stableWeight = computeStabilityWeight(4, stableHistory);
  assertGTE(stableWeight, 0.90, "stable history with 4 survival scans → ≥0.90");

  // January spike: 1 massive result, 3 normal ones
  const januaryHistory = [2.0, 15.0, 2.1, 1.9]; // huge spike in one scan
  const janWeight = computeStabilityWeight(3, januaryHistory);
  assertLTE(janWeight, 0.65, "january spike: high volatility should discount the weight");
});

section("computeStabilityWeight — floor & reset", () => {
  // Survival reset: after unprofitable scan, consecutiveSurvivalCount resets to 0
  const afterReset = computeStabilityWeight(0, [2.0, 2.1, 2.0, -0.5]); // last scan was loss
  assertCloseTo(afterReset, 0.25, 0.15, "after unprofitable scan (count=0), weight back to ~0.25");

  // Absolute floor: even worst case should not go below 0.05
  const floorTest = computeStabilityWeight(0, [0.01, 100, 0.01, 100]); // near-zero mean, massive CV
  assertGTE(floorTest, 0.05, "floor: weight never drops below 0.05");
});

section("computeOperationalFactor — well-run geo", () => {
  const metrics: OperationalMetrics = {
    spamLeadRate:        0.05,  // 5% spam
    duplicateLeadRate:   0.03,  // 3% dupes
    dispatchSuccessRate: 0.95,  // 95% dispatch
    cancellationRate:    0.04,  // 4% cancel
    missedCallRate:      0.06,  // 6% missed calls
    refundProbability:   0.02,  // 2% refunds
  };
  const { factor, dataAvailable } = computeOperationalFactor(metrics);
  assert(dataAvailable, "dataAvailable=true when metrics present");
  assertGTE(factor, 0.75, "well-run geo: factor ≥0.75");
  assertLTE(factor, 0.90, "well-run geo: factor ≤0.90 (some losses expected)");
});

section("computeOperationalFactor — disaster city", () => {
  const metrics: OperationalMetrics = {
    spamLeadRate:        0.35,  // 35% spam (low-quality traffic)
    duplicateLeadRate:   0.20,  // 20% duplicates
    dispatchSuccessRate: 0.60,  // only 60% dispatched
    cancellationRate:    0.15,  // 15% cancel
    missedCallRate:      0.20,  // 20% missed calls
    refundProbability:   0.08,  // 8% refunds
  };
  const { factor, dataAvailable } = computeOperationalFactor(metrics);
  assert(dataAvailable, "dataAvailable=true");
  assertLTE(factor, 0.25, "disaster city: factor ≤0.25 (heavy discounting)");
  assertGTE(factor, 0, "factor is non-negative");
});

section("computeOperationalFactor — no data (default)", () => {
  const { factor, dataAvailable } = computeOperationalFactor(null);
  assertEqual(factor, 1.0, "null metrics → factor=1.0 (optimistic default)");
  assertEqual(dataAvailable, false, "null metrics → dataAvailable=false");

  const empty = computeOperationalFactor({});
  assertEqual(empty.factor, 1.0, "empty metrics → factor=1.0");
  assertEqual(empty.dataAvailable, false, "empty metrics → dataAvailable=false");
});

section("profit model — CPC floor enforcement", () => {
  // CPC 0 with HIGH competition: floor should kick in at £5.00
  const zeroHighProfit = computeProfitPerClick(0, 80);
  // Should use floor £5.00: 0.15 × 175 - 5.00 = 26.25 - 5.00 = 21.25
  assertCloseTo(zeroHighProfit, 21.25, 0.01,
    "zero CPC + HIGH competition: floor £5.00 → profit = 0.15×175-5 = £21.25");

  const zeroMedProfit = computeProfitPerClick(0, 50);
  // MEDIUM floor £2.80: 0.12 × 175 - 2.80 = 21 - 2.80 = 18.20
  assertCloseTo(zeroMedProfit, 18.20, 0.01,
    "zero CPC + MEDIUM competition: floor £2.80 → profit = 0.12×175-2.80 = £18.20");

  const zeroLowProfit = computeProfitPerClick(0, 20);
  // LOW floor £1.20: 0.07 × 175 - 1.20 = 12.25 - 1.20 = 11.05
  assertCloseTo(zeroLowProfit, 11.05, 0.01,
    "zero CPC + LOW competition: floor £1.20 → profit = 0.07×175-1.20 = £11.05");
});

section("profit model — high-CPC city (Sheffield) vs cheap city", () => {
  // Sheffield: £5 CPC, HIGH competition, 15% conv → 0.15×175-5 = £21.25/click
  const sheffieldProfit = computeProfitPerClick(5.0, 80);
  assertCloseTo(sheffieldProfit, 21.25, 0.01, "Sheffield £5 CPC HIGH: profit = £21.25/click");

  // Cheap city: £1.50 CPC, LOW competition, 7% conv → 0.07×175-1.50 = £10.75/click
  const cheapProfit = computeProfitPerClick(1.50, 20);
  assertCloseTo(cheapProfit, 10.75, 0.01, "Cheap city £1.50 CPC LOW: profit = £10.75/click");

  // Sheffield at same volume should show higher monthly profit
  const sheffieldMonthly = sheffieldProfit * 100; // 100 searches
  const cheapMonthly     = cheapProfit     * 100;
  assert(sheffieldMonthly > cheapMonthly,
    "Sheffield monthly profit > cheap city at same volume (despite higher CPC)");
});

section("profit model — conv rate override", () => {
  // Real campaign data shows 18% conversion (better than 15% baseline).
  // CPC £4.00 is below the HIGH-competition floor of £5.00, so floor applies.
  // 0.18 × 175 - 5.00 = 31.50 - 5.00 = £26.50
  const withOverride = computeProfitPerClick(4.0, 80, 0.18);
  assertCloseTo(withOverride, 26.5, 0.01, "18% real conv rate, HIGH (floor £5) → £26.50/click profit");

  // With CPC above the floor (£5.50):
  const withOverrideAboveFloor = computeProfitPerClick(5.5, 80, 0.18);
  // 0.18 × 175 - 5.5 = 31.5 - 5.5 = 26.0
  assertCloseTo(withOverrideAboveFloor, 26.0, 0.01, "18% real conv rate, £5.50 CPC above floor → £26.00/click");

  // Poor performer: 6% actual (vs 12% MEDIUM baseline)
  const poorPerformer = computeProfitPerClick(3.0, 50, 0.06);
  // 0.06 × 175 - 3 = 10.5 - 3 = 7.5
  assertCloseTo(poorPerformer, 7.5, 0.01, "6% actual conv (vs 12% MEDIUM baseline) → £7.50/click");
});

section("profit model — negative profit (unprofitable keyword)", () => {
  // Super-expensive keyword: £15 CPC with only 15% conv = £26.25 revenue
  const loss = computeProfitPerClick(15.0, 80);
  // 0.15 × 175 - 15 = 26.25 - 15 = 11.25 (still positive — very high conv)
  assert(loss > 0, "£15 CPC HIGH competition still profitable due to 15% conv rate");

  // But with only LOW conv rate at £15: 0.07 × 175 - 15 = 12.25 - 15 = -2.75
  const definitelyLoss = computeProfitPerClick(15.0, 20);
  assert(definitelyLoss < 0, "£15 CPC LOW competition → negative profit (keyword should be filtered)");
});

section("BASELINE_CONV_RATES ordering invariant", () => {
  // HIGH intent must have higher conv than MEDIUM, which must beat LOW
  assert(BASELINE_CONV_RATES.HIGH > BASELINE_CONV_RATES.MEDIUM,
    "HIGH competition conv rate > MEDIUM");
  assert(BASELINE_CONV_RATES.MEDIUM > BASELINE_CONV_RATES.LOW,
    "MEDIUM competition conv rate > LOW");
  assert(BASELINE_CONV_RATES.LOW > 0,
    "LOW competition conv rate > 0");
  assert(BASELINE_CONV_RATES.UNKNOWN >= BASELINE_CONV_RATES.LOW &&
    BASELINE_CONV_RATES.UNKNOWN <= BASELINE_CONV_RATES.MEDIUM,
    "UNKNOWN conv rate between LOW and MEDIUM");
});

// ── Named Scenario Tests ────────────────────────────────────────────────────

section("Scenario 1 — January spike keyword should be discounted", () => {
  // A keyword that spikes in January (lockout after New Year parties)
  // but has inconsistent results the rest of the year.
  const januaryHistory = [1.5, 1.6, 15.0, 1.4]; // 1 huge spike (Jan)
  const survivalCount = 3; // survived 3 scans, but one was artificial spike

  const weight = computeStabilityWeight(survivalCount, januaryHistory);
  assertLTE(weight, 0.65, "January spike keyword: high volatility discounts stability weight");
  assertGTE(weight, 0.05, "Weight stays above floor (keyword not completely eliminated)");

  // Compare to stable keyword with same survival count
  const stableHistory = [1.5, 1.6, 1.4, 1.55];
  const stableWeight = computeStabilityWeight(survivalCount, stableHistory);

  assert(stableWeight > weight,
    "Stable keyword scores higher than spike keyword at same survival count");

  process.stdout.write(
    `     Spike weight: ${weight.toFixed(3)}, Stable weight: ${stableWeight.toFixed(3)}\n`,
  );
});

section("Scenario 2 — Geo contamination prevention", () => {
  // Sheffield: high-performing, 18% conv, many scans
  const sheffieldHistory = [22.0, 21.5, 22.5, 21.8, 22.2, 21.9, 22.1, 21.7];
  const sheffieldWeight = computeStabilityWeight(8, sheffieldHistory);

  // Exeter: same keyword, low volume, inconsistent results, only 2 scans
  const exeterHistory = [3.0, -1.0]; // first scan ok, second was unprofitable
  const exeterWeight = computeStabilityWeight(0, exeterHistory); // reset after loss

  // Sheffield should be rated much higher than Exeter
  assert(sheffieldWeight > exeterWeight * 2,
    "Sheffield stable keyword weight >> Exeter unstable weight (geo isolation works)");

  // If Exeter used Sheffield's global score instead of its own, it would be over-estimated
  const exeterFakeGlobal = sheffieldWeight; // what Exeter would get without isolation
  assert(exeterFakeGlobal > exeterWeight,
    "Without geo isolation, Exeter would inherit Sheffield's inflated weight");

  process.stdout.write(
    `     Sheffield weight: ${sheffieldWeight.toFixed(3)}, Exeter weight: ${exeterWeight.toFixed(3)}\n`,
  );
  process.stdout.write(
    `     Geo isolation prevents Exeter from inheriting Sheffield's ${(sheffieldWeight / exeterWeight).toFixed(1)}× higher weight\n`,
  );
});

section("Scenario 3 — Birmingham spam city", () => {
  // Birmingham: high search volume but terrible operational quality
  const birminghamMetrics: OperationalMetrics = {
    spamLeadRate:        0.40,  // 40% spam (competitor click fraud + bot traffic)
    duplicateLeadRate:   0.15,  // 15% duplicate leads from aggregators
    dispatchSuccessRate: 0.65,  // only 65% of jobs actually dispatched
    cancellationRate:    0.12,  // 12% customer cancellations
    missedCallRate:      0.18,  // 18% missed calls (understaffed)
    refundProbability:   0.05,  // 5% refunds
  };

  const { factor, dataAvailable } = computeOperationalFactor(birminghamMetrics);
  assert(dataAvailable, "Birmingham has operational data");
  // Factor = (1-0.40)×(1-0.15)×0.65×(1-0.12)×(1-0.18)×(1-0.05) ≈ 0.227
  assertLTE(factor, 0.25, "Birmingham spam city: operational factor ≤0.25 (severe discount)");
  assertGTE(factor, 0.15, "Birmingham factor is positive (not zero)");

  // Even if Birmingham shows 500 searches at £20 profit/click...
  const rawMonthlyProfit = 500 * 20; // £10,000 apparently
  const realMonthlyProfit = rawMonthlyProfit * factor;
  assertLTE(realMonthlyProfit, 2500,
    "Birmingham: raw £10k monthly profit deflated to ≤£2.5k after operational factor");

  process.stdout.write(
    `     Operational factor: ${factor.toFixed(3)}\n`,
  );
  process.stdout.write(
    `     Raw profit: £${rawMonthlyProfit.toLocaleString()}, Operational-adjusted: £${realMonthlyProfit.toFixed(0)}\n`,
  );
});

section("Scenario 4 — Hull after-hours gap (high-value opportunity)", () => {
  // Hull: medium CPC, decent volume, but 60% of searches are after 6pm
  // After-hours emergency locksmith is high-value (no competition + premium call out)

  const hullCpc = 2.50;
  const hullCompIdx = 45; // MEDIUM
  const hullProfit = computeProfitPerClick(hullCpc, hullCompIdx);
  // Hull CPC £2.50 < MEDIUM floor £2.80, so floor applies: 0.12 × 175 - 2.80 = £18.20
  assertCloseTo(hullProfit, 18.20, 0.01, "Hull MEDIUM (floor £2.80 overrides £2.50 CPC) → £18.20 profit/click");

  // After-hours boost: 1.25× multiplier (less competition, higher conv)
  const afterHoursBoost = 1.25;
  const afterHoursProfit = hullProfit * afterHoursBoost;
  // 18.20 × 1.25 = 22.75
  assertCloseTo(afterHoursProfit, 22.75, 0.01, "Hull after-hours: 1.25× boost → £22.75/click");

  // Hull operational metrics: well-run local franchise
  const hullMetrics: OperationalMetrics = {
    spamLeadRate:        0.05,
    duplicateLeadRate:   0.02,
    dispatchSuccessRate: 0.94,
    cancellationRate:    0.03,
    missedCallRate:      0.04,
    refundProbability:   0.01,
  };
  const { factor } = computeOperationalFactor(hullMetrics);
  assertGTE(factor, 0.80, "Hull well-run franchise: operational factor ≥0.80");

  const finalProfit = afterHoursProfit * factor;
  assertGTE(finalProfit, 18, "Hull final profit after operational factor still ≥£18/click");

  process.stdout.write(
    `     Profit/click: £${hullProfit.toFixed(2)}, after-hours: £${afterHoursProfit.toFixed(2)}, final: £${finalProfit.toFixed(2)}\n`,
  );
});

section("Scenario 5 — Truro first scan (new market, heavy discount)", () => {
  // Truro: we've never run ads here. First Planner scan shows 120 searches
  // at £1.80 CPC, LOW competition. Looks attractive — BUT:
  //   - No operational data → factor=1.0 (unverified)
  //   - First scan → stabilityWeight=0.25 (new keyword, heavily discounted)
  //   - This prevents us from betting big on an unproven market

  const truroCpc = 1.80;
  const truroCompIdx = 25; // LOW
  const truroProfit = computeProfitPerClick(truroCpc, truroCompIdx);
  // LOW floor £1.20, but actual CPC £1.80: 0.07 × 175 - 1.80 = 12.25 - 1.80 = 10.45
  assertCloseTo(truroProfit, 10.45, 0.01, "Truro LOW £1.80 CPC → £10.45 profit/click");

  // New keyword: 0 consecutive survival, no history
  const truroStability = computeStabilityWeight(0, []);
  assertCloseTo(truroStability, 0.25, 0.001, "First scan: stability weight = 0.25 (heavily discounted)");

  // Operational: no data yet
  const { factor: truroOpFactor, dataAvailable } = computeOperationalFactor(null);
  assertEqual(truroOpFactor, 1.0, "No operational data → factor=1.0");
  assertEqual(dataAvailable, false, "No operational data → dataAvailable=false (UI shows unverified)");

  // Effective profit is stability-discounted
  const effectiveProfit = truroProfit * truroStability;
  assertCloseTo(effectiveProfit, truroProfit * 0.25, 0.01,
    "Truro effective profit = raw × 0.25 (stability discount on first scan)");

  // Monthly: 120 searches × stability-adjusted profit
  const rawMonthly = 120 * truroProfit;
  const adjustedMonthly = 120 * effectiveProfit;
  assertLTE(adjustedMonthly, rawMonthly * 0.26,
    "Truro adjusted monthly profit is ~¼ of raw estimate (first scan discount prevents overconfidence)");

  process.stdout.write(
    `     Raw monthly: £${rawMonthly.toFixed(0)}, Stability-adjusted: £${adjustedMonthly.toFixed(0)} (${(adjustedMonthly / rawMonthly * 100).toFixed(0)}% of raw)\n`,
  );
  process.stdout.write(
    `     UI will show: ~ prefix (unverified op data) + 🆕 badge (first scan)\n`,
  );
});

section("Seed bank ranking — stable winner beats lucky spike", () => {
  // Keyword A: 6 consecutive survival scans, stable profits
  const stableEffective = computeStabilityWeight(6, [18.0, 18.5, 17.8, 18.2, 18.0, 18.3]) * 0.85;
  // (× 0.85 = Wilson score for 4 wins, 1 loss)

  // Keyword B: 1 win, 0 losses (Wilson score 0.75), only 1 scan
  const luckyEffective = computeStabilityWeight(1, [18.0]) * 0.75;

  assert(stableEffective > luckyEffective,
    "Stable keyword (6 scans, Wilson 0.85) outranks lucky spike (1 scan, Wilson 0.75)");

  process.stdout.write(
    `     Stable effective: ${stableEffective.toFixed(3)}, Lucky spike: ${luckyEffective.toFixed(3)}\n`,
  );
});

section("Seed bank ranking — volatile keyword discounted", () => {
  // Same Wilson score (0.80), but different volatility
  const wilsonScore = 0.80;

  const stableWeight   = computeStabilityWeight(4, [2.0, 2.1, 1.9, 2.05]);
  const volatileWeight = computeStabilityWeight(4, [0.5, 8.0, 0.3, 7.5]);

  const stableRank   = stableWeight   * wilsonScore;
  const volatileRank = volatileWeight * wilsonScore;

  assert(stableRank > volatileRank,
    "Stable keyword ranks higher than volatile keyword with identical Wilson score");

  process.stdout.write(
    `     Stable rank: ${stableRank.toFixed(3)}, Volatile rank: ${volatileRank.toFixed(3)}\n`,
  );
});

section("Edge cases", () => {
  // Empty history with high survival count (shouldn't happen but must not crash)
  const highSurvivalNoHistory = computeStabilityWeight(10, []);
  assertCloseTo(highSurvivalNoHistory, 1.0, 0.001,
    "10 survival scans, empty history → weight 1.0 (no volatility penalty)");

  // Single-element history (stddev = 0, volatility = 0)
  const singleHistory = computeStabilityWeight(3, [5.0]);
  assertGTE(singleHistory, 0.7, "3 survival scans, single reading → stable (volatility=0)");

  // Near-zero mean in history
  const nearZeroMean = computeStabilityWeight(2, [0.001, 0.002]);
  assertGTE(nearZeroMean, 0.05, "near-zero mean history: doesn't crash, stays above floor");

  // All-negative history (keyword was unprofitable, but count reset to 0 anyway)
  const allNegative = computeStabilityWeight(0, [-1.0, -2.0, -1.5]);
  assertCloseTo(allNegative, 0.25, 0.1,
    "all-negative history with 0 survival count → close to 0.25 (floor before vol discount)");

  // Operational factor with partial data (only spam rate known)
  const partialMetrics = computeOperationalFactor({ spamLeadRate: 0.50 });
  assertEqual(partialMetrics.dataAvailable, true, "partial metrics → dataAvailable=true");
  // factor = (1-0.5) × 1 × 1 × 1 × 1 × 1 = 0.5
  assertCloseTo(partialMetrics.factor, 0.50, 0.01,
    "only spam rate=50% known → factor=0.50 (other fields default to best-case)");
});

// ── Competitor Intelligence Tests ────────────────────────────────────────────
// Inline the pure functions from competitor-intel/agent.ts so we don't need
// Prisma or DB access. Tests cover: quality gate, cross-validation, geo factor.

// ── Inline quality gate (mirrors competitor-intel/agent.ts) ──────────────────

const CI_NEGATIVE_KEYWORDS = [
  "car locksmith", "automotive locksmith", "auto locksmith",
  "van locksmith", "motorbike lock", "scrap key",
];

const CI_RELEVANCE_RE =
  /\b(locksmith|locked out|lock change|lock replacement|door lock|upvc|lock repair|lock pick|key cutting|deadlock|mortice|barrel lock|lock cylinder|lock broken|burglary repair|door handle|lock fitting|lockout|emergency lock)\b/i;

const CI_NEGATIVE_SET = new Set(CI_NEGATIVE_KEYWORDS.map((k) => k.toLowerCase()));

function runQualityGate(
  keyword: string,
  cpcGbp: number,
  competitionIndex: number,
  isDualSource: boolean,
): { passes: boolean; reason?: string; profitPerClick?: number } {
  const norm = keyword.toLowerCase().trim();
  if (CI_NEGATIVE_SET.has(norm)) return { passes: false, reason: "negative_keyword" };
  if (!CI_RELEVANCE_RE.test(keyword))  return { passes: false, reason: "not_locksmith" };
  if (cpcGbp === 0 && isDualSource)    return { passes: true };
  const profit = computeProfitPerClick(cpcGbp, competitionIndex);
  if (profit <= 0) return { passes: false, reason: "unprofitable", profitPerClick: profit };
  return { passes: true, profitPerClick: profit };
}

// ── Inline mergeIntelKeywords (mirrors competitor-cross-validate.ts) ─────────
// Uses live SERP evidence + fingerprint evidence instead of SEMrush/SpyFu.

interface IntelKw {
  keyword: string; cpcGbp: number; monthlyClicks: number;
  competitionIndex: number; avgPosition: number;
  serpConfirmed: boolean; fingerprintConfirmed: boolean; dualConfirmed: boolean;
  geoCount: number; competitorCount: number; adCopyVariants: number;
  isEntering: boolean; isExiting: boolean;
  serpDomains: string[]; fingerprintDomains: string[];
}

// Simulated SERP result type (subset of SerpScanResult)
interface MockSerpResult {
  keyword: string;
  geo: string;
  ads: Array<{ domain: string; position: number; headline: string; description: string; displayUrl: string; sitelinks: string[] }>;
}

function mergeIntelKws(
  serpResults:  MockSerpResult[],
  fingerprints: Map<string, { titleKeywords: string[]; metaKeywords: string[]; h1Keywords: string[] }>,
): IntelKw[] {
  const norm = (k: string) => k.toLowerCase().trim();

  // Build SERP map: keyword → {domains, geos, positions, headlines}
  const serpMap = new Map<string, { domains: Set<string>; geos: Set<string>; positions: number[]; headlines: Set<string> }>();
  for (const r of serpResults) {
    const kn = norm(r.keyword);
    if (!serpMap.has(kn)) serpMap.set(kn, { domains: new Set(), geos: new Set(), positions: [], headlines: new Set() });
    const ev = serpMap.get(kn)!;
    ev.geos.add(r.geo);
    for (const ad of r.ads) {
      ev.domains.add(ad.domain);
      ev.positions.push(ad.position);
      if (ad.headline) ev.headlines.add(ad.headline);
    }
  }

  // Build fingerprint map: keyword → Set<domain>
  const fpMap = new Map<string, Set<string>>();
  for (const [domain, fp] of fingerprints) {
    const kws = new Set([...fp.titleKeywords, ...fp.metaKeywords, ...fp.h1Keywords]);
    for (const kw of kws) {
      const kn = norm(kw);
      if (!fpMap.has(kn)) fpMap.set(kn, new Set());
      fpMap.get(kn)!.add(domain);
    }
  }

  const allKws = new Set([...serpMap.keys(), ...fpMap.keys()]);
  const out: IntelKw[] = [];
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  for (const kn of allKws) {
    const serpEv = serpMap.get(kn);
    const fpDomains = fpMap.get(kn) ?? new Set<string>();
    const serpConfirmed = !!serpEv && serpEv.domains.size > 0;
    const fingerprintConfirmed = fpDomains.size > 0;
    const dualConfirmed = serpConfirmed && fingerprintConfirmed;
    const positions = serpEv?.positions ?? [];
    const avgPosition = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : 0;
    const originalKw = serpEv
      ? serpResults.find((r) => norm(r.keyword) === kn)?.keyword ?? kn
      : kn;
    out.push({
      keyword: originalKw, cpcGbp: 0, monthlyClicks: 0,
      competitionIndex: 0, avgPosition,
      serpConfirmed, fingerprintConfirmed, dualConfirmed,
      geoCount: serpEv?.geos.size ?? 0,
      competitorCount: serpEv?.domains.size ?? 0,
      adCopyVariants: serpEv?.headlines.size ?? 0,
      isEntering: true, isExiting: false, // defaults for test
      serpDomains: [...(serpEv?.domains ?? [])],
      fingerprintDomains: [...fpDomains],
    });
  }

  // Sort: dualConfirmed first, then by geoCount + competitorCount desc
  return out.sort((a, b) => {
    if (a.dualConfirmed !== b.dualConfirmed) return a.dualConfirmed ? -1 : 1;
    return (b.geoCount * 2 + b.competitorCount) - (a.geoCount * 2 + a.competitorCount);
  });
}

// ── Inline SERP HTML parsing (mirrors serp-intelligence-client.ts) ────────────

function extractDomainFromDisplayUrl(displayUrl: string): string {
  if (!displayUrl) return "";
  return displayUrl
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/›\\?#]/)[0]
    .trim()
    .toLowerCase();
}

function stripTagsInline(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function parseSerpAds(html: string): Array<{ domain: string; position: number; headline: string }> {
  const ads: Array<{ domain: string; position: number; headline: string }> = [];

  // Strategy: find data-text-ad markers first, else fall back to Sponsored text
  const dataTextAdRe = /(<div[^>]+data-text-ad[^>]*>)/gi;
  const dataMatches  = [...html.matchAll(dataTextAdRe)];

  const blocks: string[] = dataMatches.length > 0
    ? dataMatches.map((m) => html.slice(m.index ?? 0, (m.index ?? 0) + 4_000))
    : [];

  if (blocks.length === 0) {
    // Use indexOf to avoid zero-width lookahead infinite loop with exec+g flag
    const htmlLower = html.toLowerCase();
    const seen = new Set<string>();
    let pos = 0;
    while (true) {
      pos = htmlLower.indexOf("sponsored", pos);
      if (pos === -1) break;
      const start = Math.max(0, pos - 500);
      const chunk = html.slice(start, start + 4_000);
      const key   = chunk.slice(0, 80);
      if (!seen.has(key)) { seen.add(key); blocks.push(chunk); }
      pos += 9; // advance past "sponsored"
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // Extract h3 headline
    const h3m    = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block);
    const headline = h3m ? stripTagsInline(h3m[1]) : "";
    // Extract display URL from cite
    const citem   = /<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(block);
    const displayUrl = citem ? stripTagsInline(citem[1]) : "";
    const domain  = extractDomainFromDisplayUrl(displayUrl);
    if (headline || domain) {
      ads.push({ domain, position: i + 1, headline });
    }
  }
  return ads;
}

// ── Inline fingerprint pure functions (mirrors competitor-fingerprint.ts) ─────

function detectPpcTrackingInline(html: string): boolean {
  return /callrail|whatconverts|calltracking|phonexa|ringba|invoca/i.test(html);
}

function extractGoogleAdsIdsInline(html: string): string[] {
  const matches = html.match(/AW-\d{7,12}/g) ?? [];
  return [...new Set(matches)];
}

function detectMlaInline(html: string): boolean {
  return /master\s+locksmiths?\s+association|MLA\s+approved|MLA\s+member/i.test(html);
}

function extractPriceAnchorsInline(text: string): string[] {
  const priceRe = /(?:from\s+)?£\s*\d+(?:\.\d{2})?(?:\s*(?:call[-\s]?out|per\s+job))?/gi;
  return [...new Set((text.match(priceRe) ?? []).map((p) => p.trim()))];
}

function lowestGbpInline(anchors: string[]): number | null {
  const values = anchors.map((a) => parseFloat(a.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n) && n > 0);
  return values.length > 0 ? Math.min(...values) : null;
}

// ── Inline getCompetitorGeoFactor (pure logic, no DB) ────────────────────────

function competitorGeoFactor(
  signals: Array<{ trend: string; presenceScore: number }>,
): { factor: number; entryCount: number; exitCount: number } {
  const entryCount = signals.filter((s) => s.trend === "ENTERING" || s.trend === "NEW").length;
  const exitCount  = signals.filter((s) => s.trend === "EXITING").length;
  const factor = Math.max(0.5, Math.min(1.5, 1.0 + exitCount * 0.08 - entryCount * 0.05));
  return { factor, entryCount, exitCount };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

section("Quality gate — locksmith relevance filter", () => {
  // Passes: clear service intent
  assert(runQualityGate("emergency locksmith", 3.0, 70, false).passes,
    "emergency locksmith → passes relevance");
  assert(runQualityGate("locked out of house", 2.5, 50, false).passes,
    "locked out of house → passes relevance");
  assert(runQualityGate("upvc lock repair", 2.0, 40, false).passes,
    "upvc lock repair → passes relevance");
  assert(runQualityGate("deadlock fitting", 1.5, 30, false).passes,
    "deadlock fitting → passes relevance");

  // Fails: negative keywords
  assertEqual(runQualityGate("car locksmith", 2.0, 50, false).reason, "negative_keyword",
    "car locksmith → negative_keyword");

  // Fails: not locksmith service intent
  assertEqual(runQualityGate("door painting service", 1.0, 20, false).reason, "not_locksmith",
    "door painting → not_locksmith");
  assertEqual(runQualityGate("window cleaning", 1.0, 20, false).reason, "not_locksmith",
    "window cleaning → not_locksmith");
});

section("Quality gate — profitability check", () => {
  // Profitable: £3 CPC HIGH → floor £5 but still 0.15×175-5=£21.25
  const highProfit = runQualityGate("emergency locksmith", 3.0, 80, false);
  assert(highProfit.passes, "HIGH competition, reasonable CPC → profitable");
  assertGTE(highProfit.profitPerClick!, 20, "profit/click ≥ £20");

  // Unprofitable: very high CPC, low conv rate territory
  const loss = runQualityGate("locksmith near me", 16.0, 20, false);
  assertEqual(loss.passes, false, "£16 CPC LOW competition → fails profitability");
  assertEqual(loss.reason, "unprofitable", "reason = unprofitable");
  assert((loss.profitPerClick ?? 0) < 0, "profit/click is negative");

  // Dual-source with unknown CPC (0) → bypass profitability, use on next Planner run
  const dualUnknownCpc = runQualityGate("lock change sheffield", 0, 0, true);
  assert(dualUnknownCpc.passes,
    "dual-source + unknown CPC → passes gate (will price via Planner)");
});

section("SERP parsing — display URL domain extraction", () => {
  assertEqual(extractDomainFromDisplayUrl("www.lockforce.co.uk/emergency"),
    "lockforce.co.uk", "strips www + path");
  assertEqual(extractDomainFromDisplayUrl("https://emergencylocksmith.co.uk › london"),
    "emergencylocksmith.co.uk", "strips https + breadcrumb");
  assertEqual(extractDomainFromDisplayUrl("local-heroes.co.uk"),
    "local-heroes.co.uk", "bare domain unchanged");
  assertEqual(extractDomainFromDisplayUrl(""),
    "", "empty string → empty string");
  assertEqual(extractDomainFromDisplayUrl("CHECKATRADE.COM/Find"),
    "checkatrade.com", "uppercase normalised to lowercase");
});

section("SERP parsing — ad extraction from fixture HTML", () => {
  // Minimal realistic Google SERP fixture with two sponsored ads
  const fixtureHtml = `
    <div data-text-ad="1">
      <h3 class="ad-title">Emergency Locksmith London | 24/7 Service</h3>
      <cite>www.lockforce.co.uk › emergency › london</cite>
      <p>Fast response emergency locksmiths. Call now for immediate help. No call-out fee.</p>
      Sponsored
    </div>
    <div data-text-ad="1">
      <h3 class="ad-title">Locked Out? We Can Help | Local Heroes Locksmiths</h3>
      <cite>local-heroes.co.uk › locksmith</cite>
      <p>Vetted local locksmiths available now. Book online or call 24/7.</p>
      Sponsored
    </div>
    <div class="organic-result">
      <h3>Best Locksmiths in London — Which?</h3>
      <cite>www.which.co.uk › locksmiths</cite>
    </div>
  `;

  const ads = parseSerpAds(fixtureHtml);
  assertGTE(ads.length, 2, "Fixture HTML: at least 2 sponsored ads extracted");
  assertEqual(ads[0].domain, "lockforce.co.uk", "First ad domain: lockforce.co.uk");
  assert(ads[0].headline.includes("Emergency"), "First ad headline contains 'Emergency'");
  assertEqual(ads[1].domain, "local-heroes.co.uk", "Second ad domain: local-heroes.co.uk");
  assertEqual(ads[0].position, 1, "First ad position = 1");
  assertEqual(ads[1].position, 2, "Second ad position = 2");
});

section("SERP parsing — Sponsored text fallback (no data-text-ad)", () => {
  // Simulate HTML where data-text-ad is absent — falls back to Sponsored text scan
  const fallbackHtml = `
    <div class="some-container">
      Sponsored
      <h3>Locksmith Near You | 24hr Service</h3>
      <cite>locksmiths.co.uk › near-me</cite>
      <p>Expert locksmiths available around the clock. Fast, affordable lock services.</p>
    </div>
    <div class="another-ad">
      Sponsored
      <h3>Lock Change Specialists | Emergency Lockout Help</h3>
      <cite>emergencylocksmith.co.uk › lockout</cite>
    </div>
  `;
  const ads = parseSerpAds(fallbackHtml);
  assertGTE(ads.length, 1, "Sponsored-text fallback: at least 1 ad extracted");
  assert(ads.some((a) => a.domain.includes("locksmith")),
    "At least one ad domain contains 'locksmith'");
});

section("Fingerprint parsing — PPC tracking detection", () => {
  assert(detectPpcTrackingInline('<script src="https://callrail.com/track.js"></script>'),
    "CallRail script → hasPpcTracking=true");
  assert(detectPpcTrackingInline('whatconverts tracking pixel'),
    "WhatConverts mention → hasPpcTracking=true");
  assert(detectPpcTrackingInline('ringba call tracking enabled'),
    "Ringba mention → hasPpcTracking=true");
  assert(!detectPpcTrackingInline('<script src="https://cdnjs.cloudflare.com/jquery.min.js"></script>'),
    "Plain CDN script → hasPpcTracking=false");
  assert(!detectPpcTrackingInline('We have 24/7 locksmith services available.'),
    "Plain content → hasPpcTracking=false");
});

section("Fingerprint parsing — Google Ads ID extraction", () => {
  const html = `gtag('config', 'AW-123456789'); gtag('config', 'AW-987654321');`;
  const ids = extractGoogleAdsIdsInline(html);
  assertEqual(ids.length, 2, "Extracts both AW- IDs from script");
  assert(ids.includes("AW-123456789"), "AW-123456789 extracted");
  assert(ids.includes("AW-987654321"), "AW-987654321 extracted");
  assertEqual(extractGoogleAdsIdsInline("no ads here").length, 0,
    "No AW- IDs → empty array");
});

section("Fingerprint parsing — MLA detection", () => {
  assert(detectMlaInline("We are MLA approved locksmiths in London."),
    "MLA approved → isMlaApproved=true");
  assert(detectMlaInline("Member of the Master Locksmiths Association"),
    "Master Locksmiths Association → isMlaApproved=true");
  assert(!detectMlaInline("We are DBS checked and police vetted"),
    "DBS only → isMlaApproved=false");
});

section("Fingerprint parsing — price anchor extraction", () => {
  const text = "Our emergency locksmith service starts from £49. Standard lock change from £65. Call-out £25 call-out fee.";
  const anchors = extractPriceAnchorsInline(text);
  assertGTE(anchors.length, 2, "At least 2 price anchors extracted");
  assert(anchors.some((a) => a.includes("49")), "£49 anchor extracted");
  const lowest = lowestGbpInline(anchors);
  assert(lowest !== null && lowest <= 49, "Lowest price anchor ≤ £49");
  assertEqual(lowestGbpInline([]), null, "Empty anchors → lowestGbp=null");
});

section("Intel keyword merge — dualConfirmed detection", () => {
  // SERP: lockforce.co.uk appears for "emergency locksmith" in london + manchester
  const serpResults: MockSerpResult[] = [
    {
      keyword: "emergency locksmith", geo: "london",
      ads: [
        { domain: "lockforce.co.uk", position: 1, headline: "Emergency Locksmith London", description: "", displayUrl: "lockforce.co.uk", sitelinks: [] },
        { domain: "local-heroes.co.uk", position: 2, headline: "Local Heroes", description: "", displayUrl: "local-heroes.co.uk", sitelinks: [] },
      ],
    },
    {
      keyword: "emergency locksmith", geo: "manchester",
      ads: [
        { domain: "lockforce.co.uk", position: 1, headline: "Emergency Locksmith Manchester", description: "", displayUrl: "lockforce.co.uk", sitelinks: [] },
      ],
    },
    {
      keyword: "lock change", geo: "london",
      ads: [
        { domain: "lockforce.co.uk", position: 2, headline: "Lock Change Service", description: "", displayUrl: "lockforce.co.uk", sitelinks: [] },
      ],
    },
  ];

  // Fingerprint: lockforce.co.uk has the phrase "emergency locksmith" in its signals.
  // In production the tokeniser splits words, but here we test the merge logic
  // directly by supplying phrase-level entries that the normaliser will match.
  const fingerprints = new Map([
    ["lockforce.co.uk", {
      titleKeywords: ["emergency locksmith", "24hr locksmith"],
      metaKeywords:  ["locksmith london", "emergency locksmith"],
      h1Keywords:    ["emergency locksmith"],
    }],
  ]);

  const merged = mergeIntelKws(serpResults, fingerprints);

  const emergencyKw = merged.find((k) => k.keyword === "emergency locksmith");
  const lockChangeKw = merged.find((k) => k.keyword === "lock change");

  assert(!!emergencyKw, "emergency locksmith keyword found in merged list");
  assert(emergencyKw!.serpConfirmed,       "emergency locksmith: serpConfirmed=true");
  assert(emergencyKw!.fingerprintConfirmed, "emergency locksmith: fingerprintConfirmed=true (in title)");
  assert(emergencyKw!.dualConfirmed,       "emergency locksmith: dualConfirmed=true");
  assertEqual(emergencyKw!.geoCount, 2,    "emergency locksmith seen in 2 geos (london + manchester)");
  assertEqual(emergencyKw!.competitorCount, 2, "emergency locksmith: 2 competitor domains");

  // lock change: SERP only (not in fingerprint title/meta/h1)
  if (lockChangeKw) {
    assert(lockChangeKw.serpConfirmed, "lock change: serpConfirmed=true");
    assert(!lockChangeKw.dualConfirmed, "lock change: dualConfirmed=false (no fingerprint match)");
  }

  // dualConfirmed sort first
  assert(merged[0].dualConfirmed, "Dual-confirmed keywords sort first");

  process.stdout.write(
    `     Merged: ${merged.length} keywords, ${merged.filter(k => k.dualConfirmed).length} dual-confirmed\n`,
  );
});

section("Intel keyword merge — multi-domain detection", () => {
  const serpResults: MockSerpResult[] = [
    {
      keyword: "24 hour locksmith", geo: "london",
      ads: [
        { domain: "lockforce.co.uk",           position: 1, headline: "24hr Locksmith", description: "", displayUrl: "lockforce.co.uk", sitelinks: [] },
        { domain: "emergencylocksmith.co.uk",  position: 2, headline: "24hr Emergency", description: "", displayUrl: "emergencylocksmith.co.uk", sitelinks: [] },
        { domain: "locksmiths.co.uk",          position: 3, headline: "Find a Locksmith", description: "", displayUrl: "locksmiths.co.uk", sitelinks: [] },
      ],
    },
  ];
  const merged = mergeIntelKws(serpResults, new Map());
  const kwEntry = merged.find((k) => k.keyword === "24 hour locksmith");
  assertEqual(kwEntry?.competitorCount, 3, "3 competitors fighting over '24 hour locksmith'");
  assertEqual(kwEntry?.geoCount, 1, "Seen in 1 geo");
  assert(!kwEntry?.dualConfirmed, "No fingerprint → dualConfirmed=false");
});

section("Competitor geo factor — exit boost", () => {
  // Two competitors exiting Sheffield → reduced auction pressure
  const sheffieldSignals = [
    { trend: "EXITING",  presenceScore: 0.3 },
    { trend: "EXITING",  presenceScore: 0.2 },
    { trend: "STABLE",   presenceScore: 0.5 },
  ];
  const { factor, exitCount, entryCount } = competitorGeoFactor(sheffieldSignals);
  assertEqual(exitCount, 2, "Sheffield: 2 competitors exiting");
  assertEqual(entryCount, 0, "Sheffield: 0 competitors entering");
  // factor = 1.0 + 2×0.08 - 0 = 1.16
  assertCloseTo(factor, 1.16, 0.01, "Sheffield exit factor = 1.16 (+16% boost)");
  assertGTE(factor, 1.0, "Exit factor is > 1.0 (geo becomes more attractive)");

  process.stdout.write(`     Sheffield geo factor: ${factor.toFixed(3)} (exit boost)\n`);
});

section("Competitor geo factor — entry caution", () => {
  // National chain entering Exeter → more auction pressure
  const exeterSignals = [
    { trend: "ENTERING", presenceScore: 0.1 },
    { trend: "NEW",      presenceScore: 0.05 },
  ];
  const { factor, entryCount } = competitorGeoFactor(exeterSignals);
  assertEqual(entryCount, 2, "Exeter: 2 competitors entering/new");
  // factor = 1.0 + 0 - 2×0.05 = 0.90
  assertCloseTo(factor, 0.90, 0.01, "Exeter entry factor = 0.90 (-10% caution)");
  assertLTE(factor, 1.0, "Entry factor is < 1.0 (geo becomes less attractive)");
});

section("Competitor geo factor — no signals (graceful default)", () => {
  const { factor, entryCount, exitCount } = competitorGeoFactor([]);
  assertEqual(factor, 1.0, "No signals → factor=1.0 (no adjustment)");
  assertEqual(entryCount, 0, "No signals → entryCount=0");
  assertEqual(exitCount,  0, "No signals → exitCount=0");
});

section("Competitor geo factor — clamped to [0.5, 1.5]", () => {
  // Extreme: 10 competitors all entering
  const extremeEntry = Array(10).fill({ trend: "ENTERING", presenceScore: 0.8 });
  const { factor: fMin } = competitorGeoFactor(extremeEntry);
  assertGTE(fMin, 0.5, "Factor clamped at minimum 0.5 even with 10 competitors entering");

  // Extreme: 10 competitors all exiting
  const extremeExit = Array(10).fill({ trend: "EXITING", presenceScore: 0.3 });
  const { factor: fMax } = competitorGeoFactor(extremeExit);
  assertLTE(fMax, 1.5, "Factor clamped at maximum 1.5 even with 10 competitors exiting");
});

section("Integration — dual-source seed passes full quality gate", () => {
  // A keyword confirmed by both SEMrush AND SpyFu with unknown CPC
  // should pass the quality gate and be eligible for seed graduation.
  const testCases = [
    { keyword: "locksmith sheffield", cpcGbp: 0,   competitionIndex: 0,  dual: true,  expectPass: true  },
    { keyword: "emergency locksmith", cpcGbp: 4.5, competitionIndex: 70, dual: true,  expectPass: true  },
    { keyword: "emergency locksmith", cpcGbp: 4.5, competitionIndex: 70, dual: false, expectPass: true  },
    { keyword: "car locksmith",       cpcGbp: 3.0, competitionIndex: 60, dual: true,  expectPass: false }, // negative kw
    { keyword: "door painting",       cpcGbp: 1.0, competitionIndex: 20, dual: false, expectPass: false }, // not locksmith
    { keyword: "lock change",         cpcGbp: 18,  competitionIndex: 20, dual: false, expectPass: false }, // unprofitable
  ];

  for (const tc of testCases) {
    const result = runQualityGate(tc.keyword, tc.cpcGbp, tc.competitionIndex, tc.dual);
    assertEqual(result.passes, tc.expectPass,
      `"${tc.keyword}" (dual=${tc.dual}, cpc=£${tc.cpcGbp}) → passes=${tc.expectPass}`);
  }
});

section("Scenario 6 — Lockforce exiting Hull + Sheffield (opportunity opens)", () => {
  // If Lockforce (the largest national franchise) is pulling back from two
  // northern cities, it signals lower auction competition → better ROI.
  const hullSignals = [
    { trend: "EXITING",  presenceScore: 0.4 }, // Lockforce
    { trend: "STABLE",   presenceScore: 0.2 }, // Local Heroes (staying)
  ];
  const sheffieldSignals = [
    { trend: "EXITING",  presenceScore: 0.5 }, // Lockforce
    { trend: "ENTERING", presenceScore: 0.1 }, // New regional entrant
  ];

  const hullGeo      = competitorGeoFactor(hullSignals);
  const sheffieldGeo = competitorGeoFactor(sheffieldSignals);

  assertGTE(hullGeo.factor, 1.0, "Hull: Lockforce exit → geo becomes more attractive");
  // Sheffield: 1 exit + 1 entry = 1.0 + 0.08 - 0.05 = 1.03
  assertGTE(sheffieldGeo.factor, 1.0,
    "Sheffield: exit > entry → still net positive despite new entrant");

  // Hull is more attractive than Sheffield (pure exit vs mixed signal)
  assert(hullGeo.factor > sheffieldGeo.factor,
    "Hull (pure exit) more attractive than Sheffield (mixed exit+entry)");

  // Combined with Hull's after-hours profit of £22.75/click (from Scenario 4):
  const hullProfit       = computeProfitPerClick(2.50, 45); // 18.20
  const afterHoursProfit = hullProfit * 1.25;               // 22.75
  const finalWithGeo     = afterHoursProfit * hullGeo.factor;
  assertGTE(finalWithGeo, 22.75, "Hull with Lockforce exit: profit ≥ base after-hours profit");

  process.stdout.write(
    `     Hull geo factor: ${hullGeo.factor.toFixed(3)}, Sheffield: ${sheffieldGeo.factor.toFixed(3)}\n`,
  );
  process.stdout.write(
    `     Hull final profit: £${finalWithGeo.toFixed(2)}/click (after-hours + competitor exit)\n`,
  );
});

// ── Summary ─────────────────────────────────────────────────────────────────

process.stdout.write("\n" + "─".repeat(60) + "\n");
process.stdout.write(`\n📊 Results: ${passed + failed} tests — `);
if (failed === 0) {
  process.stdout.write(`✅ ALL ${passed} PASSED\n\n`);
} else {
  process.stdout.write(`✅ ${passed} passed, ❌ ${failed} failed\n\n`);
  process.stdout.write("Failed tests:\n");
  failures.forEach((f) => process.stdout.write(`  ✗ ${f}\n`));
  process.stdout.write("\n");
  process.exit(1);
}
