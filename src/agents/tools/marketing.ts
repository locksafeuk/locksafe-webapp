/**
 * Marketing Tools for CMO Agent
 *
 * Tools for managing marketing campaigns, content generation, and analytics.
 */

import prisma from "@/lib/db";
import { generateAdCopy, type AdCopyRequest } from "@/lib/openai-ads";
import { JobStatus, AdStatus, PostStatus } from "@prisma/client";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";
import OpenAI from "openai";

// OpenAI client for content generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate social post content using AI
 */
async function generateSocialPost(params: {
  platform: string;
  contentType: string;
  topic?: string;
}): Promise<{ content: string; hashtags: string[] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `You are a social media expert for LockSafe UK, an emergency locksmith marketplace.
Create engaging ${params.platform} posts that are:
- Professional but approachable
- Include relevant emojis (but not excessive)
- Under 280 characters for Twitter, under 500 for others
- Include a call to action
- Focus on home security tips, locksmith services, or customer safety`,
      },
      {
        role: "user",
        content: `Create a ${params.contentType} post about ${params.topic || "home security"} for ${params.platform}.
Return JSON: {"content": "post content", "hashtags": ["hashtag1", "hashtag2"]}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    content: result.content || "",
    hashtags: result.hashtags || [],
  };
}

/**
 * Get marketing statistics
 */
export const getMarketingStatsTool: AgentTool = {
  name: "getMarketingStats",
  description: "Get marketing performance statistics including ad spend, conversions, and ROI",
  category: "marketing",
  permissions: ["cmo", "ceo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "period",
      type: "string",
      required: false,
      description: "Time period: today, week, month",
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

    // Get ad campaigns
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        createdAt: { gte: dateFilter },
      },
    });

    // Get social posts
    const socialPosts = await prisma.socialPost.findMany({
      where: {
        createdAt: { gte: dateFilter },
      },
    });

    // Get jobs for conversion tracking
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: dateFilter },
        status: JobStatus.COMPLETED,
      },
      include: {
        quote: true,
      },
    });

    // Calculate metrics
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
    const totalRevenue = jobs.reduce((sum, j) => sum + (j.quote?.total || 0), 0);
    const conversions = jobs.length;

    return {
      success: true,
      data: {
        period,
        campaigns: {
          total: campaigns.length,
          active: campaigns.filter(c => c.status === AdStatus.ACTIVE).length,
          paused: campaigns.filter(c => c.status === AdStatus.PAUSED).length,
        },
        spend: totalSpend,
        revenue: totalRevenue,
        conversions,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        cac: conversions > 0 ? totalSpend / conversions : 0,
        socialPosts: {
          total: socialPosts.length,
          published: socialPosts.filter(p => p.status === PostStatus.PUBLISHED).length,
          scheduled: socialPosts.filter(p => p.status === PostStatus.SCHEDULED).length,
        },
      },
    };
  },
};

/**
 * Generate ad copy using AI
 */
export const generateAdCopyTool: AgentTool = {
  name: "generateAdCopy",
  description: "Generate ad copy using AI for Facebook, Google, or other platforms",
  category: "marketing",
  permissions: ["cmo", "copywriter", "ads-specialist"],
  parameters: [
    {
      name: "platform",
      type: "string",
      required: true,
      description: "Target platform",
      enum: ["facebook", "google", "instagram"],
    },
    {
      name: "objective",
      type: "string",
      required: true,
      description: "Campaign objective",
      enum: ["conversions", "awareness", "traffic", "engagement"],
    },
    {
      name: "targetAudience",
      type: "string",
      required: false,
      description: "Description of target audience",
    },
    {
      name: "tone",
      type: "string",
      required: false,
      description: "Tone of the copy",
      enum: ["professional", "urgent", "friendly", "authoritative"],
      default: "professional",
    },
    {
      name: "variants",
      type: "number",
      required: false,
      description: "Number of variants to generate",
      default: 3,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const platform = params.platform as string;
    const objective = params.objective as string;
    const targetAudience = params.targetAudience as string;
    const tone = (params.tone as string) || "professional";

    try {
      // Map objective to goal
      const goalMap: Record<string, "leads" | "sales" | "traffic" | "awareness"> = {
        conversions: "leads",
        awareness: "awareness",
        traffic: "traffic",
        engagement: "awareness",
      };

      const request: AdCopyRequest = {
        targetAudience: targetAudience || "homeowners needing emergency locksmith services",
        goal: goalMap[objective] || "leads",
        tone: tone as "professional" | "casual" | "urgent" | "friendly",
      };

      const copies = await generateAdCopy(request);

      return {
        success: true,
        data: {
          platform,
          objective,
          variants: copies.map(c => ({
            headline: c.headline,
            primaryText: c.primaryText,
            description: c.description,
            callToAction: c.callToAction,
            framework: c.framework,
          })),
          generatedAt: new Date(),
        },
        tokensUsed: 500,
        costUsd: 0.015,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate ad copy",
      };
    }
  },
};

/**
 * Generate social media content
 */
export const generateSocialContentTool: AgentTool = {
  name: "generateSocialContent",
  description: "Generate social media post content for organic reach",
  category: "content",
  permissions: ["cmo", "copywriter", "seo-agent"],
  parameters: [
    {
      name: "platform",
      type: "string",
      required: true,
      description: "Target platform",
      enum: ["facebook", "instagram", "twitter"],
    },
    {
      name: "contentType",
      type: "string",
      required: true,
      description: "Type of content",
      enum: ["tip", "educational", "promotional", "testimonial", "seasonal"],
    },
    {
      name: "topic",
      type: "string",
      required: false,
      description: "Specific topic or theme",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const platform = params.platform as string;
    const contentType = params.contentType as string;
    const topic = params.topic as string;

    try {
      const post = await generateSocialPost({
        platform,
        contentType,
        topic: topic || "home security",
      });

      return {
        success: true,
        data: {
          platform,
          contentType,
          content: post,
          generatedAt: new Date(),
        },
        tokensUsed: 300,
        costUsd: 0.01,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate content",
      };
    }
  },
};

/**
 * Schedule a social post
 */
export const scheduleSocialPostTool: AgentTool = {
  name: "scheduleSocialPost",
  description: "Schedule a social media post for future publishing",
  category: "content",
  permissions: ["cmo", "copywriter"],
  parameters: [
    {
      name: "platform",
      type: "string",
      required: true,
      description: "Target platform",
      enum: ["facebook", "instagram"],
    },
    {
      name: "content",
      type: "string",
      required: true,
      description: "The post content",
    },
    {
      name: "scheduledFor",
      type: "string",
      required: true,
      description: "ISO date string for when to publish",
    },
    {
      name: "imageUrl",
      type: "string",
      required: false,
      description: "URL of image to include",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const platform = params.platform as string;
    const content = params.content as string;
    const scheduledFor = new Date(params.scheduledFor as string);
    const imageUrl = params.imageUrl as string;

    const post = await prisma.socialPost.create({
      data: {
        content,
        imageUrl,
        status: PostStatus.SCHEDULED,
        scheduledFor,
        platforms: platform === "facebook" ? ["FACEBOOK"] : ["INSTAGRAM"],
      },
    });

    return {
      success: true,
      data: {
        postId: post.id,
        platform,
        scheduledFor,
        status: "scheduled",
      },
    };
  },
};

/**
 * Get campaign performance
 */
export const getCampaignPerformanceTool: AgentTool = {
  name: "getCampaignPerformance",
  description: "Get performance metrics for ad campaigns",
  category: "marketing",
  permissions: ["cmo", "ceo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "campaignId",
      type: "string",
      required: false,
      description: "Specific campaign ID, or leave empty for all campaigns",
    },
    {
      name: "status",
      type: "string",
      required: false,
      description: "Filter by campaign status",
      enum: ["active", "paused", "completed"],
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const campaignId = params.campaignId as string;
    const status = params.status as string;

    // Map string status to enum
    const statusMap: Record<string, AdStatus> = {
      active: AdStatus.ACTIVE,
      paused: AdStatus.PAUSED,
      completed: AdStatus.COMPLETED,
    };

    const where: Record<string, unknown> = {};
    if (campaignId) where.id = campaignId;
    if (status && statusMap[status]) where.status = statusMap[status];

    const campaigns = await prisma.adCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const performanceData = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: campaign.totalSpend || 0,
      impressions: campaign.totalImpressions || 0,
      clicks: campaign.totalClicks || 0,
      conversions: campaign.totalConversions || 0,
      ctr: campaign.totalImpressions ? ((campaign.totalClicks || 0) / campaign.totalImpressions * 100).toFixed(2) : "0.00",
      cpc: campaign.totalClicks ? ((campaign.totalSpend || 0) / campaign.totalClicks).toFixed(2) : "0.00",
      cpa: campaign.totalConversions ? ((campaign.totalSpend || 0) / campaign.totalConversions).toFixed(2) : "0.00",
    }));

    return {
      success: true,
      data: {
        totalCampaigns: campaigns.length,
        campaigns: performanceData,
        summary: {
          totalSpend: campaigns.reduce((sum, c) => sum + (c.totalSpend || 0), 0),
          totalConversions: campaigns.reduce((sum, c) => sum + (c.totalConversions || 0), 0),
          avgCtr: performanceData.length > 0
            ? (performanceData.reduce((sum, c) => sum + Number.parseFloat(c.ctr), 0) / performanceData.length).toFixed(2)
            : "0.00",
        },
      },
    };
  },
};

/**
 * Pause or resume a campaign
 */
export const updateCampaignStatusTool: AgentTool = {
  name: "updateCampaignStatus",
  description: "Pause or resume an ad campaign",
  category: "marketing",
  permissions: ["cmo", "ads-specialist"],
  parameters: [
    {
      name: "campaignId",
      type: "string",
      required: true,
      description: "The campaign ID",
    },
    {
      name: "action",
      type: "string",
      required: true,
      description: "Action to take",
      enum: ["pause", "resume"],
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "Reason for the change",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const campaignId = params.campaignId as string;
    const action = params.action as string;
    const reason = params.reason as string;

    const newStatus = action === "pause" ? AdStatus.PAUSED : AdStatus.ACTIVE;

    const campaign = await prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        campaignId,
        campaignName: campaign.name,
        previousStatus: action === "pause" ? "active" : "paused",
        newStatus: campaign.status,
        reason,
        updatedAt: campaign.updatedAt,
      },
    };
  },
};

/**
 * Analyze campaign performance and suggest optimizations
 */
export const analyzeCampaignTool: AgentTool = {
  name: "analyzeCampaign",
  description: "Analyze a campaign's performance and generate optimization suggestions",
  category: "analytics",
  permissions: ["cmo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "campaignId",
      type: "string",
      required: true,
      description: "The campaign ID to analyze",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const campaignId = params.campaignId as string;

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { success: false, error: `Campaign not found: ${campaignId}` };
    }

    const suggestions: string[] = [];
    const metrics = {
      ctr: campaign.totalImpressions ? ((campaign.totalClicks || 0) / campaign.totalImpressions * 100) : 0,
      cpc: campaign.totalClicks ? ((campaign.totalSpend || 0) / campaign.totalClicks) : 0,
      cpa: campaign.totalConversions ? ((campaign.totalSpend || 0) / campaign.totalConversions) : 0,
      conversionRate: campaign.totalClicks ? ((campaign.totalConversions || 0) / campaign.totalClicks * 100) : 0,
    };

    // Generate suggestions based on metrics
    if (metrics.ctr < 1) {
      suggestions.push("CTR is below 1%. Consider testing new ad copy and creative.");
    }
    if (metrics.ctr > 3) {
      suggestions.push("CTR is excellent! Consider scaling budget.");
    }
    if (metrics.cpa > 50) {
      suggestions.push("CPA is high. Consider narrowing audience targeting.");
    }
    if (metrics.conversionRate < 2) {
      suggestions.push("Conversion rate is low. Review landing page experience.");
    }
    if (campaign.status === AdStatus.ACTIVE && metrics.ctr < 0.5) {
      suggestions.push("Consider pausing this campaign due to very low CTR.");
    }

    return {
      success: true,
      data: {
        campaignId,
        campaignName: campaign.name,
        metrics: {
          ctr: `${metrics.ctr.toFixed(2)}%`,
          cpc: `$${metrics.cpc.toFixed(2)}`,
          cpa: `$${metrics.cpa.toFixed(2)}`,
          conversionRate: `${metrics.conversionRate.toFixed(2)}%`,
        },
        performance: metrics.ctr > 2 && metrics.cpa < 30 ? "good" : metrics.ctr < 0.5 ? "poor" : "average",
        suggestions,
        analyzedAt: new Date(),
      },
    };
  },
};

// Export all marketing tools
export const marketingTools: AgentTool[] = [
  getMarketingStatsTool,
  generateAdCopyTool,
  generateSocialContentTool,
  scheduleSocialPostTool,
  getCampaignPerformanceTool,
  updateCampaignStatusTool,
  analyzeCampaignTool,
];
