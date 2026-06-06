import { adjustParameter } from "../adjuster";
import type { TunableParam } from "../parameters";

const p = (over: Partial<TunableParam> = {}): TunableParam => ({
  key: "dispatch.minMatchScore",
  value: 70,
  min: 60,
  max: 85,
  step: 2,
  betterWhen: "higher",
  metric: "job_completion_rate",
  ...over,
});

describe("adjustParameter (bounded hill-climb + rollback)", () => {
  it("explores one step when there is no baseline", () => {
    const r = adjustParameter({ param: p(), metricBefore: null, metricAfter: 0.5, lastDelta: 0 });
    expect(r.action).toBe("explore");
    expect(r.nextValue).toBe(72);
  });

  it("continues in the same direction when the metric improved", () => {
    const r = adjustParameter({ param: p({ value: 72 }), metricBefore: 0.5, metricAfter: 0.6, lastDelta: 2 });
    expect(r.action).toBe("continue");
    expect(r.nextValue).toBe(74);
  });

  it("rolls back when the metric got worse", () => {
    const r = adjustParameter({ param: p({ value: 72 }), metricBefore: 0.6, metricAfter: 0.5, lastDelta: 2 });
    expect(r.action).toBe("rollback");
    expect(r.nextValue).toBe(70);
  });

  it("holds when the change is within the noise band", () => {
    const r = adjustParameter({ param: p({ value: 72 }), metricBefore: 0.5, metricAfter: 0.5001, lastDelta: 2 });
    expect(r.action).toBe("hold");
    expect(r.nextValue).toBe(72);
  });

  it("never exceeds the upper bound", () => {
    const r = adjustParameter({ param: p({ value: 85 }), metricBefore: 0.5, metricAfter: 0.7, lastDelta: 2 });
    expect(r.action).toBe("hold");
    expect(r.nextValue).toBe(85);
  });

  it("never drops below the lower bound on rollback", () => {
    const r = adjustParameter({ param: p({ value: 60 }), metricBefore: 0.6, metricAfter: 0.4, lastDelta: -2 });
    // worse → undo last (-2) → +2 back toward 62, still within bounds
    expect(r.nextValue).toBeGreaterThanOrEqual(60);
    expect(r.nextValue).toBeLessThanOrEqual(85);
  });

  it("treats lower-is-better metrics correctly", () => {
    const param = p({ key: "alert.errorCooldownMinutes", value: 45, min: 15, max: 180, step: 15, betterWhen: "lower", metric: "alert_noise_rate" });
    // metric dropped (good) after a +15 change → continue +15
    const r = adjustParameter({ param, metricBefore: 0.4, metricAfter: 0.3, lastDelta: 15 });
    expect(r.action).toBe("continue");
    expect(r.nextValue).toBe(60);
  });
});
