import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

// Helper to verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

// Attribution source parsing
function parseUtmSource(source: string | null): string {
  if (!source) return "direct";

  const sourceMap: Record<string, string> = {
    facebook: "meta",
    fb: "meta",
    instagram: "meta",
    ig: "meta",
    meta: "meta",
    google: "google",
    googleads: "google",
    gads: "google",
    bing: "microsoft",
    microsoft: "microsoft",
    msn: "microsoft",
    twitter: "twitter",
    x: "twitter",
    tiktok: "tiktok",
    youtube: "youtube",
    email: "email",
    newsletter: "email",
  };

  const normalized = source.toLowerCase();
  return sourceMap[normalized] || source;
}

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d, all
    const groupBy = searchParams.get("groupBy") || "source"; // source, campaign, medium

    // Calculate date range
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // Get all user sessions with UTM data
    const sessions = await prisma.userSession.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      select: {
        id: true,
        visitorId: true,
        customerId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        referrer: true,
        landingPage: true,
        funnelStage: true,
        deviceType: true,
        startedAt: true,
      },
    });

    // Get conversion events
    const conversionEvents = await prisma.analyticsEvent.findMany({
      where: {
        type: { startsWith: "conversion_" },
        createdAt: { gte: startDate },
      },
      select: {
        type: true,
        data: true,
        sessionId: true,
        createdAt: true,
      },
    });

    // Get jobs created in period with customer info
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        customerId: true,
        assessmentFee: true,
        assessmentPaid: true,
        createdAt: true,
        quote: {
          select: {
            total: true,
            accepted: true,
          },
        },
        payments: {
          where: { status: "succeeded" },
          select: {
            type: true,
            amount: true,
          },
        },
      },
    });

    // Build attribution map (customerId -> first session with UTM)
    const customerAttribution: Map<string, {
      source: string;
      medium: string;
      campaign: string;
    }> = new Map();

    for (const session of sessions) {
      if (session.customerId && !customerAttribution.has(session.customerId)) {
        customerAttribution.set(session.customerId, {
          source: parseUtmSource(session.utmSource),
          medium: session.utmMedium || "none",
          campaign: session.utmCampaign || "none",
        });
      }
    }

    // Aggregate metrics by source
    const sourceMetrics: Map<string, {
      source: string;
      sessions: number;
      leads: number; // Jobs created
      conversions: number; // Completed jobs
      revenue: number;
      assessmentRevenue: number;
      quoteRevenue: number;
    }> = new Map();

    // Count sessions by source
    for (const session of sessions) {
      const source = parseUtmSource(session.utmSource);

      if (!sourceMetrics.has(source)) {
        sourceMetrics.set(source, {
          source,
          sessions: 0,
          leads: 0,
          conversions: 0,
          revenue: 0,
          assessmentRevenue: 0,
          quoteRevenue: 0,
        });
      }

      const metrics = sourceMetrics.get(source)!;
      metrics.sessions++;
    }

    // Count jobs and revenue by source
    for (const job of jobs) {
      const attribution = customerAttribution.get(job.customerId);
      const source = attribution?.source || "direct";

      if (!sourceMetrics.has(source)) {
        sourceMetrics.set(source, {
          source,
          sessions: 0,
          leads: 0,
          conversions: 0,
          revenue: 0,
          assessmentRevenue: 0,
          quoteRevenue: 0,
        });
      }

      const metrics = sourceMetrics.get(source)!;
      metrics.leads++;

      // Calculate revenue
      let totalRevenue = 0;
      let assessmentRev = 0;
      let quoteRev = 0;

      for (const payment of job.payments) {
        totalRevenue += payment.amount;
        if (payment.type === "assessment") {
          assessmentRev += payment.amount;
        } else {
          quoteRev += payment.amount;
        }
      }

      // Count as conversion if any payment succeeded
      if (job.payments.length > 0) {
        metrics.conversions++;
        metrics.revenue += totalRevenue;
        metrics.assessmentRevenue += assessmentRev;
        metrics.quoteRevenue += quoteRev;
      }
    }

    // Convert to array and calculate rates
    const attributionData = Array.from(sourceMetrics.values()).map((metrics) => {
      const conversionRate = metrics.leads > 0
        ? (metrics.conversions / metrics.leads) * 100
        : 0;
      const costPerLead = 0; // Would need ad spend data
      const roas = 0; // Would need ad spend data

      return {
        ...metrics,
        conversionRate: Number(conversionRate.toFixed(2)),
        avgOrderValue: metrics.conversions > 0
          ? Number((metrics.revenue / metrics.conversions).toFixed(2))
          : 0,
        costPerLead,
        roas,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Calculate totals
    const totals = attributionData.reduce(
      (acc, curr) => ({
        sessions: acc.sessions + curr.sessions,
        leads: acc.leads + curr.leads,
        conversions: acc.conversions + curr.conversions,
        revenue: acc.revenue + curr.revenue,
        assessmentRevenue: acc.assessmentRevenue + curr.assessmentRevenue,
        quoteRevenue: acc.quoteRevenue + curr.quoteRevenue,
      }),
      { sessions: 0, leads: 0, conversions: 0, revenue: 0, assessmentRevenue: 0, quoteRevenue: 0 }
    );

    // Get conversion events breakdown
    const conversionBreakdown = conversionEvents.reduce(
      (acc, event) => {
        const type = event.type.replace("conversion_", "");
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Build funnel data
    const funnelStages = sessions.reduce(
      (acc, session) => {
        const stage = session.funnelStage || "visitor";
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Daily trends (last 30 days)
    const dailyTrends: Array<{
      date: string;
      sessions: number;
      leads: number;
      conversions: number;
      revenue: number;
    }> = [];

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      const daySessions = sessions.filter(
        (s) => s.startedAt.toISOString().split("T")[0] === dateStr
      ).length;

      const dayJobs = jobs.filter(
        (j) => j.createdAt.toISOString().split("T")[0] === dateStr
      );

      const dayLeads = dayJobs.length;
      const dayConversions = dayJobs.filter((j) => j.payments.length > 0).length;
      const dayRevenue = dayJobs.reduce(
        (sum, j) => sum + j.payments.reduce((s, p) => s + p.amount, 0),
        0
      );

      dailyTrends.push({
        date: dateStr,
        sessions: daySessions,
        leads: dayLeads,
        conversions: dayConversions,
        revenue: Number(dayRevenue.toFixed(2)),
      });
    }

    return NextResponse.json({
      attribution: attributionData,
      totals: {
        ...totals,
        conversionRate: totals.leads > 0
          ? Number(((totals.conversions / totals.leads) * 100).toFixed(2))
          : 0,
        avgOrderValue: totals.conversions > 0
          ? Number((totals.revenue / totals.conversions).toFixed(2))
          : 0,
      },
      conversionBreakdown,
      funnelStages,
      dailyTrends,
      period,
    });
  } catch (error) {
    console.error("Attribution API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
