/**
 * COO Agent Implementation
 *
 * Chief Operating Officer - manages dispatch and operations.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { executeHeartbeat, delegateTask } from "@/agents/core/orchestrator";
import { parseSkillsFile } from "@/agents/core/skill-parser";
import { storeDecision, storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";

// Agent configuration
export const COO_AGENT_CONFIG: AgentConfig = {
  name: "coo",
  displayName: "COO Agent",
  role: "Chief Operating Officer - Manages dispatch, locksmith operations, and service quality",
  skillsPath: "coo/SKILL.md",
  monthlyBudgetUsd: 40,
  heartbeatCronExpr: "*/5 * * * *", // Every 5 minutes
  permissions: [
    "coo",
    "ops-manager",
    "dispatch-optimizer",
  ],
  governanceLevel: "autonomous",
};

/**
 * Initialize the COO agent in the database
 */
export async function initializeCOOAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: COO_AGENT_CONFIG.name },
  });

  if (existing) {
    console.log("[COO] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: COO_AGENT_CONFIG.name },
      data: {
        displayName: COO_AGENT_CONFIG.displayName,
        role: COO_AGENT_CONFIG.role,
        skillsPath: COO_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: COO_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: COO_AGENT_CONFIG.heartbeatCronExpr,
        permissions: COO_AGENT_CONFIG.permissions,
        governanceLevel: COO_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: COO_AGENT_CONFIG.name,
      displayName: COO_AGENT_CONFIG.displayName,
      role: COO_AGENT_CONFIG.role,
      skillsPath: COO_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: COO_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: COO_AGENT_CONFIG.heartbeatCronExpr,
      permissions: COO_AGENT_CONFIG.permissions,
      governanceLevel: COO_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[COO] Agent initialized successfully");

  // Store initial system memories
  const agent = await prisma.agent.findUnique({ where: { name: "coo" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Emergency jobs should be dispatched within 5 minutes",
      "Platform SLA requirement",
      0.9
    );
    await storePattern(
      agent.id,
      "Locksmiths with rating below 4.0 should not receive auto-dispatch",
      "Quality control policy",
      0.9
    );
  }
}

/**
 * Run COO agent heartbeat
 */
export async function runCOOHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "coo" },
  });

  if (!agent) {
    console.error("[COO] Agent not found, initializing...");
    await initializeCOOAgent();
    return;
  }

  const result = await executeHeartbeat(agent.id);

  console.log(`[COO] Heartbeat completed:
    - Actions: ${result.actionsExecuted}
    - Cost: $${result.costUsd.toFixed(4)}
    - Errors: ${result.errors.length}
    - Next: ${result.nextHeartbeat.toISOString()}`);
}

/**
 * Get COO agent status
 */
export async function getCOOStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  operationalMetrics: {
    pendingJobs: number;
    availableLocksmiths: number;
    alertsCount: number;
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "coo" },
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

  // Get operational metrics
  const pendingJobs = await prisma.job.count({
    where: { status: JobStatus.PENDING },
  });

  const availableLocksmiths = await prisma.locksmith.count({
    where: { isActive: true, isAvailable: true },
  });

  // Count alerts (stuck jobs, expiring insurance)
  const stuckJobs = await prisma.job.count({
    where: {
      status: JobStatus.PENDING,
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });

  const expiringInsurance = await prisma.locksmith.count({
    where: {
      isActive: true,
      insuranceExpiryDate: {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gt: new Date(),
      },
    },
  });

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    operationalMetrics: {
      pendingJobs,
      availableLocksmiths,
      alertsCount: stuckJobs + expiringInsurance,
    },
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
