/**
 * GET  /api/admin/google-ads/drafts/live-status
 * POST /api/admin/google-ads/drafts/live-status   (alias for GET?reconcile=true)
 *
 * Reads live Google Ads serving labels (SERVING / DORMANT / PAUSED / REMOVED
 * / UNKNOWN) for every draft with a Google campaign id. Keyed by draft id.
 *
 * Two modes:
 *   • Default (read-only) — GET without `?reconcile=true`. Returns the
 *     map. Does NOT touch the DB. Same behaviour the admin "Check live
 *     status" button has always had.
 *   • Reconcile mode — GET ?reconcile=true (or POST with empty body).
 *     Applies the same logic the morning drift-sync cron applies: REMOVED
 *     drafts get flipped to PAUSED, PAUSED drafts that are actually
 *     SERVING get flipped to PUBLISHED. Audit note appended. lastSyncAt
 *     stamped on every checked draft. Use this to fix sync drift
 *     on-demand without waiting for the 07:00 UTC cron.
 *
 * Why both — the read-only path is still useful when the admin wants to
 * SEE drift before deciding, or when Google Ads quota is tight and we
 * don't want any extra write traffic. Reconcile is the "force a sync"
 * button.
 *
 * Auth: admin JWT cookie. Reconcile mode logs the admin id for audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { fetchLiveLabels } from "@/lib/google-ads-live-status";
import { reconcileAllPublishedDrafts } from "@/lib/google-ads-drift-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.type === "admin" ? payload : null;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const reconcile = url.searchParams.get("reconcile") === "true";

  if (reconcile) {
    return runReconcile(admin.id);
  }
  return runReadOnly();
}

/**
 * POST is a convenience alias for `GET ?reconcile=true`. Lets the admin
 * UI use a non-idempotent verb for the destructive action ("Sync from
 * Google" / "Reconcile now").
 */
export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runReconcile(admin.id);
}

async function runReadOnly() {
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

async function runReconcile(adminId: string) {
  try {
    const result = await reconcileAllPublishedDrafts({ dryRun: false });
    console.log(
      `[drafts/live-status/reconcile] admin=${adminId} evaluated=${result.evaluated} applied=${result.applied.length} deferred=${result.deferred.length}${result.error ? ` error=${result.error}` : ""}`,
    );

    // Build the same {statuses} map the read-only path returns so the UI
    // can reuse its existing rendering pipeline.
    const statuses: Record<string, { liveLabel: string; liveCampaignStatus: string }> = {};
    for (const a of result.applied) {
      statuses[a.draftId] = {
        liveLabel: a.liveLabel,
        liveCampaignStatus: a.liveCampaignStatus,
      };
    }
    for (const d of result.deferred) {
      statuses[d.draftId] = {
        liveLabel: d.liveLabel,
        liveCampaignStatus: d.liveCampaignStatus,
      };
    }

    if (result.error) {
      // Google was unreachable — surface but don't 500 (we've already
      // returned partial info above; in this branch statuses is empty).
      return NextResponse.json(
        {
          error: "Reconcile failed",
          details: result.error,
          syncedAt: result.syncedAt,
          applied: [],
          deferred: [],
          statuses: {},
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reconciled: true,
      syncedAt: result.syncedAt,
      evaluated: result.evaluated,
      applied: result.applied,
      deferred: result.deferred,
      statuses,
      checkedAt: result.syncedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[drafts/live-status/reconcile] unhandled:", message);
    return NextResponse.json(
      { error: "Reconcile failed", details: message },
      { status: 500 },
    );
  }
}
