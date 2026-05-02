/**
 * Agent Approval API - Approve/Reject a pending action
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { approvalId } = await params;
    const body = await request.json();
    const { approved, resolution } = body;

    if (typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "approved field is required (boolean)" },
        { status: 400 }
      );
    }

    const approval = await prisma.agentApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { error: "Approval has already been processed" },
        { status: 400 }
      );
    }

    // Update the approval
    const updatedApproval = await prisma.agentApproval.update({
      where: { id: approvalId },
      data: {
        status: approved ? "approved" : "rejected",
        resolvedBy: "admin", // In production, get from session
        resolvedAt: new Date(),
        resolution: resolution || (approved ? "Approved by admin" : "Rejected by admin"),
      },
    });

    // If approved, we could trigger the execution here
    // For now, the agent will pick it up on next heartbeat
    if (approved) {
      // Log the approval
      await prisma.agentExecution.create({
        data: {
          agentId: approval.agentId,
          traceId: `approval_${approvalId}`,
          actionType: "approval_granted",
          actionName: approval.actionType,
          input: approval.actionDetails,
          status: "success",
          tokensUsed: 0,
          costUsd: 0,
          requiresApproval: false,
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      approval: {
        id: updatedApproval.id,
        status: updatedApproval.status,
        resolvedAt: updatedApproval.resolvedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Approval API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
