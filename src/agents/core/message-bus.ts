/**
 * Inter-Agent Message Bus (durable)
 *
 * Agent-to-agent messaging with typed messages and DB persistence via the
 * AgentMessage model, so delegations / status updates survive process restarts
 * and serverless cold starts. Reads poll the DB (the authoritative inbox);
 * in-process subscribers remain as best-effort same-process notification only.
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
  fromAgentId: string; // agent NAME (kept as `fromAgentId` for API/BI contract)
  toAgentId: string;   // agent NAME
  type: MessageType;
  priority: MessagePriority;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
  status: MessageStatus;
  correlationId?: string;
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

// ─── Same-process subscribers (best-effort notification only) ────────────────

const messageSubscribers = new Map<string, Array<(message: AgentMessage) => void>>();

const PRIORITY_ORDER: Record<MessagePriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

async function getDb() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMessage(r: any): AgentMessage {
  return {
    id: r.id,
    fromAgentId: r.fromAgentName,
    toAgentId: r.toAgentName,
    type: r.type as MessageType,
    priority: r.priority as MessagePriority,
    subject: r.subject,
    body: r.body,
    metadata: (r.metadata as Record<string, unknown> | null) ?? undefined,
    status: r.status as MessageStatus,
    correlationId: r.correlationId ?? undefined,
    expiresAt: r.expiresAt ?? undefined,
    createdAt: r.createdAt,
    deliveredAt: r.deliveredAt ?? undefined,
    acknowledgedAt: r.acknowledgedAt ?? undefined,
  };
}

function notExpired(m: { expiresAt?: Date }, now: number): boolean {
  return !m.expiresAt || m.expiresAt.getTime() > now;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Send a message from one agent to another (persisted to AgentMessage).
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
  const priority = options.priority || 'normal';
  const expiresAt = options.expiresInMs ? new Date(Date.now() + options.expiresInMs) : null;

  // Same-process subscribers (best-effort) — if present, mark delivered.
  const subscribers = messageSubscribers.get(toAgentId);
  const delivered = !!(subscribers && subscribers.length > 0);

  const db = await getDb();

  // Best-effort resolve the sender's Agent row for the optional FK.
  let fromAgentDbId: string | null = null;
  try {
    const a = await db.agent.findUnique({ where: { name: fromAgentId }, select: { id: true } });
    fromAgentDbId = a?.id ?? null;
  } catch {
    // best-effort
  }

  const row = await db.agentMessage.create({
    data: {
      fromAgentName: fromAgentId,
      toAgentName: toAgentId,
      fromAgentId: fromAgentDbId,
      type,
      priority,
      status: delivered ? 'delivered' : 'pending',
      subject,
      body,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (options.metadata as any) ?? undefined,
      correlationId: options.correlationId ?? null,
      expiresAt,
      deliveredAt: delivered ? new Date() : null,
    },
  });

  const message = rowToMessage(row);

  if (delivered && subscribers) {
    for (const handler of subscribers) {
      try {
        handler(message);
      } catch (err) {
        console.error(`[MessageBus] Subscriber error for ${toAgentId}:`, err);
      }
    }
  }

  console.log(`[MessageBus] ${fromAgentId} → ${toAgentId} [${type}] ${subject} (${message.status})`);
  return message;
}

/**
 * Get pending messages for an agent (inbox). Reads the DB; expiry is filtered
 * in JS to dodge the Prisma+Mongo null-vs-missing footgun (most rows have no
 * expiresAt). Sorted by priority then recency.
 */
export async function getMessages(
  agentId: string,
  filter: Omit<MessageFilter, 'agentId'> = {}
): Promise<AgentMessage[]> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { toAgentName: agentId };
  if (filter.type) where.type = filter.type;
  if (filter.priority) where.priority = filter.priority;
  if (filter.status) where.status = filter.status;
  if (filter.since) where.createdAt = { gte: filter.since };

  const rows = await db.agentMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  const now = Date.now();
  return rows
    .map(rowToMessage)
    .filter((m) => notExpired(m, now))
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, filter.limit || 50);
}

/**
 * Get sent messages from an agent (outbox).
 */
export async function getSentMessages(agentId: string, limit = 50): Promise<AgentMessage[]> {
  const db = await getDb();
  const rows = await db.agentMessage.findMany({
    where: { fromAgentName: agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(rowToMessage);
}

/**
 * Acknowledge receipt of a message.
 */
export async function acknowledgeMessage(messageId: string): Promise<boolean> {
  const db = await getDb();
  try {
    await db.agentMessage.update({
      where: { id: messageId },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
    return true;
  } catch {
    return false; // not found
  }
}

/**
 * Subscribe to messages for a specific agent (best-effort, same-process only).
 */
export function subscribeToMessages(
  agentId: string,
  handler: (message: AgentMessage) => void
): () => void {
  if (!messageSubscribers.has(agentId)) {
    messageSubscribers.set(agentId, []);
  }
  messageSubscribers.get(agentId)!.push(handler);
  return () => {
    const subs = messageSubscribers.get(agentId);
    if (subs) {
      const idx = subs.indexOf(handler);
      if (idx >= 0) subs.splice(idx, 1);
    }
  };
}

// ─── Convenience Messaging Functions ─────────────────────────────────────────

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
    expiresInMs: 24 * 60 * 60 * 1000,
  });
}

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
 * Get full conversation thread by correlation ID.
 */
export async function getConversationThread(correlationId: string): Promise<AgentMessage[]> {
  const db = await getDb();
  const rows = await db.agentMessage.findMany({
    where: { correlationId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(rowToMessage);
}

/**
 * Get all messages (for admin/dashboard view).
 */
export async function getAllMessages(filter: MessageFilter = {}): Promise<AgentMessage[]> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (filter.agentId) where.OR = [{ fromAgentName: filter.agentId }, { toAgentName: filter.agentId }];
  if (filter.type) where.type = filter.type;
  if (filter.priority) where.priority = filter.priority;
  if (filter.status) where.status = filter.status;
  if (filter.since) where.createdAt = { gte: filter.since };

  const rows = await db.agentMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: filter.limit || 100 });
  return rows.map(rowToMessage);
}

/**
 * Get message bus statistics (shape consumed by business-intelligence.ts).
 */
export async function getMessageBusStats(): Promise<MessageBusStats> {
  const db = await getDb();
  const types: MessageType[] = [
    'TASK_DELEGATION', 'INSIGHT_SHARE', 'DECISION_REQUEST',
    'DECISION_RESPONSE', 'STATUS_UPDATE', 'ALERT', 'QUERY', 'QUERY_RESPONSE',
  ];
  const stats: MessageBusStats = {
    totalMessages: 0,
    pending: 0,
    delivered: 0,
    acknowledged: 0,
    byType: {} as Record<MessageType, number>,
    byAgent: {},
  };
  for (const t of types) stats.byType[t] = 0;

  // Message volume is low; aggregate a capped recent window in JS for accuracy
  // without relying on Mongo groupBy edge cases.
  const rows = await db.agentMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { type: true, status: true, fromAgentName: true, toAgentName: true },
  });

  stats.totalMessages = rows.length;
  for (const m of rows) {
    if (m.status === 'pending') stats.pending++;
    if (m.status === 'delivered') stats.delivered++;
    if (m.status === 'acknowledged') stats.acknowledged++;
    stats.byType[m.type as MessageType] = (stats.byType[m.type as MessageType] || 0) + 1;
    if (!stats.byAgent[m.fromAgentName]) stats.byAgent[m.fromAgentName] = { sent: 0, received: 0 };
    if (!stats.byAgent[m.toAgentName]) stats.byAgent[m.toAgentName] = { sent: 0, received: 0 };
    stats.byAgent[m.fromAgentName].sent++;
    stats.byAgent[m.toAgentName].received++;
  }

  return stats;
}

/**
 * Cleanup expired messages (deletes rows whose expiresAt is in the past).
 */
export async function cleanupExpiredMessages(): Promise<number> {
  const db = await getDb();
  // CRITICAL: on Mongo, `{ expiresAt: { lt: now } }` ALSO matches unset/null
  // fields (null sorts before dates), which would delete every message (most
  // have no expiry) on every heartbeat. Require a real, non-null value too.
  const res = await db.agentMessage.deleteMany({
    where: { AND: [{ expiresAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
  });
  return res.count;
}
