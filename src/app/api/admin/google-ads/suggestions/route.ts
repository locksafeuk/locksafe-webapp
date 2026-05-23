/**
 * GET /api/admin/google-ads/suggestions  — list pending/recent suggestions
 *   ?status=PENDING|APPROVED|REJECTED|APPLIED|EXPIRED  (default: PENDING)
 *   ?type=ADD_NEGATIVE_KEYWORD|...
 *   ?limit=50
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "PENDING";
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "50"));

  const where: Record<string, unknown> = { status };
  if (type) where.type = type;

  const [suggestions, pendingCount] = await Promise.all([
    prisma.campaignSuggestion.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.campaignSuggestion.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({ pendingCount, count: suggestions.length, suggestions });
}
