/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockCreatePaymentIntentWithTransfer = jest.fn();
const mockGetOrCreateStripeCustomer = jest.fn();
const mockGetCommissionRate = jest.fn();
const mockLocksmithFindUnique = jest.fn();
const mockCustomerFindUnique = jest.fn();
const mockCustomerUpdate = jest.fn();

jest.mock("@/lib/stripe", () => ({
  createPaymentIntentWithTransfer: (...a: unknown[]) => mockCreatePaymentIntentWithTransfer(...a),
  getOrCreateStripeCustomer: (...a: unknown[]) => mockGetOrCreateStripeCustomer(...a),
  formatAmountFromStripe: jest.fn(),
  getCommissionRate: (...a: unknown[]) => mockGetCommissionRate(...a),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    locksmith: { findUnique: (...a: unknown[]) => mockLocksmithFindUnique(...a) },
    customer: {
      findUnique: (...a: unknown[]) => mockCustomerFindUnique(...a),
      update: (...a: unknown[]) => mockCustomerUpdate(...a),
    },
  },
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://www.locksafe.uk/api/payments/create-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/payments/create-intent/route");
  POST = mod.POST;
});

beforeEach(() => {
  process.env.PAYMENT_MIN_AMOUNT_GBP = "10";
  process.env.PAYMENT_MAX_AMOUNT_GBP = "5000";
  mockCreatePaymentIntentWithTransfer.mockReset().mockResolvedValue({
    id: "pi_123",
    amount: 29,
    currency: "gbp",
    client_secret: "secret_123",
  });
  mockGetOrCreateStripeCustomer.mockReset();
  mockGetCommissionRate.mockReset().mockReturnValue(0.15);
  mockLocksmithFindUnique.mockReset().mockResolvedValue(null);
  mockCustomerFindUnique.mockReset().mockResolvedValue(null);
  mockCustomerUpdate.mockReset().mockResolvedValue(null);
});

describe("POST /api/payments/create-intent", () => {
  it("rejects amounts below the configured minimum", async () => {
    const res = await POST(
      makeRequest({ type: "assessment_fee", amount: 5, jobId: "job-1" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between GBP 10 and GBP 5000/i);
    expect(mockCreatePaymentIntentWithTransfer).not.toHaveBeenCalled();
  });

  it("creates a payment intent for valid assessment fees", async () => {
    const res = await POST(
      makeRequest({ type: "assessment_fee", amount: 29, jobId: "job-1" })
    );

    expect(res.status).toBe(200);
    expect(mockCreatePaymentIntentWithTransfer).toHaveBeenCalledWith(
      29,
      null,
      "assessment_fee",
      expect.objectContaining({ jobId: "job-1" }),
      undefined,
      undefined
    );
  });
});