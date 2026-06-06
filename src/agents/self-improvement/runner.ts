/**
 * Self-improvement experiment runner — closes the loop:
 *   measure outcome → adjust (bounded hill-climb) → record → apply (if enforcing).
 *
 * SHADOW (default): records the suggested change but never alters live values.
 * ENFORCE (CONTROL_PLANE_SELFIMPROVE_ENFORCE=true): applies the change, so the
 * system tunes itself within the hard bounds, with automatic rollback on
 * regression (the adjuster reverts the last change when the metric worsens).
 */

import { adjustParameter } from "./adjuster";
import type { MetricProvider, ParameterStore } from "./ports";
import type { TunableParam } from "./parameters";

export async function isSelfImprovementEnforced(): Promise<boolean> {
  const { isSelfImproveEnforced } = await import("@/agents/control-plane/policy");
  return isSelfImproveEnforced();
}

export interface ParamRunResult {
  key: string;
  metric: string;
  action: string;
  fromValue: number;
  toValue: number;
  applied: boolean;
  metricBefore: number | null;
  metricAfter: number | null;
  reason: string;
}

export interface SelfImprovementReport {
  ranAt: string;
  enforce: boolean;
  results: ParamRunResult[];
}

export async function runSelfImprovement(
  deps: { metrics: MetricProvider; store: ParameterStore },
  opts: { enforce?: boolean } = {},
): Promise<SelfImprovementReport> {
  const enforce = opts.enforce ?? (await isSelfImprovementEnforced());
  const params = await deps.store.loadAll();
  const results: ParamRunResult[] = [];

  for (const sp of params) {
    const metricAfter = await deps.metrics.measure(sp.metric);

    // Can't measure the outcome → do nothing (never tune blind).
    if (metricAfter === null) {
      results.push({
        key: sp.key, metric: sp.metric, action: "hold", fromValue: sp.value, toValue: sp.value,
        applied: false, metricBefore: sp.lastMetric, metricAfter: null, reason: "Metric unavailable",
      });
      continue;
    }

    const param: TunableParam = {
      key: sp.key, value: sp.value, min: sp.min, max: sp.max, step: sp.step,
      betterWhen: sp.betterWhen, metric: sp.metric,
    };
    const adj = adjustParameter({ param, metricBefore: sp.lastMetric, metricAfter, lastDelta: sp.lastDelta });

    await deps.store.recordChange({
      key: sp.key, fromValue: sp.value, toValue: adj.nextValue, action: adj.action,
      reason: adj.reason, metricBefore: sp.lastMetric, metricAfter, shadow: !enforce,
    });

    const willApply = enforce && adj.delta !== 0;
    if (willApply) {
      await deps.store.apply(sp.key, adj.nextValue, adj.delta, metricAfter);
    } else {
      // Advance the baseline so the next comparison is meaningful.
      await deps.store.touchMetric(sp.key, metricAfter);
    }

    results.push({
      key: sp.key, metric: sp.metric, action: adj.action, fromValue: sp.value, toValue: adj.nextValue,
      applied: willApply, metricBefore: sp.lastMetric, metricAfter, reason: adj.reason,
    });
  }

  return { ranAt: new Date().toISOString(), enforce, results };
}
