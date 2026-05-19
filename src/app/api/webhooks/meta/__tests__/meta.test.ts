/**
 * @jest-environment node
 */

import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const mockAdFindFirst = jest.fn();
const mockAdUpdate = jest.fn();
const mockAdSetFindFirst = jest.fn();
const mockAdSetUpdate = jest.fn();
const mockCampaignFindFirst = jest.fn();
const mockCampaignUpdate = jest.fn();
const mockSendAdminAlert = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    ad: {
      findFirst: (...a: unknown[]) => mockAdFindFirst(...a),
      update: (...a: unknown[]) => mockAdUpdate(...a),
    },
    adSet: {
      findFirst: (...a: unknown[]) => mockAdSetFindFirst(...a),
      update: (...a: unknown[]) => mockAdSetUpdate(...a),
    },
    adCampaign: {
      findFirst: (...a: unknown[]) => mockCampaignFindFirst(...a),
      update: (...a: unknown[]) => mockCampaignUpdate(...a),
    },
  },
}));

jest.mock("@/lib/telegram", () => ({
  sendAdminAlert: (...a: unknown[]) => mockSendAdminAlert(...a),
}));

function sign(body: string): string {
  return `sha256=${createHmac("sha256", process.env.META_APP_SECRET || "").update(body).digest("hex")}`;
}

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.META_APP_SECRET = "meta-secret";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-token";
  const mod = await import("@/app/api/webhooks/meta/route");
  GET = mod.GET;
  POST = mod.POST;
});

beforeEach(() => {
  mockAdFindFirst.mockReset().mockResolvedValue(null);
  mockAdUpdate.mockReset().mockResolvedValue(null);
  mockAdSetFindFirst.mockReset().mockResolvedValue(null);
  mockAdSetUpdate.mockReset().mockResolvedValue(null);
  mockCampaignFindFirst.mockReset().mockResolvedValue(null);
  mockCampaignUpdate.mockReset().mockResolvedValue(null);
  mockSendAdminAlert.mockReset().mockResolvedValue(true);
});

describe("Meta webhook", () => {
  it("verifies the GET challenge", async () => {
    const req = new NextRequest(
      "https://www.locksafe.uk/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=12345"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("12345");
  });

  it("rejects POST requests with invalid signatures", async () => {
    const body = JSON.stringify({ object: "ad_account", entry: [] });
    const req = new NextRequest("https://www.locksafe.uk/api/webhooks/meta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=invalid",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts POST requests with valid signatures", async () => {
    const body = JSON.stringify({ object: "ad_account", entry: [] });
    const req = new NextRequest("https://www.locksafe.uk/api/webhooks/meta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": sign(body),
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.received).toBe(true);
  });
});