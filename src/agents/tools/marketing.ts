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
import {
  getDefaultGoogleAdsClient,
  microsToCurrency,
} from "@/lib/google-ads";
import { generateGoogleAdsDraftPlan } from "@/lib/openai-google-ads";
import { checkAutoAction, getEffectivePolicy } from "@/lib/spend-guard";
import { isServiceSlug } from "@/lib/services-catalog";
import { optimiseMetaCampaigns } from "@/lib/meta-optimiser";

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

    // Meta campaigns (totalSpend lives on AdCampaign aggregate fields)
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        createdAt: { gte: dateFilter },
      },
    });

    // Google Ads spend lives in AdPerformanceSnapshot keyed by
    // platform="google" (we don't mirror Google campaigns into AdCampaign in
    // Phase 1).
    const googleAgg = await prisma.adPerformanceSnapshot.aggregate({
      where: { platform: "google", date: { gte: dateFilter } },
      _sum: { spend: true, conversions: true, revenue: true, clicks: true, impressions: true },
    });

    // Get social posts
    const socialPosts = await prisma.socialPost.findMany({
      where: {
        createdAt: { gte: dateFilter },
      },
    });

    // Get jobs for conversion tracking (used as ground truth for our own CAC
    // calc — Meta + Google attribution windows differ so platform-reported
    // conversions are kept separate as `byPlatform.*.conversions`).
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
    const metaSpend = campaigns.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
    const googleSpend = googleAgg._sum.spend ?? 0;
    const totalSpend = metaSpend + googleSpend;
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
        byPlatform: {
          meta: {
            spend: metaSpend,
            campaigns: campaigns.length,
          },
          google: {
            spend: googleSpend,
            platformConversions: googleAgg._sum.conversions ?? 0,
            platformRevenue: googleAgg._sum.revenue ?? 0,
            clicks: googleAgg._sum.clicks ?? 0,
            impressions: googleAgg._sum.impressions ?? 0,
          },
        },
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

/**
 * Get Google Ads campaigns with live metrics for a date range. Read-only.
 * Pulls directly from the Google Ads API, not from our DB cache, so the
 * agent always sees fresh data.
 */
export const getGoogleAdsCampaignsTool: AgentTool = {
  name: "getGoogleAdsCampaigns",
  description:
    "Fetch live Google Ads campaign metrics (impressions, clicks, cost, conversions) for the past N days. Read-only.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "lookbackDays",
      type: "number",
      required: false,
      description: "Days of history to pull (default 7, max 90)",
      default: 7,
    },
  ],
  async execute(params, _context): Promise<ToolResult> {
    const lookbackDays = Math.min(Math.max(Number(params.lookbackDays ?? 7), 1), 90);
    const handle = await getDefaultGoogleAdsClient();
    if (!handle) {
      return {
        success: false,
        error:
          "No active Google Ads account connected. Connect via /admin/integrations/google-ads first.",
      };
    }
    const until = new Date();
    const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const range = {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    };

    try {
      const rows = await handle.client.getCampaignMetrics(range);
      const enriched = rows.map((r) => {
        const cost = microsToCurrency(r.costMicros);
        const cpc = r.clicks > 0 ? cost / r.clicks : 0;
        const cpa = r.conversions > 0 ? cost / r.conversions : 0;
        const roas = cost > 0 ? r.conversionsValue / cost : 0;
        return {
          campaignId: r.campaignId,
          name: r.campaignName,
          status: r.status,
          channel: r.advertisingChannelType,
          spend: cost,
          impressions: r.impressions,
          clicks: r.clicks,
          conversions: r.conversions,
          conversionsValue: r.conversionsValue,
          ctr: r.ctr,
          averageCpc: microsToCurrency(r.averageCpc),
          cpc,
          cpa,
          roas,
        };
      });
      const totalSpend = enriched.reduce((s, c) => s + c.spend, 0);
      const totalConversions = enriched.reduce((s, c) => s + c.conversions, 0);
      const totalRevenue = enriched.reduce((s, c) => s + c.conversionsValue, 0);
      return {
        success: true,
        data: {
          customerId: handle.customerId,
          range,
          campaigns: enriched,
          summary: {
            totalSpend,
            totalConversions,
            totalRevenue,
            avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
          },
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

/**
 * Get Search Terms Report — what people actually typed before clicking ads.
 * Used by the keyword-expansion / negative-keyword loops. Phase 1 surfaces
 * candidate adds/negatives only; Phase 3 will act on them automatically.
 */
export const getGoogleAdsSearchTermsTool: AgentTool = {
  name: "getGoogleAdsSearchTerms",
  description:
    "Fetch the Google Ads Search Terms Report (actual user queries). Surfaces zero-conversion terms (negative-keyword candidates) and high-conversion terms (expansion candidates).",
  category: "marketing",
  permissions: ["cmo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "lookbackDays",
      type: "number",
      required: false,
      description: "Days of history (default 30, max 90)",
      default: 30,
    },
    {
      name: "campaignId",
      type: "string",
      required: false,
      description: "Filter to a specific Google Ads campaign ID (digits only)",
    },
    {
      name: "minImpressions",
      type: "number",
      required: false,
      description: "Drop terms with fewer impressions than this (default 50)",
      default: 50,
    },
  ],
  async execute(params, _context): Promise<ToolResult> {
    const lookbackDays = Math.min(Math.max(Number(params.lookbackDays ?? 30), 1), 90);
    const minImpressions = Number(params.minImpressions ?? 50);
    const campaignId = params.campaignId as string | undefined;

    const handle = await getDefaultGoogleAdsClient();
    if (!handle) {
      return { success: false, error: "No active Google Ads account connected." };
    }
    const until = new Date();
    const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const range = {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    };

    try {
      const rows = await handle.client.getSearchTermsReport(range, campaignId);
      const filtered = rows.filter((r) => r.impressions >= minImpressions);
      const enriched = filtered.map((r) => {
        const cost = microsToCurrency(r.costMicros);
        return {
          searchTerm: r.searchTerm,
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          adGroupId: r.adGroupId,
          adGroupName: r.adGroupName,
          status: r.status,
          impressions: r.impressions,
          clicks: r.clicks,
          spend: cost,
          conversions: r.conversions,
          ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
          cpa: r.conversions > 0 ? cost / r.conversions : null,
        };
      });

      const negativeCandidates = enriched
        .filter((r) => r.clicks >= 5 && r.conversions === 0)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 25);
      const expansionCandidates = enriched
        .filter((r) => r.conversions >= 1 && r.status !== "ADDED")
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 25);

      return {
        success: true,
        data: {
          customerId: handle.customerId,
          range,
          totalTerms: enriched.length,
          negativeCandidates,
          expansionCandidates,
          // Hard cap to keep tool output bounded for the LLM.
          allTerms: enriched.slice(0, 200),
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

/**
 * Phase 2: Create a Google Ads campaign DRAFT (RSA + keywords). Writes to
 * `googleAdsCampaignDraft` with status="PENDING_APPROVAL" and files an
 * `agentApproval` row. Nothing is pushed to Google until an admin approves
 * the draft and a separate publish call is made.
 */
export const createGoogleAdsDraftTool: AgentTool = {
  name: "createGoogleAdsDraft",
  description:
    "Generate a Google Ads search campaign draft (15 RSA headlines, 4 descriptions, keywords, negatives) and file it for admin approval. NEVER pushes to Google directly — approval + a separate publish action are required.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist"],
  parameters: [
    {
      name: "prompt",
      type: "string",
      required: true,
      description:
        "Strategy prompt: keyword theme, geography, angle. e.g. 'London emergency lockout, refund-guarantee angle, target homeowners 25-55'",
    },
    {
      name: "dailyBudget",
      type: "number",
      required: false,
      description: "Daily budget in GBP (default 15, hard-capped at 100 in P2)",
      default: 15,
    },
    {
      name: "finalUrl",
      type: "string",
      required: false,
      description: "Landing page URL (default https://locksafe.uk/quote)",
    },
    {
      name: "biddingStrategy",
      type: "string",
      required: false,
      description: "MAXIMIZE_CONVERSIONS (default) or TARGET_CPA",
      default: "MAXIMIZE_CONVERSIONS",
    },
    {
      name: "targetCpa",
      type: "number",
      required: false,
      description: "Target CPA in GBP (only used if biddingStrategy=TARGET_CPA)",
    },
    {
      name: "competitorBrands",
      type: "array",
      required: false,
      description: "Competitor brand names to add as negative keywords",
    },
  ],
  async execute(params, context: AgentContext): Promise<ToolResult> {
    const handle = await getDefaultGoogleAdsClient();
    if (!handle) {
      return {
        success: false,
        error:
          "No active Google Ads account connected. Connect one at /admin/integrations/google-ads first.",
      };
    }

    // Hard caps come from MarketingPolicy (Phase 3). The agent may not exceed
    // the per-campaign cap regardless of what was passed in.
    const policy = await getEffectivePolicy("google");
    const requestedBudget = Number(params.dailyBudget ?? 15);
    if (!Number.isFinite(requestedBudget) || requestedBudget <= 0) {
      return { success: false, error: "dailyBudget must be a positive number" };
    }
    if (requestedBudget > policy.maxCampaignDailyBudget) {
      return {
        success: false,
        error: `dailyBudget £${requestedBudget} exceeds per-campaign cap £${policy.maxCampaignDailyBudget}/day. Raise MarketingPolicy.maxCampaignDailyBudget or lower the request.`,
      };
    }

    const biddingStrategy =
      String(params.biddingStrategy || "MAXIMIZE_CONVERSIONS").toUpperCase() === "TARGET_CPA"
        ? "TARGET_CPA"
        : "MAXIMIZE_CONVERSIONS";
    const targetCpa =
      biddingStrategy === "TARGET_CPA"
        ? Number(params.targetCpa) || null
        : null;
    if (biddingStrategy === "TARGET_CPA" && (!targetCpa || targetCpa <= 0)) {
      return {
        success: false,
        error: "targetCpa is required and must be > 0 when biddingStrategy=TARGET_CPA",
      };
    }

    const competitorBrands = Array.isArray(params.competitorBrands)
      ? (params.competitorBrands as unknown[]).map((c) => String(c))
      : [];

    let plan;
    try {
      plan = await generateGoogleAdsDraftPlan({
        prompt: String(params.prompt),
        finalUrl: params.finalUrl ? String(params.finalUrl) : undefined,
        recommendedDailyBudget: requestedBudget,
        competitorBrands,
      });
    } catch (err) {
      return {
        success: false,
        error: `Plan generation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Use the LLM's recommended budget but never exceed the user-specified
    // requestedBudget (hard cap from the agent's own parameters).
    const dailyBudget = Math.min(plan.recommendedDailyBudget, requestedBudget);

    const draft = await prisma.googleAdsCampaignDraft.create({
      data: {
        accountId: handle.accountId,
        status: "PENDING_APPROVAL",
        name: plan.campaignName,
        dailyBudget,
        biddingStrategy,
        targetCpa,
        channel: "SEARCH",
        geoTargets: ["2826"], // UK
        languageTargets: ["1000"], // English
        headlines: plan.headlines,
        descriptions: plan.descriptions,
        finalUrl: plan.finalUrl,
        keywords: plan.keywords as unknown as object,
        negativeKeywords: plan.negativeKeywords,
        aiGenerated: true,
        aiPrompt: String(params.prompt).slice(0, 2000),
        aiReasoning: plan.reasoning,
        agentId: context?.agentId,
      },
    });

    // File approval row (only if we have a context agentId — admins running
    // this tool directly skip the approval flow).
    let approvalId: string | null = null;
    if (context?.agentId) {
      // Ensure we have an execution row to anchor the approval FK on.
      let executionId = context.executionId;
      if (!executionId) {
        const exec = await prisma.agentExecution.create({
          data: {
            agentId: context.agentId,
            traceId: `tool_createGoogleAdsDraft_${Date.now()}`,
            actionType: "tool_call",
            actionName: "createGoogleAdsDraft",
            input: JSON.stringify({ draftId: draft.id }).slice(0, 4000),
            status: "success",
            tokensUsed: 0,
            costUsd: 0,
            requiresApproval: true,
            completedAt: new Date(),
          },
        });
        executionId = exec.id;
      }

      const approval = await prisma.agentApproval.create({
        data: {
          agentId: context.agentId,
          executionId,
          actionType: "publish_google_ads_draft",
          actionDetails: JSON.stringify({
            draftId: draft.id,
            campaignName: plan.campaignName,
            dailyBudget,
            biddingStrategy,
            targetCpa,
            headlinesPreview: plan.headlines.slice(0, 3),
            keywordCount: plan.keywords.length,
            negativeCount: plan.negativeKeywords.length,
            finalUrl: plan.finalUrl,
            reasoning: plan.reasoning,
          }).slice(0, 8000),
          reason: `New AI-generated Google Ads campaign "${plan.campaignName}" — £${dailyBudget}/day, ${plan.keywords.length} keywords. Review at /admin/integrations/google-ads/drafts/${draft.id} before publishing.`,
          targetType: "google_ads_draft",
          targetId: draft.id,
          status: "pending",
        },
      });
      approvalId = approval.id;
      await prisma.googleAdsCampaignDraft.update({
        where: { id: draft.id },
        data: { approvalId },
      });

      // Phase 3 auto-approve: if policy permits, resolve the approval row
      // immediately and flip the draft to APPROVED so a follow-up auto-publish
      // step (CMO heartbeat) can take over without human input. Anything
      // outside the auto-approve envelope stays PENDING_APPROVAL for review.
      const guard = await checkAutoAction({
        platform: "google",
        action: "auto_approve_draft",
        proposedDailyBudget: dailyBudget,
        initiator: "agent",
      });
      if (guard.allowed) {
        await prisma.agentApproval.update({
          where: { id: approval.id },
          data: {
            status: "approved",
            resolvedAt: new Date(),
            resolvedBy: "system:auto-approve",
            resolution: `Auto-approved under policy (today £${guard.spendUsed.today.toFixed(2)} / cap £${guard.policy.maxDailySpend}, max-budget £${guard.policy.autoApproveMaxBudget}/day).`,
          },
        });
        await prisma.googleAdsCampaignDraft.update({
          where: { id: draft.id },
          data: {
            status: "APPROVED",
            approvedBy: "system:auto-approve",
            approvedAt: new Date(),
          },
        });
      }
    }

    return {
      success: true,
      data: {
        draftId: draft.id,
        approvalId,
        status: draft.status,
        campaignName: plan.campaignName,
        dailyBudget,
        biddingStrategy,
        headlines: plan.headlines,
        descriptions: plan.descriptions,
        keywordCount: plan.keywords.length,
        negativeKeywordCount: plan.negativeKeywords.length,
        finalUrl: plan.finalUrl,
        reasoning: plan.reasoning,
        reviewUrl: `/admin/integrations/google-ads/drafts/${draft.id}`,
      },
    };
  },
};

/**
 * List Google Ads drafts (pending approval, approved, published, failed).
 * Read-only — used by CMO heartbeat to inspect outstanding work.
 */
export const listGoogleAdsDraftsTool: AgentTool = {
  name: "listGoogleAdsDrafts",
  description:
    "List Google Ads campaign drafts. Filter by status (PENDING_APPROVAL, APPROVED, PUBLISHED, PAUSED, FAILED). Returns up to 50 most-recent drafts.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist", "analyst"],
  parameters: [
    {
      name: "status",
      type: "string",
      required: false,
      description: "Filter by status (case-insensitive). Omit for all.",
    },
  ],
  async execute(params, _context): Promise<ToolResult> {
    const status = params.status ? String(params.status).toUpperCase() : undefined;
    const drafts = await prisma.googleAdsCampaignDraft.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        name: true,
        dailyBudget: true,
        biddingStrategy: true,
        googleCampaignId: true,
        totalSpend: true,
        totalConversions: true,
        totalRevenue: true,
        publishedAt: true,
        publishError: true,
        createdAt: true,
      },
    });
    return {
      success: true,
      data: {
        count: drafts.length,
        drafts,
      },
    };
  },
};

/**
 * Phase 3: optimiseGoogleCampaigns. The maintenance loop.
 *
 * Scans the Search Terms Report for the past `lookbackDays` and:
 *   1. Adds wasteful queries (≥5 clicks, 0 conversions) as campaign-level
 *      negative keywords. Only mutates if spend-guard allows.
 *   2. Pauses campaigns whose ROAS has been below `pauseRoasThreshold` for
 *      `pauseGraceDays` consecutive days AND impressions ≥ `minImpressionsForPause`.
 *
 * All actions are spend-guard-gated. Returns a structured summary the CMO
 * can include in its Telegram report.
 */
export const optimiseGoogleCampaignsTool: AgentTool = {
  name: "optimiseGoogleCampaigns",
  description:
    "Phase 3 maintenance loop. Adds zero-conversion search terms as negative keywords and pauses persistently-underperforming campaigns under MarketingPolicy thresholds. Spend-guard-gated.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist"],
  parameters: [
    {
      name: "lookbackDays",
      type: "number",
      required: false,
      description: "Days of search-term history to analyse (default 14, max 30)",
      default: 14,
    },
    {
      name: "dryRun",
      type: "boolean",
      required: false,
      description: "If true, log what would change but do not mutate",
      default: false,
    },
  ],
  async execute(params, _context): Promise<ToolResult> {
    const { GoogleAdsClient: _unused1 } = await import("@/lib/google-ads");
    const { buildResourceName } = await import("@/lib/google-ads");
    const lookbackDays = Math.min(Math.max(Number(params.lookbackDays ?? 14), 1), 30);
    const dryRun = Boolean(params.dryRun);

    const handle = await getDefaultGoogleAdsClient();
    if (!handle) {
      return { success: false, error: "No active Google Ads account connected." };
    }

    const policy = await getEffectivePolicy("google");
    if (!policy.autonomyEnabled && !dryRun) {
      return {
        success: false,
        error: "Autonomy disabled for google. Run in dryRun=true mode or enable at /admin/agents/policy.",
      };
    }

    const until = new Date();
    const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const range = {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    };

    // --- 1. Negative-keyword expansion ---
    const searchTerms = await handle.client.getSearchTermsReport(range);
    const negativeCandidates = searchTerms
      .filter((t) => t.clicks >= 5 && t.conversions === 0 && t.status !== "EXCLUDED")
      .map((t) => ({
        text: t.searchTerm.toLowerCase().trim(),
        campaignId: t.campaignId,
        wastedSpend: microsToCurrency(t.costMicros),
      }))
      .filter((t) => t.text.length > 0 && t.text.length <= 80)
      .slice(0, 20);

    const negativesAdded: Array<{ campaignId: string; text: string; wasted: number }> = [];
    if (!dryRun && negativeCandidates.length > 0) {
      const byCampaign = new Map<string, typeof negativeCandidates>();
      for (const n of negativeCandidates) {
        const arr = byCampaign.get(n.campaignId) ?? [];
        arr.push(n);
        byCampaign.set(n.campaignId, arr);
      }
      for (const [cid, items] of byCampaign) {
        const ops = items.map((n) => ({
          create: {
            campaign: buildResourceName(handle.customerId, "campaigns", cid),
            negative: true,
            keyword: { text: n.text, matchType: "BROAD" },
          },
        }));
        try {
          await handle.client.mutate("campaignCriteria", ops);
          for (const i of items) {
            negativesAdded.push({ campaignId: cid, text: i.text, wasted: i.wastedSpend });
          }
        } catch (err) {
          console.error(`[optimise] failed adding negatives to campaign ${cid}:`, err);
        }
      }
    }

    // --- 2. Pause persistently-underperforming campaigns ---
    const lookbackForPause = Math.max(policy.pauseGraceDays, 3);
    const pauseSince = new Date(
      Date.UTC(
        until.getUTCFullYear(),
        until.getUTCMonth(),
        until.getUTCDate() - lookbackForPause,
      ),
    );
    const recentSnaps = await prisma.adPerformanceSnapshot.findMany({
      where: {
        platform: "google",
        date: { gte: pauseSince },
      },
      select: {
        googleCampaignId: true,
        date: true,
        spend: true,
        revenue: true,
        impressions: true,
      },
    });
    // Aggregate per campaign across the grace window.
    const perCampaign = new Map<
      string,
      { spend: number; revenue: number; impressions: number; days: number }
    >();
    for (const s of recentSnaps) {
      if (!s.googleCampaignId) continue;
      const acc = perCampaign.get(s.googleCampaignId) ?? {
        spend: 0,
        revenue: 0,
        impressions: 0,
        days: 0,
      };
      acc.spend += s.spend;
      acc.revenue += s.revenue;
      acc.impressions += s.impressions;
      acc.days += 1;
      perCampaign.set(s.googleCampaignId, acc);
    }

    const pauseCandidates: Array<{
      campaignId: string;
      roas: number;
      spend: number;
      impressions: number;
      days: number;
    }> = [];
    for (const [cid, agg] of perCampaign) {
      if (agg.days < policy.pauseGraceDays) continue;
      if (agg.impressions < policy.minImpressionsForPause) continue;
      const roas = agg.spend > 0 ? agg.revenue / agg.spend : 0;
      if (roas < policy.pauseRoasThreshold) {
        pauseCandidates.push({
          campaignId: cid,
          roas,
          spend: agg.spend,
          impressions: agg.impressions,
          days: agg.days,
        });
      }
    }

    const paused: typeof pauseCandidates = [];
    if (!dryRun) {
      for (const cand of pauseCandidates) {
        try {
          const resourceName = buildResourceName(
            handle.customerId,
            "campaigns",
            cand.campaignId,
          );
          await handle.client.mutate("campaigns", [
            {
              update: { resourceName, status: "PAUSED" },
              updateMask: "status",
            },
          ]);
          // Reflect on the draft row if we own it.
          await prisma.googleAdsCampaignDraft.updateMany({
            where: { googleCampaignId: cand.campaignId },
            data: { status: "PAUSED", pausedAt: new Date() },
          });
          paused.push(cand);
        } catch (err) {
          console.error(`[optimise] failed pausing campaign ${cand.campaignId}:`, err);
        }
      }
    }

    return {
      success: true,
      data: {
        dryRun,
        range,
        policy: {
          pauseRoasThreshold: policy.pauseRoasThreshold,
          pauseGraceDays: policy.pauseGraceDays,
          minImpressionsForPause: policy.minImpressionsForPause,
        },
        negatives: {
          candidatesFound: negativeCandidates.length,
          added: negativesAdded.length,
          details: dryRun ? negativeCandidates.slice(0, 20) : negativesAdded,
        },
        paused: {
          candidatesFound: pauseCandidates.length,
          actuallyPaused: paused.length,
          details: dryRun ? pauseCandidates : paused,
        },
      },
    };
  },
};

/**
 * Phase D: launchAcquisitionEngine
 *
 * One-shot CMO action: drafts a complete catalog-driven Meta campaign
 * (campaign + 2 adsets + 4 DR ad variants per slug per adset) and files an
 * approval request. The actual publish to Meta happens through the existing
 * /api/admin/ads/[id]/publish route once approved.
 */
export const launchAcquisitionEngineTool: AgentTool = {
  name: "launchAcquisitionEngine",
  description:
    "Draft a complete catalog-backed Meta campaign with prospecting + retargeting adsets, 4 DR copy variants per service, and file an approval request.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist"],
  parameters: [
    {
      name: "slugs",
      type: "array",
      required: true,
      description: "Service catalog slugs to target (e.g. ['locked-out','emergency-locksmith'])",
    },
    {
      name: "dailyBudget",
      type: "number",
      required: true,
      description: "Total daily campaign budget in GBP (split across both adsets).",
    },
    {
      name: "durationDays",
      type: "number",
      required: false,
      description: "How many days to run (1–90). Default 14.",
      default: 14,
    },
    {
      name: "city",
      type: "string",
      required: false,
      description: "Optional UK city for hyper-local copy.",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const slugsRaw = Array.isArray(params.slugs) ? (params.slugs as unknown[]) : [];
    const slugs = slugsRaw.filter((s): s is string => typeof s === "string" && isServiceSlug(s));
    const dailyBudget = Number(params.dailyBudget);
    const durationDays = Number.isFinite(params.durationDays as number)
      ? Math.min(Math.max(Number(params.durationDays), 1), 90)
      : 14;
    const city = typeof params.city === "string" ? params.city : undefined;

    if (slugs.length === 0) {
      return { success: false, error: "Provide at least one valid service slug." };
    }
    if (!Number.isFinite(dailyBudget) || dailyBudget < 1) {
      return { success: false, error: "dailyBudget must be a number ≥ £1." };
    }

    // Spend-guard pre-check (the launch route also gates at publish time, but
    // this short-circuits the agent loop before running the OpenAI bill).
    const guard = await checkAutoAction({
      platform: "meta",
      action: "publish_draft",
      proposedDailyBudget: dailyBudget,
      initiator: "agent",
    });
    if (!guard.allowed) {
      return { success: false, error: `spend-guard blocked: ${guard.reason}` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";
    const url = `${baseUrl}/api/admin/ads/launch-catalog-campaign`;

    // The launch route enforces admin auth via cookies, but agents call this
    // server-side with the AGENT_API_KEY shared secret. We call it through
    // the internal handler directly to avoid an HTTP round-trip + auth dance.
    // NOTE: importing the route handler keeps types clean and skips fetch.
    const { POST: launch } = await import(
      "@/app/api/admin/ads/launch-catalog-campaign/route"
    );

    // Build a minimal Request (the route reads cookies for admin auth, which
    // we bypass by setting initiator='agent'; auth still required, so we use
    // a synthetic admin cookie generated from AGENT_API_KEY -> JWT.
    // For now, the agent invokes through HTTP to keep the auth path uniform.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Internal agent header — the launch route accepts admin cookies; for
        // server-side agent calls we rely on a tightly-scoped service token
        // mediated by middleware. If your middleware does not support this
        // header yet, call this tool from an admin-authenticated session.
        "x-agent-key": process.env.AGENT_API_KEY ?? "",
      },
      body: JSON.stringify({
        slugs,
        dailyBudget,
        durationDays,
        city,
        requestApproval: true,
        initiator: "agent",
      }),
    }).catch((err) => ({ ok: false, status: 500, json: async () => ({ error: String(err) }) }) as Response);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: (body as { error?: string }).error ?? `launch failed: HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      campaignId: string;
      adsets: Array<{ id: string; mode: string }>;
      approvalId: string | null;
      summary: { slugs: string[]; dailyBudget: number; durationDays: number; totalAds: number };
    };

    return {
      success: true,
      data: {
        campaignId: data.campaignId,
        adsets: data.adsets,
        approvalId: data.approvalId,
        summary: data.summary,
        message: `Drafted £${dailyBudget}/day campaign covering ${slugs.length} service(s), ${data.summary.totalAds} ad variants. Approval pending at /admin/agents/approvals.`,
      },
      tokensUsed: 4 * slugs.length * 600, // approx — copywriter is the cost driver
      costUsd: 4 * slugs.length * 0.012,
    };
  },
};

/**
 * Phase C: optimiseMetaCampaigns — closed-loop maintenance for Meta ads.
 * Mirrors `optimiseGoogleCampaigns` but for Meta. Honours `MarketingPolicy(meta)`
 * and the spend guard. Always safe to call: defaults to dry-run when autonomy
 * is off so the heartbeat can still produce a Telegram digest.
 */
export const optimiseMetaCampaignsTool: AgentTool = {
  name: "optimiseMetaCampaigns",
  description:
    "Scan recent Meta ad performance and propose (or execute) pause/scale/rotate actions, gated by MarketingPolicy.",
  category: "marketing",
  permissions: ["cmo", "ads-specialist"],
  parameters: [
    {
      name: "lookbackDays",
      type: "number",
      required: false,
      description: "How many days of snapshots to consider. Default 7.",
      default: 7,
    },
    {
      name: "dryRun",
      type: "boolean",
      required: false,
      description: "When true, persists decisions without touching Meta or DB campaign state.",
      default: true,
    },
  ],
  async execute(params, _context): Promise<ToolResult> {
    const lookbackDays = Number.isFinite(params.lookbackDays as number)
      ? Number(params.lookbackDays)
      : 7;
    const dryRun = params.dryRun !== false;

    try {
      const result = await optimiseMetaCampaigns({ lookbackDays, dryRun });
      return {
        success: true,
        data: {
          dryRun: result.dryRun,
          proposed: result.decisions.length,
          executed: result.executed,
          blocked: result.blocked,
          errors: result.errors,
          decisions: result.decisions.map((d) => ({
            action: d.action,
            target: `${d.targetType}:${d.targetId}`,
            reason: d.reason,
          })),
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
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
  getGoogleAdsCampaignsTool,
  getGoogleAdsSearchTermsTool,
  createGoogleAdsDraftTool,
  listGoogleAdsDraftsTool,
  optimiseGoogleCampaignsTool,
  launchAcquisitionEngineTool,
  optimiseMetaCampaignsTool,
];
