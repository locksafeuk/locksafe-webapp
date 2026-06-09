/**
 * POST /api/admin/google-ads/pause-by-google-id
 *
 * Pause a Google Ads campaign by its raw googleCampaignId — no DB row
 * required. Designed for "ghost" campaigns surfaced by the ghost-audit
 * endpoint: campaigns that exist in Google Ads but have no matching
 * GoogleAdsCampaignDraft row in our DB (because they were created
 * directly in the Google Ads UI, bypassing the playbook).
 *
 * Body:
 *   { googleCampaignId: string, reason?: string }
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

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

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { googleCampaignId?: string; reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const googleCampaignId = body.googleCampaignId?.toString().trim();
  if (!googleCampaignId) {
    return NextResponse.json(
      { error: "googleCampaignId required" },
      { status: 400 },
    );
  }

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return NextResponse.json({ error: "No active GoogleAdsAccount" }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  const resourceName = buildResourceName(
    client.customerIdPlain,
    "campaigns",
    googleCampaignId,
  );

  try {
    await client.mutate("campaigns", [
      {
        update: { resourceName, status: "PAUSED" },
        updateMask: "status",
      },
    ]);

    console.log(
      `[pause-by-google-id] admin ${admin.id} paused googleCampaignId=${googleCampaignId} reason=${body.reason ?? "(none)"}`,
    );

    return NextResponse.json({
      success: true,
      googleCampaignId,
      newStatus: "PAUSED",
      pausedBy: admin.id,
      reason: body.reason ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pause failed", details: message },
      { status: 500 },
    );
  }
}
