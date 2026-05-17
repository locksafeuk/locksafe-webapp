/**
 * GET /api/agents/status
 * Lightweight polling endpoint for Mission Control dashboard.
 * Returns all agents' live status + system health.
 * Called every 15s by the dashboard auto-refresh.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextResponse } from "next/server";
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

function getPulseStatus(lastHeartbeat: Date | null): "green" | "amber" | "red" {
  if (!lastHeartbeat) return "red";
  const ageMins = (Date.now() - lastHeartbeat.getTime()) / 60000;
  if (ageMins < 5) return "green";
  if (ageMins < 30) return "amber";
  return "red";
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [agents, pendingApprovals, todayExecutions] = await Promise.all([
    prisma.agent.findMany({
      include: {
        _count: {
          select: {
            tasks: { where: { status: { in: ["pending", "in_progress"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.agentApproval.count({ where: { status: "pending" } }),
    prisma.agentExecution.count({ where: { startedAt: { gte: todayStart } } }),
  ]);

  const agentData = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat?.toISOString() ?? null,
    pulseStatus: getPulseStatus(agent.lastHeartbeat),
    budgetUsed: agent.budgetUsedUsd,
    budgetTotal: agent.monthlyBudgetUsd,
    budgetPct:
      agent.monthlyBudgetUsd > 0
        ? Math.round((agent.budgetUsedUsd / agent.monthlyBudgetUsd) * 100)
        : 0,
    pendingTasks: agent._count.tasks,
    successRate: agent.successRate,
  }));

  const hermesModeEnabled = !!process.env.OLLAMA_BASE_URL;

  return NextResponse.json({
    agents: agentData,
    system: {
      hermesModeEnabled,
      ollamaUrl: hermesModeEnabled ? process.env.OLLAMA_BASE_URL : null,
      pendingApprovals,
      todayExecutions,
      totalBudgetUsed: agents.reduce((s, a) => s + a.budgetUsedUsd, 0),
      totalBudget: agents.reduce((s, a) => s + a.monthlyBudgetUsd, 0),
      activeAgents: agents.filter((a) => a.status === "active").length,
      totalAgents: agents.length,
    },
    timestamp: new Date().toISOString(),
  });
}
