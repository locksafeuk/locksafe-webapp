import { NextRequest, NextResponse } from "next/server";
import { validateReferralCode } from "@/lib/referrals";

/**
 * GET /api/referral/validate?code=SARAH-X4K2
 * Public — validates a referral code and returns discount info.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const result = await validateReferralCode(code);
  return NextResponse.json(result);
}
