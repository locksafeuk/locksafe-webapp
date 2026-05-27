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
import { LandingPagePreflightError } from "@/lib/google-ads-landing-preflight";
import { AdCopyPreflightError } from "@/lib/google-ads-copy-guard";
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
    // Landing-page pre-flight failures are an operator-actionable 422, not a
    // 500 — the draft is left APPROVED so it can be re-published once the page
    // is generated / published / cleaned.
    if (err instanceof LandingPagePreflightError) {
      console.warn(`[google-ads/publish/${id}] blocked — landing page not ready (${err.reasonCode}): ${message}`);
      return NextResponse.json(
        { error: "Landing page not ready", reasonCode: err.reasonCode, finalUrl: err.finalUrl, details: message },
        { status: 422 },
      );
    }
    // Ad-copy compliance failures are likewise operator-actionable — the draft
    // stays APPROVED so the copy can be fixed and re-published.
    if (err instanceof AdCopyPreflightError) {
      console.warn(`[google-ads/publish/${id}] blocked — ad copy not compliant: ${message}`);
      return NextResponse.json(
        { error: "Ad copy not compliant", reasonCode: "copy_unclean", offending: err.offending, details: message },
        { status: 422 },
      );
    }
    console.error(`[google-ads/publish/${id}] failed:`, message);
    return NextResponse.json(
      { error: "Publish failed", details: message },
      { status: 500 },
    );
  }
}
