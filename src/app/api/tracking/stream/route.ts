import { NextRequest } from "next/server";

// Store active connections by job ID
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Store latest locations by locksmith ID
const locksmithLocations = new Map<string, {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: string;
  locksmithId: string;
  jobId: string;
}>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return new Response("jobId is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the job's connection pool
      if (!connections.has(jobId)) {
        connections.set(jobId, new Set());
      }
      connections.get(jobId)!.add(controller);

      // Send initial connection confirmation
      const connectMessage = JSON.stringify({
        type: "connected",
        jobId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${connectMessage}\n\n`));

      // Send current location if available
      const currentLocation = Array.from(locksmithLocations.values()).find(
        (loc) => loc.jobId === jobId
      );
      if (currentLocation) {
        const locationMessage = JSON.stringify({
          type: "location_update",
          ...currentLocation,
        });
        controller.enqueue(encoder.encode(`data: ${locationMessage}\n\n`));
      }

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
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

// POST endpoint for locksmith to update their location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, locksmithId, lat, lng, heading, speed, accuracy } = body;

    if (!jobId || !locksmithId || lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const locationData = {
      lat,
      lng,
      heading: heading || 0,
      speed: speed || 0,
      accuracy: accuracy || 10,
      timestamp: new Date().toISOString(),
      locksmithId,
      jobId,
    };

    // Store latest location
    locksmithLocations.set(locksmithId, locationData);

    // Broadcast to all connected clients for this job
    const jobConnections = connections.get(jobId);
    if (jobConnections) {
      const encoder = new TextEncoder();
      const message = JSON.stringify({
        type: "location_update",
        ...locationData,
      });

      for (const controller of jobConnections) {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          jobConnections.delete(controller);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, timestamp: locationData.timestamp }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing location update:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process location" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
