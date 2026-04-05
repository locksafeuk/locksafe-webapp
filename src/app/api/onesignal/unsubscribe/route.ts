import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { deletePlayer } from "@/lib/onesignal";

/**
 * POST /api/onesignal/unsubscribe
 *
 * Remove OneSignal player ID for a user (customer or locksmith)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType } = body;

    if (!userId || !userType) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userType" },
        { status: 400 }
      );
    }

    let playerId: string | null = null;

    if (userType === "customer") {
      const customer = await db.customer.findUnique({
        where: { id: userId },
        select: { oneSignalPlayerId: true },
      });

      playerId = customer?.oneSignalPlayerId || null;

      await db.customer.update({
        where: { id: userId },
        data: {
          oneSignalPlayerId: null,
          oneSignalSubscribedAt: null,
        },
      });
    } else if (userType === "locksmith") {
      const locksmith = await db.locksmith.findUnique({
        where: { id: userId },
        select: { oneSignalPlayerId: true },
      });

      playerId = locksmith?.oneSignalPlayerId || null;

      await db.locksmith.update({
        where: { id: userId },
        data: {
          oneSignalPlayerId: null,
          oneSignalSubscribedAt: null,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid userType. Must be 'customer' or 'locksmith'" },
        { status: 400 }
      );
    }

    // Delete player from OneSignal
    if (playerId) {
      await deletePlayer(playerId);
    }

    console.log(`[OneSignal] Subscription removed: ${userType} ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Subscription removed successfully",
    });
  } catch (error: any) {
    console.error("[OneSignal] Unsubscribe error:", error);

    // Handle not found errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
