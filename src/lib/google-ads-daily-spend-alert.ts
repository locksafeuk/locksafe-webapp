/**
 * §38 — Daily-spend early-warning alert (2026-06-24).
 *
 * The §32 cost-per-verified-conv kill switch only fires on rolling 7-day
 * cost-per-conversion > £150. That's the LAST line of defense. §38 adds a
 * FIRST line: if total account spend in a single day exceeds the alert
 * threshold (default £80), fire a Telegram alert — even if no individual
 * campaign is over its own per-campaign caps.
 *
 * Why £80: tied to the engineered monthly cap of £2,500. £2,500 / 30.4 days
 * ≈ £82/day average. We alert at £80 to give a one-day buffer before the
 * engineered cap is exceeded. The hard publish-time gate at
 * MAX_DAILY_ACCOUNT_SPEND_GBP (set to 85) prevents new campaigns from being
 * published over the cap; this alert is for already-live spend that has
 * crept past the soft ceiling (e.g. Google's 2× daily over-deliver
 * smoothing, or an existing campaign that briefly spikes).
 *
 * Pure function — no I/O. The cron supplies the spend and calls Telegram.
 */

export interface DailySpendAlertInput {
  /** Yesterday's total account spend in GBP. */
  spendGbp: number;
  /** Alert threshold (default 80). */
  thresholdGbp?: number;
  /** ISO date string for the day this spend covers (for the alert body). */
  dayIso?: string;
}

export interface DailySpendAlertDecision {
  shouldAlert: boolean;
  spendGbp: number;
  thresholdGbp: number;
  overByGbp: number;
  /** Telegram-ready message body; only set when shouldAlert=true. */
  message?: string;
}

export function evaluateDailySpendAlert(
  input: DailySpendAlertInput,
): DailySpendAlertDecision {
  const threshold =
    Number.isFinite(input.thresholdGbp) && (input.thresholdGbp ?? 0) > 0
      ? (input.thresholdGbp as number)
      : 80;
  const spend = Number.isFinite(input.spendGbp) ? input.spendGbp : 0;
  const overBy = spend - threshold;
  const shouldAlert = overBy > 0;

  if (!shouldAlert) {
    return {
      shouldAlert: false,
      spendGbp: spend,
      thresholdGbp: threshold,
      overByGbp: overBy,
    };
  }

  const day = input.dayIso ? input.dayIso.slice(0, 10) : "yesterday";
  const monthlyProjection = Math.round(spend * 30.4);
  const message =
    `Account spend on ${day} was £${spend.toFixed(2)} — over the £${threshold} ` +
    `daily alert threshold by £${overBy.toFixed(2)}. ` +
    `At this rate the engineered monthly cap (£2,500) would be exceeded ` +
    `(monthly projection: £${monthlyProjection.toLocaleString()}). ` +
    `If the spike was a one-day burst (Google's 2× over-deliver smoothing), ` +
    `no action needed. If it persists 3+ days, pause one of the higher-budget ` +
    `campaigns. The hard publish-time gate at MAX_DAILY_ACCOUNT_SPEND_GBP ` +
    `(default 85) still prevents NEW campaigns from being published over the cap.`;

  return {
    shouldAlert: true,
    spendGbp: spend,
    thresholdGbp: threshold,
    overByGbp: overBy,
    message,
  };
}
