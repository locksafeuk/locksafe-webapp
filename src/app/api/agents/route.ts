/**
 * Agents API - List all agents
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        _count: {
          select: {
            tasks: {
              where: { status: { in: ["pending", "in_progress"] } },
            },
            executions: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedAgents = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      role: agent.role,
      status: agent.status,
      lastHeartbeat: agent.lastHeartbeat?.toISOString() || null,
      nextHeartbeat: agent.nextHeartbeat?.toISOString() || null,
      budgetUsed: agent.budgetUsedUsd,
      budgetTotal: agent.monthlyBudgetUsd,
      pendingTasks: agent._count.tasks,
      totalExecutions: agent._count.executions,
      successRate: agent.successRate,
    }));

    return NextResponse.json({
      agents: formattedAgents,
      summary: {
        total: agents.length,
        active: agents.filter(a => a.status === "active").length,
        paused: agents.filter(a => a.status === "paused").length,
        totalBudgetUsed: agents.reduce((sum, a) => sum + a.budgetUsedUsd, 0),
        totalBudget: agents.reduce((sum, a) => sum + a.monthlyBudgetUsd, 0),
      },
    });
  } catch (error) {
    console.error("[Agents API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
