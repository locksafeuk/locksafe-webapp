/**
 * In-memory adapters for the control-plane ports. Used by tests and by shadow
 * mode (where we don't want to touch the database). Production uses the Prisma
 * adapters in ./prisma.
 */

import type { ExecutionResult } from "../types";
import type {
  ActionExecutor,
  ApprovalGateway,
  ExecutorRegistry,
  FactProvider,
  IdempotencyStore,
  LockManager,
  ProposalRecord,
  ProposalStore,
} from "../ports";
import type { Proposal } from "../types";

export class InMemoryProposalStore implements ProposalStore {
  readonly records: ProposalRecord[] = [];
  readonly resolutions: Array<{ proposalId: string; finalDecision: string }> = [];

  async record(rec: ProposalRecord): Promise<void> {
    this.records.push(rec);
  }
  async markResolved(proposalId: string, finalDecision: string): Promise<void> {
    this.resolutions.push({ proposalId, finalDecision });
  }
}

export class InMemoryLockManager implements LockManager {
  private locks = new Map<string, { nodeId: string; expiresAt: number }>();

  async acquire(agent: string, nodeId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(agent);
    if (existing && existing.expiresAt > now && existing.nodeId !== nodeId) {
      return false; // held by another node
    }
    this.locks.set(agent, { nodeId, expiresAt: now + ttlMs });
    return true;
  }
  async release(agent: string, nodeId: string): Promise<void> {
    const existing = this.locks.get(agent);
    if (existing && existing.nodeId === nodeId) this.locks.delete(agent);
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, { result: ExecutionResult; expiresAt: number }>();

  async get(key: string): Promise<ExecutionResult | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.result;
  }
  async put(key: string, _actionType: string, result: ExecutionResult, ttlMs: number): Promise<void> {
    this.store.set(key, { result, expiresAt: Date.now() + ttlMs });
  }
}

export class InMemoryApprovalGateway implements ApprovalGateway {
  readonly queued: Array<{ agent: string; actionType: string; args: unknown; reason: string }> = [];

  async enqueue(input: { agent: string; actionType: string; args: unknown; reason: string }): Promise<string> {
    this.queued.push(input);
    return `approval-${this.queued.length}`;
  }
}

export class InMemoryExecutorRegistry implements ExecutorRegistry {
  private map = new Map<string, ActionExecutor>();
  register(actionType: string, exec: ActionExecutor): this {
    this.map.set(actionType, exec);
    return this;
  }
  get(actionType: string): ActionExecutor | undefined {
    return this.map.get(actionType);
  }
}

/** Returns a fixed set of facts (handy for tests/shadow). */
export class StaticFactProvider implements FactProvider {
  constructor(private readonly factsByAction: Record<string, Record<string, unknown>> = {}) {}
  async factsFor(proposal: Proposal): Promise<Record<string, unknown>> {
    return this.factsByAction[proposal.actionType] ?? {};
  }
}
