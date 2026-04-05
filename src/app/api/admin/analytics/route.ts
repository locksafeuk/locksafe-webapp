import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Helper to verify admin auth
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.type === "admin";
}

// GET - Fetch analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "12m";

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "3m":
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case "6m":
        startDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case "12m":
      default:
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }

    // Fetch job statistics
    const totalJobs = await prisma.job.count();
    const completedJobs = await prisma.job.count({
      where: { status: { in: ["COMPLETED", "SIGNED"] } },
    });
    const pendingJobs = await prisma.job.count({
      where: { status: "PENDING" },
    });
    const inProgressJobs = await prisma.job.count({
      where: { status: { in: ["ACCEPTED", "ARRIVED", "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS"] } },
    });

    // Fetch locksmith statistics
    const totalLocksmiths = await prisma.locksmith.count({
      where: { isActive: true },
    });
    const verifiedLocksmiths = await prisma.locksmith.count({
      where: { isActive: true, isVerified: true },
    });

    // Fetch customer statistics
    const totalCustomers = await prisma.customer.count();

    // Calculate revenue from completed quotes
    const revenueData = await prisma.quote.aggregate({
      _sum: { total: true },
      where: {
        accepted: true,
        job: {
          status: { in: ["COMPLETED", "SIGNED"] },
          createdAt: { gte: startDate },
        },
      },
    });

    // Fetch monthly revenue data
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "SIGNED"] },
        createdAt: { gte: startDate },
      },
      include: {
        quote: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group jobs by month
    const monthlyData: Record<string, { revenue: number; jobs: number; customers: Set<string> }> = {};

    for (const job of jobs) {
      const monthKey = new Date(job.createdAt).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric"
      });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, jobs: 0, customers: new Set() };
      }

      monthlyData[monthKey].jobs++;
      monthlyData[monthKey].customers.add(job.customerId);

      if (job.quote?.total) {
        monthlyData[monthKey].revenue += job.quote.total;
      } else {
        monthlyData[monthKey].revenue += job.assessmentFee;
      }
    }

    const monthlyRevenue = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: Math.round(data.revenue),
      jobs: data.jobs,
      customers: data.customers.size,
    }));

    // Fetch job types distribution
    const jobTypeStats = await prisma.job.groupBy({
      by: ["problemType"],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    });

    const jobTypeData = jobTypeStats.map((stat) => ({
      type: stat.problemType,
      count: stat._count,
    }));

    // Fetch regional data (by postcode area)
    const regionalStats = await prisma.job.groupBy({
      by: ["postcode"],
      _count: true,
      where: {
        createdAt: { gte: startDate },
        status: { in: ["COMPLETED", "SIGNED"] },
      },
    });

    // Group by first part of postcode (area)
    const regionalData: Record<string, number> = {};
    for (const stat of regionalStats) {
      const area = stat.postcode.split(" ")[0].replace(/[0-9]/g, "");
      regionalData[area] = (regionalData[area] || 0) + stat._count;
    }

    const topRegions = Object.entries(regionalData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([region, jobs]) => ({
        region,
        jobs,
      }));

    // Fetch top performing locksmiths
    const topLocksmiths = await prisma.locksmith.findMany({
      where: { isActive: true },
      orderBy: [{ totalJobs: "desc" }, { rating: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        companyName: true,
        rating: true,
        totalJobs: true,
        totalEarnings: true,
        isVerified: true,
      },
    });

    // Fetch review statistics
    const reviews = await prisma.review.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        rating: true,
      },
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Calculate conversion rates
    const totalRequests = await prisma.job.count({
      where: { createdAt: { gte: startDate } },
    });
    const quotedJobs = await prisma.job.count({
      where: {
        createdAt: { gte: startDate },
        status: { in: ["QUOTED", "QUOTE_ACCEPTED", "QUOTE_DECLINED", "IN_PROGRESS", "COMPLETED", "SIGNED"] },
      },
    });
    const acceptedQuotes = await prisma.job.count({
      where: {
        createdAt: { gte: startDate },
        status: { in: ["QUOTE_ACCEPTED", "IN_PROGRESS", "COMPLETED", "SIGNED"] },
      },
    });

    // Calculate growth (compare this month to last month)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthJobs = await prisma.job.count({
      where: {
        createdAt: { gte: thisMonthStart },
        status: { in: ["COMPLETED", "SIGNED"] },
      },
    });

    const lastMonthJobs = await prisma.job.count({
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { in: ["COMPLETED", "SIGNED"] },
      },
    });

    const jobGrowth = lastMonthJobs > 0
      ? Math.round(((thisMonthJobs - lastMonthJobs) / lastMonthJobs) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          totalJobs,
          completedJobs,
          pendingJobs,
          inProgressJobs,
          totalLocksmiths,
          verifiedLocksmiths,
          totalCustomers,
          totalRevenue: revenueData._sum.total || 0,
          avgJobValue: completedJobs > 0
            ? Math.round((revenueData._sum.total || 0) / completedJobs)
            : 0,
          avgRating: Math.round(avgRating * 10) / 10,
          jobGrowth,
        },
        monthlyRevenue,
        jobTypeData,
        topRegions,
        topLocksmiths,
        funnel: {
          requests: totalRequests,
          quoted: quotedJobs,
          accepted: acceptedQuotes,
          completed: completedJobs,
          reviewed: reviews.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
