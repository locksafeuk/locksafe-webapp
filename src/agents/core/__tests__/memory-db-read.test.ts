/**
 * Regression test for the write-only memory bug: storeMemory persisted to the
 * AgentMemory table but reads consulted only the in-process Map, so on a fresh
 * process persisted memories were never returned. getRelevantMemories must read
 * them back from the DB.
 */
const mockAgentFindUnique = jest.fn();
const mockMemoryFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: (...a: unknown[]) => mockAgentFindUnique(...a) },
    agentMemory: { findMany: (...a: unknown[]) => mockMemoryFindMany(...a) },
  },
}));

import { getRelevantMemories } from "@/agents/core/memory";

beforeEach(() => {
  jest.clearAllMocks();
  mockAgentFindUnique.mockResolvedValue({ id: "agent-obj-id", name: "cmo" });
});

it("returns persisted memories from the DB even with an empty in-process store", async () => {
  mockMemoryFindMany.mockResolvedValue([
    {
      id: "m1",
      content: "Paused campaign TW20 — CPC above cap",
      category: "decision",
      importance: 0.8,
      createdAt: new Date(),
      expiresAt: null,
      metadata: JSON.stringify({ scope: "private", strategicCategory: "operational", tags: ["cpc"] }),
      accessCount: 1,
      lastAccessedAt: new Date(),
    },
  ]);

  const result = await getRelevantMemories("cmo", "campaign CPC cap", 5);
  expect(result).toHaveLength(1);
  expect(result[0].content).toContain("Paused campaign TW20");
});

it("filters out expired DB memories in JS (dodging the Mongo null-vs-missing bug)", async () => {
  mockMemoryFindMany.mockResolvedValue([
    {
      id: "expired",
      content: "stale memory about CPC",
      category: "decision",
      importance: 0.9,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() - 1), // already expired
      metadata: null,
      accessCount: 1,
      lastAccessedAt: new Date(),
    },
  ]);

  const result = await getRelevantMemories("cmo", "CPC", 5);
  expect(result).toHaveLength(0);
});

it("falls back to empty (not throwing) when the DB read fails", async () => {
  mockMemoryFindMany.mockRejectedValue(new Error("db down"));
  const result = await getRelevantMemories("cmo", "anything", 5);
  expect(result).toEqual([]);
});
