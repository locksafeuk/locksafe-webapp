/**
 * Agent Approval API - Approve/Reject a pending action
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdminFromCookies } from "@/lib/agent-api-auth";
import { logAgentApiMutation } from "@/lib/agent-api-audit";
import { sendAdminAlert } from "@/lib/telegram";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const admin = await requireAdminFromCookies();
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
        resolvedBy: admin.id,
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

    await logAgentApiMutation({
      admin,
      actionName: approved ? "approvals_approve" : "approvals_reject",
      targetAgentId: approval.agentId,
      input: {
        approvalId,
        actionType: approval.actionType,
        approved,
        resolution: resolution || null,
      },
      output: { status: updatedApproval.status },
    });

    // Cascade approval to linked Google Ads draft
    if (approval.targetType === "google_ads_draft" && approval.targetId) {
      const now = new Date();
      await prisma.googleAdsCampaignDraft.updateMany({
        where: { id: approval.targetId, status: { in: ["PENDING_APPROVAL", "DRAFT"] } },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          approvedBy: approved ? admin.id : null,
          approvedAt: approved ? now : null,
          rejectedReason: approved ? null : resolution || "Rejected by admin",
        },
      }).catch(() => {});
    }

    // Telegram notification
    sendAdminAlert({
      title: approved
        ? `✅ Approval Resolved: ${approval.actionType}`
        : `❌ Approval Rejected: ${approval.actionType}`,
      message: `${approved ? "Approved" : "Rejected"} by admin.\n\nReason: ${approval.reason}\nResolution: ${resolution || (approved ? "Approved by admin" : "Rejected by admin")}`,
      severity: approved ? "info" : "warning",
    }).catch(() => {});

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
