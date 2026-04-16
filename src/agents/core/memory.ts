/**
 * Enhanced Agent Memory System
 *
 * Stores decisions, patterns, and task context with:
 * - Cross-agent memory sharing (e.g., CMO shares customer trends with CEO)
 * - Memory categories: STRATEGIC, OPERATIONAL, TACTICAL
 * - Memory querying by other agents
 * - Database synchronization with AgentMemory model
 */

import type { MemoryCategory, MemoryEntry, RelevantMemory, TaskStatus } from './types';

// ─── Extended Memory Types ───────────────────────────────────────────────────

export type MemoryScope = 'private' | 'shared' | 'global';
export type StrategicCategory = 'strategic' | 'operational' | 'tactical';

export interface SharedMemoryEntry extends MemoryEntry {
  scope: MemoryScope;
  strategicCategory: StrategicCategory;
  sharedWith: string[];       // Agent IDs that can access this memory
  tags: string[];             // Searchable tags
  source: string;             // Which agent created it
  accessCount: number;
  lastAccessedAt: Date;
}

export interface MemoryQuery {
  agentId?: string;
  category?: MemoryCategory;
  strategicCategory?: StrategicCategory;
  scope?: MemoryScope;
  tags?: string[];
  minImportance?: number;
  query?: string;
  limit?: number;
}

export interface CrossAgentInsight {
  fromAgentId: string;
  toAgentIds: string[];
  insight: string;
  category: StrategicCategory;
  importance: number;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const memoryStore = new Map<string, SharedMemoryEntry[]>();
const sharedInsights: CrossAgentInsight[] = [];
let memoryIdCounter = 0;

function getAgentMemories(agentId: string): SharedMemoryEntry[] {
  if (!memoryStore.has(agentId)) {
    memoryStore.set(agentId, []);
  }
  return memoryStore.get(agentId)!;
}

// ─── Core Memory Functions ───────────────────────────────────────────────────

/**
 * Store a memory entry (enhanced with scope, strategic category, and sharing)
 */
export async function storeMemory(
  agentId: string,
  content: string,
  category: MemoryCategory,
  importance: number,
  options: {
    scope?: MemoryScope;
    strategicCategory?: StrategicCategory;
    sharedWith?: string[];
    tags?: string[];
    expiresAt?: Date;
  } = {}
): Promise<MemoryEntry> {
  const entry: SharedMemoryEntry = {
    id: `mem_${++memoryIdCounter}`,
    agentId,
    content,
    category,
    importance,
    createdAt: new Date(),
    expiresAt: options.expiresAt,
    scope: options.scope || 'private',
    strategicCategory: options.strategicCategory || 'operational',
    sharedWith: options.sharedWith || [],
    tags: options.tags || [],
    source: agentId,
    accessCount: 0,
    lastAccessedAt: new Date(),
  };

  getAgentMemories(agentId).push(entry);

  // Persist to database
  try {
    const { prisma } = await import('@/lib/prisma');
    const dbAgent = await prisma.agent.findUnique({ where: { name: agentId } });
    if (dbAgent) {
      await prisma.agentMemory.create({
        data: {
          agentId: dbAgent.id,
          type: importance >= 0.8 ? 'long' : 'short',
          category,
          content,
          metadata: JSON.stringify({
            scope: entry.scope,
            strategicCategory: entry.strategicCategory,
            sharedWith: entry.sharedWith,
            tags: entry.tags,
          }),
          importance,
          expiresAt: entry.expiresAt,
        },
      });
    }
  } catch {
    // DB persistence is best-effort
  }

  return entry;
}

/**
 * Get relevant memories with improved scoring
 */
export async function getRelevantMemories(
  agentId: string,
  query: string,
  limit: number
): Promise<RelevantMemory[]> {
  const memories = getAgentMemories(agentId);
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  return memories
    .map((m) => {
      const contentLower = m.content.toLowerCase();
      // Calculate relevance score based on keyword matches and importance
      let matchScore = 0;
      if (contentLower.includes(queryLower)) {
        matchScore = 1.0; // Exact match
      } else {
        const wordMatches = queryWords.filter(w => contentLower.includes(w)).length;
        matchScore = queryWords.length > 0 ? wordMatches / queryWords.length : 0;
      }

      // Factor in importance and recency
      const recencyBoost = Math.max(0, 1 - (Date.now() - m.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
      const relevanceScore = matchScore * 0.5 + m.importance * 0.3 + recencyBoost * 0.2;

      return { ...m, relevanceScore };
    })
    .filter((m) => m.relevanceScore > 0.1)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Get memories by category
 */
export async function getMemoriesByCategory(
  agentId: string,
  category: MemoryCategory
): Promise<MemoryEntry[]> {
  return getAgentMemories(agentId).filter((m) => m.category === category);
}

/**
 * Update memory importance
 */
export async function updateMemoryImportance(
  memoryId: string,
  importance: number
): Promise<void> {
  for (const [, entries] of memoryStore) {
    const entry = entries.find((m) => m.id === memoryId);
    if (entry) {
      entry.importance = importance;
      return;
    }
  }
}

/**
 * Promote a memory to long-term (removes expiry)
 */
export async function promoteToLongTerm(memoryId: string): Promise<void> {
  for (const [, entries] of memoryStore) {
    const entry = entries.find((m) => m.id === memoryId);
    if (entry) {
      delete entry.expiresAt;
      return;
    }
  }
}

// ─── Cross-Agent Memory Sharing ──────────────────────────────────────────────

/**
 * Share an insight across agents (e.g., CMO shares customer trends with CEO)
 */
export async function shareInsightAcrossAgents(
  fromAgentId: string,
  toAgentIds: string[],
  insight: string,
  category: StrategicCategory,
  importance: number = 0.7,
  data?: Record<string, unknown>
): Promise<CrossAgentInsight> {
  const crossInsight: CrossAgentInsight = {
    fromAgentId,
    toAgentIds,
    insight,
    category,
    importance,
    data,
    createdAt: new Date(),
  };

  sharedInsights.push(crossInsight);

  // Store in each target agent's memory as shared
  for (const toAgent of toAgentIds) {
    await storeMemory(
      toAgent,
      `[Shared from ${fromAgentId}] ${insight}`,
      'context',
      importance,
      {
        scope: 'shared',
        strategicCategory: category,
        sharedWith: [fromAgentId, ...toAgentIds],
        tags: ['cross-agent', `from:${fromAgentId}`, category],
      }
    );
  }

  console.log(
    `[Memory] ${fromAgentId} shared insight with [${toAgentIds.join(', ')}]: "${insight.slice(0, 60)}..."`
  );

  return crossInsight;
}

/**
 * Query memories accessible to an agent (including shared ones)
 */
export async function queryAccessibleMemories(
  agentId: string,
  query: MemoryQuery = {}
): Promise<SharedMemoryEntry[]> {
  const results: SharedMemoryEntry[] = [];

  for (const [ownerId, entries] of memoryStore) {
    for (const entry of entries) {
      // Access check: agent's own OR shared with this agent OR global scope
      const canAccess =
        ownerId === agentId ||
        entry.scope === 'global' ||
        (entry.scope === 'shared' && entry.sharedWith.includes(agentId));

      if (!canAccess) continue;

      // Apply filters
      if (query.category && entry.category !== query.category) continue;
      if (query.strategicCategory && entry.strategicCategory !== query.strategicCategory) continue;
      if (query.scope && entry.scope !== query.scope) continue;
      if (query.minImportance && entry.importance < query.minImportance) continue;
      if (query.tags && !query.tags.some(t => entry.tags.includes(t))) continue;
      if (query.query) {
        const q = query.query.toLowerCase();
        if (!entry.content.toLowerCase().includes(q)) continue;
      }

      // Track access
      entry.accessCount++;
      entry.lastAccessedAt = new Date();

      results.push(entry);
    }
  }

  return results
    .sort((a, b) => b.importance - a.importance)
    .slice(0, query.limit || 50);
}

/**
 * Get cross-agent insights for a specific agent
 */
export async function getCrossAgentInsights(
  agentId: string,
  category?: StrategicCategory
): Promise<CrossAgentInsight[]> {
  return sharedInsights.filter(
    (i) =>
      i.toAgentIds.includes(agentId) &&
      (!category || i.category === category)
  );
}

// ─── Decision & Pattern Storage ──────────────────────────────────────────────

export async function storeDecision(
  agentId: string,
  decision: string,
  reasoning: string,
  status: TaskStatus
): Promise<void> {
  await storeMemory(
    agentId,
    `Decision: ${decision} | Reasoning: ${reasoning} | Status: ${status}`,
    'decision',
    0.8,
    { strategicCategory: 'strategic', tags: ['decision', status] }
  );
}

export async function storePattern(
  agentId: string,
  pattern: string,
  description: string,
  importance: number
): Promise<void> {
  await storeMemory(
    agentId,
    `Pattern: ${pattern} | ${description}`,
    'pattern',
    importance,
    { strategicCategory: 'operational', tags: ['pattern'] }
  );
}

export async function storeTaskContext(
  agentId: string,
  taskId: string,
  context: Record<string, unknown>
): Promise<void> {
  await storeMemory(
    agentId,
    `Task ${taskId}: ${JSON.stringify(context)}`,
    'task',
    0.6,
    { strategicCategory: 'tactical', tags: ['task-context', taskId] }
  );
}

// ─── Cleanup & Stats ─────────────────────────────────────────────────────────

export async function cleanupExpiredMemories(agentId: string): Promise<number> {
  const memories = getAgentMemories(agentId);
  const now = Date.now();
  const before = memories.length;
  const filtered = memories.filter((m) => !m.expiresAt || m.expiresAt.getTime() > now);
  memoryStore.set(agentId, filtered);
  return before - filtered.length;
}

export async function getMemoryStats(
  agentId: string
): Promise<{
  total: number;
  byCategory: Record<MemoryCategory, number>;
  byScope: Record<MemoryScope, number>;
  byStrategicCategory: Record<StrategicCategory, number>;
}> {
  const memories = getAgentMemories(agentId);
  const byCategory: Record<MemoryCategory, number> = { decision: 0, pattern: 0, context: 0, task: 0 };
  const byScope: Record<MemoryScope, number> = { private: 0, shared: 0, global: 0 };
  const byStrategicCategory: Record<StrategicCategory, number> = { strategic: 0, operational: 0, tactical: 0 };

  for (const m of memories) {
    byCategory[m.category]++;
    byScope[m.scope]++;
    byStrategicCategory[m.strategicCategory]++;
  }

  return { total: memories.length, byCategory, byScope, byStrategicCategory };
}

export async function searchMemories(
  agentId: string,
  query: string
): Promise<MemoryEntry[]> {
  const queryLower = query.toLowerCase();
  return getAgentMemories(agentId).filter((m) =>
    m.content.toLowerCase().includes(queryLower)
  );
}

/**
 * Get memory stats across all agents (for BI)
 */
export async function getGlobalMemoryStats(): Promise<{
  totalMemories: number;
  byAgent: Record<string, number>;
  sharedInsightsCount: number;
}> {
  const byAgent: Record<string, number> = {};
  let total = 0;

  for (const [agentId, entries] of memoryStore) {
    byAgent[agentId] = entries.length;
    total += entries.length;
  }

  return {
    totalMemories: total,
    byAgent,
    sharedInsightsCount: sharedInsights.length,
  };
}
