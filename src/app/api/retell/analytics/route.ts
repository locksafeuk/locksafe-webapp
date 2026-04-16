export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "7d";

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "24h": startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const calls = await prisma.voiceCall.findMany({
      where: { startedAt: { gte: startDate }, isTestCall: false },
      orderBy: { startedAt: "asc" },
    });

    const totalCalls = calls?.length ?? 0;
    const categoryBreakdown: Record<string, number> = {};
    const outcomeBreakdown: Record<string, number> = {};
    const hourlyDistribution: Record<number, number> = {};
    const dailyDistribution: Record<string, number> = {};

    let totalDuration = 0;
    let totalSentiment = 0;
    let sentimentCount = 0;
    let negativeCalls = 0;
    let totalEstRevenue = 0;
    let totalActRevenue = 0;
    let escalatedCount = 0;
    let jobsCreated = 0;
    let appointmentsBooked = 0;

    for (const call of (calls ?? [])) {
      const cat = call?.callCategory ?? "unknown";
      categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;

      const out = call?.outcome ?? "unknown";
      outcomeBreakdown[out] = (outcomeBreakdown[out] ?? 0) + 1;

      totalDuration += call?.durationSeconds ?? 0;

      if (call?.sentimentScore != null) {
        totalSentiment += call.sentimentScore;
        sentimentCount++;
        if (call?.sentimentLabel === "negative") negativeCalls++;
      }

      totalEstRevenue += call?.estimatedRevenue ?? 0;
      totalActRevenue += call?.actualRevenue ?? 0;
      if (call?.wasEscalated) escalatedCount++;
      if (call?.outcome === "job_created") jobsCreated++;
      if (call?.outcome === "appointment_booked") appointmentsBooked++;

      const hour = new Date(call?.startedAt ?? now).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] ?? 0) + 1;

      const day = new Date(call?.startedAt ?? now).toISOString().split("T")[0] ?? "unknown";
      dailyDistribution[day] = (dailyDistribution[day] ?? 0) + 1;
    }

    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const avgSentiment = sentimentCount > 0 ? +(totalSentiment / sentimentCount).toFixed(2) : 0;
    const callToJobRate = totalCalls > 0 ? +((jobsCreated / totalCalls) * 100).toFixed(1) : 0;
    const callToBookingRate = totalCalls > 0 ? +((appointmentsBooked / totalCalls) * 100).toFixed(1) : 0;
    const escalationRate = totalCalls > 0 ? +((escalatedCount / totalCalls) * 100).toFixed(1) : 0;

    const hourlyData = Array.from({ length: 24 }, (_: unknown, i: number) => ({
      hour: i,
      label: `${String(i).padStart(2, "0")}:00`,
      calls: hourlyDistribution[i] ?? 0,
    }));

    const dailyData = Object.entries(dailyDistribution)
      .sort(([a]: [string, number], [b]: [string, number]) => a.localeCompare(b))
      .map(([date, count]: [string, number]) => ({ date, calls: count }));

    return NextResponse.json({
      success: true,
      analytics: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalCalls,
        avgDuration,
        avgSentiment,
        escalationRate,
        callToJobRate,
        callToBookingRate,
        totalEstimatedRevenue: +totalEstRevenue.toFixed(2),
        totalActualRevenue: +totalActRevenue.toFixed(2),
        categoryBreakdown,
        outcomeBreakdown,
        jobsCreated,
        appointmentsBooked,
        escalatedCount,
        negativeCalls,
        hourlyData,
        dailyData,
      },
    });
  } catch (error: any) {
    console.error("[API] Error fetching analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
