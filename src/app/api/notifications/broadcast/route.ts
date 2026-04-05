import { NextRequest, NextResponse } from "next/server";

// In-memory store for notifications (in production, use Redis or similar)
const notificationStore = new Map<string, Array<{
  id: string;
  type: string;
  jobId: string;
  data: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}>>();

// Store for SSE connections (by jobId)
const notificationConnections = new Map<string, Set<ReadableStreamDefaultController>>();

// Store for locksmith SSE connections (by locksmithId)
const locksmithConnections = new Map<string, Set<ReadableStreamDefaultController>>();

// Store for locksmith notifications
const locksmithNotificationStore = new Map<string, Array<{
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}>>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, type, locksmithIds, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { error: "type is required" },
        { status: 400 }
      );
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      jobId: jobId || null,
      data: { ...data, jobId },
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Handle NEW_JOB_IN_AREA notifications (broadcast to specific locksmiths)
    if (type === "NEW_JOB_IN_AREA" && locksmithIds && Array.isArray(locksmithIds)) {
      const encoder = new TextEncoder();
      const message = JSON.stringify(notification);
      let broadcastCount = 0;

      for (const locksmithId of locksmithIds) {
        // Store notification for locksmith
        if (!locksmithNotificationStore.has(locksmithId)) {
          locksmithNotificationStore.set(locksmithId, []);
        }
        locksmithNotificationStore.get(locksmithId)!.push(notification);

        // Keep only last 50 notifications per locksmith
        const lsNotifications = locksmithNotificationStore.get(locksmithId)!;
        if (lsNotifications.length > 50) {
          locksmithNotificationStore.set(locksmithId, lsNotifications.slice(-50));
        }

        // Broadcast to connected locksmith
        const connections = locksmithConnections.get(locksmithId);
        if (connections) {
          for (const controller of connections) {
            try {
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
              broadcastCount++;
            } catch {
              connections.delete(controller);
            }
          }
        }
      }

      console.log(`[Broadcast] NEW_JOB_IN_AREA to ${locksmithIds.length} locksmiths (${broadcastCount} active connections)`);

      return NextResponse.json({
        success: true,
        notification,
        broadcastCount,
      });
    }

    // Handle job-specific notifications
    if (jobId) {
      // Store notification
      if (!notificationStore.has(jobId)) {
        notificationStore.set(jobId, []);
      }
      notificationStore.get(jobId)!.push(notification);

      // Keep only last 50 notifications per job
      const jobNotifications = notificationStore.get(jobId)!;
      if (jobNotifications.length > 50) {
        notificationStore.set(jobId, jobNotifications.slice(-50));
      }

      // Broadcast to connected clients
      const connections = notificationConnections.get(jobId);
      if (connections) {
        const encoder = new TextEncoder();
        const message = JSON.stringify(notification);

        for (const controller of connections) {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch {
            connections.delete(controller);
          }
        }
      }

      console.log(`Broadcast notification for job ${jobId}:`, notification);
    }

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    return NextResponse.json(
      { error: "Failed to broadcast notification" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve notifications for a job or locksmith
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const locksmithId = searchParams.get("locksmithId");
  const stream = searchParams.get("stream") === "true";

  // Handle locksmith subscription for new job notifications
  if (locksmithId && stream) {
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      start(controller) {
        if (!locksmithConnections.has(locksmithId)) {
          locksmithConnections.set(locksmithId, new Set());
        }
        locksmithConnections.get(locksmithId)!.add(controller);

        // Send connection confirmation
        const connectMessage = JSON.stringify({
          type: "connected",
          locksmithId,
          timestamp: new Date().toISOString(),
        });
        controller.enqueue(encoder.encode(`data: ${connectMessage}\n\n`));

        // Send existing unread notifications
        const existing = locksmithNotificationStore.get(locksmithId) || [];
        for (const notif of existing.filter((n) => !n.read)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(notif)}\n\n`));
        }

        // Heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          locksmithConnections.get(locksmithId)?.delete(controller);
          if (locksmithConnections.get(locksmithId)?.size === 0) {
            locksmithConnections.delete(locksmithId);
          }
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Handle locksmith notification retrieval (non-stream)
  if (locksmithId) {
    const notifications = locksmithNotificationStore.get(locksmithId) || [];
    return NextResponse.json({
      success: true,
      notifications,
    });
  }

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId or locksmithId is required" },
      { status: 400 }
    );
  }

  // If stream requested, return SSE
  if (stream) {
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      start(controller) {
        if (!notificationConnections.has(jobId)) {
          notificationConnections.set(jobId, new Set());
        }
        notificationConnections.get(jobId)!.add(controller);

        // Send connection confirmation
        const connectMessage = JSON.stringify({
          type: "connected",
          jobId,
          timestamp: new Date().toISOString(),
        });
        controller.enqueue(encoder.encode(`data: ${connectMessage}\n\n`));

        // Send existing unread notifications
        const existing = notificationStore.get(jobId) || [];
        for (const notif of existing.filter((n) => !n.read)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(notif)}\n\n`));
        }

        // Heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          notificationConnections.get(jobId)?.delete(controller);
          if (notificationConnections.get(jobId)?.size === 0) {
            notificationConnections.delete(jobId);
          }
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Otherwise return stored notifications
  const notifications = notificationStore.get(jobId) || [];
  return NextResponse.json({
    success: true,
    notifications,
  });
}
