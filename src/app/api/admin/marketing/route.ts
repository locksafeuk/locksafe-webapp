import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const timeRange = request.nextUrl.searchParams.get("timeRange") || "7d";

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "7d":
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Fetch all sessions in time range
    const sessions = await prisma.userSession.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      include: {
        pageViews: true,
        events: true,
      },
      orderBy: {
        lastActiveAt: "desc",
      },
      take: 500,
    });

    // Fetch modal interactions
    const modalInteractions = await prisma.modalInteraction.findMany({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Fetch leads
    const leads = await prisma.leadMagnet.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Calculate stats
    const totalSessions = sessions.length;
    const uniqueVisitors = new Set(sessions.map((s) => s.visitorId)).size;
    const avgEngagementScore = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.engagementScore, 0) / sessions.length)
      : 0;
    const avgIntentScore = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.intentScore, 0) / sessions.length)
      : 0;

    // Calculate conversion rate (sessions with lead segment or converted modal)
    const conversions = sessions.filter(
      (s) => (s.segment as string[]).includes("lead") || s.modalsConverted.length > 0
    ).length;
    const conversionRate = totalSessions > 0
      ? Math.round((conversions / totalSessions) * 100 * 10) / 10
      : 0;

    // Calculate bounce rate (sessions with only 1 page view and < 10 engagement)
    const bounces = sessions.filter(
      (s) => s.pageViews.length <= 1 && s.engagementScore < 10
    ).length;
    const bounceRate = totalSessions > 0
      ? Math.round((bounces / totalSessions) * 100 * 10) / 10
      : 0;

    // Calculate segment distribution
    const segmentCounts: Record<string, number> = {};
    for (const session of sessions) {
      for (const segment of session.segment as string[]) {
        segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
      }
    }

    const segments = Object.entries(segmentCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate modal stats
    const modalCounts: Record<string, { shown: number; dismissed: number; converted: number }> = {};
    for (const interaction of modalInteractions) {
      if (!modalCounts[interaction.modalType]) {
        modalCounts[interaction.modalType] = { shown: 0, dismissed: 0, converted: 0 };
      }

      switch (interaction.action) {
        case "shown":
          modalCounts[interaction.modalType].shown++;
          break;
        case "dismissed":
          modalCounts[interaction.modalType].dismissed++;
          break;
        case "converted":
        case "completed":
          modalCounts[interaction.modalType].converted++;
          break;
      }
    }

    const modalStats = Object.entries(modalCounts).map(([modalType, counts]) => ({
      modalType,
      ...counts,
      conversionRate: counts.shown > 0
        ? Math.round((counts.converted / counts.shown) * 100 * 10) / 10
        : 0,
    }));

    // Format sessions for response
    const formattedSessions = sessions.map((s) => ({
      id: s.id,
      visitorId: s.visitorId,
      deviceType: s.deviceType,
      browser: s.browser,
      landingPage: s.landingPage,
      segment: s.segment as string[],
      engagementScore: s.engagementScore,
      intentScore: s.intentScore,
      pageViews: s.pageViews.length,
      startedAt: s.startedAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
    }));

    // Format leads for response
    const formattedLeads = leads.map((l) => ({
      id: l.id,
      email: l.email,
      name: l.name,
      source: l.source,
      segment: l.segment as string[],
      convertedToCustomer: l.convertedToCustomer,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalSessions,
        uniqueVisitors,
        avgEngagementScore,
        avgIntentScore,
        bounceRate,
        conversionRate,
      },
      segments,
      modalStats,
      sessions: formattedSessions,
      leads: formattedLeads,
    });
  } catch (error) {
    console.error("Error fetching marketing data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch marketing data" },
      { status: 500 }
    );
  }
}
