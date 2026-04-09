// Agent Memory System - stores decisions, patterns, and task context

import type { MemoryCategory, MemoryEntry, RelevantMemory, TaskStatus } from './types';

// In-memory store (replace with DB in production)
const memoryStore = new Map<string, MemoryEntry[]>();
let memoryIdCounter = 0;

function getAgentMemories(agentId: string): MemoryEntry[] {
  if (!memoryStore.has(agentId)) {
    memoryStore.set(agentId, []);
  }
  return memoryStore.get(agentId)!;
}

export async function storeMemory(
  agentId: string,
  content: string,
  category: MemoryCategory,
  importance: number
): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: `mem_${++memoryIdCounter}`,
    agentId,
    content,
    category,
    importance,
    createdAt: new Date(),
  };
  getAgentMemories(agentId).push(entry);
  return entry;
}

export async function getRelevantMemories(
  agentId: string,
  query: string,
  limit: number
): Promise<RelevantMemory[]> {
  const memories = getAgentMemories(agentId);
  const queryLower = query.toLowerCase();
  return memories
    .filter((m) => m.content.toLowerCase().includes(queryLower))
    .slice(0, limit)
    .map((m) => ({ ...m, relevanceScore: 0.5 }));
}

export async function getMemoriesByCategory(
  agentId: string,
  category: MemoryCategory
): Promise<MemoryEntry[]> {
  return getAgentMemories(agentId).filter((m) => m.category === category);
}

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

export async function promoteToLongTerm(memoryId: string): Promise<void> {
  for (const [, entries] of memoryStore) {
    const entry = entries.find((m) => m.id === memoryId);
    if (entry) {
      delete entry.expiresAt;
      return;
    }
  }
}

export async function storeDecision(
  agentId: string,
  decision: string,
  reasoning: string,
  status: TaskStatus
): Promise<void> {
  await storeMemory(agentId, `Decision: ${decision} | Reasoning: ${reasoning} | Status: ${status}`, 'decision', 0.8);
}

export async function storePattern(
  agentId: string,
  pattern: string,
  description: string,
  importance: number
): Promise<void> {
  await storeMemory(agentId, `Pattern: ${pattern} | ${description}`, 'pattern', importance);
}

export async function storeTaskContext(
  agentId: string,
  taskId: string,
  context: Record<string, unknown>
): Promise<void> {
  await storeMemory(agentId, `Task ${taskId}: ${JSON.stringify(context)}`, 'task', 0.6);
}

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
): Promise<{ total: number; byCategory: Record<MemoryCategory, number> }> {
  const memories = getAgentMemories(agentId);
  const byCategory: Record<MemoryCategory, number> = { decision: 0, pattern: 0, context: 0, task: 0 };
  for (const m of memories) {
    byCategory[m.category]++;
  }
  return { total: memories.length, byCategory };
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
