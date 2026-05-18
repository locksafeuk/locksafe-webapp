/**
 * Agent Orchestrator API
 *
 * GET  - Get agent system status and health
 * POST - Trigger orchestration actions (heartbeat, delegate, coordinate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromCookies } from '@/lib/agent-api-auth';
import { logAgentApiMutation } from '@/lib/agent-api-audit';
import {
  getAgentStatusSummary,
  runAllHeartbeats,
  delegateTask,
  coordinateTask,
  syncAllAgentsFromDB,
  pauseAgent,
  resumeAgent,
  getAgentsDueForHeartbeat,
} from '@/agents/core/orchestrator';

const idempotencyStore = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function registerIdempotencyKey(action: string, key: string): boolean {
  const now = Date.now();

  for (const [storedKey, expiresAt] of idempotencyStore.entries()) {
    if (expiresAt <= now) idempotencyStore.delete(storedKey);
  }

  const compositeKey = `${action}:${key}`;
  const existingExpiry = idempotencyStore.get(compositeKey);
  if (existingExpiry && existingExpiry > now) return false;

  idempotencyStore.set(compositeKey, now + IDEMPOTENCY_TTL_MS);
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status': {
        const summary = await getAgentStatusSummary();
        return NextResponse.json({
          success: true,
          data: summary,
          timestamp: new Date().toISOString(),
        });
      }

      case 'due': {
        const dueAgents = await getAgentsDueForHeartbeat();
        return NextResponse.json({
          success: true,
          data: { dueAgents, count: dueAgents.length },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Orchestrator GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const idempotencyKeyHeader = request.headers.get('x-idempotency-key')?.trim();
    const idempotentActions = new Set([
      'heartbeat',
      'delegate',
      'coordinate',
      'sync',
      'pause',
      'resume',
    ]);

    if (idempotencyKeyHeader && idempotentActions.has(action)) {
      const accepted = registerIdempotencyKey(action, idempotencyKeyHeader);
      if (!accepted) {
        return NextResponse.json(
          {
            success: false,
            error: 'Duplicate request blocked by idempotency protection',
            action,
            idempotencyKey: idempotencyKeyHeader,
          },
          { status: 409 }
        );
      }
    }

    switch (action) {
      case 'heartbeat': {
        const results = await runAllHeartbeats();
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_heartbeat',
          targetAgentName: 'ceo',
          input: { action },
          output: { agentsRun: results.length },
        });
        return NextResponse.json({
          success: true,
          data: {
            agentsRun: results.length,
            totalActions: results.reduce((s, r) => s + r.actionsExecuted, 0),
            totalCost: results.reduce((s, r) => s + r.costUsd, 0),
            results,
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'delegate': {
        const { fromAgent, toAgent, title, description, priority, deadline } = body;
        if (!fromAgent || !toAgent || !title) {
          return NextResponse.json(
            { success: false, error: 'fromAgent, toAgent, and title are required' },
            { status: 400 }
          );
        }
        const taskId = await delegateTask(fromAgent, toAgent, {
          title,
          description: description || '',
          priority: priority || 5,
          deadline: deadline ? new Date(deadline) : undefined,
        });
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_delegate',
          targetAgentName: toAgent,
          input: { fromAgent, toAgent, title, priority: priority || 5 },
          output: { taskId },
        });
        return NextResponse.json({
          success: true,
          data: { taskId, fromAgent, toAgent, title },
          timestamp: new Date().toISOString(),
        });
      }

      case 'coordinate': {
        const { initiator, taskTitle, taskDescription, agents, priority: coordPriority } = body;
        if (!initiator || !taskTitle || !agents) {
          return NextResponse.json(
            { success: false, error: 'initiator, taskTitle, and agents are required' },
            { status: 400 }
          );
        }
        const result = await coordinateTask(
          initiator,
          taskTitle,
          taskDescription || '',
          agents,
          coordPriority || 5
        );
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_coordinate',
          targetAgentName: initiator,
          input: { initiator, taskTitle, agents, priority: coordPriority || 5 },
          output: { correlationId: result.correlationId, taskCount: result.taskIds.length },
        });
        return NextResponse.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'sync': {
        const synced = await syncAllAgentsFromDB();
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_sync',
          targetAgentName: 'ceo',
          input: { action },
          output: { agentsSynced: synced },
        });
        return NextResponse.json({
          success: true,
          data: { agentsSynced: synced },
          timestamp: new Date().toISOString(),
        });
      }

      case 'pause': {
        const { agentId: pauseId } = body;
        if (!pauseId) {
          return NextResponse.json({ success: false, error: 'agentId required' }, { status: 400 });
        }
        const paused = await pauseAgent(pauseId);
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_pause',
          targetAgentName: pauseId,
          input: { agentId: pauseId },
          output: { paused },
        });
        return NextResponse.json({
          success: paused,
          data: { agentId: pauseId, status: paused ? 'paused' : 'not_found' },
          timestamp: new Date().toISOString(),
        });
      }

      case 'resume': {
        const { agentId: resumeId } = body;
        if (!resumeId) {
          return NextResponse.json({ success: false, error: 'agentId required' }, { status: 400 });
        }
        const resumed = await resumeAgent(resumeId);
        await logAgentApiMutation({
          admin,
          actionName: 'orchestrator_resume',
          targetAgentName: resumeId,
          input: { agentId: resumeId },
          output: { resumed },
        });
        return NextResponse.json({
          success: resumed,
          data: { agentId: resumeId, status: resumed ? 'active' : 'not_found' },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: heartbeat, delegate, coordinate, sync, pause, resume` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Orchestrator POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
