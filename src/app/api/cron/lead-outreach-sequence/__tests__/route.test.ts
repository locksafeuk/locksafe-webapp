/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

let GET: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/cron/lead-outreach-sequence/route");
  GET = mod.GET;
});

describe("GET /api/cron/lead-outreach-sequence", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.locksafe.uk";
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("skips sends outside UK outreach window", async () => {
    jest.setSystemTime(new Date("2026-01-10T03:00:00.000Z"));

    const req = new NextRequest("https://www.locksafe.uk/api/cron/lead-outreach-sequence", {
      method: "GET",
      headers: { authorization: "Bearer test-cron-secret" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.summary).toEqual({ attempted: 0, sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs sequence jobs inside UK outreach window", async () => {
    jest.setSystemTime(new Date("2026-01-10T10:00:00.000Z"));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, failed: 0, sequence: { attempted: 1 } }),
    });

    const req = new NextRequest("https://www.locksafe.uk/api/cron/lead-outreach-sequence", {
      method: "GET",
      headers: { authorization: "Bearer test-cron-secret" },
    });

    const pending = GET(req);
    await jest.runAllTimersAsync();
    const res = await pending;
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.skipped).toBeUndefined();
    expect(body.summary.sent).toBe(6);
    expect(body.summary.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
