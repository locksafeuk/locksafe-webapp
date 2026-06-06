/**
 * Tests for the control-plane executor + runner against in-memory adapters.
 */

import { handleProposal, type ControlPlaneDeps } from "../executor";
import { runAgentProposals } from "../runner";
import {
  InMemoryApprovalGateway,
  InMemoryExecutorRegistry,
  InMemoryIdempotencyStore,
  InMemoryLockManager,
  InMemoryProposalStore,
  StaticFactProvider,
} from "../adapters/memory";
import type { Proposal } from "../types";

const goodCandidate = {
  locksmithId: "ls1",
  isVerified: true,
  isActive: true,
  isAvailable: true,
  distanceMiles: 1.2,
  rating: 4.7,
  matchScore: 88,
  hasAssessmentFeeSet: true,
};

function makeDeps(): ControlPlaneDeps & {
  store: InMemoryProposalStore;
  approvals: InMemoryApprovalGateway;
  executors: InMemoryExecutorRegistry;
} {
  return {
    store: new InMemoryProposalStore(),
    idempotency: new InMemoryIdempotencyStore(),
    approvals: new InMemoryApprovalGateway(),
    executors: new InMemoryExecutorRegistry(),
    facts: new StaticFactProvider(),
  };
}

function prop(actionType: string, args: Record<string, unknown>, agent = "coo", id = Math.random().toString(36)): Proposal {
  return { id, agent, actionType, args, rationale: "", proposedAt: "" };
}

describe("handleProposal", () => {
  it("executes a safe, valid action exactly once and records it", async () => {
    const deps = makeDeps();
    let ran = 0;
    deps.executors.register("dispatch.auto", async () => { ran++; return { ok: true, message: "dispatched" }; });

    const r = await handleProposal(prop("dispatch.auto", { jobId: "j1", jobStatus: "PENDING", candidate: goodCandidate }), deps);
    expect(r.outcome).toBe("executed");
    expect(ran).toBe(1);
    expect(deps.store.records).toHaveLength(1);
    expect(deps.store.records[0].shadow).toBe(false);
  });

  it("returns the prior result on an idempotent repeat (no second execution)", async () => {
    const deps = makeDeps();
    let ran = 0;
    deps.executors.register("dispatch.auto", async () => { ran++; return { ok: true, message: "dispatched" }; });
    const args = { jobId: "j1", jobStatus: "PENDING", candidate: goodCandidate };

    await handleProposal(prop("dispatch.auto", args), deps);
    const r2 = await handleProposal(prop("dispatch.auto", args), deps);
    expect(r2.outcome).toBe("executed-idempotent");
    expect(ran).toBe(1);
  });

  it("rejects an invalid action without executing", async () => {
    const deps = makeDeps();
    deps.executors.register("dispatch.auto", async () => { throw new Error("must not run"); });
    const r = await handleProposal(prop("dispatch.auto", { jobId: "j2", jobStatus: "PENDING", candidate: { ...goodCandidate, distanceMiles: 9 } }), deps);
    expect(r.outcome).toBe("rejected");
    expect(r.code).toBe("too-far");
  });

  it("queues a risky action for approval instead of executing", async () => {
    const deps = makeDeps();
    const r = await handleProposal(prop("comms.email", { to: "x@y.com", template: "promo" }, "cmo"), deps);
    expect(r.outcome).toBe("queued-for-approval");
    expect(deps.approvals.queued).toHaveLength(1);
  });

  it("shadow mode decides + records but never acts", async () => {
    const deps = makeDeps();
    let ran = 0;
    deps.executors.register("dispatch.auto", async () => { ran++; return { ok: true, message: "x" }; });

    const r = await handleProposal(prop("dispatch.auto", { jobId: "j4", jobStatus: "PENDING", candidate: goodCandidate }), deps, { shadow: true });
    expect(r.outcome).toBe("shadow-execute");
    expect(ran).toBe(0);
    expect(deps.store.records[0].shadow).toBe(true);

    const r2 = await handleProposal(prop("comms.email", { to: "a@b.com", template: "t" }, "cmo"), deps, { shadow: true });
    expect(r2.outcome).toBe("shadow-approve");
    expect(deps.approvals.queued).toHaveLength(0);
  });
});

describe("runAgentProposals (locking)", () => {
  it("refuses to run while another node holds the lock, then runs after release", async () => {
    const lock = new InMemoryLockManager();
    const deps = makeDeps();
    deps.executors.register("dispatch.auto", async () => ({ ok: true, message: "x" }));
    const batch = [prop("dispatch.auto", { jobId: "jA", jobStatus: "PENDING", candidate: goodCandidate })];

    await lock.acquire("coo", "nodeA", 60_000);
    const blocked = await runAgentProposals("coo", "nodeB", batch, deps, lock, {});
    expect(blocked.ran).toBe(false);
    expect(blocked.reason).toBe("lock-held");

    await lock.release("coo", "nodeA");
    const ran = await runAgentProposals("coo", "nodeB", batch, deps, lock, {});
    expect(ran.ran).toBe(true);
    expect(ran.results[0].outcome).toBe("executed");
  });
});
