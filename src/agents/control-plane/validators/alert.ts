/**
 * Deterministic validator for `alert.raise`.
 *
 * This encodes IN CODE the rules that used to live as prose in SKILL.md (and so
 * the LLM could ignore) — the exact source of the CTO 3am false-alert spam:
 *   1. duplicate suppression (same alert within cooldown)
 *   2. no-demand guard: a "zero jobs/outage" business alert is NOT an incident
 *      when there is no unmet demand (no open jobs and none in the last 24h)
 *   3. quiet hours: hold non-infra alerts overnight unless verified infra
 *
 * Pure function: all live data is passed in via AlertFacts.
 */

import type { AlertSeverity, ValidationResult } from "../types";

export type AlertKind = "infra" | "business" | "ops";

export interface AlertRaiseArgs {
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  message: string;
  /** Whether the alert claims zero jobs / no completions / outage. */
  claimsZeroJobs?: boolean;
}

export interface AlertFacts {
  /** Jobs in a non-terminal (in-flight) state right now. */
  openJobCount: number;
  /** Jobs created in the last 24h. */
  recentJobCount24h: number;
  withinQuietHours: boolean;
  /** An identical alert was already sent within its cooldown window. */
  recentlySentSameAlert: boolean;
  /** Verified infra/security incident that must page even at night. */
  bypassQuietHours: boolean;
}

export function validateAlertRaise(args: AlertRaiseArgs, facts: AlertFacts): ValidationResult {
  // 1. Duplicate suppression — collapse identical recurring alerts.
  if (facts.recentlySentSameAlert) {
    return { ok: false, code: "duplicate", reason: "Identical alert already sent within its cooldown window." };
  }

  // 2. No-demand guard — zero completions is only an outage when demand exists.
  if (args.kind === "business" && args.claimsZeroJobs && facts.openJobCount === 0 && facts.recentJobCount24h === 0) {
    return {
      ok: false,
      code: "no-demand",
      reason: "Zero completions but no open or recent jobs — no demand, not an outage.",
    };
  }

  // 3. Quiet hours — hold advisory/non-infra alerts overnight.
  if (facts.withinQuietHours && !facts.bypassQuietHours) {
    return {
      ok: false,
      code: "quiet-hours",
      reason: "Held during quiet hours (not a verified infra/security incident).",
    };
  }

  return { ok: true };
}
