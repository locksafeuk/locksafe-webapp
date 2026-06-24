/**
 * Deterministic all-agent execution reflection: write a lesson only for tools
 * that fail persistently (>= minFailures AND failing >= succeeding), dedup
 * within 3 days, and surface nothing for healthy tools.
 */
const mockAgentFindUnique = jest.fn();
const mockExecFindMany = jest.fn();
const mockMemFindFirst = jest.fn();
const mockStoreMemory = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    agent: { findUnique: (...a: unknown[]) => mockAgentFindUnique(...a) },
    agentExecution: { findMany: (...a: unknown[]) => mockExecFindMany(...a) },
    agentMemory: { findFirst: (...a: unknown[]) => mockMemFindFirst(...a) },
  },
}));
jest.mock("@/agents/core/memory", () => ({
  storeMemory: (...a: unknown[]) => mockStoreMemory(...a),
}));
// seed-bank is imported transitively by reflection; stub it.
jest.mock("@/agents/core/seed-bank", () => ({ applyReflectionToPlaybook: jest.fn() }));

import { reflectOnAgentExecutions } from "@/agents/core/reflection";

const exec = (actionName: string, status: "success" | "failed", error?: string) => ({
  actionName,
  status,
  output: status === "failed" ? JSON.stringify({ ok: false, error }) : JSON.stringify({ ok: true }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAgentFindUnique.mockResolvedValue({ id: "agent-id" });
  mockMemFindFirst.mockResolvedValue(null); // no recent dedup hit
});

it("writes a lesson for a persistently-failing tool", async () => {
  mockExecFindMany.mockResolvedValue([
    exec("publishCampaign", "failed", "policy violation"),
    exec("publishCampaign", "failed", "policy violation"),
    exec("publishCampaign", "failed", "budget cap"),
    exec("publishCampaign", "success"),
  ]);
  const r = await reflectOnAgentExecutions("cmo");
  expect(r.lessonsWritten).toBe(1);
  const [agentName, content] = mockStoreMemory.mock.calls[0];
  expect(agentName).toBe("cmo");
  expect(content).toContain('tool "publishCampaign"');
  expect(content).toContain("policy violation"); // sample error included
});

it("does NOT flag a mostly-succeeding tool", async () => {
  mockExecFindMany.mockResolvedValue([
    exec("getStatus", "failed", "timeout"),
    ...Array.from({ length: 5 }, () => exec("getStatus", "success")),
  ]);
  const r = await reflectOnAgentExecutions("ceo");
  expect(r.lessonsWritten).toBe(0);
  expect(mockStoreMemory).not.toHaveBeenCalled();
});

it("ignores a single one-off failure (below minFailures)", async () => {
  mockExecFindMany.mockResolvedValue([exec("checkDb", "failed", "blip")]);
  const r = await reflectOnAgentExecutions("cto");
  expect(r.lessonsWritten).toBe(0);
});

it("dedups when a recent lesson already exists for that tool", async () => {
  mockExecFindMany.mockResolvedValue([
    exec("sendSms", "failed", "63016"),
    exec("sendSms", "failed", "63016"),
  ]);
  mockMemFindFirst.mockResolvedValue({ id: "existing-lesson" });
  const r = await reflectOnAgentExecutions("coo");
  expect(r.lessonsWritten).toBe(0);
  expect(mockStoreMemory).not.toHaveBeenCalled();
});

it("returns zero when the agent has no Agent row", async () => {
  mockAgentFindUnique.mockResolvedValue(null);
  const r = await reflectOnAgentExecutions("ghost");
  expect(r).toEqual({ lessonsWritten: 0, toolsReviewed: 0 });
});
