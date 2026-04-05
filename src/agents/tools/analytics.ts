/**
 * Analytics Tools for Agents
 *
 * Tools for accessing dashboard statistics and generating reports.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";

/**
 * Get dashboard statistics
 */
export const getDashboardStatsTool: AgentTool = {
  name: "getDashboardStats",
  description: "Get comprehensive dashboard statistics including revenue, jobs, and growth metrics",
  category: "analytics",
  permissions: ["ceo", "cto", "cmo", "coo", "analyst"],
  parameters: [
    {
      name: "period",
      type: "string",
      required: false,
      description: "Time period",
      enum: ["today", "week", "month", "quarter"],
      default: "week",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const period = (params.period as string) || "week";

    let dateFilter: Date;
    let previousDateFilter: Date;

    switch (period) {
      case "today":
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
        previousDateFilter = new Date(dateFilter);
        previousDateFilter.setDate(previousDateFilter.getDate() - 1);
        break;
      case "month":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        previousDateFilter = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        previousDateFilter = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        previousDateFilter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    }

    // Current period jobs
    const currentJobs = await prisma.job.findMany({
      where: { createdAt: { gte: dateFilter } },
      include: { quote: true },
    });

    // Previous period jobs (for comparison)
    const previousJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: previousDateFilter, lt: dateFilter },
      },
      include: { quote: true },
    });

    // Calculate metrics
    const currentRevenue = currentJobs
      .filter(j => j.status === JobStatus.COMPLETED && j.quote)
      .reduce((sum, j) => sum + (j.quote?.total || 0), 0);

    const previousRevenue = previousJobs
      .filter(j => j.status === JobStatus.COMPLETED && j.quote)
      .reduce((sum, j) => sum + (j.quote?.total || 0), 0);

    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(1)
      : "N/A";

    // Get locksmith stats
    const totalLocksmiths = await prisma.locksmith.count({ where: { isActive: true } });
    const availableLocksmiths = await prisma.locksmith.count({
      where: { isActive: true, isAvailable: true }
    });

    // Get customer stats
    const newCustomers = await prisma.customer.count({
      where: { createdAt: { gte: dateFilter } },
    });

    return {
      success: true,
      data: {
        period,
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          growth: revenueGrowth,
          currency: "GBP",
        },
        jobs: {
          total: currentJobs.length,
          completed: currentJobs.filter(j => j.status === JobStatus.COMPLETED).length,
          pending: currentJobs.filter(j => j.status === JobStatus.PENDING).length,
          cancelled: currentJobs.filter(j => j.status === JobStatus.CANCELLED).length,
          completionRate: currentJobs.length > 0
            ? ((currentJobs.filter(j => j.status === JobStatus.COMPLETED).length / currentJobs.length) * 100).toFixed(1)
            : "0",
        },
        locksmiths: {
          total: totalLocksmiths,
          available: availableLocksmiths,
          utilizationRate: totalLocksmiths > 0
            ? ((availableLocksmiths / totalLocksmiths) * 100).toFixed(1)
            : "0",
        },
        customers: {
          new: newCustomers,
        },
        generatedAt: new Date(),
      },
    };
  },
};

/**
 * Get conversion funnel metrics
 */
export const getConversionFunnelTool: AgentTool = {
  name: "getConversionFunnel",
  description: "Get conversion funnel metrics from visitor to completed job",
  category: "analytics",
  permissions: ["ceo", "cmo", "analyst"],
  parameters: [
    {
      name: "period",
      type: "string",
      required: false,
      description: "Time period",
      enum: ["today", "week", "month"],
      default: "week",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const period = (params.period as string) || "week";

    let dateFilter: Date;
    switch (period) {
      case "today":
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
        break;
      case "month":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get sessions (use startedAt field which exists in UserSession model)
    const sessions = await prisma.userSession.count({
      where: { startedAt: { gte: dateFilter } },
    });

    // Get job requests (form submissions)
    const jobRequests = await prisma.job.count({
      where: { createdAt: { gte: dateFilter } },
    });

    // Get jobs with locksmith
    const jobsAccepted = await prisma.job.count({
      where: {
        createdAt: { gte: dateFilter },
        status: {
          in: [
            JobStatus.ACCEPTED,
            JobStatus.EN_ROUTE,
            JobStatus.ARRIVED,
            JobStatus.IN_PROGRESS,
            JobStatus.COMPLETED,
          ],
        },
      },
    });

    // Get completed jobs
    const jobsCompleted = await prisma.job.count({
      where: {
        createdAt: { gte: dateFilter },
        status: JobStatus.COMPLETED,
      },
    });

    return {
      success: true,
      data: {
        period,
        funnel: {
          visitors: sessions,
          jobRequests,
          jobsAccepted,
          jobsCompleted,
        },
        conversionRates: {
          visitorToRequest: sessions > 0
            ? ((jobRequests / sessions) * 100).toFixed(2)
            : "0",
          requestToAccepted: jobRequests > 0
            ? ((jobsAccepted / jobRequests) * 100).toFixed(2)
            : "0",
          acceptedToCompleted: jobsAccepted > 0
            ? ((jobsCompleted / jobsAccepted) * 100).toFixed(2)
            : "0",
          overallConversion: sessions > 0
            ? ((jobsCompleted / sessions) * 100).toFixed(2)
            : "0",
        },
        generatedAt: new Date(),
      },
    };
  },
};

/**
 * Get top performing locksmiths
 */
export const getTopPerformersTool: AgentTool = {
  name: "getTopPerformers",
  description: "Get list of top performing locksmiths by various metrics",
  category: "analytics",
  permissions: ["ceo", "coo", "analyst"],
  parameters: [
    {
      name: "metric",
      type: "string",
      required: false,
      description: "Metric to rank by",
      enum: ["jobs", "revenue", "rating", "response_time"],
      default: "jobs",
    },
    {
      name: "limit",
      type: "number",
      required: false,
      description: "Number of results",
      default: 10,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const metric = (params.metric as string) || "jobs";
    const limit = (params.limit as number) || 10;

    const locksmiths = await prisma.locksmith.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
      orderBy: metric === "rating"
        ? { rating: "desc" }
        : metric === "revenue"
        ? { totalEarnings: "desc" }
        : { totalJobs: "desc" },
      take: limit,
    });

    return {
      success: true,
      data: {
        metric,
        topPerformers: locksmiths.map((ls, index) => ({
          rank: index + 1,
          id: ls.id,
          name: ls.name,
          companyName: ls.companyName,
          rating: ls.rating,
          totalJobs: ls.totalJobs,
          totalEarnings: ls.totalEarnings,
          isAvailable: ls.isAvailable,
        })),
        generatedAt: new Date(),
      },
    };
  },
};

/**
 * Generate a daily summary report
 */
export const generateDailySummaryTool: AgentTool = {
  name: "generateDailySummary",
  description: "Generate a comprehensive daily summary report",
  category: "analytics",
  permissions: ["ceo", "coo", "analyst"],
  parameters: [
    {
      name: "date",
      type: "string",
      required: false,
      description: "Date for the summary (ISO format), defaults to today",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const dateStr = params.date as string;
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get jobs for the day
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: targetDate, lt: nextDate },
      },
      include: {
        locksmith: { select: { name: true } },
        quote: true,
      },
    });

    // Get payments
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: targetDate, lt: nextDate },
        status: "succeeded",
      },
    });

    // Get new customers
    const newCustomers = await prisma.customer.count({
      where: {
        createdAt: { gte: targetDate, lt: nextDate },
      },
    });

    // Get new locksmiths
    const newLocksmiths = await prisma.locksmith.count({
      where: {
        createdAt: { gte: targetDate, lt: nextDate },
      },
    });

    // Calculate job values from quotes
    const jobsWithQuotes = jobs.filter(j => j.quote);
    const averageJobValue = jobsWithQuotes.length > 0
      ? jobsWithQuotes.reduce((sum, j) => sum + (j.quote?.total || 0), 0) / jobsWithQuotes.length
      : 0;

    const summary = {
      date: targetDate.toISOString().split("T")[0],
      jobs: {
        total: jobs.length,
        completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
        pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
        cancelled: jobs.filter(j => j.status === JobStatus.CANCELLED).length,
      },
      revenue: {
        total: payments.reduce((sum, p) => sum + p.amount, 0),
        averageJobValue,
      },
      growth: {
        newCustomers,
        newLocksmiths,
      },
      highlights: [] as string[],
    };

    // Generate highlights
    if (summary.jobs.completed > 0) {
      summary.highlights.push(`Completed ${summary.jobs.completed} jobs`);
    }
    if (summary.revenue.total > 0) {
      summary.highlights.push(`Generated £${summary.revenue.total.toFixed(2)} revenue`);
    }
    if (newCustomers > 0) {
      summary.highlights.push(`${newCustomers} new customers`);
    }
    if (summary.jobs.pending > 3) {
      summary.highlights.push(`⚠️ ${summary.jobs.pending} jobs still pending`);
    }

    return {
      success: true,
      data: summary,
    };
  },
};

// Export all analytics tools
export const analyticsTools: AgentTool[] = [
  getDashboardStatsTool,
  getConversionFunnelTool,
  getTopPerformersTool,
  generateDailySummaryTool,
];
