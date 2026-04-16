import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updatePlayerTags } from "@/lib/onesignal";

/**
 * POST /api/onesignal/subscribe
 *
 * Save OneSignal player ID for a user (customer or locksmith)
 *
 * PRIORITY 1 FIX: Ensures player IDs are ALWAYS stored in database
 * - Customer subscriptions saved to Customer.oneSignalPlayerId
 * - Locksmith subscriptions saved to Locksmith.oneSignalPlayerId
 * - Guest subscriptions saved to PushSubscription table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, playerId } = body;

    console.log(`[OneSignal] Subscribe request:`, { userId, userType, playerId: playerId?.substring(0, 8) + '...' });

    // Validate required fields
    if (!playerId) {
      console.error("[OneSignal] Missing playerId in request");
      return NextResponse.json(
        { error: "Missing required field: playerId" },
        { status: 400 }
      );
    }

    // Validate playerId format (OneSignal player IDs are UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(playerId)) {
      console.error("[OneSignal] Invalid playerId format:", playerId);
      return NextResponse.json(
        { error: "Invalid playerId format. Expected UUID." },
        { status: 400 }
      );
    }

    const now = new Date();

    // Case 1: Guest subscription (no userId)
    if (!userId) {
      console.log(`[OneSignal] Processing guest subscription: ${playerId}`);

      // Store as guest subscription in PushSubscription table
      try {
        const subscription = await prisma.pushSubscription.upsert({
          where: { playerId },
          create: {
            playerId,
            userType: userType || "guest",
            subscribedAt: now,
            isActive: true,
          },
          update: {
            subscribedAt: now,
            userType: userType || "guest",
            isActive: true,
            unsubscribedAt: null,
          },
        });

        console.log("[OneSignal] ✅ Guest subscription stored in database:", subscription.id);

        return NextResponse.json({
          success: true,
          message: "Guest subscription saved successfully. Will be linked when user logs in.",
          playerId,
          subscriptionId: subscription.id,
        });
      } catch (dbError: any) {
        console.error("[OneSignal] ❌ Database error storing guest subscription:", dbError);

        // Return detailed error for debugging
        return NextResponse.json(
          {
            error: "Failed to store guest subscription in database",
            code: "DATABASE_ERROR",
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
            dbErrorCode: dbError.code,
          },
          { status: 500 }
        );
      }
    }

    // Validate userType when userId is provided
    if (!userType || !["customer", "locksmith"].includes(userType)) {
      console.error("[OneSignal] Invalid userType:", userType);
      return NextResponse.json(
        { error: "Invalid userType. Must be 'customer' or 'locksmith'" },
        { status: 400 }
      );
    }

    // Case 2: Customer subscription
    if (userType === "customer") {
      console.log(`[OneSignal] Processing customer subscription: userId=${userId}`);

      // First check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { id: true, name: true, oneSignalPlayerId: true },
      });

      if (!existingCustomer) {
        console.error(`[OneSignal] ❌ Customer not found: ${userId}`);
        return NextResponse.json(
          {
            error: "Customer not found. Please ensure the user is registered.",
            code: "USER_NOT_FOUND"
          },
          { status: 404 }
        );
      }

      // Update customer with player ID - CRITICAL DATABASE OPERATION
      try {
        const updatedCustomer = await prisma.customer.update({
          where: { id: userId },
          data: {
            oneSignalPlayerId: playerId,
            oneSignalSubscribedAt: now,
          },
        });

        console.log(`[OneSignal] ✅ Customer subscription stored in database: ${userId} -> ${playerId}`);

        // Set tags for segmentation (fire and forget, don't block response)
        updatePlayerTags(playerId, {
          user_type: "customer",
          user_id: userId,
          user_name: existingCustomer.name || "Unknown",
        }).catch((err) => console.error("[OneSignal] Failed to set customer tags:", err));

        return NextResponse.json({
          success: true,
          message: "Customer subscription saved successfully to database",
          playerId,
          userId,
          previousPlayerId: existingCustomer.oneSignalPlayerId,
        });
      } catch (dbError: any) {
        console.error("[OneSignal] ❌ Database error updating customer:", dbError);
        return NextResponse.json(
          {
            error: "Failed to save customer subscription to database",
            code: "DATABASE_UPDATE_ERROR",
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
          },
          { status: 500 }
        );
      }
    }

    // Case 3: Locksmith subscription
    if (userType === "locksmith") {
      console.log(`[OneSignal] Processing locksmith subscription: userId=${userId}`);

      // First check if locksmith exists
      const existingLocksmith = await prisma.locksmith.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          isAvailable: true,
          isVerified: true,
          coverageRadius: true,
          oneSignalPlayerId: true,
        },
      });

      if (!existingLocksmith) {
        console.error(`[OneSignal] ❌ Locksmith not found: ${userId}`);
        return NextResponse.json(
          {
            error: "Locksmith not found. Please ensure the user is registered.",
            code: "USER_NOT_FOUND"
          },
          { status: 404 }
        );
      }

      // Update locksmith with player ID - CRITICAL DATABASE OPERATION
      try {
        const updatedLocksmith = await prisma.locksmith.update({
          where: { id: userId },
          data: {
            oneSignalPlayerId: playerId,
            oneSignalSubscribedAt: now,
          },
        });

        console.log(`[OneSignal] ✅ Locksmith subscription stored in database: ${userId} -> ${playerId}`);

        // Set tags for segmentation including coverage info (fire and forget)
        updatePlayerTags(playerId, {
          user_type: "locksmith",
          user_id: userId,
          user_name: existingLocksmith.name || "Unknown",
          is_available: existingLocksmith.isAvailable ? "true" : "false",
          is_verified: existingLocksmith.isVerified ? "true" : "false",
          coverage_radius: String(existingLocksmith.coverageRadius || 10),
        }).catch((err) => console.error("[OneSignal] Failed to set locksmith tags:", err));

        return NextResponse.json({
          success: true,
          message: "Locksmith subscription saved successfully to database",
          playerId,
          userId,
          previousPlayerId: existingLocksmith.oneSignalPlayerId,
        });
      } catch (dbError: any) {
        console.error("[OneSignal] ❌ Database error updating locksmith:", dbError);
        return NextResponse.json(
          {
            error: "Failed to save locksmith subscription to database",
            code: "DATABASE_UPDATE_ERROR",
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
          },
          { status: 500 }
        );
      }
    }

    // Should never reach here due to validation above
    console.error("[OneSignal] Reached unexpected code path");
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );

  } catch (error: any) {
    console.error("[OneSignal] ❌ Subscribe error:", error);

    // Handle specific Prisma errors
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          error: "User not found in database",
          code: "USER_NOT_FOUND",
          details: "The specified userId does not exist"
        },
        { status: 404 }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: "Duplicate subscription",
          code: "DUPLICATE_SUBSCRIPTION",
          details: "This player ID is already registered"
        },
        { status: 409 }
      );
    }

    if (error.code === "P2023") {
      return NextResponse.json(
        {
          error: "Invalid ID format",
          code: "INVALID_ID",
          details: "The userId format is invalid"
        },
        { status: 400 }
      );
    }

    // JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          code: "INVALID_JSON",
          details: "Request body must be valid JSON"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to save subscription to database",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onesignal/subscribe
 *
 * Check if a user has an active OneSignal subscription
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const userType = searchParams.get("userType");

    if (!userId || !userType) {
      return NextResponse.json(
        { error: "Missing required query params: userId, userType" },
        { status: 400 }
      );
    }

    let playerId: string | null = null;
    let subscribedAt: Date | null = null;

    if (userType === "customer") {
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true },
      });
      playerId = customer?.oneSignalPlayerId || null;
      subscribedAt = customer?.oneSignalSubscribedAt || null;
    } else if (userType === "locksmith") {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: userId },
        select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true },
      });
      playerId = locksmith?.oneSignalPlayerId || null;
      subscribedAt = locksmith?.oneSignalSubscribedAt || null;
    }

    return NextResponse.json({
      isSubscribed: !!playerId,
      playerId,
      subscribedAt,
    });

  } catch (error: any) {
    console.error("[OneSignal] Check subscription error:", error);
    return NextResponse.json(
      { error: "Failed to check subscription" },
      { status: 500 }
    );
  }
}
