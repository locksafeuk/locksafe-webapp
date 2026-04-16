/**
 * Dispatch Tools for COO Agent
 *
 * Tools for managing job dispatch and locksmith operations.
 * Wraps existing intelligent-dispatch.ts functionality.
 */

import prisma from "@/lib/db";
import { findBestLocksmiths, autoDispatchJob } from "@/lib/intelligent-dispatch";
import { JobStatus } from "@prisma/client";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";

/**
 * Get current job statistics
 */
export const getJobStatsTool: AgentTool = {
  name: "getJobStats",
  description: "Get current job statistics including counts by status, today's jobs, and pending jobs",
  category: "dispatch",
  permissions: ["coo", "ceo", "ops-manager", "dispatch-optimizer"],
  parameters: [
    {
      name: "period",
      type: "string",
      required: false,
      description: "Time period: today, week, month",
      enum: ["today", "week", "month"],
      default: "today",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const period = (params.period as string) || "today";

    let dateFilter: Date;
    switch (period) {
      case "week":
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
    }

    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: dateFilter },
      },
      include: {
        quote: true,
      },
    });

    const stats = {
      total: jobs.length,
      byStatus: {
        pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
        accepted: jobs.filter(j => j.status === JobStatus.ACCEPTED).length,
        en_route: jobs.filter(j => j.status === JobStatus.EN_ROUTE).length,
        arrived: jobs.filter(j => j.status === JobStatus.ARRIVED).length,
        in_progress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
        completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
        cancelled: jobs.filter(j => j.status === JobStatus.CANCELLED).length,
      },
      needsAttention: jobs.filter(j =>
        j.status === JobStatus.PENDING &&
        Date.now() - j.createdAt.getTime() > 30 * 60 * 1000
      ).length,
      totalValue: jobs
        .filter(j => j.status === JobStatus.COMPLETED && j.quote)
        .reduce((sum, j) => sum + (j.quote?.total || 0), 0),
    };

    return {
      success: true,
      data: stats,
    };
  },
};

/**
 * Find best locksmith matches for a job
 */
export const findBestMatchTool: AgentTool = {
  name: "findBestMatch",
  description: "Find the best locksmith matches for a job using the intelligent dispatch algorithm",
  category: "dispatch",
  permissions: ["coo", "ops-manager", "dispatch-optimizer"],
  parameters: [
    {
      name: "jobId",
      type: "string",
      required: true,
      description: "The job ID to find matches for",
    },
    {
      name: "maxCandidates",
      type: "number",
      required: false,
      description: "Maximum number of candidates to return",
      default: 5,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const jobId = params.jobId as string;
    const maxCandidates = (params.maxCandidates as number) || 5;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      return { success: false, error: `Job not found: ${jobId}` };
    }

    if (!job.latitude || !job.longitude) {
      return { success: false, error: "Job has no location coordinates" };
    }

    const result = await findBestLocksmiths(jobId, maxCandidates);

    return {
      success: true,
      data: {
        jobId,
        jobType: job.problemType,
        candidates: result.candidates.slice(0, maxCandidates),
        topCandidate: result.topCandidate,
        autoDispatchRecommended: result.autoDispatchRecommended,
        reason: result.reason,
      },
    };
  },
};

/**
 * Auto-dispatch a job to the best locksmith
 */
export const autoDispatchTool: AgentTool = {
  name: "autoDispatch",
  description: "Automatically dispatch a job to the best available locksmith",
  category: "dispatch",
  permissions: ["coo", "dispatch-optimizer"],
  requiresApproval: false, // COO can auto-dispatch
  parameters: [
    {
      name: "jobId",
      type: "string",
      required: true,
      description: "The job ID to dispatch",
    },
    {
      name: "minScore",
      type: "number",
      required: false,
      description: "Minimum match score required (0-100)",
      default: 70,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const jobId = params.jobId as string;
    const minScore = (params.minScore as number) || 70;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return { success: false, error: `Job not found: ${jobId}` };
    }

    if (job.status !== JobStatus.PENDING) {
      return { success: false, error: `Job is not pending, status: ${job.status}` };
    }

    // First find the best match
    const matchResult = await findBestLocksmiths(jobId, 1);

    if (!matchResult.success || !matchResult.topCandidate) {
      return { success: false, error: matchResult.reason || "No suitable locksmith found" };
    }

    if (matchResult.topCandidate.matchScore < minScore) {
      return {
        success: false,
        error: `Best match score (${matchResult.topCandidate.matchScore}) below minimum (${minScore})`,
      };
    }

    // Dispatch to the top candidate
    const dispatchResult = await autoDispatchJob(
      jobId,
      matchResult.topCandidate.locksmithId,
      job.assessmentFee,
      matchResult.topCandidate.estimatedEtaMinutes
    );

    if (!dispatchResult.success) {
      return { success: false, error: dispatchResult.message };
    }

    return {
      success: true,
      data: {
        jobId,
        dispatched: true,
        locksmithId: matchResult.topCandidate.locksmithId,
        locksmithName: matchResult.topCandidate.locksmithName,
        matchScore: matchResult.topCandidate.matchScore,
        estimatedEta: matchResult.topCandidate.estimatedEtaMinutes,
        applicationId: dispatchResult.applicationId,
      },
    };
  },
};

/**
 * Get available locksmiths
 */
export const getAvailableLocksmithsTool: AgentTool = {
  name: "getAvailableLocksmiths",
  description: "Get list of currently available locksmiths with their status",
  category: "dispatch",
  permissions: ["coo", "ceo", "ops-manager", "dispatch-optimizer"],
  parameters: [
    {
      name: "onlyOnline",
      type: "boolean",
      required: false,
      description: "Only return locksmiths who are currently online",
      default: true,
    },
    {
      name: "minRating",
      type: "number",
      required: false,
      description: "Minimum rating filter",
      default: 3.5,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const onlyOnline = params.onlyOnline !== false;
    const minRating = (params.minRating as number) || 3.5;

    const locksmiths = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        ...(onlyOnline ? { isAvailable: true } : {}),
        rating: { gte: minRating },
        insuranceStatus: "verified",
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        rating: true,
        totalJobs: true,
        isAvailable: true,
        baseLat: true,
        baseLng: true,
        coverageRadius: true,
      },
      orderBy: [
        { isAvailable: "desc" },
        { rating: "desc" },
      ],
    });

    // Get current workload for each locksmith
    const locksmithsWithWorkload = await Promise.all(
      locksmiths.map(async ls => {
        const activeJobs = await prisma.job.count({
          where: {
            locksmithId: ls.id,
            status: {
              in: [
                JobStatus.ACCEPTED,
                JobStatus.EN_ROUTE,
                JobStatus.ARRIVED,
                JobStatus.IN_PROGRESS,
              ],
            },
          },
        });

        return {
          ...ls,
          currentWorkload: activeJobs,
        };
      })
    );

    return {
      success: true,
      data: {
        total: locksmithsWithWorkload.length,
        online: locksmithsWithWorkload.filter(ls => ls.isAvailable).length,
        locksmiths: locksmithsWithWorkload,
      },
    };
  },
};

/**
 * Toggle locksmith availability
 */
export const setLocksmithAvailabilityTool: AgentTool = {
  name: "setLocksmithAvailability",
  description: "Set a locksmith's availability status (online/offline)",
  category: "dispatch",
  permissions: ["coo", "ops-manager"],
  parameters: [
    {
      name: "locksmithId",
      type: "string",
      required: true,
      description: "The locksmith ID",
    },
    {
      name: "available",
      type: "boolean",
      required: true,
      description: "Whether the locksmith should be available",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "Reason for the change",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const locksmithId = params.locksmithId as string;
    const available = params.available as boolean;
    const reason = params.reason as string;

    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable: available,
        lastAvailabilityChange: new Date(),
      },
    });

    return {
      success: true,
      data: {
        locksmithId,
        locksmithName: locksmith.name,
        isAvailable: locksmith.isAvailable,
        reason,
        updatedAt: locksmith.lastAvailabilityChange,
      },
    };
  },
};

/**
 * Get pending alerts
 */
export const getAlertsTool: AgentTool = {
  name: "getAlerts",
  description: "Get pending alerts and issues requiring attention",
  category: "dispatch",
  permissions: ["coo", "ceo", "ops-manager"],
  parameters: [],
  async execute(params, context): Promise<ToolResult> {
    const alerts: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      message: string;
      data: Record<string, unknown>;
    }> = [];

    // Stuck jobs (pending > 30 mins)
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: { customer: { select: { name: true } } },
    });

    for (const job of stuckJobs) {
      alerts.push({
        type: "stuck_job",
        severity: "high",
        message: `Job ${job.id.slice(-6)} pending for ${Math.round((Date.now() - job.createdAt.getTime()) / 60000)} minutes`,
        data: { jobId: job.id, customerName: job.customer?.name },
      });
    }

    // Expiring insurance
    const expiringInsurance = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        insuranceExpiryDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          gt: new Date(),
        },
      },
    });

    for (const ls of expiringInsurance) {
      alerts.push({
        type: "expiring_insurance",
        severity: "medium",
        message: `${ls.name}'s insurance expires on ${ls.insuranceExpiryDate?.toLocaleDateString()}`,
        data: { locksmithId: ls.id, locksmithName: ls.name },
      });
    }

    // Low availability
    const availableCount = await prisma.locksmith.count({
      where: { isActive: true, isAvailable: true },
    });

    if (availableCount < 3) {
      alerts.push({
        type: "low_availability",
        severity: availableCount === 0 ? "critical" : "high",
        message: `Only ${availableCount} locksmiths available`,
        data: { count: availableCount },
      });
    }

    return {
      success: true,
      data: {
        totalAlerts: alerts.length,
        critical: alerts.filter(a => a.severity === "critical").length,
        high: alerts.filter(a => a.severity === "high").length,
        alerts: alerts.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }),
      },
    };
  },
};

// Export all dispatch tools
export const dispatchTools: AgentTool[] = [
  getJobStatsTool,
  findBestMatchTool,
  autoDispatchTool,
  getAvailableLocksmithsTool,
  setLocksmithAvailabilityTool,
  getAlertsTool,
];
