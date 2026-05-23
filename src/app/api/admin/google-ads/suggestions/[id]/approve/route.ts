/**
 * POST /api/admin/google-ads/suggestions/[id]/approve
 *
 * Human approves a suggestion. Fires the Google Ads mutation immediately.
 * Returns the mutation result so the UI can show success/failure inline.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { executeSuggestion } from "@/lib/google-ads-suggestion-executor";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await executeSuggestion(id, String(admin.id ?? admin.email ?? "admin"));

  return NextResponse.json(result, { status: result.success ? 200 : 422 });
}
