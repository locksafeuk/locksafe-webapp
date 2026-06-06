/**
 * Pure decision logic for COO → peer-agent escalation.
 *
 * Kept pure (no I/O) so it is trivially unit-testable. The COO heartbeat fetches
 * the live numbers, calls this to decide what to escalate, and delegates each
 * result via the orchestrator's delegateTask (which has its own circular /
 * duplicate guards, so repeated heartbeats won't spam).
 */

export interface CooEscalationContext {
  stuckJobCount: number;
  unassignedEmergencyCount: number;
  sweptCount: number;
  sweepNotified: number;
  availableLocksmiths: number;
}

export interface CooEscalation {
  toAgent: "cto" | "cmo";
  title: string;
  description: string;
  priority: number;
}

export interface CooEscalationOptions {
  /** Stuck-job count at/above which we escalate the dispatch pipeline to CTO. */
  stuckThreshold?: number;
  /** Available-locksmith count below which we ask CMO to recruit. */
  minAvailable?: number;
}

export function planCooEscalations(
  ctx: CooEscalationContext,
  opts: CooEscalationOptions = {},
): CooEscalation[] {
  const stuckThreshold = opts.stuckThreshold ?? 3;
  const minAvailable = opts.minAvailable ?? 3;
  const escalations: CooEscalation[] = [];

  // Persistent dispatch failure → CTO investigates the routing/notify pipeline.
  if (ctx.unassignedEmergencyCount > 0 || ctx.stuckJobCount >= stuckThreshold) {
    escalations.push({
      toAgent: "cto",
      title: "[Repair] Dispatch pipeline not clearing pending jobs",
      description:
        `COO heartbeat detected a stalled dispatch funnel: ${ctx.stuckJobCount} job(s) stuck >10m, ` +
        `${ctx.unassignedEmergencyCount} emergency job(s) unassigned >10m ` +
        `(swept ${ctx.sweptCount} → notified ${ctx.sweepNotified}). ` +
        `Investigate job routing, notifyNearbyLocksmiths, and coverage data.`,
      priority: ctx.unassignedEmergencyCount > 0 ? 9 : 7,
    });
  }

  // Unmet demand + thin coverage → CMO drives recruitment/reactivation.
  if (ctx.stuckJobCount > 0 && ctx.availableLocksmiths < minAvailable) {
    escalations.push({
      toAgent: "cmo",
      title: "[Coverage] Low locksmith availability with unmet demand",
      description:
        `Only ${ctx.availableLocksmiths} locksmith(s) available while ${ctx.stuckJobCount} job(s) are stuck. ` +
        `Prioritise locksmith recruitment / reactivation in affected areas.`,
      priority: 6,
    });
  }

  return escalations;
}
