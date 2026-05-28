/**
 * Google Ads Drift Sync Cron
 *
 * Runs daily at 07:00 UTC — just AFTER auto-pause (06:00 UTC). The
 * sequence each morning is:
 *   06:00  google-ads-auto-pause   — may pause underperformers
 *   07:00  google-ads-drift-sync   — reconciles Locksafe DB ↔ Google Ads
 *                                    live state, captures pause/remove
 *                                    actions that happened outside our
 *                                    control (Google auto-apply, manual
 *                                    Web client edits, etc.)
 *
 * The reconciliation logic lives in `@/lib/google-ads-drift-sync` and is
 * shared with the admin "Sync from Google" button. That way the cron and
 * the on-demand sync can never diverge.
 *
 * Actions (applied automatically):
 *   • Live REMOVED + Locksafe PUBLISHED/PUBLISHING → flip to PAUSED.
 *   • Live SERVING + Locksafe PAUSED → flip to PUBLISHED.
 * Actions (deferred — surfaced in alert, operator decides):
 *   • Live DORMANT + Locksafe PUBLISHED.
 *   • Live UNKNOWN.
 *
 * Dry-run: pass `?dryRun=1` to evaluate without mutating Locksafe.
 *
 * Schedule:
 *   Cron: 0 7 * * *  (UTC)
 *   Authorisation: x-vercel-cron OR Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendAdminAlert } from "@/lib/telegram";
import { reconcileAllPublishedDrafts } from "@/lib/google-ads-drift-sync";

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runDriftSync(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 6).join("\n") : undefined;
    console.error("[drift-sync] unhandled error:", message, stack);
    return NextResponse.json(
      { success: false, error: "Drift-sync handler threw", message, stack },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    endpoint: "POST /api/cron/google-ads-drift-sync",
  });
}

async function runDriftSync(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const stamp = new Date().toISOString().slice(0, 10);

  const result = await reconcileAllPublishedDrafts({ dryRun });

  // If Google was unreachable, alert separately so the operator knows the
  // sync didn't actually run (this is the case most likely to bite us —
  // silent failure of the morning reconcile).
  if (result.error) {
    if (!dryRun) {
      await sendAdminAlert({
        title: `⚠️ Google Ads drift-sync FAILED to reach Google Ads`,
        message:
          `The morning drift-sync could not query Google Ads, so local Locksafe state was NOT reconciled.\n\n` +
          `Error: ${result.error}\n\n` +
          `Most common cause: dev-token daily quota (429 RESOURCE_EXHAUSTED). Local draft.status values may be stale. ` +
          `The next cron run will retry, or an admin can run "Sync from Google" from /admin/integrations/google-ads/drafts.`,
        severity: "error",
        bypassPolicyGate: true,
        dedupeKey: `drift-sync-error:${stamp}`,
      }).catch((err) => console.error("[drift-sync] error alert failed:", err));
    }
    return NextResponse.json(
      {
        success: false,
        dryRun,
        error: result.error,
        evaluated: 0,
        applied: [],
        deferred: [],
      },
      { status: 502 },
    );
  }

  // Alert on drift found.
  if (!dryRun && (result.applied.length > 0 || result.deferred.length > 0)) {
    const lines: string[] = [];
    if (result.applied.length > 0) {
      lines.push(
        `Auto-applied ${result.applied.length} drift remediation${result.applied.length === 1 ? "" : "s"}:`,
      );
      for (const a of result.applied) {
        lines.push(`  • ${a.campaignName}: ${a.was} → ${a.now} (live=${a.liveLabel})`);
      }
    }
    if (result.deferred.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(`Deferred ${result.deferred.length} for operator review:`);
      for (const d of result.deferred) {
        lines.push(
          `  • ${d.campaignName}: Locksafe=${d.locksafeStatus}, live=${d.liveLabel} — ${d.note}`,
        );
      }
    }
    await sendAdminAlert({
      title: `🔄 Google Ads drift sync: ${result.applied.length} applied / ${result.deferred.length} deferred`,
      message: lines.join("\n"),
      severity: "error",
      bypassPolicyGate: true,
      dedupeKey: `drift-sync:${stamp}`, // one per day
    }).catch((err) => console.error("[drift-sync] Telegram alert failed:", err));
  }

  return NextResponse.json({
    success: true,
    dryRun,
    evaluated: result.evaluated,
    applied: result.applied,
    deferred: result.deferred,
    syncedAt: result.syncedAt,
  });
}
