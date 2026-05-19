/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockRequireAdminOrCron = jest.fn();
const mockPayoutCount = jest.fn();
const mockPayoutFindFirst = jest.fn();
const mockPayoutFindMany = jest.fn();
const mockJobFindMany = jest.fn();

jest.mock("@/lib/agent-api-auth", () => ({
  requireAdminOrCron: (...a: unknown[]) => mockRequireAdminOrCron(...a),
  unauthorizedAgentApiResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    payout: {
      count: (...a: unknown[]) => mockPayoutCount(...a),
      findFirst: (...a: unknown[]) => mockPayoutFindFirst(...a),
      findMany: (...a: unknown[]) => mockPayoutFindMany(...a),
      create: jest.fn(),
    },
    job: {
      findMany: (...a: unknown[]) => mockJobFindMany(...a),
    },
  },
}));

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/cron/generate-payouts/route");
  POST = mod.POST;
});

beforeEach(() => {
  mockRequireAdminOrCron.mockReset().mockResolvedValue(null);
  mockPayoutCount.mockReset().mockResolvedValue(0);
  mockPayoutFindFirst.mockReset().mockResolvedValue(null);
  mockPayoutFindMany.mockReset().mockResolvedValue([]);
  mockJobFindMany.mockReset().mockResolvedValue([]);
});

describe("POST /api/cron/generate-payouts", () => {
  it("returns 401 when no cron or admin auth is present", async () => {
    const req = new NextRequest("https://www.locksafe.uk/api/cron/generate-payouts", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("allows authorized cron calls to proceed", async () => {
    mockRequireAdminOrCron.mockResolvedValueOnce({ type: "cron" });
    const req = new NextRequest("https://www.locksafe.uk/api/cron/generate-payouts", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});