/**
 * POST /api/admin/google-ads/drafts/[id]/publish
 *
 * Pushes an APPROVED draft to Google Ads. Always creates resources in PAUSED
 * state — admin must explicitly enable the campaign in Google Ads UI (or via
 * the Phase-3 spend-guard) afterwards.
 *
 * Refuses to publish unless draft.status === "APPROVED".
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { publishGoogleAdsDraft } from "@/lib/google-ads-publish";
import { checkAutoAction } from "@/lib/spend-guard";

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

  if (draft.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: `Draft is in status "${draft.status}". Approve it first.`,
        hint: "POST /api/admin/google-ads/drafts/{id}/approve with { approve: true }",
      },
      { status: 400 },
    );
  }
  if (draft.googleCampaignId) {
    return NextResponse.json(
      { error: "Draft already published", googleCampaignId: draft.googleCampaignId },
      { status: 400 },
    );
  }

  // Spend-guard: even an admin-driven publish must pass the hard caps so a
  // misclick can't blow through the monthly budget. Admin initiator bypasses
  // the autonomyEnabled flag but still respects per-campaign / daily / monthly caps.
  const guard = await checkAutoAction({
    platform: "google",
    action: "publish_draft",
    proposedDailyBudget: draft.dailyBudget,
    initiator: "admin",
  });
  if (!guard.allowed) {
    return NextResponse.json(
      { error: "Spend guard blocked publish", reason: guard.reason, policy: guard.policy, spendUsed: guard.spendUsed },
      { status: 403 },
    );
  }

  try {
    const result = await publishGoogleAdsDraft(id);
    console.log(
      `[google-ads/publish/${id}] published by admin ${admin.id} → campaign ${result.googleCampaignId}`,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[google-ads/publish/${id}] failed:`, message);
    return NextResponse.json(
      { error: "Publish failed", details: message },
      { status: 500 },
    );
  }
}
