/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockCustomerFindFirst = jest.fn();
const mockLocksmithFindFirst = jest.fn();
const mockCustomerUpdate = jest.fn();
const mockLocksmithUpdate = jest.fn();
const mockHashPassword = jest.fn();
const mockEnforceAuthRateLimit = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    customer: {
      findFirst: (...a: unknown[]) => mockCustomerFindFirst(...a),
      update: (...a: unknown[]) => mockCustomerUpdate(...a),
    },
    locksmith: {
      findFirst: (...a: unknown[]) => mockLocksmithFindFirst(...a),
      update: (...a: unknown[]) => mockLocksmithUpdate(...a),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  hashPassword: (...a: unknown[]) => mockHashPassword(...a),
}));

jest.mock("@/lib/auth-rate-limit", () => ({
  enforceAuthRateLimit: (...a: unknown[]) => mockEnforceAuthRateLimit(...a),
}));

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("https://www.locksafe.uk/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/auth/reset-password/route");
  POST = mod.POST;
});

beforeEach(() => {
  mockCustomerFindFirst.mockReset().mockResolvedValue(null);
  mockLocksmithFindFirst.mockReset().mockResolvedValue(null);
  mockCustomerUpdate.mockReset().mockResolvedValue(null);
  mockLocksmithUpdate.mockReset().mockResolvedValue(null);
  mockHashPassword.mockReset().mockReturnValue("hashed-password");
  mockEnforceAuthRateLimit.mockReset().mockReturnValue(null);
});

describe("POST /api/auth/reset-password", () => {
  it("returns 429 when the auth rate limit is exceeded", async () => {
    mockEnforceAuthRateLimit.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Too many attempts" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await POST(makeRequest({ token: "abc", password: "password123" }));
    expect(res.status).toBe(429);
    expect(mockCustomerFindFirst).not.toHaveBeenCalled();
    expect(mockLocksmithFindFirst).not.toHaveBeenCalled();
  });

  it("resets a customer password successfully", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce({ id: "customer-1" });

    const res = await POST(makeRequest({ token: "abc", password: "password123" }));
    expect(res.status).toBe(200);
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      data: {
        passwordHash: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  });
});