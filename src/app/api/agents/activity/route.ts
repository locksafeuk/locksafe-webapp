/**
 * GET /api/agents/activity
 * Returns the last N executions across all agents for the live activity feed.
 * Supports ?limit= (default 30, max 100).
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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);

  const executions = await prisma.agentExecution.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      agent: { select: { name: true, displayName: true } },
    },
  });

  const activity = executions.map((ex) => ({
    id: ex.id,
    agentName: ex.agent.name,
    agentDisplayName: ex.agent.displayName,
    actionType: ex.actionType,
    actionName: ex.actionName,
    status: ex.status,
    costUsd: ex.costUsd,
    durationMs: ex.durationMs,
    model: ex.model,
    startedAt: ex.startedAt.toISOString(),
  }));

  return NextResponse.json({ activity });
}
