/**
 * Pure daily-budget evaluation for agent heartbeats.
 *
 * An agent may set an optional per-day spend ceiling (dailyBudgetUsd). This
 * decides — deterministically — whether the agent is over its cap for the
 * current UTC day, and whether the daily counter needs resetting (new day).
 *
 * Kept pure so it's unit-testable; the orchestrator fetches the agent's state,
 * calls this, and persists the reset/increment. Null cap = inert (no behaviour
 * change), so this is opt-in per agent.
 */

export interface DailyBudgetState {
  dailyBudgetUsd: number | null;
  dailyUsedUsd: number;
  budgetDayStart: Date | null;
}

export interface DailyBudgetEvaluation {
  capEnabled: boolean;
  /** A new UTC day has started since budgetDayStart → reset the counter. */
  resetNeeded: boolean;
  /** Start of today's window (UTC midnight). */
  dayStart: Date;
  /** Spend in today's window after applying any needed reset. */
  usedToday: number;
  /** True when the cap is enabled and today's spend has reached it. */
  overCap: boolean;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function evaluateDailyBudget(state: DailyBudgetState, now: Date): DailyBudgetEvaluation {
  const dayStart = startOfUtcDay(now);
  const sameDay =
    state.budgetDayStart != null &&
    startOfUtcDay(state.budgetDayStart).getTime() === dayStart.getTime();

  const resetNeeded = !sameDay;
  const usedToday = resetNeeded ? 0 : state.dailyUsedUsd;
  const capEnabled = state.dailyBudgetUsd != null && state.dailyBudgetUsd > 0;
  const overCap = capEnabled && usedToday >= (state.dailyBudgetUsd as number);

  return { capEnabled, resetNeeded, dayStart, usedToday, overCap };
}
