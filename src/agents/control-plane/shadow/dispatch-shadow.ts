/**
 * Dispatch gate (control plane).
 *
 * Runs an auto-dispatch decision through the deterministic pipeline and returns
 * whether it should be allowed. Same two modes as the alert gate:
 *
 *   SHADOW  (default)  — evaluate + record the would-be decision; caller still
 *                        dispatches via the legacy path.
 *   ENFORCE (flagged)  — caller refuses to dispatch when allow === false.
 *
 * Gated by CONTROL_PLANE_DISPATCH_ENFORCE=true (default OFF).
 *
 * The real application creation + SMS stays in autoDispatchJob (legacy). This
 * gate only decides allow/suppress and records the proposal. It never throws.
 */

import { handleProposal } from "../executor";
import { PrismaProposalStore } from "../adapters/prisma";
import {
  InMemoryApprovalGateway,
  InMemoryExecutorRegistry,
  InMemoryIdempotencyStore,
} from "../adapters/memory";
import type { DispatchAutoArgs } from "../validators/dispatch";
import type { FactProvider } from "../ports";
import type { Proposal } from "../types";

/** Enforcement flag — default OFF (shadow only). */
export function isDispatchEnforcementEnabled(): boolean {
  return process.env.CONTROL_PLANE_DISPATCH_ENFORCE === "true";
}

export interface DispatchGateResult {
  allow: boolean;
  outcome: string;
  code?: string;
  reason?: string;
}

const noFacts: FactProvider = { factsFor: async () => ({}) };

/**
 * Evaluate an auto-dispatch through the pipeline, record it, return allow.
 * `shadow` flags the proposal as a dry-run record.
 */
export async function evaluateDispatch(
  args: DispatchAutoArgs,
  opts: { shadow: boolean; agent?: string },
): Promise<DispatchGateResult> {
  try {
    const now = new Date();
    const proposal: Proposal = {
      id: globalThis.crypto?.randomUUID?.() ?? `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agent: opts.agent ?? "coo",
      actionType: "dispatch.auto",
      args: args as unknown as Record<string, unknown>,
      rationale: opts.shadow ? "shadow evaluation of auto-dispatch" : "control-plane dispatch gate",
      proposedAt: now.toISOString(),
    };

    // No-op executor for the allowed branch — the real dispatch (application +
    // SMS) stays in autoDispatchJob; the gate only decides allow vs suppress.
    const executors = new InMemoryExecutorRegistry().register("dispatch.auto", async () => ({
      ok: true,
      message: "allowed (dispatched via legacy path)",
    }));

    const result = await handleProposal(
      proposal,
      {
        store: new PrismaProposalStore(),
        idempotency: new InMemoryIdempotencyStore(),
        approvals: new InMemoryApprovalGateway(),
        executors,
        facts: noFacts,
      },
      { shadow: opts.shadow, now },
    );

    const allow = result.outcome !== "rejected" && result.outcome !== "shadow-reject";
    console.log(
      `[control-plane:${opts.shadow ? "shadow" : "enforce"}] dispatch.auto job=${args.jobId} ` +
      `ls=${args.candidate?.locksmithId ?? "none"} ${opts.shadow ? "would=" : "decision="}${result.outcome}` +
      `${result.code ? ` code=${result.code}` : ""}`,
    );

    return { allow, outcome: result.outcome, code: result.code, reason: result.detail };
  } catch (err) {
    // Fail OPEN: control-plane errors must never block a legitimate dispatch.
    console.warn("[control-plane] dispatch gate error (failing open, dispatch proceeds):", err);
    return { allow: true, outcome: "gate-error" };
  }
}
