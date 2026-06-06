/**
 * Tunable parameters for the self-improvement loop.
 *
 * Each parameter has HARD bounds. The adjuster (see ./adjuster) may only nudge a
 * value within [min, max] by `step`, optimising the named target metric. This is
 * what makes "self-improving" safe: the system can tune itself, but can never
 * leave the guardrails an engineer set.
 *
 * Values here are DEFAULTS/seeds; live values live in the TunableParameter table.
 */

export type MetricDirection = "higher" | "lower";

export interface TunableParam {
  key: string;
  value: number;
  min: number;
  max: number;
  /** Absolute step size per adjustment. */
  step: number;
  /** Whether a HIGHER or LOWER target metric is better. */
  betterWhen: MetricDirection;
  /** The outcome metric this parameter optimises (for traceability). */
  metric: string;
}

export const TUNABLE_PARAMETERS: Record<string, TunableParam> = {
  "dispatch.maxAutoDistanceMiles": {
    key: "dispatch.maxAutoDistanceMiles",
    value: 5,
    min: 3,
    max: 8,
    step: 0.5,
    betterWhen: "higher", // maximise completed-job rate
    metric: "job_completion_rate",
  },
  "dispatch.minMatchScore": {
    key: "dispatch.minMatchScore",
    value: 70,
    min: 60,
    max: 85,
    step: 2,
    betterWhen: "higher",
    metric: "job_completion_rate",
  },
  "alert.errorCooldownMinutes": {
    key: "alert.errorCooldownMinutes",
    value: 30,
    min: 15,
    max: 180,
    step: 15,
    betterWhen: "lower", // minimise dismissed-as-noise alert rate
    metric: "alert_noise_rate",
  },
};

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
