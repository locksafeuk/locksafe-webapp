/**
 * GET    /api/admin/google-ads/drafts/[id]   — fetch full draft
 * DELETE /api/admin/google-ads/drafts/[id]   — soft-delete (only if not PUBLISHED)
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id },
    include: { account: { select: { id: true, name: true, customerId: true } } },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  let approval = null;
  if (draft.approvalId) {
    approval = await prisma.agentApproval.findUnique({ where: { id: draft.approvalId } });
  }

  return NextResponse.json({ draft, approval });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status === "PUBLISHED" || draft.googleCampaignId) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a published draft. Pause the campaign in Google Ads first, or use the pause endpoint.",
      },
      { status: 400 },
    );
  }
  await prisma.googleAdsCampaignDraft.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
