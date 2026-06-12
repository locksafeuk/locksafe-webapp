/**
 * GET /api/admin/vendor-audit/events
 *
 * Paginated VendorEvent feed for the /admin/data-ownership dashboard.
 * Supports basic filtering by vendor, direction, endpoint, status, date.
 *
 * Query params:
 *   ?vendor=google-ads&direction=outbound&since=2026-06-01&limit=50&cursor=<id>
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const vendor    = url.searchParams.get("vendor");
  const direction = url.searchParams.get("direction");
  const endpoint  = url.searchParams.get("endpoint");
  const status    = url.searchParams.get("status");
  const since     = url.searchParams.get("since");
  const limit     = Math.min(200, Number(url.searchParams.get("limit") ?? "50"));
  const cursor    = url.searchParams.get("cursor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (vendor)    where.vendor    = vendor;
  if (direction) where.direction = direction;
  if (endpoint)  where.endpoint  = { contains: endpoint };
  if (status)    where.status    = Number(status);
  if (since)     where.createdAt = { gte: new Date(since) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const events = await p.vendorEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      vendor: true,
      direction: true,
      endpoint: true,
      method: true,
      status: true,
      requestBytes: true,
      responseBytes: true,
      latencyMs: true,
      identifiersShared: true,
      identifiersReceived: true,
      callerRoute: true,
      errorMessage: true,
    },
  });

  const hasMore   = events.length > limit;
  const items     = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Roll-up: vendor counts in the same window (for header chips)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupBy = await (p.vendorEvent.groupBy({
    by:    ["vendor", "direction"],
    where: since ? { createdAt: { gte: new Date(since) } } : {},
    _count: { _all: true },
    _sum:   { requestBytes: true, responseBytes: true },
  }) as Promise<unknown>);

  return NextResponse.json({ items, nextCursor, summary: groupBy });
}
