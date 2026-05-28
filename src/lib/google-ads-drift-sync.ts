/**
 * Google Ads drift-sync — the single source of truth for reconciling our
 * GoogleAdsCampaignDraft.status column against the live state in Google Ads.
 *
 * Why this exists as a shared lib (not just the cron route):
 *   • The cron at 07:00 UTC was the ONLY writer that closed sync gaps. If
 *     it failed (quota, network), drift could persist for up to 24h.
 *   • The admin "Check live status" button could SEE drift but could not
 *     fix it — operators had to edit the DB by hand or wait for the cron.
 *   • The cron previously hand-rolled the same GAQL query as
 *     fetchLiveLabels(); two code paths, easy to skew.
 *
 * Now: this lib is the only place that decides "given a draft + its live
 * label, what should the local status be?" The cron AND the admin
 * live-status endpoint both call into it. Same logic, same audit trail.
 *
 * Reconciliation rules (matches what the original cron did, but explicit):
 *
 *   live = REMOVED  + local in {PUBLISHED, PUBLISHING}  →  local = PAUSED
 *     (Google deleted the campaign; mirror reality. Audit note added.)
 *
 *   live = SERVING  + local = PAUSED                    →  local = PUBLISHED
 *     (Someone re-enabled in Google Ads outside our flow; sync forward.
 *      THIS is the case that bit the WA1 campaign on 2026-05-27.)
 *
 *   live = DORMANT  + local = PUBLISHED                 →  deferred
 *     (campaign enabled but ad group / ad paused on Google's side — a
 *      human decision, not auto-remediable. Surface in the alert.)
 *
 *   live = UNKNOWN                                       →  deferred
 *     (Google didn't return this id. Stale id or recently-created and not
 *      propagated. Don't guess.)
 *
 *   anything else                                        →  no-op
 *
 * Always writes `lastSyncAt` on every draft we got a live label for so
 * we can tell how stale the local view is from the admin UI.
 */

import { prisma as _prisma } from "@/lib/db";
import { fetchLiveLabels, type LiveLabel, type LiveStatus } from "@/lib/google-ads-live-status";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export interface DriftDraft {
  id: string;
  name: string;
  status: string;
  googleCampaignId: string | null;
  adminNotes: string | null;
}

export interface DriftAction {
  draftId: string;
  campaignName: string;
  googleCampaignId: string;
  was: string;
  now: string;
  liveLabel: LiveLabel;
  liveCampaignStatus: string;
  reason: string;
}

export interface DeferredDrift {
  draftId: string;
  campaignName: string;
  googleCampaignId: string;
  locksafeStatus: string;
  liveLabel: LiveLabel;
  liveCampaignStatus: string;
  note: string;
}

export interface ReconcileResult {
  syncedAt: string;
  evaluated: number;
  applied: DriftAction[];
  deferred: DeferredDrift[];
  /** Set when Google Ads couldn't be queried at all (quota, auth, etc.). */
  error?: string;
}

/**
 * Decide what to do with a single draft given its live label, without
 * touching the DB. Pure function — exposed for tests and for callers that
 * want to render a diff before writing.
 */
export function classifyDrift(
  draft: DriftDraft,
  live: LiveStatus | undefined,
):
  | { kind: "apply"; action: Omit<DriftAction, "draftId" | "campaignName" | "googleCampaignId"> }
  | { kind: "defer"; note: string; liveLabel: LiveLabel; liveCampaignStatus: string }
  | { kind: "noop" } {
  const label: LiveLabel = live?.label ?? "UNKNOWN";
  const campaignStatus = live?.campaignStatus ?? "MISSING";

  // Case 1: REMOVED + local PUBLISHED/PUBLISHING → flip to PAUSED.
  if (label === "REMOVED" && (draft.status === "PUBLISHED" || draft.status === "PUBLISHING")) {
    return {
      kind: "apply",
      action: {
        was: draft.status,
        now: "PAUSED",
        liveLabel: label,
        liveCampaignStatus: campaignStatus,
        reason: `Google Ads has REMOVED campaign ${draft.googleCampaignId}; flipping Locksafe ${draft.status} → PAUSED to reflect reality.`,
      },
    };
  }

  // Case 2: SERVING + local PAUSED → flip to PUBLISHED.
  if (label === "SERVING" && draft.status === "PAUSED") {
    return {
      kind: "apply",
      action: {
        was: draft.status,
        now: "PUBLISHED",
        liveLabel: label,
        liveCampaignStatus: campaignStatus,
        reason: `Google Ads campaign ${draft.googleCampaignId} is SERVING (campaign+adgroup+ad all ENABLED); flipping Locksafe PAUSED → PUBLISHED to reflect reality.`,
      },
    };
  }

  // Case 3: DORMANT + local PUBLISHED → defer (operator decision).
  if (label === "DORMANT" && draft.status === "PUBLISHED") {
    return {
      kind: "defer",
      liveLabel: label,
      liveCampaignStatus: campaignStatus,
      note: "ad group or ad paused on Google Ads side — won't serve until unpaused (operator decision)",
    };
  }

  // Case 4: UNKNOWN — Google didn't return this id. Don't auto-remediate.
  if (label === "UNKNOWN") {
    return {
      kind: "defer",
      liveLabel: label,
      liveCampaignStatus: campaignStatus,
      note: "Google Ads didn't return this campaign — investigate manually",
    };
  }

  return { kind: "noop" };
}

/**
 * Run reconciliation against Google Ads for a set of drafts.
 *
 * Caller passes the drafts to consider (typically all drafts with a
 * googleCampaignId and status in PUBLISHED/PUBLISHING/PAUSED/FAILED).
 * The function fetches live labels, applies Case 1 / Case 2 to the DB,
 * stamps lastSyncAt on every successfully-checked draft, and returns
 * a structured report.
 *
 * @param drafts  Drafts to consider for reconciliation.
 * @param opts.dryRun  If true, compute the diff but do not write the DB.
 * @param opts.applyNote  Optional prefix for audit notes (default `[YYYY-MM-DD] drift-sync`).
 */
export async function reconcileDraftsAgainstLive(
  drafts: DriftDraft[],
  opts: { dryRun?: boolean; applyNotePrefix?: string } = {},
): Promise<ReconcileResult> {
  const syncedAt = new Date();
  const stamp = syncedAt.toISOString().slice(0, 10);
  const prefix = opts.applyNotePrefix ?? `[${stamp}] drift-sync auto-remediation`;

  // Nothing to do? Bail without calling Google.
  const valid = drafts.filter(
    (d) => d.googleCampaignId && /^[0-9]+$/.test(d.googleCampaignId),
  );
  if (valid.length === 0) {
    return { syncedAt: syncedAt.toISOString(), evaluated: 0, applied: [], deferred: [] };
  }

  // Fetch live labels in one call (handles batching internally).
  let labels: Map<string, LiveStatus>;
  try {
    labels = await fetchLiveLabels(valid.map((d) => d.googleCampaignId!));
  } catch (err) {
    // Google Ads unreachable / quota / auth — surface the error without
    // touching the DB. Caller decides whether to alert.
    return {
      syncedAt: syncedAt.toISOString(),
      evaluated: 0,
      applied: [],
      deferred: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const applied: DriftAction[] = [];
  const deferred: DeferredDrift[] = [];

  for (const d of valid) {
    const cid = d.googleCampaignId!;
    const live = labels.get(cid);
    const decision = classifyDrift(d, live);

    if (decision.kind === "apply") {
      const a = decision.action;
      applied.push({
        draftId: d.id,
        campaignName: d.name,
        googleCampaignId: cid,
        ...a,
      });

      if (!opts.dryRun) {
        const newNotes = d.adminNotes
          ? `${d.adminNotes}\n${prefix}: ${a.reason}`
          : `${prefix}: ${a.reason}`;
        const dbPatch: Record<string, unknown> = {
          status: a.now,
          adminNotes: newNotes,
          lastSyncAt: syncedAt,
        };
        // Set/unset pausedAt to reflect the new state.
        if (a.now === "PAUSED") dbPatch.pausedAt = syncedAt;
        await prisma.googleAdsCampaignDraft.update({
          where: { id: d.id },
          data: dbPatch,
        });
      }
    } else if (decision.kind === "defer") {
      deferred.push({
        draftId: d.id,
        campaignName: d.name,
        googleCampaignId: cid,
        locksafeStatus: d.status,
        liveLabel: decision.liveLabel,
        liveCampaignStatus: decision.liveCampaignStatus,
        note: decision.note,
      });
      if (!opts.dryRun) {
        await prisma.googleAdsCampaignDraft.update({
          where: { id: d.id },
          data: { lastSyncAt: syncedAt },
        });
      }
    } else {
      // noop — but still mark that we checked it.
      if (!opts.dryRun) {
        await prisma.googleAdsCampaignDraft.update({
          where: { id: d.id },
          data: { lastSyncAt: syncedAt },
        });
      }
    }
  }

  return {
    syncedAt: syncedAt.toISOString(),
    evaluated: valid.length,
    applied,
    deferred,
  };
}

/**
 * Convenience wrapper: load every draft eligible for reconciliation, run
 * reconcileDraftsAgainstLive, return the result. Used by both the cron and
 * the admin "Sync from Google" endpoint.
 */
export async function reconcileAllPublishedDrafts(
  opts: { dryRun?: boolean } = {},
): Promise<ReconcileResult> {
  const drafts: DriftDraft[] = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      googleCampaignId: { not: null },
      status: { in: ["PUBLISHED", "PUBLISHING", "PAUSED", "FAILED"] },
    },
    select: {
      id: true,
      name: true,
      status: true,
      googleCampaignId: true,
      adminNotes: true,
    },
  });
  return reconcileDraftsAgainstLive(drafts, opts);
}
