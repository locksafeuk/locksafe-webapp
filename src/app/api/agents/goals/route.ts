/**
 * Company Goals API - List and Create Goals
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (type && type !== "all") {
      where.type = type;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    const goals = await prisma.companyGoal.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Get owner agent names
    const ownerAgentIds = goals
      .map((g) => g.ownerAgentId)
      .filter((id): id is string => id !== null);

    const agents = await prisma.agent.findMany({
      where: { id: { in: ownerAgentIds } },
      select: { id: true, name: true, displayName: true },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const formattedGoals = goals.map((goal) => {
      const ownerAgent = goal.ownerAgentId ? agentMap.get(goal.ownerAgentId) : null;
      return {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        type: goal.type,
        status: goal.status,
        priority: goal.priority,
        targetMetric: goal.targetMetric,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        progress: goal.progress,
        ownerAgentId: goal.ownerAgentId,
        ownerAgentName: ownerAgent?.displayName || null,
        deadline: goal.deadline?.toISOString() || null,
        completedAt: goal.completedAt?.toISOString() || null,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
      };
    });

    const summary = {
      total: goals.length,
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      paused: goals.filter((g) => g.status === "paused").length,
      avgProgress:
        goals.length > 0
          ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
          : 0,
    };

    return NextResponse.json({
      goals: formattedGoals,
      summary,
    });
  } catch (error) {
    console.error("[Goals API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      title,
      description,
      type,
      priority,
      targetMetric,
      targetValue,
      ownerAgentId,
      deadline,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Verify owner agent if provided
    if (ownerAgentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: ownerAgentId },
      });

      if (!agent) {
        return NextResponse.json(
          { error: "Owner agent not found" },
          { status: 404 }
        );
      }
    }

    const goal = await prisma.companyGoal.create({
      data: {
        title,
        description: description || "",
        type: type || "strategic",
        status: "active",
        priority: priority || 5,
        targetMetric: targetMetric || null,
        targetValue: targetValue || null,
        currentValue: 0,
        progress: 0,
        ownerAgentId: ownerAgentId || null,
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    return NextResponse.json({
      success: true,
      goal: {
        id: goal.id,
        title: goal.title,
        type: goal.type,
        status: goal.status,
        createdAt: goal.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Goals API] Error:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
