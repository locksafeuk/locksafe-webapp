/**
 * Control-plane pipeline: propose -> validate -> classify (-> execute|approve|reject).
 *
 * This module is deterministic and side-effect free. It decides WHAT should
 * happen to a proposal; actual execution, approval-queueing, recording and
 * locking are injected by the caller (kept out of here so the decision logic
 * stays pure and testable, and so it can run in SHADOW MODE — decide + log,
 * without acting).
 */

import type { ActionContext, PipelineDecision, Proposal, ValidationResult } from "./types";
import { getAction } from "./registry";

export interface EvaluationOutcome {
  proposal: Proposal;
  /** Undefined when the action type is unknown. */
  validation?: ValidationResult;
  decision: PipelineDecision;
  idempotencyKey?: string;
}

/** Map a validation result + risk class to a decision. Pure. */
export function classify(
  risk: "safe" | "risky",
  validation: ValidationResult,
): PipelineDecision {
  if (!validation.ok) {
    return { decision: "reject", reason: validation.reason ?? "validation failed", code: validation.code ?? "invalid" };
  }
  return risk === "safe"
    ? { decision: "execute", risk }
    : { decision: "approve", risk };
}

/**
 * Evaluate a single proposal. Looks up the action, validates against ctx facts,
 * and classifies. Does NOT execute — the caller acts on `decision`.
 *
 * Unknown action types are rejected (an LLM cannot invent an action that
 * mutates state — it must exist in the registry).
 */
export function evaluateProposal(proposal: Proposal, ctx: ActionContext): EvaluationOutcome {
  const action = getAction(proposal.actionType);

  if (!action) {
    return {
      proposal,
      decision: { decision: "reject", reason: `Unknown action type: ${proposal.actionType}`, code: "unknown-action" },
    };
  }

  let validation: ValidationResult;
  try {
    validation = action.validate(proposal.args, ctx);
  } catch (err) {
    // A validator throwing is a control-plane fault — fail SAFE (reject), never
    // fall through to execution.
    return {
      proposal,
      decision: { decision: "reject", reason: `Validator error: ${err instanceof Error ? err.message : "unknown"}`, code: "validator-error" },
    };
  }

  return {
    proposal,
    validation,
    decision: classify(action.risk, validation),
    idempotencyKey: action.idempotencyKey(proposal.args),
  };
}
