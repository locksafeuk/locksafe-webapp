import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyApiKey } from "@/lib/agent-auth";
import { verifyToken, type TokenPayload } from "@/lib/auth";
import {
  sendNotification,
  sendTemplatedNotification,
  broadcastToSegment,
  NotificationTemplate,
  NOTIFICATION_TEMPLATES,
  ONESIGNAL_SEGMENTS,
} from "@/lib/onesignal";

async function getSessionPayload(request: NextRequest): Promise<TokenPayload | null> {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!authToken) {
    return null;
  }

  return verifyToken(authToken);
}

async function getPlayerIdForSession(session: TokenPayload): Promise<string | null> {
  if (session.type === "customer") {
    const customer = await db.customer.findUnique({
      where: { id: session.id },
      select: { oneSignalPlayerId: true },
    });
    return customer?.oneSignalPlayerId || null;
  }

  if (session.type === "locksmith") {
    const locksmith = await db.locksmith.findUnique({
      where: { id: session.id },
      select: { oneSignalPlayerId: true },
    });
    return locksmith?.oneSignalPlayerId || null;
  }

  return null;
}

async function authorizeSendRequest(
  request: NextRequest,
  body: Record<string, any>
): Promise<{ allowed: boolean; error?: string }> {
  const apiAuth = verifyApiKey(request);
  const session = await getSessionPayload(request);
  const isAdmin = apiAuth.authenticated || session?.type === "admin";

  if (body.template || body.segment || body.userId || body.userType) {
    if (!isAdmin) {
      return { allowed: false, error: "Unauthorized: admin credentials required" };
    }
    return { allowed: true };
  }

  if (body.playerIds?.length) {
    if (isAdmin) {
      return { allowed: true };
    }

    if (!session) {
      return { allowed: false, error: "Unauthorized: login required" };
    }

    if (!Array.isArray(body.playerIds) || body.playerIds.length !== 1) {
      return {
        allowed: false,
        error: "Unauthorized: only a single self playerId may be sent",
      };
    }

    const ownPlayerId = await getPlayerIdForSession(session);
    if (!ownPlayerId) {
      return {
        allowed: false,
        error: "Unauthorized: no active subscription for current user",
      };
    }

    if (body.playerIds[0] !== ownPlayerId) {
      return {
        allowed: false,
        error: "Unauthorized: cannot send notifications to other users",
      };
    }

    return { allowed: true };
  }

  return { allowed: false, error: "Unauthorized or invalid send request" };
}

/**
 * POST /api/onesignal/send
 *
 * Send a push notification via OneSignal.
 * This is for internal/admin use.
 *
 * Body options:
 * 1. Send to specific players: { playerIds: [...], title, message }
 * 2. Send using template: { template: "NEW_JOB_AVAILABLE", playerIds: [...], variables: {} }
 * 3. Broadcast to segment: { segment: "locksmiths", title, message }
 * 4. Send to user by ID: { userId, userType, title, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // Targeting options
      playerIds,
      userId,
      userType,
      segment,
      // Content options
      template,
      title,
      message,
      variables,
      // Optional
      url,
      data,
      jobId,
    } = body;

    const authResult = await authorizeSendRequest(request, body);
    if (!authResult.allowed) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Option 1: Send using a template
    if (template) {
      if (!NOTIFICATION_TEMPLATES[template as NotificationTemplate]) {
        return NextResponse.json(
          { error: `Invalid template: ${template}` },
          { status: 400 }
        );
      }

      let targetPlayerIds = playerIds;

      // Get player IDs from user ID if not provided directly
      if (!targetPlayerIds?.length && userId && userType) {
        const playerId = await getPlayerIdForUser(userId, userType);
        if (playerId) {
          targetPlayerIds = [playerId];
        }
      }

      if (!targetPlayerIds?.length) {
        return NextResponse.json(
          { error: "No target player IDs found" },
          { status: 400 }
        );
      }

      const result = await sendTemplatedNotification(
        template as NotificationTemplate,
        targetPlayerIds,
        {
          url: url || (jobId ? getJobUrl(userType, jobId) : undefined),
          data: { ...data, jobId, template },
          variables,
        }
      );

      return NextResponse.json(result);
    }

    // Option 2: Broadcast to a segment
    if (segment) {
      if (!title || !message) {
        return NextResponse.json(
          { error: "Title and message required for broadcast" },
          { status: 400 }
        );
      }

      const result = await broadcastToSegment(segment, title, message, {
        url,
        data,
      });

      return NextResponse.json(result);
    }

    // Option 3: Send to specific user by ID
    if (userId && userType) {
      const playerId = await getPlayerIdForUser(userId, userType);

      if (!playerId) {
        return NextResponse.json(
          { error: "User has no OneSignal subscription" },
          { status: 404 }
        );
      }

      if (!title || !message) {
        return NextResponse.json(
          { error: "Title and message required" },
          { status: 400 }
        );
      }

      const result = await sendNotification({
        playerIds: [playerId],
        title,
        message,
        url: url || (jobId ? getJobUrl(userType, jobId) : undefined),
        data: { ...data, jobId },
      });

      return NextResponse.json(result);
    }

    // Option 4: Send to specific player IDs
    if (playerIds?.length) {
      if (!title || !message) {
        return NextResponse.json(
          { error: "Title and message required" },
          { status: 400 }
        );
      }

      const result = await sendNotification({
        playerIds,
        title,
        message,
        url,
        data,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "No valid targeting option provided" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[OneSignal] Send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}

// Helper to get player ID for a user
async function getPlayerIdForUser(
  userId: string,
  userType: string
): Promise<string | null> {
  if (userType === "customer") {
    const customer = await db.customer.findUnique({
      where: { id: userId },
      select: { oneSignalPlayerId: true },
    });
    return customer?.oneSignalPlayerId || null;
  } else if (userType === "locksmith") {
    const locksmith = await db.locksmith.findUnique({
      where: { id: userId },
      select: { oneSignalPlayerId: true },
    });
    return locksmith?.oneSignalPlayerId || null;
  }
  return null;
}

// Helper to build job URL
function getJobUrl(userType: string | undefined, jobId: string): string {
  if (userType === "locksmith") {
    return `/locksmith/job/${jobId}`;
  }
  return `/customer/job/${jobId}`;
}

/**
 * GET /api/onesignal/send
 *
 * Get available templates and segments
 */
export async function GET(request: NextRequest) {
  const apiAuth = verifyApiKey(request);
  const session = await getSessionPayload(request);

  if (!apiAuth.authenticated && session?.type !== "admin") {
    return NextResponse.json(
      { error: "Unauthorized: admin credentials required" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    templates: Object.keys(NOTIFICATION_TEMPLATES),
    segments: Object.values(ONESIGNAL_SEGMENTS),
    templateDetails: NOTIFICATION_TEMPLATES,
  });
}
