import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { markWhatsAppConversationRead } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
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
  await markWhatsAppConversationRead(id);

  return NextResponse.json({ success: true });
}
