import { NextRequest } from "next/server";

// Store active connections by user/job ID
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Helper to send event to all connections for a specific job
export function broadcastToJob(jobId: string, event: { type: string; data: unknown }) {
  const jobConnections = connections.get(jobId);
  if (jobConnections) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    jobConnections.forEach((controller) => {
      try {
        controller.enqueue(new TextEncoder().encode(message));
      } catch (error) {
        console.error("Error sending SSE:", error);
      }
    });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return new Response("Missing jobId parameter", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the job's connections
      if (!connections.has(jobId)) {
        connections.set(jobId, new Set());
      }
      connections.get(jobId)?.add(controller);

      // Send initial connection message
      const initMessage = `data: ${JSON.stringify({ type: "connected", jobId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initMessage));

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const ping = `data: ${JSON.stringify({ type: "ping" })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        connections.get(jobId)?.delete(controller);
        if (connections.get(jobId)?.size === 0) {
          connections.delete(jobId);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// API to trigger notifications (called internally)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, type, data } = body;

    if (!jobId || !type) {
      return new Response("Missing required fields", { status: 400 });
    }

    broadcastToJob(jobId, { type, data });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    return new Response("Internal error", { status: 500 });
  }
}
