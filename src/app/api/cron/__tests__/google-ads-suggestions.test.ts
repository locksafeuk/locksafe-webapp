/**
 * @jest-environment node
 *
 * Tests for /api/cron/google-ads-suggestions
 */

import { NextRequest } from "next/server";

const mockRunFullSuggestionCycle = jest.fn();
const mockReflectOnApprovalPatterns = jest.fn();

jest.mock("@/lib/google-ads-suggestions", () => ({
  runFullSuggestionCycle: (...args: unknown[]) => mockRunFullSuggestionCycle(...args),
  reflectOnApprovalPatterns: (...args: unknown[]) => mockReflectOnApprovalPatterns(...args),
}));

const CRON_SECRET = "c4bcc756c1e53c197c9772ae60fdb0f4a6ebcb726b5db47f6c4c6d92307ddd42";

function makeRequest(
  url: string,
  opts: {
    authHeader?: string;
    vercelCron?: boolean;
  } = {},
): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.authHeader !== undefined) headers.set("Authorization", opts.authHeader);
  if (opts.vercelCron) headers.set("x-vercel-cron", "1");

  return new NextRequest(url, {
    method: "POST",
    headers,
  });
}

let POST: (req: NextRequest) => Promise<Response>;
let GET: () => Promise<Response>;

beforeAll(async () => {
  process.env.CRON_SECRET = CRON_SECRET;
  const mod = await import("@/app/api/cron/google-ads-suggestions/route");
  POST = mod.POST;
  GET = mod.GET;
});

describe("POST /api/cron/google-ads-suggestions", () => {
  beforeEach(() => {
    mockRunFullSuggestionCycle.mockReset();
    mockReflectOnApprovalPatterns.mockReset();

    mockRunFullSuggestionCycle.mockResolvedValue({
      campaignsAnalysed: 2,
      suggestionsCreated: 3,
      suggestionsExpired: 1,
      errors: [],
    });
    mockReflectOnApprovalPatterns.mockResolvedValue({
      summary: "ok",
      approvalRates: {},
    });
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("https://www.locksafe.uk/api/cron/google-ads-suggestions");
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockRunFullSuggestionCycle).not.toHaveBeenCalled();
  });

  it("runs suggestion cycle with bearer auth", async () => {
    const daySpy = jest.spyOn(Date.prototype, "getDay").mockReturnValue(2);
    const req = makeRequest("https://www.locksafe.uk/api/cron/google-ads-suggestions", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRunFullSuggestionCycle).toHaveBeenCalledTimes(1);
    expect(mockReflectOnApprovalPatterns).not.toHaveBeenCalled();
    expect(body.success).toBe(true);

    daySpy.mockRestore();
  });

  it("runs reflection when reflect=1 is provided", async () => {
    const daySpy = jest.spyOn(Date.prototype, "getDay").mockReturnValue(2);
    const req = makeRequest("https://www.locksafe.uk/api/cron/google-ads-suggestions?reflect=1", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRunFullSuggestionCycle).toHaveBeenCalledTimes(1);
    expect(mockReflectOnApprovalPatterns).toHaveBeenCalledTimes(1);
    expect(body.reflection).toEqual({ summary: "ok", approvalRates: {} });

    daySpy.mockRestore();
  });

  it("returns 500 when cycle throws", async () => {
    mockRunFullSuggestionCycle.mockRejectedValue(new Error("boom"));
    const req = makeRequest("https://www.locksafe.uk/api/cron/google-ads-suggestions", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(String(body.error)).toContain("boom");
  });
});

describe("GET /api/cron/google-ads-suggestions", () => {
  it("returns health payload with 6-hour schedule", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.schedule).toContain("0 */6 * * *");
  });
});
