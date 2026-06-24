/**
 * @jest-environment node
 *
 * Guards the durable message bus, especially the cleanup query shape — a naive
 * `{ expiresAt: { lt: now } }` matches unset fields on Mongo and would wipe the
 * whole bus every heartbeat. Cleanup must require a non-null expiresAt too.
 */
const store: Array<Record<string, unknown>> = [];
let idc = 0;
const deleteManyMock = jest.fn(async () => ({ count: 0 }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: async () => ({ id: "obj-id" }) },
    agentMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `id${++idc}`,
          createdAt: new Date(Date.now() + idc), // stable increasing order
          deliveredAt: null,
          acknowledgedAt: null,
          expiresAt: null,
          correlationId: null,
          metadata: null,
          ...data,
        };
        store.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        let rows = [...store];
        if (where?.toAgentName) rows = rows.filter((r) => r.toAgentName === where.toAgentName);
        if (where?.fromAgentName) rows = rows.filter((r) => r.fromAgentName === where.fromAgentName);
        return rows;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = store.find((x) => x.id === where.id);
        if (!r) throw new Error("not found");
        Object.assign(r, data);
        return r;
      },
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  sendMessage, getMessages, acknowledgeMessage, cleanupExpiredMessages,
} from "@/agents/core/message-bus";

beforeEach(() => {
  store.length = 0;
  idc = 0;
  deleteManyMock.mockClear();
});

it("persists a message with name endpoints and returns the interface shape", async () => {
  const m = await sendMessage("ceo", "cmo", "TASK_DELEGATION", "do X", "details");
  expect(m.fromAgentId).toBe("ceo"); // interface keeps `fromAgentId` = name
  expect(m.toAgentId).toBe("cmo");
  expect(store[0].fromAgentName).toBe("ceo");
  expect(store[0].toAgentName).toBe("cmo");
});

it("inbox sorts critical before normal", async () => {
  await sendMessage("ceo", "cmo", "STATUS_UPDATE", "normal", "b", { priority: "normal" });
  await sendMessage("ceo", "cmo", "ALERT", "crit", "b", { priority: "critical" });
  const inbox = await getMessages("cmo");
  expect(inbox[0].priority).toBe("critical");
});

it("excludes expired messages from the inbox (JS filter)", async () => {
  await sendMessage("ceo", "cmo", "ALERT", "live", "b");
  // force one expired
  const exp = await sendMessage("ceo", "cmo", "ALERT", "dead", "b");
  store.find((r) => r.id === (exp as { id: string }).id)!.expiresAt = new Date(Date.now() - 1000);
  const inbox = await getMessages("cmo");
  expect(inbox.map((m) => m.subject)).toEqual(["live"]);
});

it("acknowledge flips status", async () => {
  const m = await sendMessage("ceo", "cmo", "ALERT", "x", "b");
  expect(await acknowledgeMessage(m.id)).toBe(true);
  expect(store[0].status).toBe("acknowledged");
});

it("cleanup requires a non-null expiresAt (never matches unset rows)", async () => {
  await cleanupExpiredMessages();
  const where = deleteManyMock.mock.calls[0][0].where;
  // must AND a not-null guard with the lt comparison
  expect(JSON.stringify(where)).toContain('"not":null');
  expect(JSON.stringify(where)).toContain('"lt"');
});
