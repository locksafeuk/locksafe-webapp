import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listWhatsAppConversations();
  return NextResponse.json({ success: true, conversations });
}
