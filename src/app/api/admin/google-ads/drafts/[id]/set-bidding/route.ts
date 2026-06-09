/**
 * POST /api/admin/google-ads/drafts/[id]/set-bidding
 *
 * Runtime override of the bidding strategy on a LIVE published campaign.
 * Separate from the persist-time playbook rule (which hard-codes
 * MAXIMIZE_CONVERSIONS for new drafts). Admin uses this when, e.g.,
 * MAXIMIZE_CONVERSIONS is spending without conversion signal and they
 * want to switch to MAXIMIZE_CLICKS with a hard CPC ceiling to cap
 * cost-per-click while attribution gets fixed.
 *
 * Body:
 *   {
 *     strategy:        "MAXIMIZE_CLICKS" | "MAXIMIZE_CONVERSIONS" | "MANUAL_CPC",
 *     cpcBidCeilingGbp?: number    // required for MAXIMIZE_CLICKS / MANUAL_CPC
 *   }
 *
 * Auth: admin JWT cookie.
 *
 * Note: This is the ESCAPE HATCH for the persist-time bidding rule. Use
 * sparingly and log every override (admin id + previous strategy + reason).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getGoogleAdsClientForAccount, buildResourceName } from "@/lib/google-ads";

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

/** £ → micros (Google's per-currency-unit×1,000,000 standard). */
function gbpToMicros(gbp: number): string {
  return String(Math.round(gbp * 1_000_000));
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
      { error: "Draft has no published campaign — nothing to mutate" },
      { status: 400 },
    );
  }

  let body: { strategy?: string; cpcBidCeilingGbp?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const strategy = body.strategy;
  const cpcBidCeilingGbp = body.cpcBidCeilingGbp;

  if (!strategy) {
    return NextResponse.json({ error: "strategy is required" }, { status: 400 });
  }
  if (!["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"].includes(strategy)) {
    return NextResponse.json(
      { error: "strategy must be one of MAXIMIZE_CLICKS | MAXIMIZE_CONVERSIONS | MANUAL_CPC" },
      { status: 400 },
    );
  }
  if (
    (strategy === "MAXIMIZE_CLICKS" || strategy === "MANUAL_CPC") &&
    (!cpcBidCeilingGbp || cpcBidCeilingGbp <= 0)
  ) {
    return NextResponse.json(
      { error: "cpcBidCeilingGbp required (positive number) for MAXIMIZE_CLICKS or MANUAL_CPC" },
      { status: 400 },
    );
  }

  const client = await getGoogleAdsClientForAccount(draft.accountId);
  if (!client) {
    return NextResponse.json(
      { error: "No active GoogleAdsAccount for this draft" },
      { status: 500 },
    );
  }

  const previousStrategy = draft.biddingStrategy;
  const resourceName = buildResourceName(
    client.customerIdPlain,
    "campaigns",
    draft.googleCampaignId,
  );

  // Build mutation per strategy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBody: any = { resourceName };
  let updateMask: string;

  if (strategy === "MAXIMIZE_CLICKS") {
    updateBody.maximizeClicks = {
      cpcBidCeilingMicros: gbpToMicros(cpcBidCeilingGbp as number),
    };
    updateMask = "maximize_clicks";
  } else if (strategy === "MAXIMIZE_CONVERSIONS") {
    updateBody.maximizeConversions = {};
    updateMask = "maximize_conversions";
  } else {
    // MANUAL_CPC
    updateBody.manualCpc = {
      enhancedCpcEnabled: false,
    };
    updateMask = "manual_cpc";
  }

  try {
    await client.mutate("campaigns", [
      {
        update: updateBody,
        updateMask,
      },
    ]);

    // Sync the draft row so future audits show the override.
    await prisma.googleAdsCampaignDraft.update({
      where: { id },
      data: { biddingStrategy: strategy },
    });

    console.log(
      `[set-bidding/${id}] admin ${admin.id} flipped ${previousStrategy} → ${strategy}` +
        (cpcBidCeilingGbp ? ` (cap £${cpcBidCeilingGbp})` : ""),
    );

    return NextResponse.json({
      success: true,
      draftId: id,
      campaignName: draft.name,
      previousStrategy,
      newStrategy: strategy,
      cpcBidCeilingGbp: cpcBidCeilingGbp ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Bidding strategy change failed", details: message },
      { status: 500 },
    );
  }
}
