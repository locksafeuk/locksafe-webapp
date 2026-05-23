/**
 * POST /api/admin/google-ads/suggestions/[id]/reject
 * Body: { reason: string }
 *
 * Human rejects a suggestion. Records the reason so the AI can learn.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { rejectSuggestion } from "@/lib/google-ads-suggestion-executor";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "other").slice(0, 200);

  await rejectSuggestion(id, String(admin.id ?? admin.email ?? "admin"), reason);

  return NextResponse.json({ ok: true });
}
