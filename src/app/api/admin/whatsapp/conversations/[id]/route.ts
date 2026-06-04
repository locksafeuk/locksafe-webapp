import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  assignWhatsAppConversation,
  getWhatsAppConversation,
  setWhatsAppConversationUrgent,
} from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getWhatsAppConversation(id);
  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const assigneeIdValue = (body as { assigneeId?: unknown })?.assigneeId;
  const isUrgentValue = (body as { isUrgent?: unknown })?.isUrgent;

  if (assigneeIdValue === undefined && isUrgentValue === undefined) {
    return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 });
  }

  if (assigneeIdValue !== undefined) {
    if (assigneeIdValue === null || assigneeIdValue === "") {
      const updated = await assignWhatsAppConversation(id, null);
      return NextResponse.json({ success: true, conversation: updated });
    }

    if (typeof assigneeIdValue !== "string") {
      return NextResponse.json({ success: false, error: "Invalid assigneeId" }, { status: 400 });
    }

    const assignee = await prisma.admin.findUnique({
      where: { id: assigneeIdValue },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!assignee || !assignee.isActive) {
      return NextResponse.json({ success: false, error: "Assignee not found" }, { status: 404 });
    }

    const updated = await assignWhatsAppConversation(id, {
      id: assignee.id,
      email: assignee.email,
      name: assignee.name,
    });
    return NextResponse.json({ success: true, conversation: updated });
  }

  if (typeof isUrgentValue !== "boolean") {
    return NextResponse.json({ success: false, error: "Invalid isUrgent" }, { status: 400 });
  }

  const updated = await setWhatsAppConversationUrgent(id, isUrgentValue);
  return NextResponse.json({ success: true, conversation: updated });
}
