/**
 * Agent API - Get/Update individual agent
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        executions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        memories: {
          orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          take: 50,
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Format the response for the frontend
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        displayName: agent.displayName,
        role: agent.role,
        status: agent.status,
        heartbeatEnabled: agent.heartbeatEnabled,
        heartbeatCronExpr: agent.heartbeatCronExpr,
        lastHeartbeat: agent.lastHeartbeat?.toISOString() || null,
        nextHeartbeat: agent.nextHeartbeat?.toISOString() || null,
        budgetUsedUsd: agent.budgetUsedUsd,
        monthlyBudgetUsd: agent.monthlyBudgetUsd,
        budgetResetAt: agent.budgetResetAt?.toISOString() || null,
        permissions: agent.permissions,
        governanceLevel: agent.governanceLevel,
        successRate: agent.successRate,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
      tasks: agent.tasks.map(task => ({
        id: task.id,
        type: task.title,
        priority: task.priority,
        status: task.status,
        description: task.description,
        result: task.result,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      })),
      executions: agent.executions.map(exec => ({
        id: exec.id,
        triggerType: exec.actionType,
        status: exec.status,
        actionsExecuted: 1, // Each execution is one action
        tokensUsed: exec.tokensUsed,
        costUsd: exec.costUsd,
        startedAt: exec.startedAt.toISOString(),
        completedAt: exec.completedAt?.toISOString() || null,
        errorMessage: exec.output?.includes("error") ? exec.output : null,
      })),
      memories: agent.memories.map(mem => ({
        id: mem.id,
        type: mem.type,
        content: mem.content,
        importance: mem.importance,
        createdAt: mem.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[Agent API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json();

    const allowedUpdates = ["status", "heartbeatEnabled", "monthlyBudgetUsd"];
    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        heartbeatEnabled: agent.heartbeatEnabled,
        monthlyBudgetUsd: agent.monthlyBudgetUsd,
      },
    });
  } catch (error) {
    console.error("[Agent API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}
