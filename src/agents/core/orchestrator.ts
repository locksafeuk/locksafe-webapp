// Agent Orchestrator - manages heartbeats, task delegation, and agent state

import type {
  HeartbeatResult,
  AgentStatusMessage,
  TaskCreateRequest,
  AgentRuntimeState,
} from './types';

// In-memory agent state store
const agentStates = new Map<string, AgentRuntimeState>();

// Telegram rate limiting
let lastTelegramMessage = 0;
const TELEGRAM_RATE_LIMIT_MS = 3000; // 3 seconds between messages

export function canSendTelegramMessage(): boolean {
  return Date.now() - lastTelegramMessage > TELEGRAM_RATE_LIMIT_MS;
}

export function recordTelegramMessage(): void {
  lastTelegramMessage = Date.now();
}

export async function runAllHeartbeats(): Promise<HeartbeatResult[]> {
  const results: HeartbeatResult[] = [];
  for (const [agentId] of agentStates) {
    try {
      const result = await executeHeartbeat(agentId);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        agentName: agentId,
        actionsExecuted: 0,
        costUsd: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        nextHeartbeat: new Date(Date.now() + 3600000),
      });
    }
  }
  return results;
}

export async function getAgentStatusSummary(): Promise<{
  total: number;
  active: number;
  paused: number;
  agents: AgentStatusMessage[];
}> {
  const agents: AgentStatusMessage[] = [];
  let active = 0;
  let paused = 0;

  for (const [, state] of agentStates) {
    const statusMsg: AgentStatusMessage = {
      name: state.agentId,
      agentName: state.agentId,
      displayName: state.agentId,
      status: state.status,
      lastHeartbeat: state.lastHeartbeat,
      pendingTasks: 0,
      budgetUsed: 0,
      budgetTotal: 50,
    };
    agents.push(statusMsg);
    if (state.status === 'active') active++;
    if (state.status === 'paused') paused++;
  }

  return { total: agents.length, active, paused, agents };
}

export async function executeHeartbeat(agentId: string): Promise<HeartbeatResult> {
  const state = agentStates.get(agentId);
  const now = new Date();

  if (state) {
    state.lastHeartbeat = now;
    state.nextHeartbeat = new Date(now.getTime() + 3600000);
  }

  return {
    success: true,
    agentName: agentId,
    actionsExecuted: 0,
    costUsd: 0,
    errors: [],
    nextHeartbeat: new Date(now.getTime() + 3600000),
  };
}

export async function delegateTask(
  fromAgentId: string,
  toAgent: string,
  task: TaskCreateRequest
): Promise<void> {
  console.log(`[Orchestrator] Task delegated from ${fromAgentId} to ${toAgent}: ${task.title}`);
}

export async function initializeAgentState(agentId: string): Promise<AgentRuntimeState> {
  const state: AgentRuntimeState = {
    agentId,
    status: 'active',
    lastHeartbeat: null,
    nextHeartbeat: new Date(Date.now() + 3600000),
  };
  agentStates.set(agentId, state);
  return state;
}

export async function getAgentsDueForHeartbeat(): Promise<string[]> {
  const now = Date.now();
  const due: string[] = [];
  for (const [agentId, state] of agentStates) {
    if (state.status === 'active' && state.nextHeartbeat.getTime() <= now) {
      due.push(agentId);
    }
  }
  return due;
}
