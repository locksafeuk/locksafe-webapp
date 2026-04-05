import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { updatePlayerTags } from "@/lib/onesignal";

/**
 * POST /api/onesignal/subscribe
 *
 * Save OneSignal player ID for a user (customer or locksmith)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, playerId } = body;

    if (!userId || !userType || !playerId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userType, playerId" },
        { status: 400 }
      );
    }

    const now = new Date();

    if (userType === "customer") {
      await db.customer.update({
        where: { id: userId },
        data: {
          oneSignalPlayerId: playerId,
          oneSignalSubscribedAt: now,
        },
      });

      // Set tags for segmentation
      await updatePlayerTags(playerId, {
        user_type: "customer",
        user_id: userId,
      });
    } else if (userType === "locksmith") {
      const locksmith = await db.locksmith.update({
        where: { id: userId },
        data: {
          oneSignalPlayerId: playerId,
          oneSignalSubscribedAt: now,
        },
      });

      // Set tags for segmentation including coverage info
      await updatePlayerTags(playerId, {
        user_type: "locksmith",
        user_id: userId,
        is_available: locksmith.isAvailable ? "true" : "false",
        is_verified: locksmith.isVerified ? "true" : "false",
        coverage_radius: String(locksmith.coverageRadius || 10),
      });
    } else {
      return NextResponse.json(
        { error: "Invalid userType. Must be 'customer' or 'locksmith'" },
        { status: 400 }
      );
    }

    console.log(`[OneSignal] Subscription saved: ${userType} ${userId} -> ${playerId}`);

    return NextResponse.json({
      success: true,
      message: "Subscription saved successfully",
    });
  } catch (error: any) {
    console.error("[OneSignal] Subscribe error:", error);

    // Handle not found errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
