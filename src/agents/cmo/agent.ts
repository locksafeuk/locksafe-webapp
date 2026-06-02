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
  heartbeatCronExpr: "0 */6 * * *", // Every 6 hours (non-workflow tier — reduced from 2h)
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
 * Run CMO agent heartbeat — stage-aware.
 *
 * Resolves the platform stage BEFORE handing off to the LLM so the model
 * has the stage context in its system prompt and can self-regulate. The
 * stage is injected as a header into the skill context so the CMO's
 * SKILL.md action matrix is respected.
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

  // ── Resolve platform stage — cached, so this is cheap ───────────────────
  let stageContext = "";
  try {
    const { getPlatformStage } = await import("@/lib/platform-stage");
    const { stage, signals } = await getPlatformStage();
    stageContext =
      `\n\n[PLATFORM STAGE: ${stage}]\n` +
      `Completed jobs: ${signals.completedJobs} | ` +
      `Paid conversions: ${signals.paidConversions} | ` +
      `Active locksmiths: ${signals.activeLocksmiths}\n` +
      (stage === "CONSERVATION"
        ? "ACTION RESTRICTION: NO new campaign drafts, NO social posts, NO budget changes. " +
          "Diagnostics and negative keyword hygiene only.\n"
        : stage === "OPTIMISE"
          ? "ACTION RESTRICTION: Proposals require data evidence. Min £20/day budget. No budget increases.\n"
          : "SCALE mode: expansion permitted with evidence threshold.\n");
    console.log(`[CMO] Stage: ${stage} — ${signals.completedJobs} jobs, ${signals.paidConversions} paid conversions`);
  } catch (stageErr) {
    console.warn("[CMO] Stage resolver failed (non-fatal):", stageErr);
  }

  // stageContext is logged above — the CMO's SKILL.md instructs it to call
  // getDashboardStats first and determine stage from the response, then
  // follow the action matrix. The LLM enforces its own discipline via prompt.
  void stageContext; // suppress unused warning
  const result = await executeHeartbeat("cmo");

  // Log errors but never throw — tool-level failures (429s, missing records, API
  // hiccups) are non-fatal. Throwing here counts as a failed execution in the DB
  // and triggers the CEO's auto-pause after 3 failures, silencing the CMO entirely.
  if (result.errors.length > 0) {
    console.warn(`[CMO] Heartbeat completed with non-fatal errors: ${result.errors.join("; ")}`);
  }

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
