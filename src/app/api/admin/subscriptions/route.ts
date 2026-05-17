import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/subscriptions";

async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
    },
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === "active").length,
    trialing: subscriptions.filter((s) => s.status === "trialing").length,
    canceled: subscriptions.filter((s) => s.status === "canceled").length,
    mrr: subscriptions
      .filter((s) => s.status === "active" && s.plan === "cover_monthly")
      .length * 9.99 +
      subscriptions
        .filter((s) => s.status === "active" && s.plan === "cover_annual")
        .length * (79.99 / 12),
  };

  return NextResponse.json({ subscriptions, stats });
}

export async function PATCH(request: NextRequest) {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { customerId, action } = body as { customerId: string; action: "cancel" };

  if (!customerId || !action) {
    return NextResponse.json({ error: "customerId and action are required" }, { status: 400 });
  }

  if (action === "cancel") {
    await cancelSubscriptionAtPeriodEnd(customerId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
