/**
 * Call-Intent Matcher — unit tests.
 *
 * Pins the two-strategy matcher contract:
 *   • visitor-scoped match wins when visitorId is supplied
 *   • global-recent fallback when visitorId is absent
 *   • 5-minute window enforced both directions (no future, no stale)
 *   • atomic stamp prevents double-claim under concurrent Retell webhooks
 *   • invalid timestamps rejected
 *
 * Prisma is mocked. No DB connection needed.
 */

const findFirstMock  = jest.fn();
const updateManyMock = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    callIntent: {
      findFirst:  findFirstMock,
      updateMany: updateManyMock,
    },
  },
  default: {
    callIntent: {
      findFirst:  findFirstMock,
      updateMany: updateManyMock,
    },
  },
}));

import {
  matchInboundCall,
  MATCH_WINDOW_MS,
} from "@/lib/marketing/call-intent-matcher";

beforeEach(() => {
  findFirstMock.mockReset();
  updateManyMock.mockReset();
  updateManyMock.mockResolvedValue({ count: 1 });
});

// ── Window constant sanity ──────────────────────────────────────────────────

describe("MATCH_WINDOW_MS", () => {
  it("is 5 minutes (300_000ms)", () => {
    expect(MATCH_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

// ── Visitor-scoped strategy ─────────────────────────────────────────────────

describe("matchInboundCall — visitor_scoped strategy", () => {
  it("matches a recent CallIntent for the same visitor", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-1" });

    const result = await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: new Date(),
      visitorId:     "visitor-1",
    });

    expect(result.matched).toBe(true);
    expect(result.intentId).toBe("intent-1");
    expect(result.strategy).toBe("visitor_scoped");
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "intent-1", matched: false },
      data: expect.objectContaining({
        matched:      true,
        retellCallId: "call-abc",
      }),
    });
  });

  it("queries CallIntent with visitor scope + matched=false + time window", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-1" });

    const startedAt = new Date("2026-05-26T12:00:00Z");
    await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: startedAt,
      visitorId:     "visitor-1",
    });

    const where = findFirstMock.mock.calls[0][0].where;
    expect(where.visitorId).toBe("visitor-1");
    expect(where.matched).toBe(false);
    expect(where.createdAt.gte.getTime()).toBe(startedAt.getTime() - MATCH_WINDOW_MS);
    expect(where.createdAt.lte.getTime()).toBe(startedAt.getTime());
  });

  it("falls through to global_recent when no visitor-scoped intent found", async () => {
    findFirstMock
      .mockResolvedValueOnce(null)                  // visitor-scoped: nothing
      .mockResolvedValueOnce({ id: "intent-2" });   // global-recent: hit

    const result = await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: new Date(),
      visitorId:     "visitor-1",
    });
    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("global_recent");
    expect(result.intentId).toBe("intent-2");
  });

  it("falls through to global_recent when the atomic update was lost (race)", async () => {
    // First findFirst returns a candidate, but updateMany returns count=0
    // (someone else matched it concurrently). Should fall through to global.
    findFirstMock
      .mockResolvedValueOnce({ id: "intent-1" })   // visitor-scoped find
      .mockResolvedValueOnce({ id: "intent-2" });  // global-recent find
    updateManyMock
      .mockResolvedValueOnce({ count: 0 })          // visitor-scoped stamp lost the race
      .mockResolvedValueOnce({ count: 1 });         // global-recent stamp wins

    const result = await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: new Date(),
      visitorId:     "visitor-1",
    });
    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("global_recent");
  });
});

// ── Global-recent strategy ──────────────────────────────────────────────────

describe("matchInboundCall — global_recent strategy", () => {
  it("matches the freshest unmatched intent within the window", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-global-1" });

    const result = await matchInboundCall({
      retellCallId:  "call-xyz",
      callStartedAt: new Date(),
      // intentionally no visitorId
    });

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("global_recent");
    expect(result.intentId).toBe("intent-global-1");

    // Confirm the where clause has NO visitor scope
    const where = findFirstMock.mock.calls[0][0].where;
    expect(where.visitorId).toBeUndefined();
    expect(where.matched).toBe(false);
  });

  it("returns matched=false when nothing is found in either strategy", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await matchInboundCall({
      retellCallId:  "call-xyz",
      callStartedAt: new Date(),
      visitorId:     "visitor-9",
    });
    expect(result.matched).toBe(false);
    expect(result.intentId).toBeUndefined();
    expect(result.reason).toMatch(/no unmatched/i);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe("matchInboundCall — edge cases", () => {
  it("rejects an invalid callStartedAt", async () => {
    const result = await matchInboundCall({
      retellCallId:  "call-bad",
      callStartedAt: "not-a-date",
    });
    expect(result.matched).toBe(false);
    expect(result.reason).toMatch(/invalid callStartedAt/i);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("accepts an ISO string callStartedAt", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-1" });

    const result = await matchInboundCall({
      retellCallId:  "call-iso",
      callStartedAt: "2026-05-26T12:00:00Z",
      visitorId:     "v-1",
    });
    expect(result.matched).toBe(true);
  });

  it("stamps callerIdE164 on the matched intent for audit", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-1" });

    await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: new Date(),
      callerIdE164:  "+447700900123",
      visitorId:     "v-1",
    });

    const data = updateManyMock.mock.calls[0][0].data;
    expect(data.callerIdE164).toBe("+447700900123");
    expect(data.retellCallId).toBe("call-abc");
    expect(data.matched).toBe(true);
  });

  it("uses atomic updateMany predicate to prevent double-claim", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "intent-1" });
    await matchInboundCall({
      retellCallId:  "call-abc",
      callStartedAt: new Date(),
      visitorId:     "v-1",
    });
    // The where clause for the stamp must include matched=false so
    // a parallel webhook can't double-claim the same intent
    expect(updateManyMock.mock.calls[0][0].where).toEqual({
      id:      "intent-1",
      matched: false,
    });
  });
});
