/**
 * GET /api/agents/executions
 * Returns the last 50 agent executions with agent display name.
 * Used by the admin agents dashboard execution log tab.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFromCookies } from "@/lib/agent-api-auth";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromCookies();
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
