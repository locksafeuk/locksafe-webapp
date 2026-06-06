/**
 * Bounded hill-climb with rollback — the deterministic heart of self-improvement.
 *
 * Given a parameter's current value and how the target metric moved since the
 * last change, it proposes the next value:
 *   - no baseline / no prior change  → explore one step
 *   - last change improved the metric → continue in the same direction
 *   - last change worsened it         → roll back the last change
 *   - change within the noise band    → hold
 *
 * Always clamped to [min, max]. Pure and side-effect free, so it's fully testable
 * and can run in shadow (suggest + record) before changes are ever applied.
 */

import { clamp, type TunableParam } from "./parameters";

export interface AdjustInput {
  param: TunableParam;
  /** Target metric before the last change (null on first observation). */
  metricBefore: number | null;
  /** Target metric in the latest measurement window. */
  metricAfter: number;
  /** The change applied to `value` last time (+step / -step / 0). */
  lastDelta: number;
}

export type AdjustAction = "explore" | "continue" | "rollback" | "hold";

export interface AdjustResult {
  nextValue: number;
  /** nextValue - param.value (0 when holding). */
  delta: number;
  action: AdjustAction;
  reason: string;
}

export function adjustParameter(input: AdjustInput, epsilonPct = 0.01): AdjustResult {
  const { param, metricBefore, metricAfter, lastDelta } = input;
  const { value, min, max, step, betterWhen } = param;

  // First observation, or nothing changed last time → explore one step.
  if (metricBefore === null || lastDelta === 0) {
    const dir = value + step <= max ? step : value - step >= min ? -step : 0;
    const next = clamp(value + dir, min, max);
    return {
      nextValue: next,
      delta: next - value,
      action: dir === 0 ? "hold" : "explore",
      reason: dir === 0 ? "At bound — nothing to explore" : "No baseline — exploring one step",
    };
  }

  // Did the metric move beyond the noise band?
  const diff = metricAfter - metricBefore;
  const threshold = Math.abs(metricBefore) * epsilonPct;
  if (Math.abs(diff) <= threshold) {
    return { nextValue: value, delta: 0, action: "hold", reason: "Metric change within noise band" };
  }

  const improved = betterWhen === "higher" ? diff > 0 : diff < 0;

  if (improved) {
    const next = clamp(value + lastDelta, min, max);
    if (next === value) {
      return { nextValue: value, delta: 0, action: "hold", reason: "Improving but at bound" };
    }
    return { nextValue: next, delta: next - value, action: "continue", reason: "Last change improved the metric — continuing" };
  }

  // Worse → undo the last change.
  const next = clamp(value - lastDelta, min, max);
  return { nextValue: next, delta: next - value, action: "rollback", reason: "Last change worsened the metric — rolling back" };
}
