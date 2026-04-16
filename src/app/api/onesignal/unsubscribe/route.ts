import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deletePlayer } from "@/lib/onesignal";

/**
 * POST /api/onesignal/unsubscribe
 *
 * Remove OneSignal player ID for a user (customer or locksmith)
 * Also deletes the player from OneSignal to stop future notifications.
 *
 * PRIORITY 1 FIX: Ensures player IDs are ALWAYS removed from database
 * - Customer subscriptions cleared from Customer table
 * - Locksmith subscriptions cleared from Locksmith table
 * - Guest subscriptions removed from PushSubscription table
 * - Player deleted from OneSignal API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, playerId: directPlayerId } = body;

    console.log(`[OneSignal] Unsubscribe request:`, {
      userId,
      userType,
      directPlayerId: directPlayerId?.substring(0, 8) + '...',
    });

    // Allow unsubscribe by playerId directly (for guest users)
    if (directPlayerId && !userId) {
      console.log(`[OneSignal] Processing guest unsubscribe: ${directPlayerId}`);

      // Try to delete from OneSignal first
      const deletedFromOneSignal = await deletePlayer(directPlayerId);
      if (!deletedFromOneSignal) {
        console.warn(`[OneSignal] ⚠️  Failed to delete player from OneSignal API: ${directPlayerId}`);
      } else {
        console.log(`[OneSignal] ✅ Player deleted from OneSignal API: ${directPlayerId}`);
      }

      // Try to remove from PushSubscription database table
      try {
        const deletedSubscription = await prisma.pushSubscription.delete({
          where: { playerId: directPlayerId },
        });
        console.log("[OneSignal] ✅ Guest subscription removed from database:", deletedSubscription.id);

        return NextResponse.json({
          success: true,
          message: "Guest subscription removed from database successfully",
          deletedFromDatabase: true,
          deletedFromOneSignal,
          playerId: directPlayerId,
        });
      } catch (dbError: any) {
        // Record might not exist - that's OK
        if (dbError.code === "P2025") {
          console.log("[OneSignal] No database record found for guest subscription (already deleted)");
          return NextResponse.json({
            success: true,
            message: "Guest subscription already removed or not found in database",
            deletedFromDatabase: false,
            deletedFromOneSignal,
            playerId: directPlayerId,
          });
        }

        // Other database errors
        console.error("[OneSignal] ❌ Database error removing guest subscription:", dbError);
        return NextResponse.json(
          {
            error: "Failed to remove guest subscription from database",
            code: "DATABASE_ERROR",
            deletedFromOneSignal,
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
          },
          { status: 500 }
        );
      }
    }

    // Validate required fields for user unsubscribe
    if (!userId) {
      console.error("[OneSignal] Missing userId in request");
      return NextResponse.json(
        { error: "Missing required field: userId (or provide playerId for guest unsubscribe)" },
        { status: 400 }
      );
    }

    if (!userType || !["customer", "locksmith"].includes(userType)) {
      console.error("[OneSignal] Invalid userType:", userType);
      return NextResponse.json(
        { error: "Invalid userType. Must be 'customer' or 'locksmith'" },
        { status: 400 }
      );
    }

    let playerId: string | null = null;
    let userFound = false;
    let deletedFromOneSignal = false;

    if (userType === "customer") {
      console.log(`[OneSignal] Processing customer unsubscribe: userId=${userId}`);

      // Find customer and get their player ID
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { id: true, name: true, oneSignalPlayerId: true },
      });

      if (!customer) {
        console.error(`[OneSignal] ❌ Customer not found: ${userId}`);
        return NextResponse.json(
          {
            error: "Customer not found",
            code: "USER_NOT_FOUND"
          },
          { status: 404 }
        );
      }

      userFound = true;
      playerId = customer.oneSignalPlayerId;

      // Delete player from OneSignal API first (before database)
      if (playerId) {
        deletedFromOneSignal = await deletePlayer(playerId);
        if (deletedFromOneSignal) {
          console.log(`[OneSignal] ✅ Player deleted from OneSignal API: ${playerId}`);
        } else {
          console.warn(`[OneSignal] ⚠️  Failed to delete player from OneSignal API: ${playerId}`);
        }
      } else {
        console.log(`[OneSignal] No player ID found for customer ${userId} (already unsubscribed)`);
      }

      // Clear subscription from database - CRITICAL DATABASE OPERATION
      try {
        const updatedCustomer = await prisma.customer.update({
          where: { id: userId },
          data: {
            oneSignalPlayerId: null,
            oneSignalSubscribedAt: null,
          },
        });

        console.log(`[OneSignal] ✅ Customer subscription removed from database: ${userId}`);

        return NextResponse.json({
          success: true,
          message: "Customer subscription removed from database successfully",
          userFound: true,
          hadPlayerId: !!playerId,
          deletedFromOneSignal,
          userId,
        });
      } catch (dbError: any) {
        console.error("[OneSignal] ❌ Database error updating customer:", dbError);
        return NextResponse.json(
          {
            error: "Failed to remove customer subscription from database",
            code: "DATABASE_UPDATE_ERROR",
            deletedFromOneSignal,
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
          },
          { status: 500 }
        );
      }

    } else if (userType === "locksmith") {
      console.log(`[OneSignal] Processing locksmith unsubscribe: userId=${userId}`);

      // Find locksmith and get their player ID
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: userId },
        select: { id: true, name: true, oneSignalPlayerId: true },
      });

      if (!locksmith) {
        console.error(`[OneSignal] ❌ Locksmith not found: ${userId}`);
        return NextResponse.json(
          {
            error: "Locksmith not found",
            code: "USER_NOT_FOUND"
          },
          { status: 404 }
        );
      }

      userFound = true;
      playerId = locksmith.oneSignalPlayerId;

      // Delete player from OneSignal API first (before database)
      if (playerId) {
        deletedFromOneSignal = await deletePlayer(playerId);
        if (deletedFromOneSignal) {
          console.log(`[OneSignal] ✅ Player deleted from OneSignal API: ${playerId}`);
        } else {
          console.warn(`[OneSignal] ⚠️  Failed to delete player from OneSignal API: ${playerId}`);
        }
      } else {
        console.log(`[OneSignal] No player ID found for locksmith ${userId} (already unsubscribed)`);
      }

      // Clear subscription from database - CRITICAL DATABASE OPERATION
      try {
        const updatedLocksmith = await prisma.locksmith.update({
          where: { id: userId },
          data: {
            oneSignalPlayerId: null,
            oneSignalSubscribedAt: null,
          },
        });

        console.log(`[OneSignal] ✅ Locksmith subscription removed from database: ${userId}`);

        return NextResponse.json({
          success: true,
          message: "Locksmith subscription removed from database successfully",
          userFound: true,
          hadPlayerId: !!playerId,
          deletedFromOneSignal,
          userId,
        });
      } catch (dbError: any) {
        console.error("[OneSignal] ❌ Database error updating locksmith:", dbError);
        return NextResponse.json(
          {
            error: "Failed to remove locksmith subscription from database",
            code: "DATABASE_UPDATE_ERROR",
            deletedFromOneSignal,
            details: process.env.NODE_ENV === "development" ? dbError.message : undefined,
          },
          { status: 500 }
        );
      }
    }

    // Should never reach here due to validation above
    console.error("[OneSignal] Reached unexpected code path in unsubscribe");
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );

  } catch (error: any) {
    console.error("[OneSignal] ❌ Unsubscribe error:", error);

    // Handle specific Prisma errors
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          error: "User not found in database",
          code: "USER_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    if (error.code === "P2023") {
      return NextResponse.json(
        {
          error: "Invalid ID format",
          code: "INVALID_ID"
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
        error: "Failed to remove subscription from database",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onesignal/unsubscribe
 *
 * Alternative method for unsubscribing - same as POST
 */
export async function DELETE(request: NextRequest) {
  return POST(request);
}
