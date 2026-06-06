/**
 * Prisma-backed adapters for the control-plane ports (production).
 *
 * NOTE: these target the new models AgentProposal / AgentHeartbeatLock /
 * ActionIdempotency added to prisma/schema.prisma. Until you run
 * `npx prisma generate && npm run db:push`, the generated client won't include
 * them — so we type the delegates locally and cast the client at this boundary
 * only. After generate, the runtime calls line up with the generated client.
 *
 * The approval gateway is intentionally NOT implemented here yet: it will reuse
 * the existing AgentApproval model and is wired during the approvals cutover.
 */

import prisma from "@/lib/db";
import type { ExecutionResult } from "../types";
import type { IdempotencyStore, LockManager, ProposalRecord, ProposalStore } from "../ports";

// ── Minimal delegate shapes (subset of the generated client we use) ──
interface Where {
  [k: string]: unknown;
}
interface ProposalDelegate {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  updateMany(args: { where: Where; data: Record<string, unknown> }): Promise<{ count: number }>;
}
interface LockDelegate {
  updateMany(args: { where: Where; data: Record<string, unknown> }): Promise<{ count: number }>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  deleteMany(args: { where: Where }): Promise<{ count: number }>;
}
interface IdempotencyDelegate {
  findUnique(args: { where: { key: string } }): Promise<{ result: string; expiresAt: Date } | null>;
  upsert(args: { where: { key: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
}
interface ControlPlaneClient {
  agentProposal: ProposalDelegate;
  agentHeartbeatLock: LockDelegate;
  actionIdempotency: IdempotencyDelegate;
}

const db = prisma as unknown as ControlPlaneClient;

export class PrismaProposalStore implements ProposalStore {
  // Maps domain proposal id -> DB row id for markResolved within a run.
  private idMap = new Map<string, string>();

  async record(rec: ProposalRecord): Promise<void> {
    const decision = rec.decision.decision;
    const row = await db.agentProposal.create({
      data: {
        agent: rec.proposal.agent,
        actionType: rec.proposal.actionType,
        args: JSON.stringify(rec.proposal.args ?? {}),
        rationale: rec.proposal.rationale ?? "",
        evidenceRefs: rec.proposal.evidenceRefs ?? [],
        decision,
        validationCode: rec.validationCode ?? null,
        validationReason: rec.validationReason ?? null,
        idempotencyKey: rec.idempotencyKey ?? null,
        shadow: rec.shadow,
      },
    });
    this.idMap.set(rec.proposal.id, row.id);
  }

  async markResolved(proposalId: string, finalDecision: string): Promise<void> {
    const dbId = this.idMap.get(proposalId);
    if (!dbId) return; // resolved without a prior record in this process — skip
    await db.agentProposal.updateMany({
      where: { id: dbId },
      data: { finalDecision, resolvedAt: new Date() },
    });
  }
}

export class PrismaLockManager implements LockManager {
  async acquire(agent: string, nodeId: string, ttlMs: number): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Take over an expired lock or our own lock atomically via the unique agent.
    const taken = await db.agentHeartbeatLock.updateMany({
      where: { agent, OR: [{ expiresAt: { lt: now } }, { nodeId }] },
      data: { nodeId, acquiredAt: now, expiresAt },
    });
    if (taken.count > 0) return true;

    // No row (or held by another live node) — try to create. Unique violation
    // means another node holds a live lock.
    try {
      await db.agentHeartbeatLock.create({ data: { agent, nodeId, acquiredAt: now, expiresAt } });
      return true;
    } catch {
      return false;
    }
  }

  async release(agent: string, nodeId: string): Promise<void> {
    await db.agentHeartbeatLock.deleteMany({ where: { agent, nodeId } });
  }
}

export class PrismaIdempotencyStore implements IdempotencyStore {
  async get(key: string): Promise<ExecutionResult | null> {
    const row = await db.actionIdempotency.findUnique({ where: { key } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    try {
      return JSON.parse(row.result) as ExecutionResult;
    } catch {
      return null;
    }
  }

  async put(key: string, actionType: string, result: ExecutionResult, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const payload = JSON.stringify(result);
    await db.actionIdempotency.upsert({
      where: { key },
      create: { key, actionType, result: payload, expiresAt },
      update: { result: payload, expiresAt },
    });
  }
}
