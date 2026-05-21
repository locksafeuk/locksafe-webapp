/**
 * POST /api/admin/google-ads/drafts/[id]/snapshot
 *
 * Re-pulls the live Google Ads state for a published draft and stores it as
 * `publishedSnapshot`. Safe to call repeatedly — overwrites prior snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { captureAndStoreSnapshot } from "@/lib/google-ads-snapshot";

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
  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id },
    select: { id: true, googleCampaignId: true },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (!draft.googleCampaignId) {
    return NextResponse.json(
      { error: "Draft has not been published — nothing to snapshot." },
      { status: 400 },
    );
  }

  const result = await captureAndStoreSnapshot(id);
  if (!result.ok) {
    return NextResponse.json({ error: "Snapshot failed", details: result.error }, { status: 500 });
  }

  const updated = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id },
    select: { publishedSnapshot: true, snapshotAt: true },
  });
  return NextResponse.json({
    success: true,
    snapshotAt: updated?.snapshotAt,
    snapshot: updated?.publishedSnapshot,
  });
}
