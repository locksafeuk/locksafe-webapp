/**
 * In-memory adapters for the self-improvement ports (tests + dry runs).
 */

import type { MetricProvider, ParameterChangeRecord, ParameterStore, StoredParam } from "../ports";
import { TUNABLE_PARAMETERS } from "../parameters";

export class InMemoryParameterStore implements ParameterStore {
  params: Map<string, StoredParam>;
  readonly changes: ParameterChangeRecord[] = [];

  constructor(seed?: StoredParam[]) {
    this.params = new Map();
    const initial = seed ?? Object.values(TUNABLE_PARAMETERS).map((p) => ({ ...p, lastDelta: 0, lastMetric: null }));
    for (const p of initial) this.params.set(p.key, { ...p });
  }

  async loadAll(): Promise<StoredParam[]> {
    return [...this.params.values()].map((p) => ({ ...p }));
  }
  async apply(key: string, toValue: number, delta: number, lastMetric: number): Promise<void> {
    const p = this.params.get(key);
    if (p) {
      p.value = toValue;
      p.lastDelta = delta;
      p.lastMetric = lastMetric;
    }
  }
  async touchMetric(key: string, lastMetric: number): Promise<void> {
    const p = this.params.get(key);
    if (p) p.lastMetric = lastMetric;
  }
  async recordChange(rec: ParameterChangeRecord): Promise<void> {
    this.changes.push(rec);
  }
}

/** Returns metric values from a fixed map or a sequence (for multi-run tests). */
export class ScriptedMetricProvider implements MetricProvider {
  private calls = 0;
  constructor(private readonly script: Record<string, number[] | number | null>) {}
  async measure(metric: string): Promise<number | null> {
    const entry = this.script[metric];
    if (entry == null) return null;
    if (Array.isArray(entry)) {
      const v = entry[Math.min(this.calls, entry.length - 1)];
      return v ?? null;
    }
    return entry;
  }
  advanceRun(): void {
    this.calls += 1;
  }
}
