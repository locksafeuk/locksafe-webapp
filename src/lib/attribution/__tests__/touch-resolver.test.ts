/**
 * Unit tests for touch-resolver. Mocks prisma.userSession.findFirst to
 * exercise the resolution logic without a database.
 */

jest.mock("@/lib/db", () => {
  return {
    __esModule: true,
    default: {
      userSession: {
        findFirst: jest.fn(),
      },
    },
  };
});

import {
  resolveFirstTouch,
  resolveLastTouch,
  spreadFirstTouchOnto,
  spreadLastTouchOnto,
  stampFirstAndLastTouchOn,
  stampFirstTouchOn,
  stampLastTouchOn,
  stampJobAttribution,
  type TouchSnapshot,
} from "../touch-resolver";
import prisma from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = (prisma as any).userSession.findFirst as jest.Mock;

const SESSION_FIRST = {
  id:           "sess_first",
  startedAt:    new Date("2026-05-01T10:00:00Z"),
  lastActiveAt: new Date("2026-05-01T10:25:00Z"),
  utmSource:    "google",
  utmMedium:    "cpc",
  utmCampaign:  "Bristol BS1",
  utmContent:   null,
  utmTerm:      null,
  gclid:        "G_ABC123",
  fbclid:       null,
  landingPage:  "/locksmith-in/bs1",
  referrer:     "https://www.google.com/",
};

const SESSION_LAST = {
  id:           "sess_last",
  startedAt:    new Date("2026-06-12T08:00:00Z"),
  lastActiveAt: new Date("2026-06-12T08:14:00Z"),
  utmSource:    "direct",
  utmMedium:    null,
  utmCampaign:  null,
  utmContent:   null,
  utmTerm:      null,
  gclid:        null,
  fbclid:       null,
  landingPage:  "/",
  referrer:     null,
};

beforeEach(() => {
  mockFindFirst.mockReset();
});

describe("resolveFirstTouch", () => {
  it("returns null when visitorId is missing", async () => {
    expect(await resolveFirstTouch(null)).toBeNull();
    expect(await resolveFirstTouch(undefined)).toBeNull();
    expect(await resolveFirstTouch("")).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("queries with orderBy startedAt asc and returns the snapshot", async () => {
    mockFindFirst.mockResolvedValueOnce(SESSION_FIRST);
    const snap = await resolveFirstTouch("v_xyz");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where:   { visitorId: "v_xyz" },
      orderBy: { startedAt: "asc" },
    });
    expect(snap).toMatchObject({
      visitorId:   "v_xyz",
      sessionId:   "sess_first",
      source:      "google",
      medium:      "cpc",
      campaign:    "Bristol BS1",
      gclid:       "G_ABC123",
      landingPage: "/locksmith-in/bs1",
      referrer:    "https://www.google.com/",
    });
    expect(snap?.at).toEqual(new Date("2026-05-01T10:00:00Z"));
  });

  it("returns null when no session exists", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await resolveFirstTouch("v_xyz")).toBeNull();
  });
});

describe("resolveLastTouch", () => {
  it("queries with orderBy lastActiveAt desc", async () => {
    mockFindFirst.mockResolvedValueOnce(SESSION_LAST);
    const snap = await resolveLastTouch("v_xyz");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where:   { visitorId: "v_xyz" },
      orderBy: { lastActiveAt: "desc" },
    });
    expect(snap?.source).toBe("direct");
    expect(snap?.at).toEqual(new Date("2026-06-12T08:14:00Z"));
  });
});

describe("spreadFirstTouchOnto / spreadLastTouchOnto", () => {
  const snap: TouchSnapshot = {
    visitorId:   "v",
    sessionId:   "s1",
    at:          new Date("2026-05-01T10:00:00Z"),
    source:      "google",
    medium:      "cpc",
    campaign:    "Bristol BS1",
    content:     null,
    term:        null,
    gclid:       "G_ABC",
    fbclid:      null,
    landingPage: "/locksmith-in/bs1",
    referrer:    null,
  };

  it("spreadFirstTouchOnto returns the original data plus firstTouch fields", () => {
    const result = spreadFirstTouchOnto({ name: "Sarah" }, snap);
    expect(result.name).toBe("Sarah");
    expect(result.firstTouchSource).toBe("google");
    expect(result.firstTouchGclid).toBe("G_ABC");
    expect(result.firstSessionId).toBe("s1");
    expect(result.firstTouchAt).toEqual(new Date("2026-05-01T10:00:00Z"));
  });

  it("spreadLastTouchOnto returns the original data plus lastTouch fields", () => {
    const result = spreadLastTouchOnto({ name: "Sarah" }, snap);
    expect(result.lastTouchSource).toBe("google");
    expect(result.lastSessionId).toBe("s1");
  });
});

describe("stampFirstAndLastTouchOn", () => {
  it("stamps both when both sessions exist", async () => {
    mockFindFirst
      .mockResolvedValueOnce(SESSION_FIRST) // first
      .mockResolvedValueOnce(SESSION_LAST); // last
    const result = await stampFirstAndLastTouchOn(
      { name: "Sarah", email: "s@example.com" },
      "v_xyz",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.visitorId).toBe("v_xyz");
    expect(r.firstTouchSource).toBe("google");
    expect(r.lastTouchSource).toBe("direct");
    expect(r.name).toBe("Sarah");
    expect(r.email).toBe("s@example.com");
  });

  it("returns data unchanged when visitorId missing and no fallback", async () => {
    const result = await stampFirstAndLastTouchOn({ name: "Sarah" }, null);
    expect(result).toEqual({ name: "Sarah" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("uses fallbackSource when no visitorId provided", async () => {
    const result = await stampFirstAndLastTouchOn(
      { name: "Sarah" },
      null,
      { fallbackSource: "phone" },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.firstTouchSource).toBe("phone");
    expect(r.lastTouchSource).toBe("phone");
    expect(r.firstTouchAt).toBeInstanceOf(Date);
  });

  it("uses fallbackSource when visitorId present but no session history", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await stampFirstAndLastTouchOn(
      { name: "Sarah" },
      "v_unknown",
      { fallbackSource: "phone" },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.firstTouchSource).toBe("phone");
    expect(r.lastTouchSource).toBe("phone");
  });
});

describe("stampLastTouchOn", () => {
  it("only adds lastTouch fields", async () => {
    mockFindFirst.mockResolvedValueOnce(SESSION_LAST);
    const result = await stampLastTouchOn({ id: "c1" }, "v_xyz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.id).toBe("c1");
    expect(r.lastTouchSource).toBe("direct");
    expect(r.firstTouchSource).toBeUndefined();
  });

  it("returns data unchanged when no session", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await stampLastTouchOn({ id: "c1" }, "v_xyz");
    expect(result).toEqual({ id: "c1" });
  });
});

describe("stampFirstTouchOn", () => {
  it("only adds firstTouch fields", async () => {
    mockFindFirst.mockResolvedValueOnce(SESSION_FIRST);
    const result = await stampFirstTouchOn({ name: "Locksmith" }, "v_xyz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.firstTouchSource).toBe("google");
    expect(r.lastTouchSource).toBeUndefined();
  });

  it("falls back when no session", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await stampFirstTouchOn(
      { name: "Locksmith" },
      "v_xyz",
      { fallbackSource: "recruit_email" },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    expect(r.firstTouchSource).toBe("recruit_email");
  });
});

describe("stampJobAttribution", () => {
  it("populates both legacy utm* and firstTouch* on Job payload", async () => {
    mockFindFirst
      .mockResolvedValueOnce(SESSION_FIRST)
      .mockResolvedValueOnce(SESSION_LAST);
    const result = await stampJobAttribution({ customerId: "c1" }, "v_xyz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    // last-touch lives in legacy columns
    expect(r.utmSource).toBe("direct");
    expect(r.landingPage).toBe("/");
    // first-touch is the new column set
    expect(r.firstTouchSource).toBe("google");
    expect(r.firstTouchGclid).toBe("G_ABC123");
  });

  it("returns data unchanged when visitorId missing", async () => {
    const result = await stampJobAttribution({ customerId: "c1" }, undefined);
    expect(result).toEqual({ customerId: "c1" });
  });
});
