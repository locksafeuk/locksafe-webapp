import {
  DATASET_INCREMENTAL_DEFAULT_LOOKBACK_HOURS,
  DATASET_INCREMENTAL_MIN_GAP_MINUTES,
  resolveIncrementalDatasetWindow,
  shouldRunIncrementalDataset,
} from "@/lib/retell-dataset-jobs";

describe("resolveIncrementalDatasetWindow", () => {
  const now = new Date("2026-05-01T12:00:00.000Z");

  it("falls back to a lookback window when no prior job exists", () => {
    const window = resolveIncrementalDatasetWindow({ lastCompletedUntil: null, now });

    expect(window.source).toBe("lookback");
    expect(window.until).toEqual(now);
    const diffHours = (window.until.getTime() - window.since.getTime()) / (60 * 60 * 1000);
    expect(diffHours).toBe(DATASET_INCREMENTAL_DEFAULT_LOOKBACK_HOURS);
  });

  it("uses the last completed job's until as the new since", () => {
    const last = new Date("2026-05-01T06:00:00.000Z");
    const window = resolveIncrementalDatasetWindow({ lastCompletedUntil: last, now });

    expect(window.source).toBe("lastCompleted");
    expect(window.since).toEqual(last);
    expect(window.until).toEqual(now);
  });

  it("falls back to lookback when the last completed until is in the future", () => {
    const futureUntil = new Date(now.getTime() + 60 * 60 * 1000);
    const window = resolveIncrementalDatasetWindow({ lastCompletedUntil: futureUntil, now });

    expect(window.source).toBe("lookback");
    expect(window.until).toEqual(now);
  });

  it("respects a custom lookback window", () => {
    const window = resolveIncrementalDatasetWindow({
      lastCompletedUntil: null,
      now,
      lookbackHours: 6,
    });
    const diffHours = (window.until.getTime() - window.since.getTime()) / (60 * 60 * 1000);
    expect(diffHours).toBe(6);
  });
});

describe("shouldRunIncrementalDataset", () => {
  const now = new Date("2026-05-01T12:00:00.000Z");

  it("returns true when no prior job exists", () => {
    expect(shouldRunIncrementalDataset({ lastCompletedUntil: null, now })).toBe(true);
  });

  it("returns false when the last completion is within the min gap", () => {
    const recent = new Date(now.getTime() - (DATASET_INCREMENTAL_MIN_GAP_MINUTES - 1) * 60 * 1000);
    expect(shouldRunIncrementalDataset({ lastCompletedUntil: recent, now })).toBe(false);
  });

  it("returns true when the last completion is older than the min gap", () => {
    const stale = new Date(now.getTime() - (DATASET_INCREMENTAL_MIN_GAP_MINUTES + 5) * 60 * 1000);
    expect(shouldRunIncrementalDataset({ lastCompletedUntil: stale, now })).toBe(true);
  });
});
