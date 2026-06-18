import { JobStatus } from "@prisma/client";

/**
 * Job status invariants — single source of truth.
 *
 * 2026-06-18: production had 3 jobs in COMPLETED with locksmithId=null and every
 * intermediate timestamp null — they had been PATCHed straight to a terminal
 * status from PENDING, because neither status route validated the transition or
 * required an assigned locksmith. This module enforces the one invariant that is
 * unambiguously correct and prevents that corruption:
 *
 *   A job cannot be ACCEPTED — or in ANY later operational/terminal state —
 *   without an assigned locksmith.
 *
 * We deliberately do NOT enforce a full transition graph here (that risks
 * rejecting legitimate fast-path transitions the apps already rely on). The
 * locksmith invariant alone closes the corruption vector, because every valid
 * forward flow has a locksmith assigned by the time it reaches ACCEPTED.
 *
 * Admins can pass `override: true` to force a status (e.g. a phone job handled
 * entirely offline) — the override is logged by the caller.
 */
export const LOCKSMITH_REQUIRED_STATUSES: ReadonlySet<string> = new Set<JobStatus>([
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "DIAGNOSING",
  "QUOTED",
  "QUOTE_ACCEPTED",
  "QUOTE_DECLINED",
  "IN_PROGRESS",
  "PENDING_CUSTOMER_CONFIRMATION",
  "COMPLETED",
  "SIGNED",
]);

export function statusRequiresLocksmith(status: string): boolean {
  return LOCKSMITH_REQUIRED_STATUSES.has(status);
}

export interface TransitionContext {
  /** Whether the job currently has an assigned locksmith. */
  hasLocksmith: boolean;
  /** Admin force-override — bypasses the invariant. Caller should log it. */
  override?: boolean;
}

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a requested status transition. Returns ok:false with a message when
 * the transition would violate the locksmith invariant (unless override).
 */
export function validateStatusTransition(
  nextStatus: string,
  ctx: TransitionContext,
): TransitionResult {
  if (ctx.override) return { ok: true };

  if (statusRequiresLocksmith(nextStatus) && !ctx.hasLocksmith) {
    return {
      ok: false,
      error:
        `Cannot set status "${nextStatus}" on a job with no assigned locksmith. ` +
        `Assign a locksmith first, or pass override:true (admin) to force.`,
    };
  }

  return { ok: true };
}
