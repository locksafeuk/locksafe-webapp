/**
 * Control-plane contracts.
 *
 * The control plane is the deterministic "spine" of the agent system. The
 * cognition plane (the LLM/agents) never mutates state directly — it emits
 * Proposals, and the control plane validates, classifies, and (later) executes
 * them. Every type here is plain data with no I/O so the safety surface stays
 * pure and unit-testable.
 *
 * Pipeline: propose -> validate -> (execute | approve | reject) -> record -> reflect
 *
 * See AGENT_AUTONOMY_REDESIGN_2026-06-06.md (repo root) for the full design.
 */

export type RiskClass = "safe" | "risky";
export type AlertSeverity = "info" | "warning" | "error";

/** What an agent wants to do. Persisted before validation for a full audit trail. */
export interface Proposal<A = Record<string, unknown>> {
  id: string;
  agent: string;
  actionType: string;
  args: A;
  /** LLM reasoning — recorded for audit only, NEVER trusted for control flow. */
  rationale: string;
  /** Ids of rows/metrics the claim rests on (for traceability). */
  evidenceRefs?: string[];
  proposedAt: string;
}

/** Result of a deterministic validator. `code` is machine-readable for metrics. */
export interface ValidationResult {
  ok: boolean;
  /** Present when ok === false. */
  reason?: string;
  /** Stable machine-readable code, e.g. "no-demand", "below-min-score". */
  code?: string;
}

/** What the control plane decides to do with a validated proposal. */
export type PipelineDecision =
  | { decision: "execute"; risk: RiskClass }
  | { decision: "approve"; risk: RiskClass }
  | { decision: "reject"; reason: string; code: string };

export interface ExecutionResult {
  ok: boolean;
  message: string;
  /** True when a prior identical action's result was returned (idempotency). */
  idempotent?: boolean;
  data?: unknown;
}

/**
 * Facts the control plane fetches and hands to a validator. Keeping data access
 * out of the validator is what makes validators pure and trivially testable.
 */
export interface ActionContext {
  now: Date;
  facts?: Record<string, unknown>;
}

export interface ActionDef<A = Record<string, unknown>> {
  type: string;
  risk: RiskClass;
  /** Risky auto-actions must be reversible so rollback/self-healing is mechanical. */
  reversible: boolean;
  /** Deterministic gate. Pure given (args, ctx.facts). */
  validate(args: A, ctx: ActionContext): ValidationResult;
  /** Dedupe key for idempotent execution. */
  idempotencyKey(args: A): string;
}
