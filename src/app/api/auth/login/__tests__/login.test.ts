/**
 * @jest-environment node
 *
 * Tests for POST /api/auth/login.
 *
 * Validates input validation, credential checks across Admin/Locksmith/Customer
 * tables, deactivated-account handling, and error paths.
 */

import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAdminFindUnique = jest.fn();
const mockLocksmithFindUnique = jest.fn();
const mockCustomerFindUnique = jest.fn();
const mockEnforceAuthRateLimit = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    admin: { findUnique: (...a: unknown[]) => mockAdminFindUnique(...a) },
    locksmith: { findUnique: (...a: unknown[]) => mockLocksmithFindUnique(...a) },
    customer: { findUnique: (...a: unknown[]) => mockCustomerFindUnique(...a) },
  },
}));

const mockGenerateToken = jest.fn();
const mockVerifyPassword = jest.fn();
const mockGetRedirectPath = jest.fn();

jest.mock("@/lib/auth", () => ({
  generateToken: (...a: unknown[]) => mockGenerateToken(...a),
  verifyPassword: (...a: unknown[]) => mockVerifyPassword(...a),
  getRedirectPath: (...a: unknown[]) => mockGetRedirectPath(...a),
  AUTH_COOKIE_OPTIONS: { httpOnly: true, sameSite: "lax", path: "/" },
}));

jest.mock("@/lib/auth-rate-limit", () => ({
  enforceAuthRateLimit: (...a: unknown[]) => mockEnforceAuthRateLimit(...a),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("https://www.locksafe.uk/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/auth/login/route");
  POST = mod.POST;
});

beforeEach(() => {
  mockAdminFindUnique.mockReset().mockResolvedValue(null);
  mockLocksmithFindUnique.mockReset().mockResolvedValue(null);
  mockCustomerFindUnique.mockReset().mockResolvedValue(null);
  mockVerifyPassword.mockReset().mockReturnValue(false);
  mockEnforceAuthRateLimit.mockReset().mockReturnValue(null);
  mockGenerateToken.mockReset().mockImplementation((payload) => `token-for-${JSON.stringify(payload)}`);
  mockGetRedirectPath.mockReset().mockImplementation((kind) => `/${kind}`);
});

describe("POST /api/auth/login", () => {
  it("returns 429 when the auth rate limit is exceeded", async () => {
    mockEnforceAuthRateLimit.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Too many attempts" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await POST(makeRequest({ email: "user@example.com", password: "secret" }));
    expect(res.status).toBe(429);
    expect(mockAdminFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ password: "secret" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on malformed JSON body", async () => {
    const req = new NextRequest("https://www.locksafe.uk/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 401 when no user matches", async () => {
    const res = await POST(makeRequest({ email: "ghost@x.com", password: "p" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid email or password/i);
  });

  it("trims and lowercases the email before lookup", async () => {
    await POST(makeRequest({ email: "  USER@Example.COM  ", password: "p" }));
    expect(mockAdminFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("signs in an Admin successfully and sets auth cookie", async () => {
    mockAdminFindUnique.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@x.com",
      name: "Admin",
      passwordHash: "hash",
      role: "superadmin",
    });
    mockVerifyPassword.mockReturnValueOnce(true);

    const res = await POST(makeRequest({ email: "admin@x.com", password: "ok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.type).toBe("admin");
    expect(body.user.role).toBe("superadmin");
    expect(body.redirectTo).toBe("/admin");

    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/auth_token=/);
  });

  it("rejects a deactivated locksmith with 403", async () => {
    mockLocksmithFindUnique.mockResolvedValueOnce({
      id: "ls-1",
      email: "ls@x.com",
      name: "Lock",
      passwordHash: "hash",
      isActive: false,
      isVerified: true,
      companyName: "Co",
    });
    mockVerifyPassword.mockReturnValueOnce(true);

    const res = await POST(makeRequest({ email: "ls@x.com", password: "ok" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/deactivated/i);
  });

  it("signs in an active locksmith and returns redirect", async () => {
    mockLocksmithFindUnique.mockResolvedValueOnce({
      id: "ls-2",
      email: "ls@x.com",
      name: "Lock",
      passwordHash: "hash",
      isActive: true,
      isVerified: true,
      companyName: "Co",
    });
    mockVerifyPassword.mockReturnValueOnce(true);

    const res = await POST(makeRequest({ email: "ls@x.com", password: "ok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.type).toBe("locksmith");
    expect(body.redirectTo).toBe("/locksmith");
  });

  it("signs in a customer when admin and locksmith lookups miss", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "c-1",
      email: "c@x.com",
      name: "Cust",
      phone: "+447000000000",
      passwordHash: "hash",
    });
    mockVerifyPassword.mockReturnValueOnce(true);

    const res = await POST(makeRequest({ email: "c@x.com", password: "ok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.type).toBe("customer");
    expect(body.user.phone).toBe("+447000000000");
  });

  it("returns 401 when password verification fails for an existing user", async () => {
    mockAdminFindUnique.mockResolvedValueOnce({
      id: "a-1",
      email: "a@x.com",
      name: "A",
      passwordHash: "hash",
      role: "admin",
    });
    mockVerifyPassword.mockReturnValueOnce(false);

    const res = await POST(makeRequest({ email: "a@x.com", password: "bad" }));
    expect(res.status).toBe(401);
  });
});
