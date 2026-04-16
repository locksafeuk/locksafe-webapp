/**
 * Company Goal API - Get, Update, Delete individual goal
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;

    const goal = await prisma.companyGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Get owner agent name if exists
    let ownerAgentName = null;
    if (goal.ownerAgentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: goal.ownerAgentId },
        select: { displayName: true },
      });
      ownerAgentName = agent?.displayName || null;
    }

    // Get related tasks count
    const relatedTasks = await prisma.agentTask.count({
      where: { companyGoalId: goalId },
    });

    return NextResponse.json({
      goal: {
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
        ownerAgentName,
        deadline: goal.deadline?.toISOString() || null,
        completedAt: goal.completedAt?.toISOString() || null,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
        relatedTasks,
      },
    });
  } catch (error) {
    console.error("[Goal API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const body = await request.json();

    // Allowed fields to update
    const allowedUpdates = [
      "title",
      "description",
      "type",
      "status",
      "priority",
      "targetMetric",
      "targetValue",
      "currentValue",
      "progress",
      "ownerAgentId",
      "deadline",
    ];

    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    // Handle status transitions
    if (updates.status === "completed" && !body.completedAt) {
      updates.completedAt = new Date();
      updates.progress = 100;
    }

    // Calculate progress from current/target values if both present
    if (updates.currentValue !== undefined && body.targetValue !== undefined) {
      const current = updates.currentValue as number;
      const target = body.targetValue as number;
      if (target > 0) {
        updates.progress = Math.min(100, (current / target) * 100);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    // Verify owner agent if being updated
    if (updates.ownerAgentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: updates.ownerAgentId as string },
      });

      if (!agent) {
        return NextResponse.json(
          { error: "Owner agent not found" },
          { status: 404 }
        );
      }
    }

    const goal = await prisma.companyGoal.update({
      where: { id: goalId },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      goal: {
        id: goal.id,
        title: goal.title,
        status: goal.status,
        progress: goal.progress,
        updatedAt: goal.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Goal API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;

    // Check if goal exists
    const goal = await prisma.companyGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Check for related tasks
    const relatedTasks = await prisma.agentTask.count({
      where: { companyGoalId: goalId },
    });

    if (relatedTasks > 0) {
      // Clear the goal reference from related tasks instead of blocking
      await prisma.agentTask.updateMany({
        where: { companyGoalId: goalId },
        data: { companyGoalId: null },
      });
    }

    // Delete the goal
    await prisma.companyGoal.delete({
      where: { id: goalId },
    });

    return NextResponse.json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.error("[Goal API] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
