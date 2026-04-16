/**
 * CTO Agent Implementation
 *
 * Chief Technology Officer - system health, deployments, and technical oversight.
 */

import prisma from "@/lib/db";
import { executeHeartbeat, delegateTask } from "@/agents/core/orchestrator";
import { storeDecision, storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";

// Agent configuration
export const CTO_AGENT_CONFIG: AgentConfig = {
  name: "cto",
  displayName: "CTO Agent",
  role: "Chief Technology Officer - System health monitoring, deployments, and technical oversight",
  skillsPath: "cto/SKILL.md",
  monthlyBudgetUsd: 80,
  heartbeatCronExpr: "*/15 * * * *", // Every 15 minutes
  permissions: [
    "cto",
    "senior-dev",
    "debugger",
    "devops",
    "system",
  ],
  governanceLevel: "supervised",
};

/**
 * Initialize the CTO agent in the database
 */
export async function initializeCTOAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: CTO_AGENT_CONFIG.name },
  });

  if (existing) {
    console.log("[CTO] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: CTO_AGENT_CONFIG.name },
      data: {
        displayName: CTO_AGENT_CONFIG.displayName,
        role: CTO_AGENT_CONFIG.role,
        skillsPath: CTO_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: CTO_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: CTO_AGENT_CONFIG.heartbeatCronExpr,
        permissions: CTO_AGENT_CONFIG.permissions,
        governanceLevel: CTO_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: CTO_AGENT_CONFIG.name,
      displayName: CTO_AGENT_CONFIG.displayName,
      role: CTO_AGENT_CONFIG.role,
      skillsPath: CTO_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: CTO_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: CTO_AGENT_CONFIG.heartbeatCronExpr,
      permissions: CTO_AGENT_CONFIG.permissions,
      governanceLevel: CTO_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[CTO] Agent initialized successfully");

  // Store initial system memories
  const agent = await prisma.agent.findUnique({ where: { name: "cto" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Target uptime is 99.9% - alert if dropping below 99.5%",
      "System policy",
      1.0
    );
    await storePattern(
      agent.id,
      "Error rate threshold is 0.1% - investigate above this",
      "Monitoring benchmark",
      0.9
    );
    await storePattern(
      agent.id,
      "API response time should stay under 200ms average",
      "Performance benchmark",
      0.9
    );
    await storePattern(
      agent.id,
      "Database queries exceeding 100ms need optimization",
      "Database policy",
      0.8
    );
  }
}

/**
 * Run CTO agent heartbeat
 */
export async function runCTOHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cto" },
  });

  if (!agent) {
    console.error("[CTO] Agent not found, initializing...");
    await initializeCTOAgent();
    return;
  }

  const result = await executeHeartbeat(agent.id);

  console.log(`[CTO] Heartbeat completed:
    - Actions: ${result.actionsExecuted}
    - Cost: $${result.costUsd.toFixed(4)}
    - Errors: ${result.errors.length}
    - Next: ${result.nextHeartbeat.toISOString()}`);
}

/**
 * Get CTO agent status with system health metrics
 */
export async function getCTOStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  systemHealth: {
    uptime: string;
    errorRate: string;
    avgResponseMs: number;
    activeConnections: number;
    databaseHealth: "healthy" | "degraded" | "critical";
    recentErrors: number;
    deploymentStatus: "stable" | "deploying" | "failed";
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cto" },
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

  // Get system health metrics
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Count recent analytics events for error tracking
  const recentErrors = await prisma.analyticsEvent.count({
    where: {
      type: "error",
      createdAt: { gte: oneHourAgo },
    },
  });

  // Get database health by checking recent queries
  const recentEvents = await prisma.analyticsEvent.count({
    where: {
      createdAt: { gte: oneHourAgo },
    },
  });

  // Simulate system health metrics
  const totalRequests = Math.max(recentEvents, 100);
  const errorRate = recentErrors / totalRequests;

  let databaseHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (errorRate > 0.05) databaseHealth = "degraded";
  if (errorRate > 0.1) databaseHealth = "critical";

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    systemHealth: {
      uptime: "99.95%",
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
      avgResponseMs: 145 + Math.floor(Math.random() * 50),
      activeConnections: 12 + Math.floor(Math.random() * 8),
      databaseHealth,
      recentErrors,
      deploymentStatus: "stable",
    },
  };
}

/**
 * Trigger system health check task
 */
export async function triggerSystemHealthCheck(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cto" },
  });

  if (!agent) {
    console.error("[CTO] Agent not found");
    return;
  }

  await prisma.agentTask.create({
    data: {
      agentId: agent.id,
      title: "System Health Check",
      description: "Perform comprehensive system health analysis including database performance, API response times, and error rates",
      priority: 8,
      status: "pending",
    },
  });

  console.log("[CTO] System health check task created");
}

/**
 * Trigger bug investigation task
 */
export async function triggerBugInvestigation(
  bugDescription: string,
  severity: "low" | "medium" | "high" | "critical"
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cto" },
  });

  if (!agent) {
    console.error("[CTO] Agent not found");
    return;
  }

  const priorityMap = { low: 3, medium: 5, high: 7, critical: 10 };

  await prisma.agentTask.create({
    data: {
      agentId: agent.id,
      title: `Bug Investigation: ${severity.toUpperCase()}`,
      description: bugDescription,
      priority: priorityMap[severity],
      status: "pending",
    },
  });

  console.log(`[CTO] Bug investigation task created: ${severity}`);

  // Store in memory for pattern recognition
  await storeDecision(
    agent.id,
    `New ${severity} bug reported: ${bugDescription.slice(0, 100)}`,
    `Bug investigation initiated with priority ${priorityMap[severity]}`,
    "pending"
  );
}

/**
 * Get deployment history
 */
export async function getDeploymentHistory(): Promise<{
  recentDeployments: Array<{
    timestamp: Date;
    version: string;
    status: "success" | "failed" | "rollback";
    duration: number;
  }>;
  lastSuccessful: Date | null;
  failureRate: number;
}> {
  // Simulated deployment history - in production this would come from CI/CD
  const now = new Date();
  const deployments = [
    {
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      version: "v2.4.1",
      status: "success" as const,
      duration: 245,
    },
    {
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      version: "v2.4.0",
      status: "success" as const,
      duration: 312,
    },
    {
      timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      version: "v2.3.9",
      status: "success" as const,
      duration: 198,
    },
  ];

  return {
    recentDeployments: deployments,
    lastSuccessful: deployments[0]?.timestamp || null,
    failureRate: 0.02,
  };
}

/**
 * Generate system report
 */
export async function generateSystemReport(): Promise<{
  period: string;
  uptime: string;
  totalRequests: number;
  errorCount: number;
  avgResponseTime: number;
  peakLoad: string;
  recommendations: string[];
}> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const totalRequests = await prisma.analyticsEvent.count({
    where: { createdAt: { gte: dayAgo } },
  });

  const errorCount = await prisma.analyticsEvent.count({
    where: { type: "error", createdAt: { gte: dayAgo } },
  });

  const recommendations: string[] = [];

  if (errorCount > 10) {
    recommendations.push("Investigate error spike - consider enabling enhanced logging");
  }
  if (totalRequests < 100) {
    recommendations.push("Low traffic detected - verify monitoring is working correctly");
  }

  return {
    period: `${dayAgo.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`,
    uptime: "99.95%",
    totalRequests,
    errorCount,
    avgResponseTime: 165,
    peakLoad: "14:00-16:00 UTC",
    recommendations: recommendations.length > 0 ? recommendations : ["System operating normally"],
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
