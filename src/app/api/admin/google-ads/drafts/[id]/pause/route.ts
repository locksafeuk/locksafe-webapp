/**
 * POST /api/admin/google-ads/drafts/[id]/pause
 *
 * Pauses the live Google Ads campaign linked to this draft. Used as the
 * per-campaign kill switch.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { pausePublishedDraft } from "@/lib/google-ads-publish";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (!draft.googleCampaignId) {
    return NextResponse.json(
      { error: "Draft is not published — nothing to pause" },
      { status: 400 },
    );
  }

  try {
    const result = await pausePublishedDraft(id);
    console.log(`[google-ads/pause/${id}] paused by admin ${admin.id}`);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Pause failed", details: message }, { status: 500 });
  }
}
