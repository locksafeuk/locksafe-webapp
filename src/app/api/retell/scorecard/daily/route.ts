export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { evaluateVoiceObservabilityAlerts, summarizeVoiceAlerts } from "@/lib/retell-observability";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const date = body?.date ? new Date(body.date) : new Date();

    const from = startOfDay(date);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

    const [calls, completed, jobs, escalations, reviews] = await Promise.all([
      prisma.voiceCall.count({ where: { startedAt: { gte: from, lt: to }, isTestCall: false } }),
      prisma.voiceCall.count({ where: { startedAt: { gte: from, lt: to }, isTestCall: false, callStatus: "completed" } }),
      prisma.voiceCall.count({ where: { startedAt: { gte: from, lt: to }, isTestCall: false, outcome: "job_created" } }),
      prisma.voiceCall.count({ where: { startedAt: { gte: from, lt: to }, isTestCall: false, wasEscalated: true } }),
      prisma.voiceCallReview.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { naturalnessScore: true } }),
    ]);

    const completionRate = calls > 0 ? +((completed / calls) * 100).toFixed(1) : 0;
    const callToJobRate = calls > 0 ? +((jobs / calls) * 100).toFixed(1) : 0;
    const escalationRate = calls > 0 ? +((escalations / calls) * 100).toFixed(1) : 0;
    const avgNaturalness =
      reviews.length > 0
        ? +(reviews.reduce((sum, r) => sum + (r.naturalnessScore ?? 0), 0) / reviews.length).toFixed(2)
        : 0;

    const alerts = evaluateVoiceObservabilityAlerts({
      totalCalls: calls,
      completionRate,
      callToJobRate,
      escalationRate,
      avgNaturalness,
      reviewCount: reviews.length,
    });
    const alertSummary = summarizeVoiceAlerts(alerts);

    const card = await prisma.voiceDailyScorecard.upsert({
      where: { date: from },
      create: {
        date: from,
        totalCalls: calls,
        completionRate,
        callToJobRate,
        escalationRate,
        avgNaturalness,
        alertCount: alerts.length,
        alertsJson: alerts,
      },
      update: {
        totalCalls: calls,
        completionRate,
        callToJobRate,
        escalationRate,
        avgNaturalness,
        alertCount: alerts.length,
        alertsJson: alerts,
      },
    });

    if (alertSummary.critical > 0 || alertSummary.warning > 0) {
      await sendAdminAlert({
        title: alertSummary.critical > 0 ? "Voice AI critical alert" : "Voice AI warning",
        severity: alertSummary.critical > 0 ? "error" : "warning",
        message: alerts.map((alert) => `[${alert.severity}] ${alert.message}`).join("\n"),
      });
    }

    return NextResponse.json({ success: true, scorecard: card, alerts, alertSummary });
  } catch (error: any) {
    console.error("[API] Error building voice daily scorecard:", error);
    return NextResponse.json({ error: "Failed to build scorecard" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const days = Number(request.nextUrl.searchParams.get("days") || 14);
    const from = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);

    const scorecards = await prisma.voiceDailyScorecard.findMany({
      where: { date: { gte: from } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, scorecards });
  } catch (error: any) {
    console.error("[API] Error listing voice scorecards:", error);
    return NextResponse.json({ error: "Failed to list scorecards" }, { status: 500 });
  }
}
