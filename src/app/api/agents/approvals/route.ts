/**
 * Agent Approvals API - List pending approvals
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const approvals = await prisma.agentApproval.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    // Get agent names for display
    const agentIds = [...new Set(approvals.map(a => a.agentId))];
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, displayName: true },
    });
    const agentMap = new Map(agents.map(a => [a.id, a]));

    const formattedApprovals = approvals.map(approval => ({
      id: approval.id,
      agentId: approval.agentId,
      agentName: agentMap.get(approval.agentId)?.displayName || "Unknown Agent",
      actionType: approval.actionType,
      actionDetails: approval.actionDetails,
      reason: approval.reason,
      estimatedCost: 0, // Could be parsed from actionDetails if needed
      createdAt: approval.createdAt.toISOString(),
    }));

    return NextResponse.json({
      approvals: formattedApprovals,
      count: formattedApprovals.length,
    });
  } catch (error) {
    console.error("[Approvals API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}
