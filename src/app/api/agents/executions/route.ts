/**
 * GET /api/agents/executions
 * Returns the last 50 agent executions with agent display name.
 * Used by the admin agents dashboard execution log tab.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const agentFilter = searchParams.get("agentId");

  const executions = await prisma.agentExecution.findMany({
    where: agentFilter ? { agentId: agentFilter } : undefined,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      agent: { select: { name: true, displayName: true } },
    },
  });

  return NextResponse.json({ executions });
}
