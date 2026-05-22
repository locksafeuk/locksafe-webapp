/**
 * GET /api/admin/agents/reflections
 *
 * Lists recent agent reflections, newest first. Supports query filters:
 *   ?agent=opportunity-scout
 *   ?outcome=WIN|LOSS|INCONCLUSIVE|NEUTRAL
 *   ?subjectType=opportunity|draft|...
 *   ?limit=50 (max 200)
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

  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent");
  const outcome = searchParams.get("outcome");
  const subjectType = searchParams.get("subjectType");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  const where: Record<string, string> = {};
  if (agent) where.agentName = agent;
  if (outcome) where.outcome = outcome;
  if (subjectType) where.subjectType = subjectType;

  const reflections = await prisma.agentReflection.findMany({
    where,
    orderBy: { computedAt: "desc" },
    take: limit,
  });

  const counts = await prisma.agentReflection.groupBy({
    by: ["outcome"],
    _count: { _all: true },
  });

  return NextResponse.json({
    reflections,
    counts: counts.reduce<Record<string, number>>((acc, c) => {
      acc[c.outcome] = c._count._all;
      return acc;
    }, {}),
  });
}
