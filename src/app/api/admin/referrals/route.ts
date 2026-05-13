import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const referrals = await prisma.referral.findMany({
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: referrals.length,
    active: referrals.filter((r) => r.status === "active").length,
    converted: referrals.filter((r) => r.status === "converted").length,
    rewarded: referrals.filter((r) => r.status === "rewarded").length,
    totalClicks: referrals.reduce((s, r) => s + r.clickCount, 0),
    totalRewardsPaid: referrals
      .filter((r) => r.status === "rewarded")
      .reduce((s, r) => s + r.referrerReward, 0),
    totalDiscountsGiven: referrals
      .filter((r) => r.status !== "active")
      .reduce((s, r) => s + r.referredReward, 0),
  };

  return NextResponse.json({ referrals, stats });
}
