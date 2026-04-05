/**
 * CEO Agent Implementation
 *
 * Chief Executive Officer - strategic coordination and oversight.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { executeHeartbeat, delegateTask } from "@/agents/core/orchestrator";
import { storeDecision, storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";

// Agent configuration
export const CEO_AGENT_CONFIG: AgentConfig = {
  name: "ceo",
  displayName: "CEO Agent",
  role: "Chief Executive Officer - Strategic coordination, resource allocation, and company oversight",
  skillsPath: "ceo/SKILL.md",
  monthlyBudgetUsd: 100,
  heartbeatCronExpr: "0 */4 * * *", // Every 4 hours
  permissions: [
    "ceo",
    "analyst",
  ],
  governanceLevel: "supervised", // CEO decisions often need human review
};

/**
 * Initialize the CEO agent in the database
 */
export async function initializeCEOAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: CEO_AGENT_CONFIG.name },
  });

  if (existing) {
    console.log("[CEO] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: CEO_AGENT_CONFIG.name },
      data: {
        displayName: CEO_AGENT_CONFIG.displayName,
        role: CEO_AGENT_CONFIG.role,
        skillsPath: CEO_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: CEO_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: CEO_AGENT_CONFIG.heartbeatCronExpr,
        permissions: CEO_AGENT_CONFIG.permissions,
        governanceLevel: CEO_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: CEO_AGENT_CONFIG.name,
      displayName: CEO_AGENT_CONFIG.displayName,
      role: CEO_AGENT_CONFIG.role,
      skillsPath: CEO_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: CEO_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: CEO_AGENT_CONFIG.heartbeatCronExpr,
      permissions: CEO_AGENT_CONFIG.permissions,
      governanceLevel: CEO_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[CEO] Agent initialized successfully");

  // Store initial system memories
  const agent = await prisma.agent.findUnique({ where: { name: "ceo" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Company mission: Build the UK's most trusted locksmith platform through transparency and anti-fraud protection",
      "Core company mission",
      1.0
    );
    await storePattern(
      agent.id,
      "Revenue target: £2M ARR with 500+ locksmiths",
      "Strategic targets",
      0.9
    );
    await storePattern(
      agent.id,
      "Customer satisfaction must remain above 95% - quality over growth",
      "Strategic priority",
      0.9
    );
  }
}

/**
 * Run CEO agent heartbeat
 */
export async function runCEOHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "ceo" },
  });

  if (!agent) {
    console.error("[CEO] Agent not found, initializing...");
    await initializeCEOAgent();
    return;
  }

  const result = await executeHeartbeat(agent.id);

  console.log(`[CEO] Heartbeat completed:
    - Actions: ${result.actionsExecuted}
    - Cost: $${result.costUsd.toFixed(4)}
    - Errors: ${result.errors.length}
    - Next: ${result.nextHeartbeat.toISOString()}`);
}

/**
 * Get CEO agent status with strategic metrics
 */
export async function getCEOStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  strategicMetrics: {
    weeklyRevenue: number;
    weeklyJobs: number;
    activeLocksmiths: number;
    customerSatisfaction: number;
    agentHealth: {
      coo: string;
      cmo: string;
    };
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "ceo" },
    include: {
      _count: {
        select: {
          tasks: {
            where: { status: { in: ["pending", "in_progress"] } },
          },
        },
      },
    },
  });

  if (!agent) return null;

  // Get strategic metrics
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Weekly revenue from payments
  const weeklyPayments = await prisma.payment.aggregate({
    where: {
      status: "succeeded",
      createdAt: { gte: weekAgo },
    },
    _sum: { amount: true },
  });

  // Weekly jobs
  const weeklyJobs = await prisma.job.count({
    where: {
      createdAt: { gte: weekAgo },
    },
  });

  // Active locksmiths
  const activeLocksmiths = await prisma.locksmith.count({
    where: { isActive: true, isVerified: true },
  });

  // Customer satisfaction (average rating from recent reviews)
  const recentReviews = await prisma.review.findMany({
    where: {
      createdAt: { gte: weekAgo },
    },
    select: { rating: true },
  });
  const avgRating = recentReviews.length > 0
    ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
    : 5;

  // Subagent health
  const cooAgent = await prisma.agent.findUnique({ where: { name: "coo" } });
  const cmoAgent = await prisma.agent.findUnique({ where: { name: "cmo" } });

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    strategicMetrics: {
      weeklyRevenue: weeklyPayments._sum.amount || 0,
      weeklyJobs,
      activeLocksmiths,
      customerSatisfaction: (avgRating / 5) * 100,
      agentHealth: {
        coo: cooAgent?.status || "not_initialized",
        cmo: cmoAgent?.status || "not_initialized",
      },
    },
  };
}

/**
 * Delegate a strategic task to a subagent
 */
export async function delegateStrategicTask(
  targetAgent: "cmo" | "coo",
  task: {
    title: string;
    description: string;
    priority: number;
    deadline?: Date;
  }
): Promise<void> {
  const ceoAgent = await prisma.agent.findUnique({ where: { name: "ceo" } });
  if (!ceoAgent) {
    console.error("[CEO] Cannot delegate - CEO agent not found");
    return;
  }

  await delegateTask(ceoAgent.id, targetAgent, {
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline,
  });

  // Store decision in memory
  await storeDecision(
    ceoAgent.id,
    `Delegated task to ${targetAgent}: ${task.title}`,
    `Priority: ${task.priority}, Deadline: ${task.deadline?.toISOString() || "none"}`,
    "pending"
  );

  console.log(`[CEO] Delegated task to ${targetAgent}: ${task.title}`);
}

/**
 * Generate weekly strategic summary
 */
export async function generateWeeklySummary(): Promise<{
  period: string;
  revenue: { total: number; growth: string };
  jobs: { total: number; completed: number; completionRate: string };
  locksmiths: { total: number; available: number };
  customers: { new: number };
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Current week revenue
  const currentRevenue = await prisma.payment.aggregate({
    where: { status: "succeeded", createdAt: { gte: weekAgo } },
    _sum: { amount: true },
  });

  // Previous week revenue
  const previousRevenue = await prisma.payment.aggregate({
    where: { status: "succeeded", createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    _sum: { amount: true },
  });

  const currentTotal = currentRevenue._sum.amount || 0;
  const previousTotal = previousRevenue._sum.amount || 0;
  const growth = previousTotal > 0
    ? (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1)
    : "N/A";

  // Jobs
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: weekAgo } },
  });
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED).length;

  // Locksmiths
  const totalLocksmiths = await prisma.locksmith.count({ where: { isActive: true } });
  const availableLocksmiths = await prisma.locksmith.count({
    where: { isActive: true, isAvailable: true },
  });

  // New customers
  const newCustomers = await prisma.customer.count({
    where: { createdAt: { gte: weekAgo } },
  });

  // Generate insights
  const highlights: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (Number(growth) > 10) {
    highlights.push(`Strong revenue growth of ${growth}%`);
  }
  if (completedJobs > 50) {
    highlights.push(`${completedJobs} jobs completed this week`);
  }
  if (newCustomers > 20) {
    highlights.push(`${newCustomers} new customers acquired`);
  }

  if (Number(growth) < 0) {
    concerns.push(`Revenue declined by ${Math.abs(Number(growth))}%`);
    recommendations.push("Review marketing campaigns and consider budget increase");
  }
  if (availableLocksmiths < 5) {
    concerns.push(`Only ${availableLocksmiths} locksmiths currently available`);
    recommendations.push("Focus on locksmith recruitment in underserved areas");
  }
  if (jobs.length > 0 && (completedJobs / jobs.length) < 0.8) {
    concerns.push(`Completion rate at ${((completedJobs / jobs.length) * 100).toFixed(0)}%`);
    recommendations.push("Investigate job completion bottlenecks");
  }

  return {
    period: `${weekAgo.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`,
    revenue: { total: currentTotal, growth: `${growth}%` },
    jobs: {
      total: jobs.length,
      completed: completedJobs,
      completionRate: jobs.length > 0 ? `${((completedJobs / jobs.length) * 100).toFixed(0)}%` : "N/A",
    },
    locksmiths: { total: totalLocksmiths, available: availableLocksmiths },
    customers: { new: newCustomers },
    highlights,
    concerns,
    recommendations,
  };
}

/**
 * Helper: Get first day of next month
 */
function getNextMonthStart(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}
