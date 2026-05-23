/**
 * GET /api/agents/status
 * Lightweight polling endpoint for Mission Control dashboard.
 * Returns all agents' live status + system health.
 * Called every 15s by the dashboard auto-refresh.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFromCookies } from "@/lib/agent-api-auth";
import { classifyModel } from "@/lib/classify-model";
import { getOllamaRuntimeDecision } from "@/lib/ollama-runtime";

function getPulseStatus(lastHeartbeat: Date | null): "green" | "amber" | "red" {
  if (!lastHeartbeat) return "red";
  const ageMins = (Date.now() - lastHeartbeat.getTime()) / 60000;
  if (ageMins < 5) return "green";
  if (ageMins < 30) return "amber";
  return "red";
}

export async function GET() {
  const admin = await requireAdminFromCookies();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const [agents, pendingApprovals, todayExecutions, recentExecutions] = await Promise.all([
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
    prisma.agentExecution.findMany({
      where: { startedAt: { gte: oneDayAgo }, model: { not: null } },
      select: { model: true, startedAt: true },
      orderBy: { startedAt: "desc" },
    }),
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

  const ollamaRuntime = getOllamaRuntimeDecision();
  const hermesModeEnabled = ollamaRuntime.enabled;

  const localCount   = recentExecutions.filter(e => classifyModel(e.model) === "local").length;
  const openaiCount  = recentExecutions.filter(e => classifyModel(e.model) === "openai").length;
  const unknownCount = recentExecutions.filter(e => classifyModel(e.model) === "unknown").length;
  const total        = recentExecutions.length;

  return NextResponse.json({
    agents: agentData,
    system: {
      hermesModeEnabled,
      ollamaUrl: process.env.OLLAMA_BASE_URL ?? null,
      ollamaRuntimeReason: ollamaRuntime.reason ?? null,
      pendingApprovals,
      todayExecutions,
      totalBudgetUsed: agents.reduce((s, a) => s + a.budgetUsedUsd, 0),
      totalBudget: agents.reduce((s, a) => s + a.monthlyBudgetUsd, 0),
      activeAgents: agents.filter((a) => a.status === "active").length,
      totalAgents: agents.length,
      llmRuntime: {
        total,
        localCount,
        openaiCount,
        unknownCount,
        localPct: total > 0 ? Math.round((localCount / total) * 100) : null,
        lastModel: recentExecutions[0]?.model ?? null,
        lastSeenAt: recentExecutions[0]?.startedAt?.toISOString() ?? null,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
