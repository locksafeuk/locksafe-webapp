/**
 * Ports for the self-improvement experiment runner. Kept abstract so the runner
 * is pure orchestration, testable with in-memory adapters and backed by Prisma +
 * real metrics in production.
 */

import type { MetricDirection } from "./parameters";

export interface StoredParam {
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
  betterWhen: MetricDirection;
  metric: string;
  lastDelta: number;
  /** Metric value at the previous run — the hill-climb baseline. */
  lastMetric: number | null;
}

export interface ParameterChangeRecord {
  key: string;
  fromValue: number;
  toValue: number;
  action: string;
  reason: string;
  metricBefore: number | null;
  metricAfter: number;
  shadow: boolean;
}

/** Computes an outcome metric. Returns null when it cannot be measured (→ hold). */
export interface MetricProvider {
  measure(metric: string): Promise<number | null>;
}

export interface ParameterStore {
  /** Returns all tunable params (seeding defaults if missing). */
  loadAll(): Promise<StoredParam[]>;
  /** Apply a real change: new value + delta + new baseline metric. */
  apply(key: string, toValue: number, delta: number, lastMetric: number): Promise<void>;
  /** Shadow path: advance the baseline metric without changing the value. */
  touchMetric(key: string, lastMetric: number): Promise<void>;
  recordChange(rec: ParameterChangeRecord): Promise<void>;
}
