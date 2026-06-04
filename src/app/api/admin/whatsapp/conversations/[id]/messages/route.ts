import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getWhatsAppConversation,
  getWhatsAppConversationMessages,
} from "@/lib/whatsapp-inbox";
import { sendTemplateMessage, sendTextMessage } from "@/lib/whatsapp-business";

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

  const sendMode = typeof (body as { sendMode?: unknown })?.sendMode === "string"
    ? (body as { sendMode: string }).sendMode
    : "text";

  if (sendMode === "template") {
    const templateName = typeof (body as { templateName?: unknown })?.templateName === "string"
      ? (body as { templateName: string }).templateName.trim()
      : "";

    const templateLanguage = typeof (body as { templateLanguage?: unknown })?.templateLanguage === "string"
      ? (body as { templateLanguage: string }).templateLanguage.trim()
      : "en_GB";

    const templateParametersRaw = (body as { templateParameters?: unknown })?.templateParameters;
    const templateParameters = Array.isArray(templateParametersRaw)
      ? templateParametersRaw.filter((item): item is string => typeof item === "string").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!templateName) {
      return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });
    }

    const templateResult = await sendTemplateMessage(
      conversation.phone,
      templateName,
      templateParameters,
      { languageCode: templateLanguage },
    );

    if (!templateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: templateResult.error || "Failed to send WhatsApp template",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, messageId: templateResult.messageId });
  }

  if (!text) {
    return NextResponse.json({ success: false, error: "Message text is required" }, { status: 400 });
  }

  const result = await sendTextMessage(conversation.phone, text);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to send WhatsApp message",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
