import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/notifications/unsubscribe - Clear a PWA web-push subscription
//
// Body: { userId, userType? }
// userType is optional (the PWA client omits it). Only locksmith subscriptions
// are tracked, so we clear the web-push fields for a matching locksmith.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    if (userType === "customer") {
      return NextResponse.json({ success: true, message: "Acknowledged (customer tracking not enabled)" });
    }

    // Clear the web-push fields if this is a known locksmith. updateMany avoids
    // throwing when the id is not a locksmith (e.g. a customer).
    await prisma.locksmith.updateMany({
      where: { id: userId },
      data: {
        webPushSubscription: null,
        webPushPlatform: null,
        webPushRegisteredAt: null,
      },
    });

    return NextResponse.json({ success: true, message: "Subscription removed" });
  } catch (error) {
    console.error("[Push][WebPush] Error removing subscription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
