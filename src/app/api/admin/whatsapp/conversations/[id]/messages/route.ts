import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getWhatsAppConversation,
  getWhatsAppConversationMessages,
} from "@/lib/whatsapp-inbox";
import { sendTextMessage } from "@/lib/whatsapp-business";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [conversation, messages] = await Promise.all([
    getWhatsAppConversation(id),
    getWhatsAppConversationMessages(id),
  ]);

  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, conversation, messages });
}

export async function POST(
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

  const text = typeof (body as { text?: unknown })?.text === "string"
    ? (body as { text: string }).text.trim()
    : "";

  if (!text) {
    return NextResponse.json({ success: false, error: "Message text is required" }, { status: 400 });
  }

  const result = await sendTextMessage(conversation.phone, text);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send WhatsApp message",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
