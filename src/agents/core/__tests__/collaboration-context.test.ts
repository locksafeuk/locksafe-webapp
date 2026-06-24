jest.mock("@/agents/core/memory", () => ({ getRelevantMemories: jest.fn() }));
jest.mock("@/agents/core/message-bus", () => ({ getMessages: jest.fn() }));

import { getRelevantMemories } from "@/agents/core/memory";
import { getMessages } from "@/agents/core/message-bus";
import { buildCollaborationContext } from "@/agents/core/collaboration-context";

const mockMem = getRelevantMemories as jest.Mock;
const mockMsg = getMessages as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMem.mockResolvedValue([]);
  mockMsg.mockResolvedValue([]);
});

it("returns no parts when there is no memory or inbox", async () => {
  expect(await buildCollaborationContext("cmo", "q")).toEqual([]);
});

it("renders relevant memories", async () => {
  mockMem.mockResolvedValue([{ content: "Paused campaign X (high CPC)" }]);
  const parts = await buildCollaborationContext("cmo", "campaign");
  expect(parts.join("\n")).toContain("Relevant memory from prior runs");
  expect(parts.join("\n")).toContain("Paused campaign X (high CPC)");
});

it("renders unread inbox messages and skips acknowledged ones", async () => {
  mockMsg.mockResolvedValue([
    { priority: "high", fromAgentId: "ceo", type: "TASK_DELEGATION", subject: "Review spend", body: "Check Q3 budget", status: "delivered" },
    { priority: "normal", fromAgentId: "coo", type: "STATUS_UPDATE", subject: "All clear", body: "ops nominal", status: "acknowledged" },
  ]);
  const text = (await buildCollaborationContext("cmo", "q")).join("\n");
  expect(text).toContain("Unread messages from other agents");
  expect(text).toContain("Review spend");
  expect(text).not.toContain("All clear"); // acknowledged excluded
});

it("degrades gracefully when a source throws", async () => {
  mockMem.mockRejectedValue(new Error("db down"));
  mockMsg.mockResolvedValue([{ priority: "low", fromAgentId: "cto", type: "ALERT", subject: "disk", body: "85%", status: "pending" }]);
  const text = (await buildCollaborationContext("cmo", "q")).join("\n");
  expect(text).toContain("disk"); // inbox still rendered despite memory failure
});
