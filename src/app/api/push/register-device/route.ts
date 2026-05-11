import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/push/register-device
 *
 * Registers a native APNs (iOS) or FCM (Android) push token for a locksmith.
 * Called by the mobile app after expo-notifications.getDevicePushTokenAsync()
 * returns a device token.
 *
 * Body:
 *   userId        - locksmith ID
 *   userType      - must be "locksmith"
 *   deviceToken   - raw APNs or FCM device token
 *   tokenType     - "apns" | "fcm" | "fcmv1"
 *   platform      - "ios" | "android"
 *   deviceName    - human-readable device name (optional)
 *   isDevice      - true if real device, false if simulator (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, deviceToken, tokenType, platform, deviceName, isDevice } = body;

    if (!userId || !deviceToken || !tokenType || !platform) {
      return NextResponse.json(
        { success: false, error: "userId, deviceToken, tokenType and platform are required" },
        { status: 400 }
      );
    }

    if (userType !== "locksmith") {
      return NextResponse.json(
        { success: false, error: "Only locksmith registration is supported" },
        { status: 400 }
      );
    }

    // Validate token type
    const validTokenTypes = ["apns", "fcm", "fcmv1"];
    if (!validTokenTypes.includes(tokenType)) {
      return NextResponse.json(
        { success: false, error: `Invalid tokenType. Must be one of: ${validTokenTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the locksmith exists
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Update or set the native device token
    await prisma.locksmith.update({
      where: { id: userId },
      data: {
        nativeDeviceToken: deviceToken,
        nativeTokenType: tokenType,
        nativeTokenPlatform: platform,
        nativeTokenRegisteredAt: new Date(),
      },
    });

    console.log(`[Push][Register] Native ${tokenType} token registered for locksmith ${locksmith.name} (${userId}) on ${platform}${deviceName ? ` [${deviceName}]` : ""}${isDevice === false ? " [simulator]" : ""}`);

    return NextResponse.json({ success: true, message: "Device token registered" });
  } catch (error) {
    console.error("[Push][Register] Error registering device token:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register device token" },
      { status: 500 }
    );
  }
}
