/**
 * Control-plane runner: processes a batch of an agent's proposals under a
 * distributed lock, so the PM2 runner and Vercel cron can never double-run the
 * same agent. Delegates each proposal to handleProposal.
 */

import { handleProposal, type ControlPlaneDeps, type HandleResult } from "./executor";
import type { LockManager } from "./ports";
import type { Proposal } from "./types";

const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface RunResult {
  ran: boolean;
  reason?: string; // when ran === false (e.g. "lock-held")
  results: HandleResult[];
}

export async function runAgentProposals(
  agent: string,
  nodeId: string,
  proposals: Proposal[],
  deps: ControlPlaneDeps,
  lock: LockManager,
  opts: { shadow?: boolean; now?: Date; lockTtlMs?: number } = {},
): Promise<RunResult> {
  const acquired = await lock.acquire(agent, nodeId, opts.lockTtlMs ?? DEFAULT_LOCK_TTL_MS);
  if (!acquired) {
    return { ran: false, reason: "lock-held", results: [] };
  }

  try {
    const results: HandleResult[] = [];
    for (const proposal of proposals) {
      results.push(await handleProposal(proposal, deps, { shadow: opts.shadow, now: opts.now }));
    }
    return { ran: true, results };
  } finally {
    await lock.release(agent, nodeId);
  }
}
