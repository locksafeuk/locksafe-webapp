/**
 * §33 — Attribution-chain observability cron (2026-06-17, GODMODE plan).
 *
 * Every 6 hours (offset 30 min from the other crons to avoid scheduler
 * collisions): pull the rolling-24h CallIntent rows and compute the
 * gclid-attachment rate by source.
 *
 *   rate = count(gclid IS NOT NULL) / total
 *
 * If rate < 50% AND total >= 10 in the window → Telegram alert with the
 * breakdown by source.
 *
 * Why this exists
 * ───────────────
 * On 2026-06-17 we discovered only 2 of 51 CallIntents over the prior
 * month carried a gclid. That meant 96% of paid clicks were arriving at
 * Retell with no way to feed a conversion back to Google Ads — the
 * Stripe webhook's `uploadJobConversionIfEligible` correctly returned
 * `skipped_no_gclid` every time, and the auction algorithm bid blind.
 *
 * This cron is the canary that catches the next time that link breaks
 * silently — before another £600 is wasted on bid-blind auctions.
 *
 * Schedule: `30 *\/6 * * *`  (every 6 hours, on the half-hour).
 * Auth: x-vercel-cron OR Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendAdminAlert } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    endpoint: "POST /api/cron/attribution-chain-monitor",
    rule: "§33 (2026-06-17, GODMODE plan)",
  });
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url    = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const now    = new Date();
  const since  = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const minTotalForAlert = Number(
    process.env["ATTRIBUTION_MONITOR_MIN_TOTAL"] ?? "10",
  );
  const minRateThreshold = Number(
    process.env["ATTRIBUTION_MONITOR_MIN_RATE"] ?? "0.5",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  let intents: Array<{ id: string; gclid: string | null; source: string | null }> = [];
  try {
    intents = await p.callIntent.findMany({
      where:  { createdAt: { gte: since } },
      select: { id: true, gclid: true, source: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: "DB query failed", message: msg },
      { status: 500 },
    );
  }

  const total = intents.length;
  const withGclid = intents.filter((i) => i.gclid && i.gclid.trim() !== "").length;
  const rate = total > 0 ? withGclid / total : 1;  // empty window = trivially fine

  // Per-source breakdown
  const bySource = new Map<string, { total: number; withGclid: number }>();
  for (const i of intents) {
    const src = (i.source ?? "unknown").trim() || "unknown";
    const cur = bySource.get(src) ?? { total: 0, withGclid: 0 };
    cur.total += 1;
    if (i.gclid && i.gclid.trim() !== "") cur.withGclid += 1;
    bySource.set(src, cur);
  }
  const breakdown = Array.from(bySource.entries()).map(([source, v]) => ({
    source,
    total:     v.total,
    withGclid: v.withGclid,
    rate:      v.total > 0 ? v.withGclid / v.total : 0,
  }));

  const alertNeeded = total >= minTotalForAlert && rate < minRateThreshold;

  if (alertNeeded && !dryRun) {
    const lines = breakdown
      .sort((a, b) => b.total - a.total)
      .map(
        (b) =>
          `• ${b.source}: ${b.withGclid}/${b.total} = ${(b.rate * 100).toFixed(1)}%`,
      );
    await sendAdminAlert({
      title:    `§33 attribution-chain degraded — gclid rate ${(rate * 100).toFixed(1)}%`,
      severity: "warning",
      message:
        `In the last 24h, ${withGclid}/${total} CallIntents carry a gclid (rate < ${(minRateThreshold * 100).toFixed(0)}%).\n\n` +
        `Breakdown by source:\n${lines.join("\n")}\n\n` +
        `If the rate stays below threshold, Google Ads will keep bidding blind. ` +
        `Check: TelLinkAttribution.tsx wiring, landing-page gtag, ad call extension.`,
    }).catch(() => {});
  }

  return NextResponse.json({
    success:        true,
    rule:           "§33",
    windowStart:    since.toISOString(),
    windowEnd:      now.toISOString(),
    total,
    withGclid,
    rate,
    minTotalForAlert,
    minRateThreshold,
    alertTriggered: alertNeeded && !dryRun,
    breakdown,
  });
}
