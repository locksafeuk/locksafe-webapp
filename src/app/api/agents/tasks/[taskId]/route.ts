/**
 * Agent Task API - Get, Update, Delete individual task
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    const task = await prisma.agentTask.findUnique({
      where: { id: taskId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      task: {
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
        error: task.error,
        delegatedFrom: task.delegatedFrom,
        delegatedTo: task.delegatedTo,
        companyGoalId: task.companyGoalId,
        projectContext: task.projectContext,
        tokensUsed: task.tokensUsed,
        costUsd: task.costUsd,
        deadline: task.deadline?.toISOString() || null,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("[Task API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    // Allowed fields to update
    const allowedUpdates = [
      "status",
      "priority",
      "title",
      "description",
      "result",
      "resultSummary",
      "error",
      "deadline",
    ];

    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    // Handle status transitions
    if (updates.status === "in_progress" && !body.startedAt) {
      updates.startedAt = new Date();
    }

    if (updates.status === "completed" && !body.completedAt) {
      updates.completedAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const task = await prisma.agentTask.update({
      where: { id: taskId },
      data: updates,
      include: {
        agent: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Update agent stats if task completed
    if (updates.status === "completed") {
      await prisma.agent.update({
        where: { id: task.agentId },
        data: {
          totalTasksCompleted: {
            increment: 1,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        agentName: task.agent.name,
        status: task.status,
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Task API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // Check if task exists
    const task = await prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Delete the task
    await prisma.agentTask.delete({
      where: { id: taskId },
    });

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("[Task API] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
