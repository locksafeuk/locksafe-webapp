/**
 * Ads Specialist Subagent Implementation
 *
 * Campaign management and optimization specialist - reports to CMO Agent.
 */

import prisma from "@/lib/db";
import { AdStatus, AdObjective } from "@prisma/client";
import { executeHeartbeat } from "@/agents/core/orchestrator";
import { storeDecision, storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";

// Agent configuration
export const ADS_SPECIALIST_AGENT_CONFIG: AgentConfig = {
  name: "ads-specialist",
  displayName: "Ads Specialist Agent",
  role: "Campaign Management Specialist - Ad campaigns, targeting, and optimization",
  skillsPath: "cmo/subagents/ads-specialist/SKILL.md",
  monthlyBudgetUsd: 25,
  heartbeatCronExpr: "0 */2 * * *", // Every 2 hours
  permissions: [
    "ads-specialist",
    "marketing",
  ],
  governanceLevel: "supervised",
};

// Get parent CMO agent ID
async function getCMOAgentId(): Promise<string | undefined> {
  const cmo = await prisma.agent.findUnique({ where: { name: "cmo" } });
  return cmo?.id;
}

/**
 * Initialize the Ads Specialist agent in the database
 */
export async function initializeAdsSpecialistAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: ADS_SPECIALIST_AGENT_CONFIG.name },
  });

  const parentAgentId = await getCMOAgentId();

  if (existing) {
    console.log("[AdsSpecialist] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: ADS_SPECIALIST_AGENT_CONFIG.name },
      data: {
        displayName: ADS_SPECIALIST_AGENT_CONFIG.displayName,
        role: ADS_SPECIALIST_AGENT_CONFIG.role,
        skillsPath: ADS_SPECIALIST_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: ADS_SPECIALIST_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: ADS_SPECIALIST_AGENT_CONFIG.heartbeatCronExpr,
        permissions: ADS_SPECIALIST_AGENT_CONFIG.permissions,
        governanceLevel: ADS_SPECIALIST_AGENT_CONFIG.governanceLevel,
        parentAgentId,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: ADS_SPECIALIST_AGENT_CONFIG.name,
      displayName: ADS_SPECIALIST_AGENT_CONFIG.displayName,
      role: ADS_SPECIALIST_AGENT_CONFIG.role,
      skillsPath: ADS_SPECIALIST_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: ADS_SPECIALIST_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: ADS_SPECIALIST_AGENT_CONFIG.heartbeatCronExpr,
      permissions: ADS_SPECIALIST_AGENT_CONFIG.permissions,
      governanceLevel: ADS_SPECIALIST_AGENT_CONFIG.governanceLevel,
      parentAgentId,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[AdsSpecialist] Agent initialized successfully");

  // Store initial patterns
  const agent = await prisma.agent.findUnique({ where: { name: "ads-specialist" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Scale winning campaigns by max 20% per day to maintain performance",
      "Scaling best practice",
      0.9
    );
    await storePattern(
      agent.id,
      "Pause campaigns with CTR below 0.5% after 1000 impressions",
      "Performance threshold",
      1.0
    );
    await storePattern(
      agent.id,
      "Best performing audiences: Homeowners 35-55, Small business owners, Property managers",
      "Audience insight",
      0.85
    );
    await storePattern(
      agent.id,
      "Peak conversion hours: 6pm-10pm weekdays, 10am-6pm weekends",
      "Timing optimization",
      0.8
    );
  }
}

/**
 * Run Ads Specialist agent heartbeat
 */
export async function runAdsSpecialistHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { name: "ads-specialist" },
  });

  if (!agent) {
    console.error("[AdsSpecialist] Agent not found, initializing...");
    await initializeAdsSpecialistAgent();
    return;
  }

  const result = await executeHeartbeat(agent.id);

  console.log(`[AdsSpecialist] Heartbeat completed:
    - Actions: ${result.actionsExecuted}
    - Cost: $${result.costUsd.toFixed(4)}
    - Errors: ${result.errors.length}
    - Next: ${result.nextHeartbeat.toISOString()}`);
}

/**
 * Get Ads Specialist agent status
 */
export async function getAdsSpecialistStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  campaignStats: {
    activeCampaigns: number;
    pausedCampaigns: number;
    totalSpend: number;
    totalConversions: number;
    avgCAC: number;
    avgROAS: number;
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "ads-specialist" },
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

  // Get campaign stats
  const activeCampaigns = await prisma.adCampaign.count({
    where: { status: AdStatus.ACTIVE },
  });

  const pausedCampaigns = await prisma.adCampaign.count({
    where: { status: AdStatus.PAUSED },
  });

  const campaigns = await prisma.adCampaign.findMany({
    where: { status: { in: [AdStatus.ACTIVE, AdStatus.PAUSED] } },
  });

  const totalSpend = campaigns.reduce((sum, c) => sum + c.totalSpend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.totalConversions, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.totalRevenue, 0);

  const avgCAC = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    campaignStats: {
      activeCampaigns,
      pausedCampaigns,
      totalSpend,
      totalConversions,
      avgCAC,
      avgROAS,
    },
  };
}

/**
 * Analyze campaign performance and suggest optimizations
 */
export async function analyzeCampaignPerformance(campaignId: string): Promise<{
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cac: number;
    roas: number;
  };
  recommendations: string[];
  action: "scale" | "pause" | "optimize" | "maintain";
}> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: {
      adSets: {
        include: {
          ads: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const spend = campaign.totalSpend;
  const impressions = campaign.totalImpressions;
  const clicks = campaign.totalClicks;
  const conversions = campaign.totalConversions;
  const revenue = campaign.totalRevenue;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cac = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;

  const recommendations: string[] = [];
  let action: "scale" | "pause" | "optimize" | "maintain" = "maintain";

  // Analyze performance
  if (ctr < 0.5 && impressions > 1000) {
    recommendations.push("CTR below 0.5% - consider pausing or refreshing creative");
    action = "pause";
  } else if (ctr > 2) {
    recommendations.push("Strong CTR - consider scaling budget");
    action = "scale";
  }

  if (cac > 60) {
    recommendations.push("CAC above £60 threshold - needs optimization");
    if (action !== "pause") action = "optimize";
  } else if (cac < 30 && conversions > 5) {
    recommendations.push("Excellent CAC performance - scale opportunity");
    action = "scale";
  }

  if (roas > 3) {
    recommendations.push("ROAS above 3x target - consider budget increase");
    action = "scale";
  } else if (roas < 1 && spend > 100) {
    recommendations.push("Negative ROAS - review targeting and landing page");
    action = "optimize";
  }

  if (recommendations.length === 0) {
    recommendations.push("Campaign performing within normal parameters");
  }

  // Store decision
  const agent = await prisma.agent.findUnique({ where: { name: "ads-specialist" } });
  if (agent) {
    await storeDecision(
      agent.id,
      `Analyzed campaign ${campaign.name}: ${action}`,
      `CAC: £${cac.toFixed(2)}, ROAS: ${roas.toFixed(2)}x, CTR: ${ctr.toFixed(2)}%`,
      "completed"
    );
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
    },
    metrics: {
      spend,
      impressions,
      clicks,
      conversions,
      ctr,
      cpc,
      cac,
      roas,
    },
    recommendations,
    action,
  };
}

/**
 * Pause underperforming campaigns
 */
export async function pauseUnderperformingCampaigns(): Promise<{
  paused: number;
  campaigns: Array<{ id: string; name: string; reason: string }>;
}> {
  const campaigns = await prisma.adCampaign.findMany({
    where: { status: AdStatus.ACTIVE },
  });

  const toPause: Array<{ id: string; name: string; reason: string }> = [];

  for (const campaign of campaigns) {
    const ctr = campaign.totalImpressions > 0
      ? (campaign.totalClicks / campaign.totalImpressions) * 100
      : 0;
    const cac = campaign.totalConversions > 0
      ? campaign.totalSpend / campaign.totalConversions
      : Infinity;

    // Check pause criteria
    if (ctr < 0.5 && campaign.totalImpressions > 1000) {
      toPause.push({
        id: campaign.id,
        name: campaign.name,
        reason: `Low CTR: ${ctr.toFixed(2)}%`,
      });
    } else if (cac > 100 && campaign.totalSpend > 200) {
      toPause.push({
        id: campaign.id,
        name: campaign.name,
        reason: `High CAC: £${cac.toFixed(2)}`,
      });
    }
  }

  // Pause the campaigns
  for (const campaign of toPause) {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: AdStatus.PAUSED },
    });
  }

  // Store decision
  const agent = await prisma.agent.findUnique({ where: { name: "ads-specialist" } });
  if (agent && toPause.length > 0) {
    await storeDecision(
      agent.id,
      `Paused ${toPause.length} underperforming campaigns`,
      toPause.map(c => `${c.name}: ${c.reason}`).join("; "),
      "completed"
    );
  }

  return {
    paused: toPause.length,
    campaigns: toPause,
  };
}

/**
 * Generate campaign performance report
 */
export async function generateCampaignReport(): Promise<{
  period: string;
  summary: {
    totalSpend: number;
    totalConversions: number;
    avgCAC: number;
    avgROAS: number;
    activeCampaigns: number;
  };
  topPerformers: Array<{
    name: string;
    roas: number;
    conversions: number;
  }>;
  recommendations: string[];
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      status: { in: [AdStatus.ACTIVE, AdStatus.PAUSED] },
      createdAt: { lte: new Date() },
    },
    orderBy: { totalRevenue: "desc" },
  });

  const activeCampaigns = campaigns.filter(c => c.status === AdStatus.ACTIVE);
  const totalSpend = campaigns.reduce((sum, c) => sum + c.totalSpend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.totalConversions, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.totalRevenue, 0);

  const avgCAC = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const topPerformers = campaigns
    .filter(c => c.totalConversions > 0)
    .slice(0, 3)
    .map(c => ({
      name: c.name,
      roas: c.totalSpend > 0 ? c.totalRevenue / c.totalSpend : 0,
      conversions: c.totalConversions,
    }));

  const recommendations: string[] = [];
  if (avgCAC > 50) {
    recommendations.push("Average CAC above £50 target - review targeting");
  }
  if (avgROAS < 3) {
    recommendations.push("ROAS below 3x target - optimize landing pages");
  }
  if (activeCampaigns.length < 3) {
    recommendations.push("Consider launching new campaigns to increase reach");
  }

  return {
    period: `${weekAgo.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`,
    summary: {
      totalSpend,
      totalConversions,
      avgCAC,
      avgROAS,
      activeCampaigns: activeCampaigns.length,
    },
    topPerformers,
    recommendations: recommendations.length > 0 ? recommendations : ["Performance on track"],
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
