/**
 * Agent Decisions API
 *
 * GET  - View decision proposals, votes, and outcomes
 * POST - Propose decisions, cast votes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  proposeDecision,
  castVote,
  getPendingDecisions,
  getProposedDecisions,
  getAllDecisions,
  getDecision,
  getDecisionStats,
  expireOverdueDecisions,
  type DecisionScope,
  type DecisionStatus,
  type VoteChoice,
} from '@/agents/core/decision-engine';
import type { MessagePriority } from '@/agents/core/message-bus';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';
    const agentId = searchParams.get('agentId');
    const decisionId = searchParams.get('decisionId');
    const status = searchParams.get('status') as DecisionStatus | null;
    const scope = searchParams.get('scope') as DecisionScope | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'all': {
        const decisions = await getAllDecisions({
          status: status || undefined,
          scope: scope || undefined,
          agentId: agentId || undefined,
          limit,
        });
        return NextResponse.json({
          success: true,
          data: { decisions, count: decisions.length },
          timestamp: new Date().toISOString(),
        });
      }

      case 'pending': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId required for pending decisions' },
            { status: 400 }
          );
        }
        const pending = await getPendingDecisions(agentId);
        return NextResponse.json({
          success: true,
          data: { decisions: pending, count: pending.length, agentId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'proposed': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId required for proposed decisions' },
            { status: 400 }
          );
        }
        const proposed = await getProposedDecisions(agentId);
        return NextResponse.json({
          success: true,
          data: { decisions: proposed, count: proposed.length, agentId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'detail': {
        if (!decisionId) {
          return NextResponse.json(
            { success: false, error: 'decisionId required for detail view' },
            { status: 400 }
          );
        }
        const decision = await getDecision(decisionId);
        if (!decision) {
          return NextResponse.json(
            { success: false, error: 'Decision not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: decision,
          timestamp: new Date().toISOString(),
        });
      }

      case 'stats': {
        const stats = await getDecisionStats();
        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: all, pending, proposed, detail, stats` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Decisions GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'propose': {
        const {
          proposedBy,
          title,
          description,
          scope,
          choices,
          requiredVoters,
          consensusThreshold,
          priority,
          deadlineMs,
        } = body;
        if (!proposedBy || !title || !description) {
          return NextResponse.json(
            { success: false, error: 'proposedBy, title, and description are required' },
            { status: 400 }
          );
        }
        const decision = await proposeDecision(proposedBy, title, description, {
          scope: scope as DecisionScope,
          choices,
          requiredVoters,
          consensusThreshold,
          priority: priority as MessagePriority,
          deadlineMs,
        });
        return NextResponse.json({
          success: true,
          data: decision,
          timestamp: new Date().toISOString(),
        });
      }

      case 'vote': {
        const { decisionId, agentId, choice, reasoning, selectedOption } = body;
        if (!decisionId || !agentId || !choice || !reasoning) {
          return NextResponse.json(
            { success: false, error: 'decisionId, agentId, choice, and reasoning are required' },
            { status: 400 }
          );
        }
        const outcome = await castVote(
          decisionId,
          agentId,
          choice as VoteChoice,
          reasoning,
          selectedOption
        );
        return NextResponse.json({
          success: true,
          data: {
            voted: true,
            outcome: outcome || null,
            message: outcome
              ? `Decision resolved: ${outcome.approved ? 'approved' : 'rejected'}`
              : 'Vote recorded, awaiting more votes',
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'expire': {
        const expired = await expireOverdueDecisions();
        return NextResponse.json({
          success: true,
          data: { expiredCount: expired },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: propose, vote, expire` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Decisions POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
