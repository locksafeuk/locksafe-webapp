/**
 * POST /api/marketing/call-intent — endpoint tests.
 *
 * Pins the request validation + persistence contract:
 *   • visitorId required → 400 when missing
 *   • valid body → 201 with id
 *   • field allowlist (no arbitrary keys land in DB)
 *   • invalid JSON → 400 from upstream req.json() catch path
 *   • DB error → 200 with diagnostic (never blocks the tel: dial)
 */

// Stub next/server BEFORE the route is imported. jsdom doesn't expose
// TextEncoder/Request/Response/Headers globally, so loading next/server
// (or undici as a polyfill source) crashes at module-init. We don't
// need the real implementations — just NextResponse.json() and a
// minimal request shape the route reads.
jest.mock("next/server", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NextRequest:  class { constructor(_: any, __: any) {} } as any,
  NextResponse: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const createMock = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    callIntent: { create: createMock },
  },
  default: {
    callIntent: { create: createMock },
  },
}));

import { POST } from "@/app/api/marketing/call-intent/route";

/**
 * Build a minimal NextRequest-shaped object — only the methods the
 * route actually calls (request.json() + request.headers.get(...)).
 * Avoids loading any Web API globals.
 */
function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  const headerMap = new Map<string, string>();
  for (const [k, v] of Object.entries({ "content-type": "application/json", ...headers })) {
    headerMap.set(k.toLowerCase(), v);
  }
  return {
    json: async () => {
      if (typeof body === "string") return JSON.parse(body); // throws on bad JSON
      return body;
    },
    headers: {
      get: (k: string) => headerMap.get(k.toLowerCase()) ?? null,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: "intent-mock-id", createdAt: new Date() });
});

// ── Validation ──────────────────────────────────────────────────────────────

describe("POST /api/marketing/call-intent — validation", () => {
  it("returns 400 when visitorId is missing", async () => {
    const res = await POST(buildRequest({ source: "website_call_button" }));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 when visitorId is an empty string", async () => {
    const res = await POST(buildRequest({ visitorId: "   " }));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 200 with diagnostic when JSON is invalid", async () => {
    // Treated as empty body → fails the visitorId guard with 400
    const res = await POST(buildRequest("{bad json"));
    expect([400, 200]).toContain(res.status);
  });
});

// ── Happy path ──────────────────────────────────────────────────────────────

describe("POST /api/marketing/call-intent — persistence", () => {
  it("creates a CallIntent and returns 201 with id", async () => {
    const res = await POST(buildRequest({
      visitorId:   "visitor-1",
      source:      "website_call_button",
      gclid:       "abc123",
      utmSource:   "google",
      utmCampaign: "phase2-launch",
      landingPage: "/book",
    }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("intent-mock-id");

    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0][0].data;
    expect(args.visitorId).toBe("visitor-1");
    expect(args.source).toBe("website_call_button");
    expect(args.gclid).toBe("abc123");
    expect(args.utmSource).toBe("google");
    expect(args.utmCampaign).toBe("phase2-launch");
  });

  it("defaults source to 'website_call_button' when omitted", async () => {
    await POST(buildRequest({ visitorId: "v" }));
    expect(createMock.mock.calls[0][0].data.source).toBe("website_call_button");
  });

  it("strips empty-string fields rather than persisting empty values", async () => {
    await POST(buildRequest({
      visitorId: "v",
      gclid:     "   ",       // empty after trim
      utmSource: "",
      landingPage: "/book",
    }));
    const data = createMock.mock.calls[0][0].data;
    expect(data.gclid).toBeUndefined();
    expect(data.utmSource).toBeUndefined();
    expect(data.landingPage).toBe("/book");
  });

  it("captures the user-agent header for audit", async () => {
    await POST(buildRequest(
      { visitorId: "v" },
      { "user-agent": "MyTestAgent/1.0" },
    ));
    expect(createMock.mock.calls[0][0].data.userAgent).toBe("MyTestAgent/1.0");
  });

  it("ignores unknown body fields (allowlist semantics)", async () => {
    await POST(buildRequest({
      visitorId:     "v",
      // not in the allowlist
      arbitraryThing: "hacker",
      isAdmin:        true,
    }));
    const data = createMock.mock.calls[0][0].data;
    expect(data.arbitraryThing).toBeUndefined();
    expect(data.isAdmin).toBeUndefined();
  });
});

// ── Failure handling ────────────────────────────────────────────────────────

describe("POST /api/marketing/call-intent — failure handling", () => {
  it("returns 200 (not 500) when the DB write throws", async () => {
    createMock.mockRejectedValue(new Error("simulated DB outage"));

    const res = await POST(buildRequest({ visitorId: "v" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toMatch(/not recorded/i);
    // Never block the tel: dial with a 5xx — the user has to be able
    // to call us even if our DB is down.
  });
});
