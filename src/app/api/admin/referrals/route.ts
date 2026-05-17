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

export async function PATCH(request: NextRequest) {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { referralId, action, amount } = body as {
    referralId: string;
    action: "credit_override" | "flag_fraud" | "reset";
    amount?: number;
  };

  if (!referralId || !action) {
    return NextResponse.json({ error: "referralId and action are required" }, { status: 400 });
  }

  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

  if (action === "flag_fraud") {
    await prisma.referral.update({
      where: { id: referralId },
      data: { status: "fraud" as never },
    });
    // Claw back referrer credit if already rewarded
    if (referral.status === "rewarded") {
      await prisma.customer.update({
        where: { id: referral.referrerId },
        data: { referralCredits: { decrement: referral.referrerReward } },
      });
    }
    return NextResponse.json({ success: true, action: "flagged_fraud" });
  }

  if (action === "reset") {
    await prisma.referral.update({
      where: { id: referralId },
      data: { status: "active", rewardedAt: null, triggerJobId: null },
    });
    return NextResponse.json({ success: true, action: "reset" });
  }

  if (action === "credit_override") {
    const override = typeof amount === "number" && amount > 0 ? amount : referral.referrerReward;
    await prisma.customer.update({
      where: { id: referral.referrerId },
      data: { referralCredits: { increment: override } },
    });
    await prisma.referral.update({
      where: { id: referralId },
      data: { status: "rewarded", rewardedAt: new Date() },
    });
    return NextResponse.json({ success: true, action: "credit_override", amount: override });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
