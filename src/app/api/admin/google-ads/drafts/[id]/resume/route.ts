/**
 * POST /api/admin/google-ads/drafts/[id]/resume
 *
 * Resume a paused Google Ads campaign. Sets the campaign status back
 * to ENABLED on Google's side AND optionally bumps the daily budget
 * in the same call (common when un-pausing a forensic-validation test
 * campaign at £20/day for real Smart Bidding at £60-100/day).
 *
 * Body (optional):
 *   {
 *     dailyBudget?: number     // GBP — if provided, mutates campaign_budget too
 *   }
 *
 * Throws (via 500) if the new budget would exceed
 * MAX_DAILY_ACCOUNT_SPEND_GBP (Rule #14, playbook §17).
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { resumePublishedDraft } from "@/lib/google-ads-publish";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (!draft.googleCampaignId) {
    return NextResponse.json(
      { error: "Draft is not published — nothing to resume" },
      { status: 400 },
    );
  }

  let body: { dailyBudget?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const newDailyBudgetGbp =
    typeof body.dailyBudget === "number" && Number.isFinite(body.dailyBudget) && body.dailyBudget > 0
      ? body.dailyBudget
      : undefined;

  try {
    const result = await resumePublishedDraft(id, { newDailyBudgetGbp });
    console.log(
      `[google-ads/resume/${id}] resumed by admin ${admin.id} — budget £${result.previousDailyBudget} → £${result.newDailyBudget}`,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Resume failed", details: message },
      { status: 500 },
    );
  }
}
