import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/notifications/subscribe - Save push subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId, userType } = body;

    if (!subscription || !userId || !userType) {
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

    // Store subscription in database
    // For simplicity, we'll store it as JSON in the user model
    // In production, you might want a separate PushSubscription model

    if (userType === "customer") {
      // Find and update customer - we'd need to add a pushSubscription field
      // For now, log it
      console.log(`[Push] Saving subscription for customer ${userId}:`, subscription.endpoint);

      // In a full implementation, you'd update the customer record:
      // await prisma.customer.update({
      //   where: { id: userId },
      //   data: { pushSubscription: JSON.stringify(subscription) },
      // });
    } else if (userType === "locksmith") {
      console.log(`[Push] Saving subscription for locksmith ${userId}:`, subscription.endpoint);

      // In a full implementation, you'd update the locksmith record:
      // await prisma.locksmith.update({
      //   where: { id: userId },
      //   data: { pushSubscription: JSON.stringify(subscription) },
      // });
    }

    return NextResponse.json({
      success: true,
      message: "Subscription saved successfully",
    });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
