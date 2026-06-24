/**
 * §32 — Cost-per-verified-conv kill switch cron (2026-06-17, GODMODE plan).
 *
 * Daily at 07:15 UTC (after the existing drift-sync at 07:00 — keeps Google
 * Ads API calls staggered and ensures DB state is reconciled before we
 * read spend totals from it).
 *
 * For each ENABLED campaign, computes rolling 7-day:
 *   cost_per_verified_conv = spend_7d / verified_conversions_7d
 *
 * Pauses any campaign where cost_per_verified_conv > £150 (override via
 * env KILL_SWITCH_CPC_THRESHOLD_GBP). Treats 0 verified conversions in
 * 7 days as Infinity when spend > £100 (override via env
 * KILL_SWITCH_ZERO_CONV_SPEND_FLOOR_GBP). Sends a Telegram alert
 * summarising actions.
 *
 * Dry-run: pass `?dryRun=1` to compute decisions without mutating Google
 * or DB.
 *
 * Schedule: `15 7 * * *`  (15 minutes after drift-sync at 07:00).
 * Auth: x-vercel-cron OR Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendAdminAlert } from "@/lib/telegram";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import {
  evaluateKillSwitch,
  type CampaignSpendRow,
} from "@/lib/google-ads-cost-per-conv-killswitch";
import { evaluateDailySpendAlert } from "@/lib/google-ads-daily-spend-alert";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    endpoint: "POST /api/cron/google-ads-cost-per-conv-killswitch",
    rule: "§32 (2026-06-17, GODMODE plan)",
  });
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url    = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const stampISO = new Date().toISOString();

  const threshold = Number(
    process.env["KILL_SWITCH_CPC_THRESHOLD_GBP"] ?? "150",
  );
  const zeroFloor = Number(
    process.env["KILL_SWITCH_ZERO_CONV_SPEND_FLOOR_GBP"] ?? "100",
  );

  let ctx;
  try {
    ctx = await getDefaultGoogleAdsClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!dryRun) {
      await sendAdminAlert({
        title: "§32 kill switch FAILED to reach Google Ads",
        message:
          `Could not query Google Ads. Kill switch did NOT run. Error: ${msg}\n\n` +
          `Most common: dev-token daily quota (429 RESOURCE_EXHAUSTED).`,
        severity: "error",
      }).catch(() => {});
    }
    return NextResponse.json(
      { success: false, error: "Google Ads client unavailable", message: msg, runAt: stampISO },
      { status: 502 },
    );
  }
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "No active GoogleAdsAccount", runAt: stampISO },
      { status: 400 },
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  // ── Pull 7-day spend + conversions for every ENABLED campaign ─────────
  // segments.date >= "X DAYS AGO" gives Google's 7-day rolling spend.
  // Google's conversions column is the only counter that matches what
  // the auction algorithm sees — uploads (via uploadJobConversionIfEligible)
  // land here once successful.
  type LiveRow = {
    campaign?: { id?: string; name?: string };
    metrics?:  { costMicros?: string | number; conversions?: string | number };
  };
  let liveRows: LiveRow[] = [];
  try {
    liveRows = (await client.query(`
      SELECT campaign.id, campaign.name,
             metrics.cost_micros, metrics.conversions
        FROM campaign
       WHERE campaign.status = ENABLED
         AND segments.date DURING LAST_7_DAYS
    `)) as LiveRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!dryRun) {
      await sendAdminAlert({
        title: "§32 kill switch — GAQL query failed",
        message: `Could not fetch 7-day spend. Kill switch did NOT run. Error: ${msg}`,
        severity: "error",
      }).catch(() => {});
    }
    return NextResponse.json(
      { success: false, error: "GAQL query failed", message: msg, runAt: stampISO },
      { status: 502 },
    );
  }

  // Aggregate per campaign (GAQL row may emit per-day segments — we sum).
  const agg = new Map<string, { campaignName: string; spendGbp: number; verifiedConversions: number }>();
  for (const r of liveRows) {
    const id = r.campaign?.id;
    if (!id) continue;
    const cur = agg.get(id) ?? {
      campaignName: r.campaign?.name ?? id,
      spendGbp:     0,
      verifiedConversions: 0,
    };
    const costMicros = Number(r.metrics?.costMicros ?? 0);
    const conv       = Number(r.metrics?.conversions ?? 0);
    cur.spendGbp += Number.isFinite(costMicros) ? costMicros / 1_000_000 : 0;
    cur.verifiedConversions += Number.isFinite(conv) ? conv : 0;
    agg.set(id, cur);
  }

  const rows: CampaignSpendRow[] = Array.from(agg.entries()).map(
    ([campaignId, v]) => ({
      campaignId,
      campaignName:        v.campaignName,
      status:              "ENABLED",
      spendGbp:            v.spendGbp,
      verifiedConversions: v.verifiedConversions,
    }),
  );

  const decisions = evaluateKillSwitch(rows, {
    thresholdGbp: Number.isFinite(threshold) ? threshold : 150,
    zeroConvSpendFloor: Number.isFinite(zeroFloor) ? zeroFloor : 100,
  });
  const toPause = decisions.filter((d) => d.action === "pause");

  // ── §38 — Daily-spend early-warning alert (2026-06-24) ────────────────
  // Independent of the per-campaign kill switch above. Query yesterday's
  // total account spend; if it exceeded the alert threshold (default £80,
  // override via DAILY_ACCOUNT_SPEND_ALERT_GBP) fire a Telegram heads-up.
  // This is the EARLY-WARNING tier of the engineered £2,500/month cap:
  // hard publish-time gate at MAX_DAILY_ACCOUNT_SPEND_GBP=85 prevents NEW
  // campaigns from being published over the ceiling; this alert catches
  // EXISTING live campaigns that have crept over (Google's 2× over-deliver,
  // spend-spike day, etc.) so Piky knows before the kill switch fires.
  let dailyAlertResult: ReturnType<typeof evaluateDailySpendAlert> | null = null;
  try {
    type DailyRow = { metrics?: { costMicros?: string | number } };
    const dailyRows = (await client.query(`
      SELECT metrics.cost_micros
        FROM customer
       WHERE segments.date DURING YESTERDAY
    `)) as DailyRow[];
    const yesterdaySpendGbp = dailyRows.reduce((sum, r) => {
      const m = Number(r.metrics?.costMicros ?? 0);
      return sum + (Number.isFinite(m) ? m / 1_000_000 : 0);
    }, 0);
    const alertThreshold = Number(
      process.env["DAILY_ACCOUNT_SPEND_ALERT_GBP"] ?? "80",
    );
    dailyAlertResult = evaluateDailySpendAlert({
      spendGbp: yesterdaySpendGbp,
      thresholdGbp: Number.isFinite(alertThreshold) ? alertThreshold : 80,
      dayIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    if (dailyAlertResult.shouldAlert && !dryRun && dailyAlertResult.message) {
      await sendAdminAlert({
        title:    `§38 DAILY SPEND ALERT — £${yesterdaySpendGbp.toFixed(2)} yesterday`,
        severity: "warning",
        message:  dailyAlertResult.message,
      }).catch(() => {});
    }
  } catch (err) {
    // Non-fatal — the kill switch above is the safety net.
    // eslint-disable-next-line no-console
    console.warn("§38 daily-spend alert query failed:", err);
  }

  // ── Pause via Google Ads + DB ─────────────────────────────────────────
  const actions: Array<{ campaignId: string; campaignName: string; result: string; error?: string }> = [];
  if (!dryRun) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (ctx as any).client.customerIdPlain as string;
    for (const decision of toPause) {
      const resourceName = `customers/${cid}/campaigns/${decision.campaignId}`;
      try {
        await client.mutate("campaigns", [
          {
            update:     { resourceName, status: "PAUSED" },
            updateMask: "status",
          },
        ]);
        actions.push({
          campaignId:   decision.campaignId,
          campaignName: decision.campaignName,
          result:       "paused",
        });
        // Mirror onto the DB draft row if it exists.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = prisma as any;
        await p.googleAdsCampaignDraft
          .updateMany({
            where: { googleCampaignId: decision.campaignId },
            data:  { status: "PAUSED", pausedAt: new Date() },
          })
          .catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        actions.push({
          campaignId:   decision.campaignId,
          campaignName: decision.campaignName,
          result:       "pause_failed",
          error:        msg.slice(0, 500),
        });
      }
    }
  }

  // ── Telegram summary ──────────────────────────────────────────────────
  if (toPause.length > 0 && !dryRun) {
    const lines = toPause.map(
      (d) => `• ${d.campaignName} — ${d.reason}`,
    );
    await sendAdminAlert({
      title:    `§32 KILL SWITCH — ${toPause.length} campaign(s) paused`,
      severity: "warning",
      message:
        `Cost-per-verified-conversion exceeded £${threshold} over 7 days. Pauses:\n\n${lines.join("\n")}\n\n` +
        `Investigate before resuming. The §34 test-upload gate must pass within 24h to re-publish.`,
    }).catch(() => {});
  }

  return NextResponse.json({
    success:    true,
    rule:       "§32 + §38",
    runAt:      stampISO,
    dryRun,
    threshold,
    zeroFloor,
    examined:   rows.length,
    decisions,
    pauseCount: toPause.length,
    actions,
    dailySpendAlert: dailyAlertResult,
  });
}
