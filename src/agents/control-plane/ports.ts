/**
 * Control-plane ports (hexagonal architecture).
 *
 * The executor/runner depend only on these interfaces, never on a concrete
 * database or service. This keeps the decision logic pure and testable, lets
 * shadow mode run against in-memory adapters, and lets production swap in the
 * Prisma/Telegram adapters without changing the core.
 */

import type { ExecutionResult, PipelineDecision, Proposal } from "./types";

export interface ProposalRecord {
  proposal: Proposal;
  decision: PipelineDecision;
  validationCode?: string;
  validationReason?: string;
  idempotencyKey?: string;
  shadow: boolean;
}

/** Persists the full proposal + decision audit trail. */
export interface ProposalStore {
  record(rec: ProposalRecord): Promise<void>;
  markResolved(proposalId: string, finalDecision: string): Promise<void>;
}

/** Distributed lock preventing concurrent runs of the same agent. */
export interface LockManager {
  /** Returns true if the lock was acquired (or already held by this nodeId). */
  acquire(agent: string, nodeId: string, ttlMs: number): Promise<boolean>;
  release(agent: string, nodeId: string): Promise<void>;
}

/** Idempotency ledger: repeated action key returns the prior result. */
export interface IdempotencyStore {
  get(key: string): Promise<ExecutionResult | null>;
  put(key: string, actionType: string, result: ExecutionResult, ttlMs: number): Promise<void>;
}

/** Queues a risky action for human approval; returns an approval id. */
export interface ApprovalGateway {
  enqueue(input: {
    agent: string;
    actionType: string;
    args: unknown;
    reason: string;
  }): Promise<string>;
}

/** Performs the real-world side effect for a SAFE action. */
export type ActionExecutor = (args: unknown) => Promise<ExecutionResult>;

export interface ExecutorRegistry {
  get(actionType: string): ActionExecutor | undefined;
}

/** Supplies the live facts a validator needs for a given proposal. */
export interface FactProvider {
  factsFor(proposal: Proposal): Promise<Record<string, unknown>>;
}
