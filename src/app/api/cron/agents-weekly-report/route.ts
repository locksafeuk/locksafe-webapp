/**
 * Weekly summary of CMO agent autonomy.
 *
 * Schedule: Mondays at 09:00 UTC. Aggregates the last 7 days of:
 *   - Spend per platform from AdPerformanceSnapshot
 *   - Auto-actions taken (auto-approved drafts, paused campaigns, negatives added)
 *   - Pending approvals waiting on a human
 *
 * Sends the report as a Telegram alert via sendAdminAlert.
 *
 * Auth:
 *   - x-vercel-cron header (Vercel Cron auto-set), OR
 *   - Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");
  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [snapshots, autoApprovedDrafts, pausedDrafts, pendingApprovals, autoExecutions] =
    await Promise.all([
      prisma.adPerformanceSnapshot.findMany({
        where: { date: { gte: since } },
        select: { platform: true, spend: true, revenue: true, conversions: true, clicks: true },
      }),
      prisma.googleAdsCampaignDraft.count({
        where: {
          aiGenerated: true,
          approvedBy: "system:auto-approve",
          approvedAt: { gte: since },
        },
      }),
      prisma.googleAdsCampaignDraft.count({
        where: { status: "PAUSED", pausedAt: { gte: since } },
      }),
      prisma.agentApproval.count({ where: { status: "pending" } }),
      prisma.agentExecution.count({
        where: { startedAt: { gte: since }, status: "completed" },
      }),
    ]);

  const byPlatform = new Map<string, { spend: number; revenue: number; conv: number; clicks: number }>();
  for (const s of snapshots) {
    const acc = byPlatform.get(s.platform) ?? { spend: 0, revenue: 0, conv: 0, clicks: 0 };
    acc.spend += s.spend;
    acc.revenue += s.revenue;
    acc.conv += s.conversions;
    acc.clicks += s.clicks;
    byPlatform.set(s.platform, acc);
  }

  const lines: string[] = [];
  lines.push(`Window: last 7 days (since ${since.toISOString().slice(0, 10)})`);
  lines.push("");
  for (const [platform, agg] of byPlatform) {
    const roas = agg.spend > 0 ? (agg.revenue / agg.spend).toFixed(2) : "n/a";
    lines.push(
      `${platform.toUpperCase()}: £${agg.spend.toFixed(2)} spend · £${agg.revenue.toFixed(2)} revenue · ROAS ${roas} · ${agg.conv} conv · ${agg.clicks} clicks`,
    );
  }
  if (byPlatform.size === 0) lines.push("No paid spend recorded.");
  lines.push("");
  lines.push(`Auto-approved drafts: ${autoApprovedDrafts}`);
  lines.push(`Drafts paused by optimiser: ${pausedDrafts}`);
  lines.push(`Agent executions completed: ${autoExecutions}`);
  lines.push(`Pending approvals waiting on human: ${pendingApprovals}`);

  await sendAdminAlert({
    title: "CMO weekly report",
    message: lines.join("\n"),
    severity: pendingApprovals > 5 ? "warning" : "info",
  });

  return NextResponse.json({
    ok: true,
    window: { since: since.toISOString(), until: now.toISOString() },
    platforms: Object.fromEntries(byPlatform),
    autoApprovedDrafts,
    pausedDrafts,
    pendingApprovals,
    autoExecutions,
  });
}
