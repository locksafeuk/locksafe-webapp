import { runSelfImprovement } from "../runner";
import { InMemoryParameterStore, ScriptedMetricProvider } from "../adapters/memory";
import type { StoredParam } from "../ports";

function seed(): StoredParam[] {
  return [{
    key: "dispatch.minMatchScore", value: 70, min: 60, max: 85, step: 2,
    betterWhen: "higher", metric: "job_completion_rate", lastDelta: 0, lastMetric: null,
  }];
}

describe("runSelfImprovement", () => {
  it("shadow mode records a suggestion but never changes the value", async () => {
    const store = new InMemoryParameterStore(seed());
    const metrics = new ScriptedMetricProvider({ job_completion_rate: 0.5 });
    const report = await runSelfImprovement({ metrics, store }, { enforce: false });

    expect(report.enforce).toBe(false);
    expect(report.results[0].applied).toBe(false);
    expect(store.changes).toHaveLength(1);
    expect(store.changes[0].shadow).toBe(true);
    const after = (await store.loadAll())[0];
    expect(after.value).toBe(70); // unchanged in shadow
  });

  it("enforce mode explores, then continues when the metric improves, then rolls back when it worsens", async () => {
    const store = new InMemoryParameterStore(seed());
    // run1 measures 0.5, run2 0.6 (improved), run3 0.5 (worse)
    const metrics = new ScriptedMetricProvider({ job_completion_rate: [0.5, 0.6, 0.5] });

    // Run 1: no baseline → explore +step (70 → 72)
    let r = await runSelfImprovement({ metrics, store }, { enforce: true });
    expect(r.results[0].action).toBe("explore");
    expect((await store.loadAll())[0].value).toBe(72);
    metrics.advanceRun();

    // Run 2: 0.6 > 0.5 improved → continue same dir (72 → 74)
    r = await runSelfImprovement({ metrics, store }, { enforce: true });
    expect(r.results[0].action).toBe("continue");
    expect((await store.loadAll())[0].value).toBe(74);
    metrics.advanceRun();

    // Run 3: 0.5 < 0.6 worse → rollback (74 → 72)
    r = await runSelfImprovement({ metrics, store }, { enforce: true });
    expect(r.results[0].action).toBe("rollback");
    expect((await store.loadAll())[0].value).toBe(72);
  });

  it("holds (no tuning) when the metric cannot be measured", async () => {
    const store = new InMemoryParameterStore(seed());
    const metrics = new ScriptedMetricProvider({ job_completion_rate: null });
    const r = await runSelfImprovement({ metrics, store }, { enforce: true });
    expect(r.results[0].action).toBe("hold");
    expect(r.results[0].applied).toBe(false);
    expect((await store.loadAll())[0].value).toBe(70);
  });
});
