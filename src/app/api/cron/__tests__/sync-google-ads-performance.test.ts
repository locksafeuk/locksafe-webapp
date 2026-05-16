/**
 * @jest-environment node
 *
 * Tests for /api/cron/sync-google-ads-performance
 *
 * Validates auth enforcement, success path, error path, and the GET
 * health-check endpoint. Requires Node environment for NextRequest (uses
 * the Web Request global available in Node 18+).
 */

import { NextRequest } from "next/server";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSyncAllGoogleAdsAccounts = jest.fn();
const mockGetGoogleAdsSyncStatus = jest.fn();

jest.mock("@/lib/google-ads-sync", () => ({
  syncAllGoogleAdsAccounts: (...args: unknown[]) => mockSyncAllGoogleAdsAccounts(...args),
  getGoogleAdsSyncStatus: () => mockGetGoogleAdsSyncStatus(),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

const CRON_SECRET = "c4bcc756c1e53c197c9772ae60fdb0f4a6ebcb726b5db47f6c4c6d92307ddd42";

function makeRequest(
  method: "POST" | "GET",
  opts: {
    authHeader?: string;
    vercelCron?: boolean;
    body?: Record<string, unknown>;
  } = {},
): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.authHeader !== undefined) {
    headers.set("Authorization", opts.authHeader);
  }
  if (opts.vercelCron) {
    headers.set("x-vercel-cron", "1");
  }

  const bodyStr = opts.body ? JSON.stringify(opts.body) : undefined;
  return new NextRequest("https://www.locksafe.uk/api/cron/sync-google-ads-performance", {
    method,
    headers,
    body: bodyStr,
  });
}

// ── Import after mocks ────────────────────────────────────────────────────────

// Dynamic import so module is loaded after mock definitions above
let POST: (req: NextRequest) => Promise<Response>;
let GET: () => Promise<Response>;

beforeAll(async () => {
  process.env.CRON_SECRET = CRON_SECRET;
  const mod = await import(
    "@/app/api/cron/sync-google-ads-performance/route"
  );
  POST = mod.POST;
  GET = mod.GET;
});

// ─────────────────────────────────────────────────────────────────────────────
// POST — cron sync
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/cron/sync-google-ads-performance", () => {
  beforeEach(() => {
    mockSyncAllGoogleAdsAccounts.mockReset();
    mockSyncAllGoogleAdsAccounts.mockResolvedValue({
      success: true,
      accountsProcessed: 1,
      campaignsObserved: 3,
      snapshotsWritten: 21,
      errors: [],
    });
  });

  it("returns 401 with no auth header", async () => {
    const req = makeRequest("POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 with wrong bearer token", async () => {
    const req = makeRequest("POST", { authHeader: "Bearer wrong-secret" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct CRON_SECRET", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.metrics.accountsProcessed).toBe(1);
    expect(body.metrics.campaignsObserved).toBe(3);
    expect(body.metrics.snapshotsWritten).toBe(21);
  });

  it("allows x-vercel-cron header as auth (bypass for scheduled runs)", async () => {
    const req = makeRequest("POST", { vercelCron: true });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("passes lookbackDays body option to sync function", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
      body: { lookbackDays: 14 },
    });
    await POST(req);
    expect(mockSyncAllGoogleAdsAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ lookbackDays: 14 }),
    );
  });

  it("passes explicit dateRange option to sync function", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
      body: { dateRange: { since: "2026-05-01", until: "2026-05-15" } },
    });
    await POST(req);
    expect(mockSyncAllGoogleAdsAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: { since: "2026-05-01", until: "2026-05-15" },
      }),
    );
  });

  it("returns 200 even when empty body is sent", async () => {
    const req = new NextRequest(
      "https://www.locksafe.uk/api/cron/sync-google-ads-performance",
      {
        method: "POST",
        headers: new Headers({ Authorization: `Bearer ${CRON_SECRET}` }),
        // No body at all
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSyncAllGoogleAdsAccounts).toHaveBeenCalledWith({});
  });

  it("includes sync errors in response when present", async () => {
    mockSyncAllGoogleAdsAccounts.mockResolvedValue({
      success: true,
      accountsProcessed: 2,
      campaignsObserved: 5,
      snapshotsWritten: 10,
      errors: ["Account acc-001: token expired"],
    });

    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toContain("Account acc-001: token expired");
  });

  it("omits errors field when there are no errors", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
  });

  it("returns 500 when syncAllGoogleAdsAccounts throws", async () => {
    mockSyncAllGoogleAdsAccounts.mockRejectedValue(
      new Error("DB connection timeout"),
    );

    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("DB connection timeout");
  });

  it("response includes duration in milliseconds", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(typeof body.duration).toBe("number");
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });

  it("response includes ISO timestamp", async () => {
    const req = makeRequest("POST", {
      authHeader: `Bearer ${CRON_SECRET}`,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — health check
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/cron/sync-google-ads-performance", () => {
  beforeEach(() => {
    mockGetGoogleAdsSyncStatus.mockReset();
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "sbMXQHwqfdpHpWVGFnh1jg";
  });

  it("returns 200 health check with status fields", async () => {
    mockGetGoogleAdsSyncStatus.mockResolvedValue({
      isConfigured: true,
      accountsConnected: 1,
      lastSyncAt: new Date("2026-05-15T12:00:00Z"),
      totalSpend: 450.75,
      totalConversions: 62,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("healthy");
    expect(body.isConfigured).toBe(true);
    expect(body.accountsConnected).toBe(1);
    expect(body.totalSpend).toBe(450.75);
  });

  it("reports not-configured when developer token is missing", async () => {
    mockGetGoogleAdsSyncStatus.mockResolvedValue({
      isConfigured: false,
      accountsConnected: 0,
      lastSyncAt: null,
      totalSpend: 0,
      totalConversions: 0,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.isConfigured).toBe(false);
    expect(body.accountsConnected).toBe(0);
  });

  it("includes cronSync endpoint URL in response", async () => {
    mockGetGoogleAdsSyncStatus.mockResolvedValue({
      isConfigured: true,
      accountsConnected: 1,
      lastSyncAt: null,
      totalSpend: 0,
      totalConversions: 0,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.endpoints.cronSync).toContain("sync-google-ads-performance");
  });

  it("returns 500 when status check throws", async () => {
    mockGetGoogleAdsSyncStatus.mockRejectedValue(new Error("Prisma error"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Prisma error");
  });
});
