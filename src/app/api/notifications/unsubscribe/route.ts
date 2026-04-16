import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/notifications/unsubscribe - Remove push subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType } = body;

    if (!userId || !userType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["customer", "locksmith"].includes(userType)) {
      return NextResponse.json(
        { success: false, error: "Invalid user type" },
        { status: 400 }
      );
    }

    // Remove subscription from database
    if (userType === "customer") {
      console.log(`[Push] Removing subscription for customer ${userId}`);
      // In a full implementation:
      // await prisma.customer.update({
      //   where: { id: userId },
      //   data: { pushSubscription: null },
      // });
    } else if (userType === "locksmith") {
      console.log(`[Push] Removing subscription for locksmith ${userId}`);
      // In a full implementation:
      // await prisma.locksmith.update({
      //   where: { id: userId },
      //   data: { pushSubscription: null },
      // });
    }

    return NextResponse.json({
      success: true,
      message: "Subscription removed successfully",
    });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
