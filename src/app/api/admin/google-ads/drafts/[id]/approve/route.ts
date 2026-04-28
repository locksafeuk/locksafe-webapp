/**
 * POST /api/admin/google-ads/drafts/[id]/approve
 * Body: { approve: boolean, resolution?: string }
 *
 * Marks the matching AgentApproval row as approved/rejected and updates the
 * draft.status. Does NOT publish — admin must call /publish separately.
 *
 * In Phase 2 this is admin-only; Phase 3 will add a Telegram-deep-link path
 * via /api/agents/approvals/[id] that admins can hit from their phone.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

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
    approve?: boolean;
    resolution?: string;
  };

  if (typeof body.approve !== "boolean") {
    return NextResponse.json(
      { error: "Body must include `approve` (boolean)" },
      { status: 400 },
    );
  }

  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "PENDING_APPROVAL" && draft.status !== "DRAFT") {
    return NextResponse.json(
      { error: `Draft is in status "${draft.status}" and cannot be approved/rejected` },
      { status: 400 },
    );
  }

  const now = new Date();
  const newStatus = body.approve ? "APPROVED" : "REJECTED";
  const resolution = body.resolution?.slice(0, 500);

  // Resolve the linked AgentApproval row if any.
  if (draft.approvalId) {
    await prisma.agentApproval.updateMany({
      where: { id: draft.approvalId, status: "pending" },
      data: {
        status: body.approve ? "approved" : "rejected",
        resolvedAt: now,
        resolvedBy: admin.id,
        resolution: resolution ?? (body.approve ? "Approved by admin" : "Rejected by admin"),
      },
    });
  }

  const updated = await prisma.googleAdsCampaignDraft.update({
    where: { id },
    data: {
      status: newStatus,
      approvedBy: body.approve ? admin.id : null,
      approvedAt: body.approve ? now : null,
      rejectedReason: body.approve ? null : resolution ?? "Rejected by admin",
    },
  });

  return NextResponse.json({ success: true, draft: updated });
}
