/**
 * Control-plane observability API.
 *
 *   GET /api/admin/agents/control-plane
 *
 * Returns a single snapshot for the health dashboard: agent health, the last
 * 24h of pipeline decisions (shadow + enforced), the approval backlog, and any
 * active heartbeat locks. Admin-authed.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { getControlPlaneFlags, setControlPlaneFlag, type ControlPlaneFlagKey } from "@/agents/control-plane/policy";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const flags = await getControlPlaneFlags();

  const [agents, pendingApprovals, recentProposals, locks] = await Promise.all([
    prisma.agent.findMany({
      select: {
        name: true,
        displayName: true,
        status: true,
        lastHeartbeat: true,
        nextHeartbeat: true,
        monthlyBudgetUsd: true,
        budgetUsedUsd: true,
        heartbeatEnabled: true,
      },
    }),
    prisma.agentApproval.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.agentProposal.findMany({
      where: { proposedAt: { gte: since24h } },
      select: { actionType: true, decision: true, finalDecision: true, validationCode: true, shadow: true },
      take: 5000,
    }),
    prisma.agentHeartbeatLock.findMany({ where: { expiresAt: { gt: now } } }),
  ]);

  // Aggregate the last 24h of decisions.
  const byDecision: Record<string, number> = {};
  const byCode: Record<string, number> = {};
  const byAction: Record<string, { total: number; reject: number }> = {};
  let shadowCount = 0;
  let enforcedCount = 0;
  let wouldReject = 0;

  for (const p of recentProposals) {
    byDecision[p.decision] = (byDecision[p.decision] ?? 0) + 1;
    if (p.shadow) shadowCount++; else enforcedCount++;
    if (p.decision === "reject") {
      wouldReject++;
      if (p.validationCode) byCode[p.validationCode] = (byCode[p.validationCode] ?? 0) + 1;
    }
    const a = (byAction[p.actionType] ??= { total: 0, reject: 0 });
    a.total++;
    if (p.decision === "reject") a.reject++;
  }

  const agentHealth = agents.map((a) => ({
    name: a.name,
    displayName: a.displayName,
    status: a.status,
    heartbeatEnabled: a.heartbeatEnabled,
    lastHeartbeat: a.lastHeartbeat,
    nextHeartbeat: a.nextHeartbeat,
    lastHeartbeatAgeMins: a.lastHeartbeat ? Math.round((now.getTime() - a.lastHeartbeat.getTime()) / 60000) : null,
    budgetUsedUsd: a.budgetUsedUsd,
    budgetRemainingUsd: Math.max(0, a.monthlyBudgetUsd - a.budgetUsedUsd),
  }));

  return NextResponse.json({
    success: true,
    generatedAt: now.toISOString(),
    enforcement: flags,
    agents: agentHealth,
    decisions24h: {
      total: recentProposals.length,
      shadow: shadowCount,
      enforced: enforcedCount,
      wouldReject,
      byDecision,
      byRejectCode: byCode,
      byAction,
    },
    approvals: {
      pendingCount: pendingApprovals.length,
      pending: pendingApprovals,
    },
    locks: locks.map((l) => ({ agent: l.agent, nodeId: l.nodeId, expiresAt: l.expiresAt })),
  });
}

/**
 * Toggle a control-plane enforcement flag (or the kill switch) at runtime — no
 * redeploy, no PM2 restart. Body: { flag: "alert"|"dispatch"|"approvals"|"selfImprove"|"killSwitch", value: boolean | null }.
 * value=null clears the override (back to env fallback).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const flag = String(body?.flag || "");
  const valid = ["alert", "dispatch", "approvals", "selfImprove", "killSwitch"];
  if (!valid.includes(flag)) {
    return NextResponse.json({ error: `flag must be one of: ${valid.join(", ")}` }, { status: 400 });
  }
  const value = body?.value === null ? null : body?.value === true;

  const adminId = (admin as { sub?: string; id?: string }).sub || (admin as { id?: string }).id || "admin";
  const flags = await setControlPlaneFlag(flag as ControlPlaneFlagKey | "killSwitch", value, adminId);

  return NextResponse.json({ success: true, flags });
}
