/**
 * @jest-environment node
 *
 * Tests for GET /api/referral/validate?code=...
 */

import { NextRequest } from "next/server";

const mockValidate = jest.fn();

jest.mock("@/lib/referrals", () => ({
  validateReferralCode: (...a: unknown[]) => mockValidate(...a),
}));

let GET: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/referral/validate/route");
  GET = mod.GET;
});

beforeEach(() => {
  mockValidate.mockReset();
});

function req(qs: string) {
  return new NextRequest(`https://www.locksafe.uk/api/referral/validate${qs}`);
}

describe("GET /api/referral/validate", () => {
  it("returns 400 when `code` is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code is required/i);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("returns the validation result for a valid code", async () => {
    mockValidate.mockResolvedValueOnce({
      valid: true,
      discount: 10,
      referrerName: "Sarah",
      code: "SARAH-X4K2",
    });

    const res = await GET(req("?code=SARAH-X4K2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      valid: true,
      discount: 10,
      referrerName: "Sarah",
      code: "SARAH-X4K2",
    });
    expect(mockValidate).toHaveBeenCalledWith("SARAH-X4K2");
  });

  it("returns the validation result for an invalid code", async () => {
    mockValidate.mockResolvedValueOnce({
      valid: false,
      discount: 0,
      referrerName: "",
      code: "BAD",
      error: "Invalid referral code",
    });

    const res = await GET(req("?code=BAD"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("Invalid referral code");
  });
});
