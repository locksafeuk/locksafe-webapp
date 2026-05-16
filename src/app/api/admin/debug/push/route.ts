/**
 * GET  /api/admin/debug/push   — diagnostics: env vars + locksmith device token state
 * POST /api/admin/debug/push   — send a test notification to a specific locksmith
 *
 * POST body: { locksmithId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendNativePush } from "@/lib/native-push";

async function requireAdmin(req?: NextRequest) {
  // Allow CRON_SECRET bearer token for CLI/cron testing
  if (req) {
    const auth = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && auth === `Bearer ${cronSecret}`) return { type: "admin" as const };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // --- Env var check ---
  const apns = {
    APNS_KEY_ID: !!process.env.APNS_KEY_ID,
    APNS_TEAM_ID: !!process.env.APNS_TEAM_ID,
    APNS_BUNDLE_ID: !!process.env.APNS_BUNDLE_ID,
    APNS_PRIVATE_KEY: !!process.env.APNS_PRIVATE_KEY,
    ready: !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID && process.env.APNS_PRIVATE_KEY),
    bundleId: process.env.APNS_BUNDLE_ID || "(not set)",
  };

  const fcm = {
    FCM_PROJECT_ID: !!process.env.FCM_PROJECT_ID,
    FCM_SERVICE_ACCOUNT_JSON: !!process.env.FCM_SERVICE_ACCOUNT_JSON,
    ready: !!(process.env.FCM_PROJECT_ID && process.env.FCM_SERVICE_ACCOUNT_JSON),
    projectId: process.env.FCM_PROJECT_ID || "(not set)",
  };

  const oneSignal = {
    NEXT_PUBLIC_ONESIGNAL_APP_ID: !!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    ONESIGNAL_REST_API_KEY: !!process.env.ONESIGNAL_REST_API_KEY,
    ready: !!(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY),
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "(not set)",
  };

  // --- Locksmith device token state ---
  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      isAvailable: true,
      nativeDeviceToken: true,
      nativeTokenType: true,
      nativeTokenPlatform: true,
      nativeTokenRegisteredAt: true,
      oneSignalPlayerId: true,
    },
    orderBy: { name: "asc" },
  });

  const tokenSummary = locksmiths.map((ls) => ({
    id: ls.id,
    name: ls.name,
    isAvailable: ls.isAvailable,
    hasNativeToken: !!ls.nativeDeviceToken,
    tokenPlatform: ls.nativeTokenPlatform,
    tokenType: ls.nativeTokenType,
    tokenRegisteredAt: ls.nativeTokenRegisteredAt,
    // Partially redact token for security
    tokenPreview: ls.nativeDeviceToken
      ? ls.nativeDeviceToken.substring(0, 12) + "…" + ls.nativeDeviceToken.slice(-6)
      : null,
    hasOneSignal: !!ls.oneSignalPlayerId,
    oneSignalPreview: ls.oneSignalPlayerId
      ? ls.oneSignalPlayerId.substring(0, 8) + "…"
      : null,
  }));

  const withNativeToken = tokenSummary.filter((ls) => ls.hasNativeToken);
  const withOneSignal = tokenSummary.filter((ls) => ls.hasOneSignal);
  const noTokenAtAll = tokenSummary.filter((ls) => !ls.hasNativeToken && !ls.hasOneSignal);

  return NextResponse.json({
    env: { apns, fcm, oneSignal },
    locksmiths: {
      total: locksmiths.length,
      withNativeToken: withNativeToken.length,
      withOneSignal: withOneSignal.length,
      noTokenAtAll: noTokenAtAll.length,
      list: tokenSummary,
    },
    registerEndpoint: "POST /api/push/register-device",
    registerBody: {
      userId: "<locksmith_id>",
      userType: "locksmith",
      deviceToken: "<token_from_expo>",
      tokenType: "apns | fcm | fcmv1",
      platform: "ios | android",
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locksmithId } = await request.json();
  if (!locksmithId) {
    return NextResponse.json({ error: "locksmithId required" }, { status: 400 });
  }

  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: {
      id: true,
      name: true,
      nativeDeviceToken: true,
      nativeTokenType: true,
      nativeTokenPlatform: true,
    },
  });

  if (!locksmith) {
    return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });
  }

  if (!locksmith.nativeDeviceToken || !locksmith.nativeTokenType) {
    return NextResponse.json(
      { error: `Locksmith "${locksmith.name}" has no device token registered` },
      { status: 422 }
    );
  }

  const result = await sendNativePush(
    locksmith.nativeDeviceToken,
    locksmith.nativeTokenType,
    locksmith.nativeTokenPlatform ?? "",
    {
      title: "🔔 LockSafe Test",
      body: "Push notifications are working! This is a test from admin.",
      data: { type: "TEST" },
    }
  );

  return NextResponse.json({
    locksmith: locksmith.name,
    platform: locksmith.nativeTokenPlatform,
    tokenType: locksmith.nativeTokenType,
    result,
  });
}
