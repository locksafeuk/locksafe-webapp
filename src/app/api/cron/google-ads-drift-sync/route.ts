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
 * Without this cron, Locksafe's view of campaign state silently drifts:
 * we discovered on 2026-05-26 that 3 campaigns were Removed on Google
 * Ads while Locksafe still marked them PUBLISHED, because nothing was
 * watching for state changes initiated outside our publish flow.
 *
 * For each GoogleAdsCampaignDraft with a googleCampaignId AND status in
 * (PUBLISHED, PUBLISHING, PAUSED, FAILED), query Google Ads via GAQL and
 * compute a `live` label:
 *   SERVING   — campaign+adgroup+ad all ENABLED
 *   DORMANT   — campaign ENABLED but adgroup or ad PAUSED
 *   PAUSED    — campaign PAUSED
 *   REMOVED   — campaign REMOVED on Google Ads side
 *
 * Actions:
 *   • REMOVED + Locksafe PUBLISHED → flip Locksafe to PAUSED with
 *     audit note (mirrors what remediate-removed-drift.ts does)
 *   • DORMANT + Locksafe PUBLISHED → leave alone (operator decides)
 *   • SERVING + Locksafe PAUSED    → flip Locksafe to PUBLISHED
 *     (someone unpaused on Google Ads side, sync back)
 *
 * Telegram alert (severity=error, bypassPolicyGate) sent if any drift
 * found, with summary of state changes applied + state changes deferred.
 *
 * Dry-run: pass `?dryRun=1` to evaluate without mutating Locksafe.
 *
 * Schedule:
 *   Cron: 0 7 * * *  (UTC)
 *   Authorisation: x-vercel-cron OR Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma as _prisma } from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Types ───────────────────────────────────────────────────────────────────

interface AdGroupAdRow {
  campaign:    { id: string; name: string; status: string };
  adGroup:     { id: string; status: string };
  adGroupAd:   { ad: { id: string }; status: string };
}

type LiveLabel = "SERVING" | "DORMANT" | "PAUSED" | "REMOVED" | "UNKNOWN";

interface DriftAction {
  campaignName:    string;
  googleCampaignId: string;
  was:             string;          // Locksafe status before
  now:             string;          // Locksafe status after
  liveLabel:       LiveLabel;
  liveCampaignStatus: string;
  reason:          string;
}

interface DeferredDrift {
  campaignName:    string;
  googleCampaignId: string;
  locksafeStatus:  string;
  liveLabel:       LiveLabel;
  liveCampaignStatus: string;
  note:            string;
}

// ── Cron entrypoint ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runDriftSync(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack?.split("\n").slice(0, 6).join("\n") : undefined;
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
    status:  "healthy",
    endpoint: "POST /api/cron/google-ads-drift-sync",
  });
}

async function runDriftSync(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const drafts: Array<{
    id:               string;
    name:             string;
    status:           string;
    googleCampaignId: string | null;
    adminNotes:       string | null;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      googleCampaignId: { not: null },
      status: { in: ["PUBLISHED", "PUBLISHING", "PAUSED", "FAILED"] },
    },
    select: {
      id: true, name: true, status: true,
      googleCampaignId: true, adminNotes: true,
    },
  });

  if (drafts.length === 0) {
    return NextResponse.json({
      success: true, dryRun, evaluated: 0, applied: [], deferred: [],
    });
  }

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "No active GoogleAdsAccount" },
      { status: 500 },
    );
  }
  const { client } = ctx;

  const ids: string[] = [];
  for (const d of drafts) {
    if (d.googleCampaignId && /^[0-9]+$/.test(d.googleCampaignId)) {
      ids.push(d.googleCampaignId);
    }
  }
  if (ids.length === 0) {
    return NextResponse.json({ success: true, dryRun, evaluated: 0, applied: [], deferred: [] });
  }

  // Fetch ad_group_ad rows (gives us campaign + ad_group + ad statuses
  // in one query, but REMOVED-only campaigns won't surface here since
  // they have no ad_group_ad children).
  const adRows = await client.query<AdGroupAdRow>(`
    SELECT campaign.id, campaign.name, campaign.status,
           ad_group.id, ad_group.status,
           ad_group_ad.ad.id, ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id IN (${ids.join(",")})
  `);

  // Second pass for top-level campaign rows to catch REMOVED entries.
  const campaignRows = await client.query<{
    campaign: { id: string; name: string; status: string };
  }>(`
    SELECT campaign.id, campaign.name, campaign.status
    FROM campaign
    WHERE campaign.id IN (${ids.join(",")})
  `);

  // Aggregate live state.
  interface LiveAgg {
    name: string; status: string;
    adGroupCount: number; enabledAdGroups: number;
    adCount: number;      enabledAds: number;
  }
  const live = new Map<string, LiveAgg>();
  for (const r of campaignRows) {
    live.set(r.campaign.id, {
      name: r.campaign.name, status: r.campaign.status,
      adGroupCount: 0, enabledAdGroups: 0,
      adCount: 0,      enabledAds: 0,
    });
  }
  const seenAdGroups = new Map<string, Set<string>>();
  for (const r of adRows) {
    const agg = live.get(r.campaign.id);
    if (!agg) continue;
    const seen = seenAdGroups.get(r.campaign.id) ?? new Set<string>();
    if (!seen.has(r.adGroup.id)) {
      seen.add(r.adGroup.id);
      agg.adGroupCount++;
      if (r.adGroup.status === "ENABLED") agg.enabledAdGroups++;
    }
    seenAdGroups.set(r.campaign.id, seen);
    agg.adCount++;
    if (r.adGroupAd.status === "ENABLED") agg.enabledAds++;
  }

  function classify(agg: LiveAgg | undefined): LiveLabel {
    if (!agg) return "UNKNOWN";
    if (agg.status === "REMOVED") return "REMOVED";
    if (agg.status === "PAUSED")  return "PAUSED";
    if (agg.status !== "ENABLED") return "UNKNOWN";
    if (agg.enabledAdGroups === 0 || agg.enabledAds === 0) return "DORMANT";
    return "SERVING";
  }

  // ── Decide + (optionally) apply ─────────────────────────────────────────
  const applied:  DriftAction[]   = [];
  const deferred: DeferredDrift[] = [];
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);

  for (const d of drafts) {
    const cid = d.googleCampaignId!;
    const agg = live.get(cid);
    const label = classify(agg);

    // Case 1: live is REMOVED + Locksafe still thinks PUBLISHED/PUBLISHING.
    if (label === "REMOVED" && (d.status === "PUBLISHED" || d.status === "PUBLISHING")) {
      const reason = `Google Ads has REMOVED campaign ${cid}; flipping Locksafe ${d.status} → PAUSED to reflect reality.`;
      const newNotes = d.adminNotes
        ? `${d.adminNotes}\n[${stamp}] drift-sync auto-remediation: ${reason}`
        : `[${stamp}] drift-sync auto-remediation: ${reason}`;
      applied.push({
        campaignName:        d.name,
        googleCampaignId:    cid,
        was:                 d.status,
        now:                 "PAUSED",
        liveLabel:           label,
        liveCampaignStatus:  agg?.status ?? "MISSING",
        reason,
      });
      if (!dryRun) {
        await prisma.googleAdsCampaignDraft.update({
          where: { id: d.id },
          data:  { status: "PAUSED", pausedAt: now, adminNotes: newNotes },
        });
      }
      continue;
    }

    // Case 2: live is SERVING + Locksafe says PAUSED. Someone unpaused
    // outside our publish flow — sync forward to PUBLISHED.
    if (label === "SERVING" && d.status === "PAUSED") {
      const reason = `Google Ads campaign ${cid} is SERVING (campaign+adgroup+ad all ENABLED); flipping Locksafe PAUSED → PUBLISHED to reflect reality.`;
      const newNotes = d.adminNotes
        ? `${d.adminNotes}\n[${stamp}] drift-sync auto-remediation: ${reason}`
        : `[${stamp}] drift-sync auto-remediation: ${reason}`;
      applied.push({
        campaignName:        d.name,
        googleCampaignId:    cid,
        was:                 d.status,
        now:                 "PUBLISHED",
        liveLabel:           label,
        liveCampaignStatus:  agg?.status ?? "?",
        reason,
      });
      if (!dryRun) {
        await prisma.googleAdsCampaignDraft.update({
          where: { id: d.id },
          data:  { status: "PUBLISHED", adminNotes: newNotes },
        });
      }
      continue;
    }

    // Case 3: DORMANT — campaign Enabled but downstream paused. This is
    // operational state; the operator decides whether to unpause. We
    // record it as deferred so the morning alert calls attention to it.
    if (label === "DORMANT" && d.status === "PUBLISHED") {
      deferred.push({
        campaignName:        d.name,
        googleCampaignId:    cid,
        locksafeStatus:      d.status,
        liveLabel:           label,
        liveCampaignStatus:  agg?.status ?? "?",
        note:                "ad group or ad paused on Google Ads side — won't serve until unpaused (operator decision)",
      });
      continue;
    }

    // Case 4: UNKNOWN — Google Ads doesn't recognise this ID. Could be a
    // recently-created campaign that hasn't propagated, or a stale ID.
    if (label === "UNKNOWN") {
      deferred.push({
        campaignName:        d.name,
        googleCampaignId:    cid,
        locksafeStatus:      d.status,
        liveLabel:           label,
        liveCampaignStatus:  agg?.status ?? "MISSING",
        note:                "Google Ads didn't return this campaign — investigate manually",
      });
      continue;
    }
  }

  // ── Alert if anything happened ──────────────────────────────────────────
  if (!dryRun && (applied.length > 0 || deferred.length > 0)) {
    const lines: string[] = [];
    if (applied.length > 0) {
      lines.push(`Auto-applied ${applied.length} drift remediation${applied.length === 1 ? "" : "s"}:`);
      for (const a of applied) {
        lines.push(`  • ${a.campaignName}: ${a.was} → ${a.now} (live=${a.liveLabel})`);
      }
    }
    if (deferred.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(`Deferred ${deferred.length} for operator review:`);
      for (const d of deferred) {
        lines.push(`  • ${d.campaignName}: Locksafe=${d.locksafeStatus}, live=${d.liveLabel} — ${d.note}`);
      }
    }
    await sendAdminAlert({
      title:            `🔄 Google Ads drift sync: ${applied.length} applied / ${deferred.length} deferred`,
      message:          lines.join("\n"),
      severity:         "error",
      bypassPolicyGate: true,
      dedupeKey:        `drift-sync:${stamp}`,   // one per day
    }).catch((err) =>
      console.error("[drift-sync] Telegram alert failed:", err),
    );
  }

  return NextResponse.json({
    success:    true,
    dryRun,
    evaluated:  drafts.length,
    applied,
    deferred,
  });
}
