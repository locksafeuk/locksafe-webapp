/**
 * GET /api/admin/google-ads/drafts/live-status
 *
 * On-demand reconciliation read: for every draft with a Google campaign id,
 * queries Google Ads live and returns its real serving label
 * (SERVING / DORMANT / PAUSED / REMOVED / UNKNOWN), keyed by draft id.
 *
 * This is the "Check live status" action on the drafts page — it lets the
 * operator see whether a PUBLISHED draft is actually serving, without trusting
 * the stored status badge. Read-only: it does NOT mutate any draft (use the
 * drift-sync cron for that).
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { fetchLiveLabels } from "@/lib/google-ads-live-status";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.type === "admin" ? payload : null;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drafts: Array<{ id: string; googleCampaignId: string | null }> =
    await prisma.googleAdsCampaignDraft.findMany({
      where: {
        googleCampaignId: { not: null },
        status: { in: ["PUBLISHED", "PUBLISHING", "PAUSED", "FAILED"] },
      },
      select: { id: true, googleCampaignId: true },
    });

  if (drafts.length === 0) {
    return NextResponse.json({ statuses: {}, checkedAt: new Date().toISOString() });
  }

  try {
    const ids = drafts.map((d) => d.googleCampaignId!).filter(Boolean);
    const labels = await fetchLiveLabels(ids);

    const statuses: Record<string, { liveLabel: string; liveCampaignStatus: string }> = {};
    for (const d of drafts) {
      const live = d.googleCampaignId ? labels.get(d.googleCampaignId) : undefined;
      statuses[d.id] = {
        liveLabel: live?.label ?? "UNKNOWN",
        liveCampaignStatus: live?.campaignStatus ?? "MISSING",
      };
    }

    return NextResponse.json({ statuses, checkedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[drafts/live-status] failed:", message);
    // Common: Google Ads dev-token daily quota (429 RESOURCE_EXHAUSTED).
    return NextResponse.json(
      { error: "Live status check failed", details: message },
      { status: 502 },
    );
  }
}
