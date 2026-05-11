import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/push/unregister-device
 *
 * Removes a native push token for a locksmith (called on logout).
 *
 * Body:
 *   userId      - locksmith ID
 *   userType    - must be "locksmith"
 *   deviceToken - the token to remove
 *   tokenType   - "apns" | "fcm" | "fcmv1"
 *   platform    - "ios" | "android"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, deviceToken } = body;

    if (!userId || !deviceToken) {
      return NextResponse.json(
        { success: false, error: "userId and deviceToken are required" },
        { status: 400 }
      );
    }

    if (userType !== "locksmith") {
      return NextResponse.json(
        { success: false, error: "Only locksmith unregistration is supported" },
        { status: 400 }
      );
    }

    // Only clear if the stored token matches (prevent another device clearing someone else's token)
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: userId },
      select: { id: true, nativeDeviceToken: true },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (locksmith.nativeDeviceToken === deviceToken) {
      await prisma.locksmith.update({
        where: { id: userId },
        data: {
          nativeDeviceToken: null,
          nativeTokenType: null,
          nativeTokenPlatform: null,
          nativeTokenRegisteredAt: null,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Device token removed" });
  } catch (error) {
    console.error("[Push][Unregister] Error removing device token:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove device token" },
      { status: 500 }
    );
  }
}
