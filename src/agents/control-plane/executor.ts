/**
 * Control-plane executor: turns a validated decision into the real outcome.
 *
 *   reject  -> record + stop (never acts)
 *   approve -> enqueue an approval, never auto-executes a risky action
 *   execute -> run the registered executor, with idempotency
 *
 * SHADOW MODE: when opts.shadow is true, the proposal is evaluated and recorded
 * (flagged shadow) but NO side effect happens — used to prove the pipeline would
 * have made the right call before any cutover.
 */

import { evaluateProposal } from "./pipeline";
import type { Proposal } from "./types";
import type {
  ApprovalGateway,
  ExecutorRegistry,
  FactProvider,
  IdempotencyStore,
  ProposalStore,
} from "./ports";

export interface ControlPlaneDeps {
  store: ProposalStore;
  idempotency: IdempotencyStore;
  approvals: ApprovalGateway;
  executors: ExecutorRegistry;
  facts: FactProvider;
  idempotencyTtlMs?: number;
}

export type HandleOutcome =
  | "executed"
  | "executed-idempotent"
  | "execute-failed"
  | "queued-for-approval"
  | "rejected"
  | "no-executor"
  | "shadow-execute"
  | "shadow-approve"
  | "shadow-reject";

export interface HandleResult {
  proposalId: string;
  actionType: string;
  outcome: HandleOutcome;
  code?: string;
  detail?: string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function handleProposal(
  proposal: Proposal,
  deps: ControlPlaneDeps,
  opts: { shadow?: boolean; now?: Date } = {},
): Promise<HandleResult> {
  const shadow = opts.shadow ?? false;
  const now = opts.now ?? new Date();

  const facts = await deps.facts.factsFor(proposal);
  const evalOut = evaluateProposal(proposal, { now, facts });
  const { decision } = evalOut;

  // Always record what was proposed + decided (audit trail), shadow-flagged.
  await deps.store.record({
    proposal,
    decision,
    validationCode: evalOut.validation?.code,
    validationReason: evalOut.validation?.reason,
    idempotencyKey: evalOut.idempotencyKey,
    shadow,
  });

  const base = { proposalId: proposal.id, actionType: proposal.actionType };

  // ── REJECT ──
  if (decision.decision === "reject") {
    if (!shadow) await deps.store.markResolved(proposal.id, "rejected");
    return { ...base, outcome: shadow ? "shadow-reject" : "rejected", code: decision.code, detail: decision.reason };
  }

  // ── APPROVE (risky) ──
  if (decision.decision === "approve") {
    if (shadow) return { ...base, outcome: "shadow-approve" };
    const approvalId = await deps.approvals.enqueue({
      agent: proposal.agent,
      actionType: proposal.actionType,
      args: proposal.args,
      reason: `Risky action (${proposal.actionType}) requires approval`,
    });
    await deps.store.markResolved(proposal.id, "queued-for-approval");
    return { ...base, outcome: "queued-for-approval", detail: approvalId };
  }

  // ── EXECUTE (safe + valid) ──
  if (shadow) return { ...base, outcome: "shadow-execute" };

  const key = evalOut.idempotencyKey;
  if (key) {
    const prior = await deps.idempotency.get(key);
    if (prior) {
      await deps.store.markResolved(proposal.id, "executed-idempotent");
      return { ...base, outcome: "executed-idempotent", detail: prior.message };
    }
  }

  const exec = deps.executors.get(proposal.actionType);
  if (!exec) {
    // Safe action with no executor wired yet — record, do not silently drop.
    await deps.store.markResolved(proposal.id, "no-executor");
    return { ...base, outcome: "no-executor", detail: "No executor registered for action" };
  }

  let result;
  try {
    result = await exec(proposal.args);
  } catch (err) {
    await deps.store.markResolved(proposal.id, "execute-failed");
    return { ...base, outcome: "execute-failed", detail: err instanceof Error ? err.message : "unknown error" };
  }

  if (key && result.ok) {
    await deps.idempotency.put(key, proposal.actionType, result, deps.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS);
  }
  await deps.store.markResolved(proposal.id, result.ok ? "executed" : "execute-failed");
  return { ...base, outcome: result.ok ? "executed" : "execute-failed", detail: result.message };
}
