/**
 * Per-family budget caps for the keyword discovery engine.
 *
 * Pure config + helpers. No DB, no clock — testable and auditable.
 *
 * WHY PER-FAMILY CAPS
 * ───────────────────
 * Every family has a different economics profile:
 *
 *   postcode_local       hyper-local emergency → highest phone-call conv,
 *                        sharks underbid here, low-mid CPC, scales widely
 *   trust_signal         informed buyers; small audience but very sticky,
 *                        slightly lower CPC ceiling (less competitive)
 *   service_long_tail    planned work; lower urgency → lower call rate,
 *                        web-bookable → cheaper conv if we have a great
 *                        booking flow, but riskier on phone-only campaigns
 *   b2b_specialist       landlord/commercial; small absolute volume but
 *                        much higher LTV (repeat customers)
 *   research_intent      "best locksmith review" — almost never a phone
 *                        call. Should run with tiny budget if at all.
 *   negative             never spend; if these slip through, we lose money
 *
 * The cap structure enforces three things ops cares about:
 *
 *   1. NEVER overspend on a single campaign in a low-intent family
 *   2. NEVER bid above a known CPC ceiling per family (anti-shark hook)
 *   3. Predictable total spend even when many drafts are auto-generated
 *
 * Caps are RUN-TIME ADJUSTABLE via env var overrides; defaults below are
 * sized for the initial £500-£2000/week opening budget. Ops can raise
 * them once the data justifies it.
 */

import type { SeedCategory } from "@/agents/core/seed-bank";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FamilyBudgetCap {
  /** Maximum DAILY spend (GBP) for any one campaign in this family. */
  dailyBudgetGbp: number;
  /** Maximum bid (GBP) — campaign-level ceiling, prevents overpayment. */
  maxCpcGbp:      number;
  /** Whether the opportunity scout may promote seeds from this family. */
  enabled:        boolean;
}

// ── Defaults ────────────────────────────────────────────────────────────────

/**
 * Default per-family caps. Tuned for an opening £500-£2000/week budget.
 *
 * The pattern:
 *   • postcode_local gets the highest per-campaign cap — it's the
 *     phone-call workhorse and we want it to scale freely
 *   • trust_signal sits just below — informed buyers convert well but
 *     the search volume per district is much lower
 *   • research_intent is throttled to a token amount — we don't want
 *     to fund a £/click race we'll lose to comparison-shopping content
 *   • negative is hard-zero; if it ever fires, fail loud, not silent
 *
 * These are PER CAMPAIGN per day. Total spend across N campaigns of the
 * same family is N × dailyBudgetGbp — the opportunity scout caps the
 * count of campaigns per family separately (Phase 2c).
 */
export const DEFAULT_FAMILY_CAPS: Record<string, FamilyBudgetCap> = {
  postcode_local:    { dailyBudgetGbp: 30, maxCpcGbp: 3.50, enabled: true  },
  trust_signal:      { dailyBudgetGbp: 20, maxCpcGbp: 2.80, enabled: true  },
  b2b_specialist:    { dailyBudgetGbp: 15, maxCpcGbp: 3.00, enabled: true  },
  service_long_tail: { dailyBudgetGbp: 15, maxCpcGbp: 2.00, enabled: true  },
  competitor:        { dailyBudgetGbp: 15, maxCpcGbp: 2.50, enabled: true  },
  baseline:          { dailyBudgetGbp: 12, maxCpcGbp: 2.00, enabled: true  },
  learned:           { dailyBudgetGbp: 12, maxCpcGbp: 2.00, enabled: true  },
  experimental:      { dailyBudgetGbp:  8, maxCpcGbp: 1.50, enabled: true  },
  research_intent:   { dailyBudgetGbp:  5, maxCpcGbp: 0.80, enabled: true  },
  negative:          { dailyBudgetGbp:  0, maxCpcGbp: 0.00, enabled: false },
};

/** Fallback when a category isn't recognised. Neutral, conservative. */
const UNKNOWN_FAMILY_CAP: FamilyBudgetCap = {
  dailyBudgetGbp: 10,
  maxCpcGbp:      1.50,
  enabled:        true,
};

// ── Env overrides ───────────────────────────────────────────────────────────

/**
 * Allow ops to override defaults without a code deploy. Env vars take the
 * form FAMILY_CAP_<FAMILY>_BUDGET / _CPC / _ENABLED (uppercased), e.g.:
 *
 *   FAMILY_CAP_POSTCODE_LOCAL_BUDGET=40
 *   FAMILY_CAP_RESEARCH_INTENT_ENABLED=false
 *
 * Invalid values silently fall back to the default — we never want a
 * typo'd env var to crash the scout. The parsed value is logged via the
 * returned `source` info in getCapForFamily().
 */
function readEnvOverride(family: string): Partial<FamilyBudgetCap> {
  const key       = family.toUpperCase();
  const budgetRaw = process.env[`FAMILY_CAP_${key}_BUDGET`];
  const cpcRaw    = process.env[`FAMILY_CAP_${key}_CPC`];
  const enabledRaw = process.env[`FAMILY_CAP_${key}_ENABLED`];

  const overrides: Partial<FamilyBudgetCap> = {};

  if (budgetRaw !== undefined) {
    const n = parseFloat(budgetRaw);
    if (Number.isFinite(n) && n >= 0) overrides.dailyBudgetGbp = n;
  }
  if (cpcRaw !== undefined) {
    const n = parseFloat(cpcRaw);
    if (Number.isFinite(n) && n >= 0) overrides.maxCpcGbp = n;
  }
  if (enabledRaw !== undefined) {
    overrides.enabled = enabledRaw.toLowerCase() === "true";
  }

  return overrides;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the effective budget cap for a family. Merges DEFAULT_FAMILY_CAPS
 * with any env overrides. Unknown families fall back to UNKNOWN_FAMILY_CAP.
 */
export function getCapForFamily(family: SeedCategory | string): FamilyBudgetCap {
  const base = DEFAULT_FAMILY_CAPS[family] ?? UNKNOWN_FAMILY_CAP;
  const override = readEnvOverride(String(family));
  return { ...base, ...override };
}

/**
 * Clamp a requested daily budget to the family's cap. Returns BOTH the
 * effective budget and an `audit` flag so the caller can log "the cap
 * was applied" without re-fetching the config.
 */
export function enforceBudgetCap(
  family:           SeedCategory | string,
  requestedGbpDay:  number,
): { effective: number; capped: boolean; cap: FamilyBudgetCap } {
  const cap = getCapForFamily(family);

  if (!cap.enabled) {
    // Disabled family → budget is zero regardless of what was requested
    return { effective: 0, capped: requestedGbpDay > 0, cap };
  }
  if (!Number.isFinite(requestedGbpDay) || requestedGbpDay < 0) {
    return { effective: 0, capped: false, cap };
  }

  const effective = Math.min(requestedGbpDay, cap.dailyBudgetGbp);
  return { effective, capped: effective < requestedGbpDay, cap };
}

/**
 * Clamp a requested max CPC to the family's ceiling. Same shape as
 * enforceBudgetCap. Use this when constructing AdGroupCriterion bids.
 */
export function enforceMaxCpc(
  family:        SeedCategory | string,
  requestedGbp:  number,
): { effective: number; capped: boolean; cap: FamilyBudgetCap } {
  const cap = getCapForFamily(family);

  if (!cap.enabled) {
    return { effective: 0, capped: requestedGbp > 0, cap };
  }
  if (!Number.isFinite(requestedGbp) || requestedGbp < 0) {
    return { effective: 0, capped: false, cap };
  }

  const effective = Math.min(requestedGbp, cap.maxCpcGbp);
  return { effective, capped: effective < requestedGbp, cap };
}

// ── Aggregate planner ───────────────────────────────────────────────────────

/**
 * Plan a total daily-spend distribution across N planned campaigns,
 * grouped by family. Used by Phase 2c when the campaign generator wants
 * to honour an overall budget without breaching any per-family cap.
 *
 * Algorithm:
 *   1. Each campaign is initially allocated min(totalBudget × share, cap).
 *      Share is uniform across campaigns of the same family.
 *   2. Any leftover budget (because some families hit their cap) is
 *      redistributed to families that didn't, proportionally.
 *   3. We do up to 5 passes; if the cap stack absorbs everything, the
 *      remainder is unallocated and returned in `surplus`.
 *
 * The result preserves the input order so callers can map back to
 * the original campaign list by index.
 */
export interface PlannedCampaign {
  family:        SeedCategory | string;
  /** Campaign identifier — purely for the caller's benefit, opaque to us. */
  ref:           string;
}

export interface AllocatedCampaign extends PlannedCampaign {
  dailyBudgetGbp: number;
  cappedAtFamily: boolean;
}

export interface AllocationPlan {
  totalAllocatedGbp: number;
  surplusGbp:        number;
  perCampaign:       AllocatedCampaign[];
}

export function planFamilyBudgetSplit(
  totalDailyGbp: number,
  campaigns:     PlannedCampaign[],
): AllocationPlan {
  if (campaigns.length === 0 || totalDailyGbp <= 0) {
    return {
      totalAllocatedGbp: 0,
      surplusGbp:        Math.max(0, totalDailyGbp),
      perCampaign:       campaigns.map((c) => ({
        ...c, dailyBudgetGbp: 0, cappedAtFamily: false,
      })),
    };
  }

  // Filter out disabled families up-front — they get £0 regardless.
  const allocations: AllocatedCampaign[] = campaigns.map((c) => {
    const cap = getCapForFamily(c.family);
    return {
      ...c,
      dailyBudgetGbp: 0,
      cappedAtFamily: !cap.enabled,
    };
  });

  const eligibleIdx = allocations
    .map((a, i) => (getCapForFamily(a.family).enabled ? i : -1))
    .filter((i) => i >= 0);

  if (eligibleIdx.length === 0) {
    return {
      totalAllocatedGbp: 0,
      surplusGbp:        totalDailyGbp,
      perCampaign:       allocations,
    };
  }

  let remaining = totalDailyGbp;
  const PASSES = 5;

  for (let pass = 0; pass < PASSES && remaining > 0.01; pass++) {
    // Indices that still have capacity headroom this pass
    const open = eligibleIdx.filter((i) => {
      const cap = getCapForFamily(allocations[i].family);
      return allocations[i].dailyBudgetGbp < cap.dailyBudgetGbp;
    });
    if (open.length === 0) break;

    const share = remaining / open.length;
    let distributed = 0;

    for (const i of open) {
      const cap = getCapForFamily(allocations[i].family);
      const headroom = cap.dailyBudgetGbp - allocations[i].dailyBudgetGbp;
      const take     = Math.min(share, headroom);
      allocations[i].dailyBudgetGbp += take;
      distributed += take;
      if (allocations[i].dailyBudgetGbp >= cap.dailyBudgetGbp - 0.001) {
        allocations[i].cappedAtFamily = true;
      }
    }

    remaining -= distributed;
    if (distributed < 0.01) break;  // no progress — bail
  }

  const totalAllocated = allocations.reduce((s, a) => s + a.dailyBudgetGbp, 0);
  return {
    totalAllocatedGbp: Math.round(totalAllocated * 100) / 100,
    surplusGbp:        Math.max(0, Math.round((totalDailyGbp - totalAllocated) * 100) / 100),
    perCampaign:       allocations.map((a) => ({
      ...a,
      dailyBudgetGbp: Math.round(a.dailyBudgetGbp * 100) / 100,
    })),
  };
}
