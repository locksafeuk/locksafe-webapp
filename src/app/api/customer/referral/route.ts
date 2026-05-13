import { NextRequest, NextResponse } from "next/server";
import { getCustomerReferralStats } from "@/lib/referrals";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/customer/referral
 * Returns the authenticated customer's referral code, stats, and available credits.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "customer") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const stats = await getCustomerReferralStats(payload.id);
  return NextResponse.json(stats);
}
