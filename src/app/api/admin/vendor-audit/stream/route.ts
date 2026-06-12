/**
 * GET /api/admin/vendor-audit/stream
 *
 * SSE stream of newly-arrived VendorEvent rows. The client opens an
 * EventSource and gets a JSON-encoded event every time a new row lands
 * in the audit log.
 *
 * Implementation: a 2.5s poll over `createdAt > lastSeen`. Cheap, no
 * MongoDB change-stream dependency, fits within Vercel's serverless
 * function ceilings. Connection times out after 9 minutes — the client
 * just reconnects automatically.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 540; // Vercel hobby cap; serverless functions can run up to 9m

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(_request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const encoder = new TextEncoder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  let lastSeen = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* connection closed */ }
      };

      send({ type: "ready", since: lastSeen.toISOString() });

      const interval = setInterval(async () => {
        try {
          const rows = await p.vendorEvent.findMany({
            where:   { createdAt: { gt: lastSeen } },
            orderBy: { createdAt: "asc" },
            take:    50,
            select: {
              id: true, createdAt: true, vendor: true, direction: true,
              endpoint: true, method: true, status: true,
              requestBytes: true, responseBytes: true, latencyMs: true,
              identifiersShared: true, identifiersReceived: true,
              fieldsShared: true, fieldsReceived: true,
              callerRoute: true, errorMessage: true,
            },
          });
          for (const row of rows) {
            send({ type: "event", row });
            if (new Date(row.createdAt) > lastSeen) lastSeen = new Date(row.createdAt);
          }
          // Heartbeat so proxies don't kill an idle connection.
          send({ type: "heartbeat", at: new Date().toISOString() });
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }, 2500);

      // Cleanup if the consumer disconnects.
      const cleanup = () => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      };
      // 8m hard cap to give us 1m of headroom before maxDuration.
      setTimeout(cleanup, 8 * 60 * 1000);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type":   "text/event-stream",
      "Cache-Control":  "no-cache, no-transform",
      "Connection":     "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
