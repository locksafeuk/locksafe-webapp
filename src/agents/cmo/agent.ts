/**
 * CMO Agent Implementation
 *
 * Chief Marketing Officer - manages campaigns and content.
 */

import prisma from "@/lib/db";
import { JobStatus, AdStatus, PostStatus } from "@prisma/client";
import { executeHeartbeat, delegateTask } from "@/agents/core/orchestrator";
import { parseSkillsFile } from "@/agents/core/skill-parser";
import { storeDecision, storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";

// Agent configuration
export const CMO_AGENT_CONFIG: AgentConfig = {
  name: "cmo",
  displayName: "CMO Agent",
  role: "Chief Marketing Officer - Manages ad campaigns, content generation, and marketing strategy",
  skillsPath: "cmo/SKILL.md",
  monthlyBudgetUsd: 60,
  heartbeatCronExpr: "0 */2 * * *", // Every 2 hours
  permissions: [
    "cmo",
    "copywriter",
    "ads-specialist",
    "analyst",
  ],
  governanceLevel: "supervised",
};

/**
 * Initialize the CMO agent in the database
 */
export async function initializeCMOAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: CMO_AGENT_CONFIG.name },
  });

  if (existing) {
    console.log("[CMO] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: CMO_AGENT_CONFIG.name },
      data: {
        displayName: CMO_AGENT_CONFIG.displayName,
        role: CMO_AGENT_CONFIG.role,
        skillsPath: CMO_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: CMO_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: CMO_AGENT_CONFIG.heartbeatCronExpr,
        permissions: CMO_AGENT_CONFIG.permissions,
        governanceLevel: CMO_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: CMO_AGENT_CONFIG.name,
      displayName: CMO_AGENT_CONFIG.displayName,
      role: CMO_AGENT_CONFIG.role,
      skillsPath: CMO_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: CMO_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: CMO_AGENT_CONFIG.heartbeatCronExpr,
      permissions: CMO_AGENT_CONFIG.permissions,
      governanceLevel: CMO_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[CMO] Agent initialized successfully");

  // Store initial system memories
  const agent = await prisma.agent.findUnique({ where: { name: "cmo" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Target CAC is £50 - pause campaigns exceeding this",
      "Marketing policy",
      0.9
    );
    await storePattern(
      agent.id,
      "CTR below 0.5% after 1000 impressions = underperforming",
      "Performance benchmark",
      0.8
    );
    await storePattern(
      agent.id,
      "Post organic content at 9am, 1pm, and 6pm for best engagement",
      "Historical performance data",
      0.7
    );
  }
}

/**
 * Run CMO agent heartbeat
 */
export async function runCMOHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cmo" },
  });

  if (!agent) {
    console.error("[CMO] Agent not found, initializing...");
    await initializeCMOAgent();
    return;
  }

  const result = await executeHeartbeat(agent.id);

  console.log(`[CMO] Heartbeat completed:
    - Actions: ${result.actionsExecuted}
    - Cost: $${result.costUsd.toFixed(4)}
    - Errors: ${result.errors.length}
    - Next: ${result.nextHeartbeat.toISOString()}`);
}

/**
 * Get CMO agent status
 */
export async function getCMOStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  marketingMetrics: {
    activeCampaigns: number;
    scheduledPosts: number;
    weeklySpend: number;
    weeklyConversions: number;
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cmo" },
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

  // Get marketing metrics
  const activeCampaigns = await prisma.adCampaign.count({
    where: { status: AdStatus.ACTIVE },
  });

  const scheduledPosts = await prisma.socialPost.count({
    where: { status: PostStatus.SCHEDULED },
  });

  // Weekly spend
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const campaigns = await prisma.adCampaign.findMany({
    where: {
      createdAt: { gte: weekAgo },
    },
  });
  const weeklySpend = campaigns.reduce((sum, c) => sum + (c.totalSpend || 0), 0);

  // Weekly conversions
  const completedJobs = await prisma.job.count({
    where: {
      status: JobStatus.COMPLETED,
      createdAt: { gte: weekAgo },
    },
  });

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    marketingMetrics: {
      activeCampaigns,
      scheduledPosts,
      weeklySpend,
      weeklyConversions: completedJobs,
    },
  };
}

/**
 * Trigger content generation task
 */
export async function triggerContentGeneration(
  contentType: "social" | "ad" | "email",
  topic?: string
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "cmo" },
  });

  if (!agent) {
    console.error("[CMO] Agent not found");
    return;
  }

  await prisma.agentTask.create({
    data: {
      agentId: agent.id,
      title: `Generate ${contentType} content`,
      description: `Generate new ${contentType} content${topic ? ` about: ${topic}` : ""}`,
      priority: 5,
      status: "pending",
    },
  });

  console.log(`[CMO] Content generation task created: ${contentType}`);
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
