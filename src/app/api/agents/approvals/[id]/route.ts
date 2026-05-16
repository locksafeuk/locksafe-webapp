/**
 * POST /api/agents/approvals/[id]
 * Body: { approved: boolean, resolution?: string }
 *
 * Resolves a pending AgentApproval. For google_ads_draft targets, also
 * updates the linked GoogleAdsCampaignDraft status.
 * Sends a Telegram alert on resolution.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendAdminAlert } from "@/lib/telegram";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    approved?: boolean;
    resolution?: string;
  };

  if (typeof body.approved !== "boolean") {
    return NextResponse.json(
      { error: "Body must include `approved` (boolean)" },
      { status: 400 },
    );
  }

  const approval = await prisma.agentApproval.findUnique({ where: { id } });
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `Approval is already ${approval.status}` },
      { status: 400 },
    );
  }

  const now = new Date();
  const resolution = body.resolution?.slice(0, 500) ?? (body.approved ? "Approved by admin" : "Rejected by admin");

  const updated = await prisma.agentApproval.update({
    where: { id },
    data: {
      status: body.approved ? "approved" : "rejected",
      resolvedAt: now,
      resolvedBy: admin.id,
      resolution,
    },
  });

  // Cascade to linked Google Ads draft
  if (approval.targetType === "google_ads_draft" && approval.targetId) {
    await prisma.googleAdsCampaignDraft.updateMany({
      where: { id: approval.targetId, status: { in: ["PENDING_APPROVAL", "DRAFT"] } },
      data: {
        status: body.approved ? "APPROVED" : "REJECTED",
        approvedBy: body.approved ? admin.id : null,
        approvedAt: body.approved ? now : null,
        rejectedReason: body.approved ? null : resolution,
      },
    }).catch(() => {});
  }

  // Telegram alert
  sendAdminAlert({
    title: body.approved
      ? `✅ Approval Resolved: ${approval.actionType}`
      : `❌ Approval Rejected: ${approval.actionType}`,
    message: `${body.approved ? "Approved" : "Rejected"} by admin.\n\nReason: ${approval.reason}\nResolution: ${resolution}`,
    severity: body.approved ? "info" : "warning",
  }).catch(() => {});

  return NextResponse.json({ success: true, approval: updated });
}
