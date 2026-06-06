import { evaluateDailyBudget, startOfUtcDay } from "../daily-budget";

const NOW = new Date("2026-06-06T14:00:00Z");

describe("evaluateDailyBudget", () => {
  it("is inert when no cap is set (null)", () => {
    const r = evaluateDailyBudget({ dailyBudgetUsd: null, dailyUsedUsd: 5, budgetDayStart: startOfUtcDay(NOW) }, NOW);
    expect(r.capEnabled).toBe(false);
    expect(r.overCap).toBe(false);
  });

  it("flags over cap when today's spend reached the cap", () => {
    const r = evaluateDailyBudget({ dailyBudgetUsd: 2, dailyUsedUsd: 2, budgetDayStart: startOfUtcDay(NOW) }, NOW);
    expect(r.overCap).toBe(true);
    expect(r.resetNeeded).toBe(false);
  });

  it("allows spend below the cap", () => {
    const r = evaluateDailyBudget({ dailyBudgetUsd: 2, dailyUsedUsd: 1.5, budgetDayStart: startOfUtcDay(NOW) }, NOW);
    expect(r.overCap).toBe(false);
  });

  it("resets on a new UTC day (yesterday's usage doesn't count)", () => {
    const yesterday = new Date("2026-06-05T23:00:00Z");
    const r = evaluateDailyBudget({ dailyBudgetUsd: 2, dailyUsedUsd: 5, budgetDayStart: yesterday }, NOW);
    expect(r.resetNeeded).toBe(true);
    expect(r.usedToday).toBe(0);
    expect(r.overCap).toBe(false); // reset → under cap again
    expect(r.dayStart.toISOString()).toBe("2026-06-06T00:00:00.000Z");
  });

  it("treats a never-initialised day (null) as needing reset", () => {
    const r = evaluateDailyBudget({ dailyBudgetUsd: 2, dailyUsedUsd: 0, budgetDayStart: null }, NOW);
    expect(r.resetNeeded).toBe(true);
    expect(r.overCap).toBe(false);
  });
});
