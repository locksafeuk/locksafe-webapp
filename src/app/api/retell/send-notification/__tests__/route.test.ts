/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockVerifyRetellSignature = jest.fn();
const mockSendSMS = jest.fn();
const mockSendEmail = jest.fn();
const mockJobFindUnique = jest.fn();
const mockJobUpdate = jest.fn();

jest.mock("@/lib/retell-auth", () => ({
  verifyRetellSignature: (...args: unknown[]) => mockVerifyRetellSignature(...args),
}));

jest.mock("@/lib/sms", () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
}));

jest.mock("@/lib/email", () => ({
  sendPhoneRequestContinuationEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    job: {
      findUnique: (...args: unknown[]) => mockJobFindUnique(...args),
      update: (...args: unknown[]) => mockJobUpdate(...args),
    },
    customer: {
      findUnique: jest.fn(),
    },
  },
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://www.locksafe.uk/api/retell/send-notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-retell-signature": "test-signature",
    },
    body: JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/retell/send-notification/route");
  POST = mod.POST;
});

beforeEach(() => {
  mockVerifyRetellSignature.mockReset().mockResolvedValue({ valid: true });
  mockSendSMS.mockReset().mockResolvedValue({ success: true, messageId: "SM123" });
  mockSendEmail.mockReset().mockResolvedValue({ success: true });
  mockJobFindUnique.mockReset().mockResolvedValue(null);
  mockJobUpdate.mockReset().mockResolvedValue({ id: "job_1" });
});

describe("POST /api/retell/send-notification", () => {
  it("does not report sms_sent when SMS provider returns success=false", async () => {
    mockSendSMS.mockResolvedValueOnce({ success: false, error: "provider rejected" });

    const req = makeRequest({
      call: { call_id: "call_123" },
      args: {
        job_id: "job_1",
        job_number: "LRS-202605-0001",
        customer_phone: "+447700900123",
        customer_name: "Jane",
        continue_url: "https://locksafe.uk/continue-request/token-abc",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.retryable).toBe(false);
    expect(body.fallback_action).toBe("handoff_human");
    expect(body.sms_sent).toBe(false);
    expect(body.notifications_sent).not.toContain("sms");
  });

  it("creates and returns continue_url when job has no continueToken", async () => {
    mockJobFindUnique.mockResolvedValueOnce({ id: "job_1", continueToken: null });

    const req = makeRequest({
      call: { call_id: "call_456" },
      args: {
        job_id: "job_1",
        job_number: "LRS-202605-0002",
        customer_phone: "+447700900124",
        customer_name: "John",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.continue_url).toMatch(/^https:\/\/locksafe\.uk\/continue-request\/[a-f0-9]+$/);
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_1" },
        data: expect.objectContaining({ continueToken: expect.any(String) }),
      })
    );
  });

  it("remaps payment notification requests to continue/details behavior", async () => {
    const req = makeRequest({
      call: { call_id: "call_789" },
      args: {
        job_id: "job_1",
        job_number: "LRS-202605-0003",
        customer_phone: "+447700900125",
        customer_name: "Alex",
        notification_type: "payment",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notification_type).toBe("continue");
    expect(body.notification_type_requested).toBe("payment");
    expect(body.message).toContain("complete your request");
    expect(mockSendSMS).toHaveBeenCalledTimes(1);
    const sentMessage = mockSendSMS.mock.calls[0]?.[1];
    expect(String(sentMessage)).not.toContain("Pay the call-out fee");
  });
});
