/**
 * Shared Decision Framework
 * 
 * Allows agents to propose decisions, request approvals from other agents,
 * implement voting/consensus mechanisms, and track decision history.
 */

import { sendMessage, requestDecision as requestDecisionMsg, respondToDecision } from './message-bus';
import type { MessagePriority } from './message-bus';

// ─── Decision Types ──────────────────────────────────────────────────────────

export type DecisionStatus = 'proposed' | 'voting' | 'approved' | 'rejected' | 'expired' | 'executed';
export type DecisionScope = 'strategic' | 'operational' | 'tactical';
export type VoteChoice = 'approve' | 'reject' | 'abstain';

export interface DecisionProposal {
  id: string;
  proposedBy: string;
  title: string;
  description: string;
  scope: DecisionScope;
  options: string[];
  selectedOption?: string;
  status: DecisionStatus;
  priority: MessagePriority;
  requiredVoters: string[];
  votes: DecisionVote[];
  consensusThreshold: number; // 0-1 (e.g., 0.5 = majority, 1.0 = unanimous)
  reasoning?: string;
  outcome?: string;
  impact?: Record<string, unknown>;
  createdAt: Date;
  deadline: Date;
  resolvedAt?: Date;
}

export interface DecisionVote {
  agentId: string;
  choice: VoteChoice;
  selectedOption?: string;
  reasoning: string;
  votedAt: Date;
}

export interface DecisionOutcome {
  decisionId: string;
  approved: boolean;
  selectedOption?: string;
  voteSummary: {
    total: number;
    approve: number;
    reject: number;
    abstain: number;
  };
  reasoning: string;
}

// ─── Decision Store ──────────────────────────────────────────────────────────

const decisionStore: DecisionProposal[] = [];
let decisionIdCounter = 0;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Propose a new decision for collaborative approval
 */
export async function proposeDecision(
  proposedBy: string,
  title: string,
  description: string,
  options: {
    scope?: DecisionScope;
    choices?: string[];
    requiredVoters?: string[];
    consensusThreshold?: number;
    priority?: MessagePriority;
    deadlineMs?: number;
  } = {}
): Promise<DecisionProposal> {
  const defaultVoters = ['ceo', 'cmo', 'coo', 'cto'].filter((a) => a !== proposedBy);

  const decision: DecisionProposal = {
    id: `dec_${++decisionIdCounter}_${Date.now()}`,
    proposedBy,
    title,
    description,
    scope: options.scope || 'operational',
    options: options.choices || ['approve', 'reject'],
    status: 'proposed',
    priority: options.priority || 'normal',
    requiredVoters: options.requiredVoters || defaultVoters,
    votes: [],
    consensusThreshold: options.consensusThreshold ?? 0.5,
    createdAt: new Date(),
    deadline: new Date(Date.now() + (options.deadlineMs || 24 * 60 * 60 * 1000)),
  };

  decisionStore.push(decision);

  // Notify required voters via message bus
  decision.status = 'voting';
  for (const voter of decision.requiredVoters) {
    await requestDecisionMsg(
      proposedBy,
      voter,
      `[Decision] ${title}`,
      decision.options,
      { decisionId: decision.id, description, scope: decision.scope }
    );
  }

  console.log(
    `[DecisionEngine] Decision proposed by ${proposedBy}: "${title}" → voters: [${decision.requiredVoters.join(', ')}]`
  );

  // Persist to DB
  try {
    const { prisma } = await import('@/lib/prisma');
    const agent = await prisma.agent.findUnique({ where: { name: proposedBy } });
    if (agent) {
      await prisma.agentExecution.create({
        data: {
          agentId: agent.id,
          traceId: decision.id,
          actionType: 'decision',
          actionName: 'propose_decision',
          input: JSON.stringify({ title, description, scope: decision.scope, options: decision.options }),
          output: JSON.stringify({ decisionId: decision.id, voters: decision.requiredVoters }),
          status: 'success',
        },
      });
    }
  } catch {
    // Best-effort DB persistence
  }

  return decision;
}

/**
 * Cast a vote on a pending decision
 */
export async function castVote(
  decisionId: string,
  agentId: string,
  choice: VoteChoice,
  reasoning: string,
  selectedOption?: string
): Promise<DecisionOutcome | null> {
  const decision = decisionStore.find((d) => d.id === decisionId);
  if (!decision) {
    console.error(`[DecisionEngine] Decision ${decisionId} not found`);
    return null;
  }

  if (decision.status !== 'voting') {
    console.error(`[DecisionEngine] Decision ${decisionId} is no longer accepting votes (${decision.status})`);
    return null;
  }

  // Check if already voted
  if (decision.votes.find((v) => v.agentId === agentId)) {
    console.warn(`[DecisionEngine] ${agentId} already voted on ${decisionId}`);
    return null;
  }

  // Check if voter is authorized
  if (!decision.requiredVoters.includes(agentId)) {
    console.warn(`[DecisionEngine] ${agentId} is not a required voter for ${decisionId}`);
    return null;
  }

  decision.votes.push({
    agentId,
    choice,
    selectedOption,
    reasoning,
    votedAt: new Date(),
  });

  // Notify proposer
  await respondToDecision(agentId, decision.proposedBy, decision.id, choice, reasoning);

  console.log(
    `[DecisionEngine] ${agentId} voted ${choice} on "${decision.title}" (${decision.votes.length}/${decision.requiredVoters.length})`
  );

  // Check if all votes are in
  if (decision.votes.length >= decision.requiredVoters.length) {
    return resolveDecision(decision);
  }

  return null;
}

/**
 * Resolve a decision based on votes
 */
function resolveDecision(decision: DecisionProposal): DecisionOutcome {
  const approveCount = decision.votes.filter((v) => v.choice === 'approve').length;
  const rejectCount = decision.votes.filter((v) => v.choice === 'reject').length;
  const abstainCount = decision.votes.filter((v) => v.choice === 'abstain').length;
  const totalVotes = decision.votes.length;
  const nonAbstainVotes = totalVotes - abstainCount;

  const approvalRate = nonAbstainVotes > 0 ? approveCount / nonAbstainVotes : 0;
  const approved = approvalRate >= decision.consensusThreshold;

  decision.status = approved ? 'approved' : 'rejected';
  decision.resolvedAt = new Date();

  // Determine selected option (most voted)
  if (approved && decision.options.length > 2) {
    const optionVotes = new Map<string, number>();
    for (const v of decision.votes) {
      if (v.selectedOption) {
        optionVotes.set(v.selectedOption, (optionVotes.get(v.selectedOption) || 0) + 1);
      }
    }
    let maxVotes = 0;
    for (const [opt, count] of optionVotes) {
      if (count > maxVotes) {
        maxVotes = count;
        decision.selectedOption = opt;
      }
    }
  }

  const outcome: DecisionOutcome = {
    decisionId: decision.id,
    approved,
    selectedOption: decision.selectedOption,
    voteSummary: {
      total: totalVotes,
      approve: approveCount,
      reject: rejectCount,
      abstain: abstainCount,
    },
    reasoning: `Approval rate: ${(approvalRate * 100).toFixed(0)}% (threshold: ${(decision.consensusThreshold * 100).toFixed(0)}%). ${approveCount} approve, ${rejectCount} reject, ${abstainCount} abstain.`,
  };

  decision.outcome = outcome.reasoning;

  console.log(
    `[DecisionEngine] Decision "${decision.title}" ${decision.status}: ${outcome.reasoning}`
  );

  // Broadcast result
  sendMessage(
    decision.proposedBy,
    decision.proposedBy, // Self-notification
    'STATUS_UPDATE',
    `Decision ${decision.status}: ${decision.title}`,
    outcome.reasoning,
    { metadata: { decisionId: decision.id, outcome } }
  );

  return outcome;
}

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get pending decisions requiring a specific agent's vote
 */
export async function getPendingDecisions(
  agentId: string
): Promise<DecisionProposal[]> {
  return decisionStore.filter(
    (d) =>
      d.status === 'voting' &&
      d.requiredVoters.includes(agentId) &&
      !d.votes.find((v) => v.agentId === agentId) &&
      d.deadline.getTime() > Date.now()
  );
}

/**
 * Get decisions proposed by a specific agent
 */
export async function getProposedDecisions(
  agentId: string
): Promise<DecisionProposal[]> {
  return decisionStore
    .filter((d) => d.proposedBy === agentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get all decisions (admin view)
 */
export async function getAllDecisions(
  filter: {
    status?: DecisionStatus;
    scope?: DecisionScope;
    agentId?: string;
    limit?: number;
  } = {}
): Promise<DecisionProposal[]> {
  return decisionStore
    .filter((d) => {
      if (filter.status && d.status !== filter.status) return false;
      if (filter.scope && d.scope !== filter.scope) return false;
      if (filter.agentId && d.proposedBy !== filter.agentId &&
          !d.requiredVoters.includes(filter.agentId)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, filter.limit || 50);
}

/**
 * Get decision by ID
 */
export async function getDecision(decisionId: string): Promise<DecisionProposal | undefined> {
  return decisionStore.find((d) => d.id === decisionId);
}

/**
 * Get decision engine statistics
 */
export async function getDecisionStats(): Promise<{
  total: number;
  byStatus: Record<DecisionStatus, number>;
  byScope: Record<DecisionScope, number>;
  averageVoteTime: number;
  approvalRate: number;
}> {
  const byStatus: Record<DecisionStatus, number> = {
    proposed: 0, voting: 0, approved: 0, rejected: 0, expired: 0, executed: 0,
  };
  const byScope: Record<DecisionScope, number> = {
    strategic: 0, operational: 0, tactical: 0,
  };

  let totalVoteTimeMs = 0;
  let resolvedCount = 0;
  let approvedCount = 0;

  for (const d of decisionStore) {
    byStatus[d.status]++;
    byScope[d.scope]++;

    if (d.resolvedAt) {
      totalVoteTimeMs += d.resolvedAt.getTime() - d.createdAt.getTime();
      resolvedCount++;
      if (d.status === 'approved') approvedCount++;
    }
  }

  return {
    total: decisionStore.length,
    byStatus,
    byScope,
    averageVoteTime: resolvedCount > 0 ? totalVoteTimeMs / resolvedCount : 0,
    approvalRate: resolvedCount > 0 ? approvedCount / resolvedCount : 0,
  };
}

/**
 * Check and expire overdue decisions
 */
export async function expireOverdueDecisions(): Promise<number> {
  const now = Date.now();
  let expired = 0;
  for (const d of decisionStore) {
    if (d.status === 'voting' && d.deadline.getTime() < now) {
      d.status = 'expired';
      d.resolvedAt = new Date();
      d.outcome = 'Decision expired - deadline passed without sufficient votes.';
      expired++;
    }
  }
  return expired;
}
