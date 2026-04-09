/**
 * Inter-Agent Message Bus
 * 
 * Enables agent-to-agent messaging with typed messages,
 * async delivery, acknowledgment, and database persistence.
 */

import type { TaskStatus } from './types';

// ─── Message Types ───────────────────────────────────────────────────────────

export type MessageType =
  | 'TASK_DELEGATION'
  | 'INSIGHT_SHARE'
  | 'DECISION_REQUEST'
  | 'DECISION_RESPONSE'
  | 'STATUS_UPDATE'
  | 'ALERT'
  | 'QUERY'
  | 'QUERY_RESPONSE';

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';
export type MessageStatus = 'pending' | 'delivered' | 'acknowledged' | 'failed' | 'expired';

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  type: MessageType;
  priority: MessagePriority;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
  status: MessageStatus;
  correlationId?: string;  // Link related messages (request/response)
  expiresAt?: Date;
  createdAt: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
}

export interface MessageFilter {
  agentId?: string;
  type?: MessageType;
  priority?: MessagePriority;
  status?: MessageStatus;
  since?: Date;
  limit?: number;
}

export interface MessageBusStats {
  totalMessages: number;
  pending: number;
  delivered: number;
  acknowledged: number;
  byType: Record<MessageType, number>;
  byAgent: Record<string, { sent: number; received: number }>;
}

// ─── In-Memory Message Store ─────────────────────────────────────────────────

const messageStore: AgentMessage[] = [];
let messageIdCounter = 0;
const messageSubscribers = new Map<string, Array<(message: AgentMessage) => void>>();

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Send a message from one agent to another
 */
export async function sendMessage(
  fromAgentId: string,
  toAgentId: string,
  type: MessageType,
  subject: string,
  body: string,
  options: {
    priority?: MessagePriority;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    expiresInMs?: number;
  } = {}
): Promise<AgentMessage> {
  const message: AgentMessage = {
    id: `msg_${++messageIdCounter}_${Date.now()}`,
    fromAgentId,
    toAgentId,
    type,
    priority: options.priority || 'normal',
    subject,
    body,
    metadata: options.metadata,
    status: 'pending',
    correlationId: options.correlationId,
    expiresAt: options.expiresInMs
      ? new Date(Date.now() + options.expiresInMs)
      : undefined,
    createdAt: new Date(),
  };

  messageStore.push(message);

  // Attempt immediate delivery to subscribers
  const subscribers = messageSubscribers.get(toAgentId);
  if (subscribers && subscribers.length > 0) {
    message.status = 'delivered';
    message.deliveredAt = new Date();
    for (const handler of subscribers) {
      try {
        handler(message);
      } catch (err) {
        console.error(`[MessageBus] Subscriber error for ${toAgentId}:`, err);
      }
    }
  }

  console.log(
    `[MessageBus] ${fromAgentId} → ${toAgentId} [${type}] ${subject} (${message.status})`
  );

  // Persist to DB via AgentExecution for audit trail
  try {
    const { prisma } = await import('@/lib/prisma');
    const fromAgent = await prisma.agent.findUnique({ where: { name: fromAgentId } });
    if (fromAgent) {
      await prisma.agentExecution.create({
        data: {
          agentId: fromAgent.id,
          traceId: message.correlationId || message.id,
          actionType: 'message',
          actionName: `send_${type.toLowerCase()}`,
          input: JSON.stringify({
            to: toAgentId,
            subject,
            type,
            priority: message.priority,
          }),
          output: JSON.stringify({ messageId: message.id, status: message.status }),
          status: 'success',
        },
      });
    }
  } catch {
    // DB persistence is best-effort; don't fail message delivery
  }

  return message;
}

/**
 * Get pending messages for an agent (inbox)
 */
export async function getMessages(
  agentId: string,
  filter: Omit<MessageFilter, 'agentId'> = {}
): Promise<AgentMessage[]> {
  const now = Date.now();
  return messageStore
    .filter((m) => {
      if (m.toAgentId !== agentId) return false;
      if (filter.type && m.type !== filter.type) return false;
      if (filter.priority && m.priority !== filter.priority) return false;
      if (filter.status && m.status !== filter.status) return false;
      if (filter.since && m.createdAt < filter.since) return false;
      if (m.expiresAt && m.expiresAt.getTime() < now) {
        m.status = 'expired';
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by priority then recency
      const priorityOrder: Record<MessagePriority, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, filter.limit || 50);
}

/**
 * Get sent messages from an agent (outbox)
 */
export async function getSentMessages(
  agentId: string,
  limit = 50
): Promise<AgentMessage[]> {
  return messageStore
    .filter((m) => m.fromAgentId === agentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Acknowledge receipt of a message
 */
export async function acknowledgeMessage(messageId: string): Promise<boolean> {
  const msg = messageStore.find((m) => m.id === messageId);
  if (!msg) return false;
  msg.status = 'acknowledged';
  msg.acknowledgedAt = new Date();
  return true;
}

/**
 * Subscribe to messages for a specific agent
 */
export function subscribeToMessages(
  agentId: string,
  handler: (message: AgentMessage) => void
): () => void {
  if (!messageSubscribers.has(agentId)) {
    messageSubscribers.set(agentId, []);
  }
  messageSubscribers.get(agentId)!.push(handler);

  // Return unsubscribe function
  return () => {
    const subs = messageSubscribers.get(agentId);
    if (subs) {
      const idx = subs.indexOf(handler);
      if (idx >= 0) subs.splice(idx, 1);
    }
  };
}

// ─── Convenience Messaging Functions ─────────────────────────────────────────

/**
 * Share an insight with another agent (e.g., CMO shares customer trends with CEO)
 */
export async function shareInsight(
  fromAgentId: string,
  toAgentId: string,
  insight: string,
  category: string,
  data?: Record<string, unknown>
): Promise<AgentMessage> {
  return sendMessage(fromAgentId, toAgentId, 'INSIGHT_SHARE', `Insight: ${category}`, insight, {
    priority: 'normal',
    metadata: { category, ...data },
  });
}

/**
 * Request a decision from another agent
 */
export async function requestDecision(
  fromAgentId: string,
  toAgentId: string,
  question: string,
  options: string[],
  context?: Record<string, unknown>
): Promise<AgentMessage> {
  const correlationId = `decision_${Date.now()}`;
  return sendMessage(fromAgentId, toAgentId, 'DECISION_REQUEST', question, JSON.stringify({ options, context }), {
    priority: 'high',
    correlationId,
    metadata: { options, context },
    expiresInMs: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Respond to a decision request
 */
export async function respondToDecision(
  fromAgentId: string,
  toAgentId: string,
  correlationId: string,
  decision: string,
  reasoning: string
): Promise<AgentMessage> {
  return sendMessage(fromAgentId, toAgentId, 'DECISION_RESPONSE', `Decision: ${decision}`, reasoning, {
    priority: 'high',
    correlationId,
    metadata: { decision, reasoning },
  });
}

/**
 * Send a status update to another agent
 */
export async function sendStatusUpdate(
  fromAgentId: string,
  toAgentId: string,
  status: TaskStatus,
  summary: string,
  metrics?: Record<string, unknown>
): Promise<AgentMessage> {
  return sendMessage(fromAgentId, toAgentId, 'STATUS_UPDATE', `Status: ${status}`, summary, {
    priority: 'normal',
    metadata: { status, metrics },
  });
}

/**
 * Broadcast a message to all agents
 */
export async function broadcastMessage(
  fromAgentId: string,
  type: MessageType,
  subject: string,
  body: string,
  targetAgents: string[] = ['ceo', 'cmo', 'coo', 'cto'],
  options: { priority?: MessagePriority; metadata?: Record<string, unknown> } = {}
): Promise<AgentMessage[]> {
  const messages: AgentMessage[] = [];
  for (const toAgent of targetAgents) {
    if (toAgent !== fromAgentId) {
      const msg = await sendMessage(fromAgentId, toAgent, type, subject, body, options);
      messages.push(msg);
    }
  }
  return messages;
}

// ─── Message History & Stats ─────────────────────────────────────────────────

/**
 * Get full conversation thread by correlation ID
 */
export async function getConversationThread(
  correlationId: string
): Promise<AgentMessage[]> {
  return messageStore
    .filter((m) => m.correlationId === correlationId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Get all messages (for admin/dashboard view)
 */
export async function getAllMessages(
  filter: MessageFilter = {}
): Promise<AgentMessage[]> {
  const now = Date.now();
  return messageStore
    .filter((m) => {
      if (filter.agentId && m.fromAgentId !== filter.agentId && m.toAgentId !== filter.agentId) return false;
      if (filter.type && m.type !== filter.type) return false;
      if (filter.priority && m.priority !== filter.priority) return false;
      if (filter.status && m.status !== filter.status) return false;
      if (filter.since && m.createdAt < filter.since) return false;
      // Mark expired
      if (m.expiresAt && m.expiresAt.getTime() < now) m.status = 'expired';
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, filter.limit || 100);
}

/**
 * Get message bus statistics
 */
export async function getMessageBusStats(): Promise<MessageBusStats> {
  const stats: MessageBusStats = {
    totalMessages: messageStore.length,
    pending: 0,
    delivered: 0,
    acknowledged: 0,
    byType: {} as Record<MessageType, number>,
    byAgent: {},
  };

  const types: MessageType[] = [
    'TASK_DELEGATION', 'INSIGHT_SHARE', 'DECISION_REQUEST',
    'DECISION_RESPONSE', 'STATUS_UPDATE', 'ALERT', 'QUERY', 'QUERY_RESPONSE',
  ];
  for (const t of types) stats.byType[t] = 0;

  for (const m of messageStore) {
    if (m.status === 'pending') stats.pending++;
    if (m.status === 'delivered') stats.delivered++;
    if (m.status === 'acknowledged') stats.acknowledged++;
    stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;

    // Track per-agent
    if (!stats.byAgent[m.fromAgentId]) stats.byAgent[m.fromAgentId] = { sent: 0, received: 0 };
    if (!stats.byAgent[m.toAgentId]) stats.byAgent[m.toAgentId] = { sent: 0, received: 0 };
    stats.byAgent[m.fromAgentId].sent++;
    stats.byAgent[m.toAgentId].received++;
  }

  return stats;
}

/**
 * Cleanup expired messages
 */
export async function cleanupExpiredMessages(): Promise<number> {
  const now = Date.now();
  const before = messageStore.length;
  const active = messageStore.filter(
    (m) => !m.expiresAt || m.expiresAt.getTime() > now
  );
  messageStore.length = 0;
  messageStore.push(...active);
  return before - active.length;
}
