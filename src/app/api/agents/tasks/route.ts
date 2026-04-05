/**
 * Agent Tasks API - List and Create Tasks
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (agentId) {
      where.agentId = agentId;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    const tasks = await prisma.agentTask.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      take: 100,
    });

    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      agentId: task.agentId,
      agentName: task.agent.name,
      agentDisplayName: task.agent.displayName,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      result: task.result,
      resultSummary: task.resultSummary,
      delegatedFrom: task.delegatedFrom,
      delegatedTo: task.delegatedTo,
      companyGoalId: task.companyGoalId,
      projectContext: task.projectContext,
      deadline: task.deadline?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
    }));

    const summary = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };

    return NextResponse.json({
      tasks: formattedTasks,
      summary,
    });
  } catch (error) {
    console.error("[Tasks API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { agentId, title, description, priority, deadline, companyGoalId, projectContext } = body;

    if (!agentId || !title) {
      return NextResponse.json(
        { error: "agentId and title are required" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const task = await prisma.agentTask.create({
      data: {
        agentId,
        title,
        description: description || "",
        priority: priority || 5,
        status: "pending",
        deadline: deadline ? new Date(deadline) : null,
        companyGoalId: companyGoalId || null,
        projectContext: projectContext || null,
      },
      include: {
        agent: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        agentId: task.agentId,
        agentName: task.agent.name,
        agentDisplayName: task.agent.displayName,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        createdAt: task.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Tasks API] Error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
