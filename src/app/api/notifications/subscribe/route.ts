import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Best-effort OS hint from the User-Agent. Used only to label which kind of
 * device a PWA (web-push) subscriber is on — "ios" | "android" | "desktop".
 */
function platformFromUserAgent(ua: string | null): string {
  if (!ua) return "desktop";
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  return "desktop";
}

// POST /api/notifications/subscribe - Save a PWA web-push subscription
//
// Body: { subscription, userId, userType? }
// The PWA client (usePushNotifications) historically omits userType, so it is
// optional here. We only persist locksmith subscriptions (current scope); a
// subscription whose userId is not a known locksmith is acknowledged but not
// stored.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId, userType } = body;

    if (!subscription || !userId) {
      return NextResponse.json(
        { success: false, error: "subscription and userId are required" },
        { status: 400 }
      );
    }

    // Out of scope: customer PWA tracking. Acknowledge without storing.
    if (userType === "customer") {
      return NextResponse.json({ success: true, message: "Acknowledged (customer tracking not enabled)" });
    }

    // Only persist if this userId is a real locksmith.
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!locksmith) {
      // Unknown id (e.g. a customer) — acknowledge without storing.
      return NextResponse.json({ success: true, message: "Acknowledged" });
    }

    const platform = platformFromUserAgent(request.headers.get("user-agent"));

    await prisma.locksmith.update({
      where: { id: userId },
      data: {
        webPushSubscription: JSON.stringify(subscription),
        webPushPlatform: platform,
        webPushRegisteredAt: new Date(),
      },
    });

    console.log(`[Push][WebPush] Subscription saved for locksmith ${locksmith.name} (${userId}) on ${platform}`);

    return NextResponse.json({ success: true, message: "Subscription saved" });
  } catch (error) {
    console.error("[Push][WebPush] Error saving subscription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
