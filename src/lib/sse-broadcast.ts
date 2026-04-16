// Store active connections by user/job ID
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export function getConnections() {
  return connections;
}

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
