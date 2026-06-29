/**
 * Deterministic reflection verdict engine.
 *
 * Turns a graded AgentReflection (+ optional live Google Ads state) into a
 * single, plain-English recommendation an operator can act on WITHOUT any LLM:
 *
 *   CONTINUE        — working; keep running (and maybe scale)
 *   OPTIMISE        — under target but salvageable; tweak before more spend
 *   CHANGE_STRATEGY — confident loss / spend-with-no-conversions; rework or stop
 *   KEEP_WATCHING   — not enough data/confidence to act yet
 *   ARCHIVE         — campaign gone on Google's side; nothing to action
 *
 * Pure function — same inputs, same verdict. The narrative LLM (when it's
 * reachable) layers richer prose ON TOP of this; this is the floor that always
 * works, so the Reflections page is never blank.
 */

export type VerdictCode =
  | "CONTINUE"
  | "OPTIMISE"
  | "CHANGE_STRATEGY"
  | "KEEP_WATCHING"
  | "ARCHIVE";

export type VerdictTone = "green" | "amber" | "red" | "blue" | "grey";

export interface Verdict {
  code: VerdictCode;
  label: string;
  rationale: string;
  tone: VerdictTone;
}

export interface VerdictLiveState {
  label?: string | null; // SERVING | DORMANT | PAUSED | REMOVED | UNKNOWN
  spend?: number | null;
  conversions?: number | null;
  clicks?: number | null;
}

export interface VerdictInput {
  outcome: "WIN" | "LOSS" | "INCONCLUSIVE" | "NEUTRAL";
  metric: string;
  expectedValue: number | null;
  actualValue: number | null;
  confidence: number;
  windowDays: number;
  live?: VerdictLiveState | null;
}

const CONFIDENT = 0.6; // confidence floor at which we trust the grade enough to act

function gbp(n: number | null | undefined): string {
  if (n == null) return "£0";
  return `£${n >= 100 ? Math.round(n) : n.toFixed(2)}`;
}

/** Short, human phrasing of expected-vs-actual for the metric in play. */
function metricPhrase(i: VerdictInput): string {
  const { metric, expectedValue, actualValue } = i;
  const a = actualValue;
  const e = expectedValue;
  if (a == null || e == null) return "outcome not yet measurable";
  switch (metric) {
    case "spend_efficiency":
      return `${a.toFixed(2)} vs ${e.toFixed(2)} conversions per £100`;
    case "roas":
      return `ROAS ${a.toFixed(2)}× vs ${e.toFixed(2)}× target`;
    case "cpa":
      return `CPA ${gbp(a)} vs ${gbp(e)} target`;
    case "ctr":
      return `CTR ${(a * 100).toFixed(2)}% vs ${(e * 100).toFixed(2)}% target`;
    case "conversionRate":
      return `conv-rate ${(a * 100).toFixed(2)}% vs ${(e * 100).toFixed(2)}% target`;
    default:
      return `${a.toFixed(2)} vs ${e.toFixed(2)} expected`;
  }
}

export function computeVerdict(i: VerdictInput): Verdict {
  const live = i.live ?? null;
  const liveLabel = live?.label ?? null;
  const spend = live?.spend ?? null;
  const conv = live?.conversions ?? null;
  const conf = Number.isFinite(i.confidence) ? i.confidence : 0;
  const confPct = `${Math.round(conf * 100)}% confidence`;
  const phrase = metricPhrase(i);

  // 0. Campaign no longer exists on Google — nothing to action.
  if (liveLabel === "REMOVED") {
    return {
      code: "ARCHIVE",
      label: "Archive",
      tone: "grey",
      rationale: `Removed on Google Ads — no longer running. Keep the learning; nothing to action here.`,
    };
  }

  // 1. On target → keep running as-is.
  if (i.outcome === "NEUTRAL") {
    return {
      code: "CONTINUE",
      label: "Continue",
      tone: "green",
      rationale: `On target (${phrase}). Keep running as-is; no change needed.`,
    };
  }

  // 2. Beating target.
  if (i.outcome === "WIN") {
    if (conf >= CONFIDENT) {
      return {
        code: "CONTINUE",
        label: "Continue / scale",
        tone: "green",
        rationale: `Beating target (${phrase}, ${confPct}). Keep running — consider raising budget.`,
      };
    }
    return {
      code: "KEEP_WATCHING",
      label: "Keep watching",
      tone: "blue",
      rationale: `Ahead of target (${phrase}) but only ${confPct} — hold budget steady and gather more data before scaling.`,
    };
  }

  // 3. Missing target.
  if (i.outcome === "LOSS") {
    if (conf >= CONFIDENT) {
      const spentWithNoConv = (spend ?? 0) > 0 && (conv ?? 0) === 0;
      if (spentWithNoConv) {
        return {
          code: "CHANGE_STRATEGY",
          label: "Change strategy",
          tone: "red",
          rationale: `${gbp(spend)} spent over ${i.windowDays}d with 0 conversions (${phrase}). Targeting, landing page or offer isn't converting — rework it or pause spend.`,
        };
      }
      return {
        code: "OPTIMISE",
        label: "Optimise",
        tone: "amber",
        rationale: `Below target (${phrase}, ${confPct}). Tighten keywords, bids and negatives before spending more.`,
      };
    }
    return {
      code: "KEEP_WATCHING",
      label: "Keep watching",
      tone: "blue",
      rationale: `Behind target (${phrase}) but only ${confPct} — small sample, don't act on noise yet.`,
    };
  }

  // 4. Inconclusive — not enough data.
  return {
    code: "KEEP_WATCHING",
    label: "Keep watching",
    tone: "blue",
    rationale: `Not enough spend/data to judge yet (${confPct}). Let it run to reach a clear verdict.`,
  };
}
