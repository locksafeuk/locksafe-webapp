/**
 * Per-family budget caps — unit tests.
 *
 * The cap module is the spending guardrail the Phase 2c campaign
 * generator depends on. Tests pin down:
 *
 *   • Default cap shape per family
 *   • Env var override semantics (typos must fall back to defaults)
 *   • enforceBudgetCap / enforceMaxCpc clamping behaviour
 *   • planFamilyBudgetSplit invariants:
 *     - total allocated ≤ requested
 *     - each campaign ≤ its family cap
 *     - surplus reported when caps absorb everything
 *     - deterministic across runs
 *
 * Env-override tests use jest.spyOn + delete to isolate from the
 * surrounding test environment.
 */

import {
  DEFAULT_FAMILY_CAPS,
  getCapForFamily,
  enforceBudgetCap,
  enforceMaxCpc,
  planFamilyBudgetSplit,
} from "@/lib/family-budget-caps";

// Snapshot env to restore after env-override tests
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Clean up any FAMILY_CAP_* env we touched
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("FAMILY_CAP_")) delete process.env[k];
  }
  // Restore anything we wiped out
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (k.startsWith("FAMILY_CAP_") && v !== undefined) process.env[k] = v;
  }
});

// ── Defaults shape ───────────────────────────────────────────────────────────

describe("DEFAULT_FAMILY_CAPS — invariants", () => {
  it("postcode_local has the highest per-campaign daily budget", () => {
    const pl = DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp;
    expect(pl).toBeGreaterThanOrEqual(DEFAULT_FAMILY_CAPS.trust_signal.dailyBudgetGbp);
    expect(pl).toBeGreaterThanOrEqual(DEFAULT_FAMILY_CAPS.service_long_tail.dailyBudgetGbp);
    expect(pl).toBeGreaterThanOrEqual(DEFAULT_FAMILY_CAPS.b2b_specialist.dailyBudgetGbp);
    expect(pl).toBeGreaterThanOrEqual(DEFAULT_FAMILY_CAPS.research_intent.dailyBudgetGbp);
  });

  it("negative is hard-disabled with zero budget", () => {
    expect(DEFAULT_FAMILY_CAPS.negative.enabled).toBe(false);
    expect(DEFAULT_FAMILY_CAPS.negative.dailyBudgetGbp).toBe(0);
    expect(DEFAULT_FAMILY_CAPS.negative.maxCpcGbp).toBe(0);
  });

  it("research_intent has the tightest CPC ceiling (we don't pay £/click for reviews)", () => {
    expect(DEFAULT_FAMILY_CAPS.research_intent.maxCpcGbp).toBeLessThanOrEqual(1.0);
    expect(DEFAULT_FAMILY_CAPS.research_intent.maxCpcGbp).toBeLessThan(
      DEFAULT_FAMILY_CAPS.postcode_local.maxCpcGbp,
    );
  });

  it("every default family is enabled (except negative)", () => {
    for (const [family, cap] of Object.entries(DEFAULT_FAMILY_CAPS)) {
      if (family === "negative") continue;
      expect(cap.enabled).toBe(true);
    }
  });
});

// ── getCapForFamily ─────────────────────────────────────────────────────────

describe("getCapForFamily", () => {
  it("returns the default cap for a known family", () => {
    expect(getCapForFamily("postcode_local")).toEqual(DEFAULT_FAMILY_CAPS.postcode_local);
  });

  it("falls back to the UNKNOWN cap for an unrecognised family", () => {
    const cap = getCapForFamily("alien-category");
    expect(cap.enabled).toBe(true);
    expect(cap.dailyBudgetGbp).toBeGreaterThan(0);
    // Conservative: unknown family must be lower than postcode_local
    expect(cap.dailyBudgetGbp).toBeLessThan(DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp);
  });

  it("applies env override on dailyBudgetGbp", () => {
    process.env.FAMILY_CAP_POSTCODE_LOCAL_BUDGET = "45";
    const cap = getCapForFamily("postcode_local");
    expect(cap.dailyBudgetGbp).toBe(45);
    // CPC unchanged
    expect(cap.maxCpcGbp).toBe(DEFAULT_FAMILY_CAPS.postcode_local.maxCpcGbp);
  });

  it("applies env override on maxCpcGbp", () => {
    process.env.FAMILY_CAP_TRUST_SIGNAL_CPC = "3.50";
    const cap = getCapForFamily("trust_signal");
    expect(cap.maxCpcGbp).toBe(3.50);
  });

  it("disables a family via env", () => {
    process.env.FAMILY_CAP_RESEARCH_INTENT_ENABLED = "false";
    const cap = getCapForFamily("research_intent");
    expect(cap.enabled).toBe(false);
  });

  it("ignores garbage env values (typo'd env never crashes)", () => {
    process.env.FAMILY_CAP_POSTCODE_LOCAL_BUDGET = "not-a-number";
    process.env.FAMILY_CAP_POSTCODE_LOCAL_CPC    = "🐟";
    const cap = getCapForFamily("postcode_local");
    expect(cap.dailyBudgetGbp).toBe(DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp);
    expect(cap.maxCpcGbp).toBe(DEFAULT_FAMILY_CAPS.postcode_local.maxCpcGbp);
  });

  it("ignores negative numeric env values", () => {
    process.env.FAMILY_CAP_POSTCODE_LOCAL_BUDGET = "-10";
    const cap = getCapForFamily("postcode_local");
    expect(cap.dailyBudgetGbp).toBe(DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp);
  });
});

// ── enforceBudgetCap ────────────────────────────────────────────────────────

describe("enforceBudgetCap", () => {
  it("clamps a request above the cap", () => {
    const r = enforceBudgetCap("postcode_local", 999);
    expect(r.effective).toBe(DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp);
    expect(r.capped).toBe(true);
  });

  it("leaves a request below the cap untouched", () => {
    const r = enforceBudgetCap("postcode_local", 10);
    expect(r.effective).toBe(10);
    expect(r.capped).toBe(false);
  });

  it("returns 0 for a disabled family even when budget was requested", () => {
    const r = enforceBudgetCap("negative", 50);
    expect(r.effective).toBe(0);
    expect(r.capped).toBe(true);
  });

  it("returns 0 for an invalid (non-finite or negative) request", () => {
    // Strict input contract: only finite, non-negative numbers are valid.
    // Infinity, NaN, -5 all return 0 — callers should never pass these
    // anyway, and silently clamping Infinity to the cap would hide bugs
    // upstream.
    expect(enforceBudgetCap("postcode_local", -5).effective).toBe(0);
    expect(enforceBudgetCap("postcode_local", Number.NaN).effective).toBe(0);
    expect(enforceBudgetCap("postcode_local", Infinity).effective).toBe(0);
    expect(enforceBudgetCap("postcode_local", -Infinity).effective).toBe(0);
  });
});

// ── enforceMaxCpc ───────────────────────────────────────────────────────────

describe("enforceMaxCpc", () => {
  it("clamps a CPC bid above the family ceiling", () => {
    const r = enforceMaxCpc("research_intent", 5.0);
    expect(r.effective).toBe(DEFAULT_FAMILY_CAPS.research_intent.maxCpcGbp);
    expect(r.capped).toBe(true);
  });

  it("leaves a bid below the ceiling untouched", () => {
    const r = enforceMaxCpc("postcode_local", 1.5);
    expect(r.effective).toBe(1.5);
    expect(r.capped).toBe(false);
  });

  it("returns 0 for a disabled family", () => {
    expect(enforceMaxCpc("negative", 1.0).effective).toBe(0);
  });
});

// ── planFamilyBudgetSplit ───────────────────────────────────────────────────

describe("planFamilyBudgetSplit — allocation invariants", () => {
  it("returns zero allocations when totalDailyGbp is 0", () => {
    const plan = planFamilyBudgetSplit(0, [
      { family: "postcode_local", ref: "a" },
      { family: "postcode_local", ref: "b" },
    ]);
    expect(plan.totalAllocatedGbp).toBe(0);
    expect(plan.perCampaign.every((c) => c.dailyBudgetGbp === 0)).toBe(true);
  });

  it("returns surplus when there are no eligible families", () => {
    const plan = planFamilyBudgetSplit(50, [
      { family: "negative", ref: "n1" },
      { family: "negative", ref: "n2" },
    ]);
    expect(plan.totalAllocatedGbp).toBe(0);
    expect(plan.surplusGbp).toBe(50);
    expect(plan.perCampaign.every((c) => c.dailyBudgetGbp === 0)).toBe(true);
    expect(plan.perCampaign.every((c) => c.cappedAtFamily)).toBe(true);
  });

  it("never allocates more than each campaign's family cap", () => {
    const plan = planFamilyBudgetSplit(500, [
      { family: "postcode_local",  ref: "p1" },
      { family: "research_intent", ref: "r1" },
    ]);
    expect(plan.perCampaign[0].dailyBudgetGbp).toBeLessThanOrEqual(
      DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp,
    );
    expect(plan.perCampaign[1].dailyBudgetGbp).toBeLessThanOrEqual(
      DEFAULT_FAMILY_CAPS.research_intent.dailyBudgetGbp,
    );
  });

  it("total allocation never exceeds the total budget", () => {
    const plan = planFamilyBudgetSplit(60, [
      { family: "postcode_local", ref: "p1" },
      { family: "postcode_local", ref: "p2" },
      { family: "trust_signal",   ref: "t1" },
    ]);
    expect(plan.totalAllocatedGbp).toBeLessThanOrEqual(60);
    expect(plan.totalAllocatedGbp + plan.surplusGbp).toBeCloseTo(
      Math.min(60, plan.totalAllocatedGbp + plan.surplusGbp),
    );
  });

  it("reports surplus when caps absorb the entire request", () => {
    // 2 research_intent campaigns × £5/day cap = £10/day max; £100 ask
    const plan = planFamilyBudgetSplit(100, [
      { family: "research_intent", ref: "r1" },
      { family: "research_intent", ref: "r2" },
    ]);
    expect(plan.totalAllocatedGbp).toBeLessThanOrEqual(
      2 * DEFAULT_FAMILY_CAPS.research_intent.dailyBudgetGbp,
    );
    expect(plan.surplusGbp).toBeGreaterThan(80);
  });

  it("marks campaigns as cappedAtFamily when they hit their ceiling", () => {
    const plan = planFamilyBudgetSplit(200, [
      { family: "research_intent", ref: "r1" },
    ]);
    expect(plan.perCampaign[0].cappedAtFamily).toBe(true);
    expect(plan.perCampaign[0].dailyBudgetGbp).toBe(
      DEFAULT_FAMILY_CAPS.research_intent.dailyBudgetGbp,
    );
  });

  it("is deterministic across runs (same input → same output)", () => {
    const input = [
      { family: "postcode_local" as const, ref: "p1" },
      { family: "trust_signal"   as const, ref: "t1" },
      { family: "service_long_tail" as const, ref: "s1" },
    ];
    const a = planFamilyBudgetSplit(80, input);
    const b = planFamilyBudgetSplit(80, input);
    expect(a).toEqual(b);
  });

  it("preserves input ordering in perCampaign", () => {
    const plan = planFamilyBudgetSplit(60, [
      { family: "trust_signal",   ref: "X" },
      { family: "postcode_local", ref: "Y" },
      { family: "b2b_specialist", ref: "Z" },
    ]);
    expect(plan.perCampaign.map((c) => c.ref)).toEqual(["X", "Y", "Z"]);
  });

  it("returns an empty plan for empty input", () => {
    const plan = planFamilyBudgetSplit(100, []);
    expect(plan.perCampaign).toEqual([]);
    expect(plan.totalAllocatedGbp).toBe(0);
    expect(plan.surplusGbp).toBe(100);
  });
});
