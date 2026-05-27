/**
 * Social Media Subagent
 *
 * Generates platform-specific social content for all 5 platforms:
 * Instagram, Facebook, Twitter/X, LinkedIn, TikTok (scripts only)
 *
 * Reports to: CMO Agent
 * Heartbeat: Daily at 5am (alongside Copywriter)
 * Budget: $15/month (near-zero with Ollama)
 */

import prisma from "@/lib/db";
import { SocialPlatform } from "@prisma/client";
import { chat, Models, estimateLLMCost } from "@/lib/llm-router";
import { recordCost } from "@/agents/core/budget";
import { sendAdminAlert } from "@/lib/telegram";
import { getOperationalPolicy, shouldEmitAlert } from "@/agents/core/operational-policy";
import { generateTikTokScript } from "@/lib/tiktok";
import { generateSocialVideo } from "@/lib/creatomate";
import type { AgentConfig } from "@/agents/core/types";

export const SOCIAL_MEDIA_AGENT_CONFIG: AgentConfig = {
  name: "social-media",
  displayName: "Social Media Agent",
  role: "Multi-platform content generation and scheduling",
  skillsPath: "cmo/subagents/social-media/SKILL.md",
  monthlyBudgetUsd: 15,
  heartbeatCronExpr: "0 5 * * *",
  permissions: ["create_content", "schedule_posts"],
  governanceLevel: "autonomous",
};

// ─── Content Pillars ─────────────────────────────────────────────────────────

const CONTENT_PILLARS = [
  { name: "security-tips",   days: [1, 4] }, // Mon, Thu
  { name: "success-stories", days: [2, 5] }, // Tue, Fri
  { name: "trust-signals",   days: [3]    }, // Wed
  { name: "behind-scenes",   days: [6]    }, // Sat
  { name: "engagement",      days: [0]    }, // Sun
] as const;

type ContentPillar = typeof CONTENT_PILLARS[number]["name"];

// Posting slot: 4 PM UK (BST = UTC+1 in summer) → 15:00 UTC
const POSTING_SLOTS = ["15:00"];

// ─── Agent Init ───────────────────────────────────────────────────────────────

export async function initializeSocialMediaAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({ where: { name: "social-media" } });
  const cmo = await prisma.agent.findUnique({ where: { name: "cmo" } });

  const data = {
    displayName: SOCIAL_MEDIA_AGENT_CONFIG.displayName,
    role: SOCIAL_MEDIA_AGENT_CONFIG.role,
    skillsPath: SOCIAL_MEDIA_AGENT_CONFIG.skillsPath,
    monthlyBudgetUsd: SOCIAL_MEDIA_AGENT_CONFIG.monthlyBudgetUsd,
    heartbeatCronExpr: SOCIAL_MEDIA_AGENT_CONFIG.heartbeatCronExpr,
    permissions: SOCIAL_MEDIA_AGENT_CONFIG.permissions,
    governanceLevel: SOCIAL_MEDIA_AGENT_CONFIG.governanceLevel,
    parentAgentId: cmo?.id,
    status: "active",
  };

  if (existing) {
    await prisma.agent.update({ where: { name: "social-media" }, data });
    console.log("[SocialMedia] Agent config updated");
    return;
  }

  await prisma.agent.create({ data: { name: "social-media", ...data } });
  console.log("[SocialMedia] Agent created");
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export async function runSocialMediaHeartbeat(): Promise<void> {
  console.log("[SocialMedia] Starting heartbeat...");

  const markHeartbeat = async () => {
    await prisma.agent.update({
      where: { name: "social-media" },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});
  };

  const autopilot = await prisma.autopilotConfig.findFirst();
  if (!autopilot?.isEnabled) {
    console.log("[SocialMedia] AutopilotConfig disabled or not seeded — skipping");
    await markHeartbeat();
    return;
  }

  // Skip if posts already generated for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const existingToday = await prisma.socialPost.count({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      aiGenerated: true,
      contentPillar: { not: null },
    },
  });

  if (existingToday >= 3) {
    console.log(`[SocialMedia] ${existingToday} posts already generated today — skipping`);
    await markHeartbeat();
    return;
  }

  const pillar = getTodaysPillar();
  const activeAccounts = await prisma.socialAccount.findMany({ where: { isActive: true } });

  if (!activeAccounts.length) {
    console.log("[SocialMedia] No active social accounts configured");
    await markHeartbeat();
    return;
  }

  const activePlatforms = [...new Set(activeAccounts.map((a) => a.platform))];
  console.log(`[SocialMedia] Generating for pillar: ${pillar}, platforms: ${activePlatforms.join(", ")}`);

  // Get recent completed jobs for success story content
  const recentJobs = await prisma.job.findMany({
    where: { status: "COMPLETED", updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { problemType: true, postcode: true, updatedAt: true },
    take: 5,
    orderBy: { updatedAt: "desc" },
  });

  let postsCreated = 0;
  const errors: string[] = [];

  for (let slotIndex = 0; slotIndex < POSTING_SLOTS.length; slotIndex++) {
    const slot = POSTING_SLOTS[slotIndex];
    const scheduledFor = getScheduledTime(today, slot);

    // Skip if this slot already has a post scheduled
    const slotConflict = await prisma.socialPost.count({
      where: {
        scheduledFor: { gte: scheduledFor, lt: new Date(scheduledFor.getTime() + 3_600_000) },
      },
    });
    if (slotConflict > 0) continue;

    try {
      const content = await generateContentSet(pillar, slotIndex, recentJobs, activePlatforms);

      // ── Video generation (non-blocking, non-fatal) ────────────────────────
      // Generates a 15s branded Reel/TikTok video via Creatomate.
      // Only runs when CREATOMATE_API_KEY is set — silently skips otherwise.
      let videoUrl: string | null = null;
      try {
        const video = await generateSocialVideo({
          headline: content.title,
          subtext: content.facebook.split("\n")[0]?.slice(0, 120) ?? undefined,
          pillar,
          format: "vertical",
          durationSeconds: 15,
        });
        videoUrl = video?.url ?? null;
        if (videoUrl) console.log(`[SocialMedia] 🎬 Video generated: ${videoUrl}`);
      } catch {
        // video errors never block the post
      }

      await prisma.socialPost.create({
        data: {
          content: content.facebook,        // base content (Facebook copy)
          instagramContent: content.instagram,
          facebookContent: content.facebook,
          twitterContent: content.twitter,
          linkedinContent: content.linkedin,
          twitterThreadParts: content.twitterThread ?? [],
          tiktokScript: content.tiktokScript ? JSON.stringify(content.tiktokScript) : null,
          platforms: activePlatforms as SocialPlatform[],
          status: autopilot.requireApproval ? "PENDING_APPROVAL" : "SCHEDULED",
          scheduledFor,
          contentPillar: pillar,
          aiFramework: content.framework,
          source: "social-media-agent",
          aiGenerated: true,
          imagePrompt: content.imagePrompt ?? null,
          headline: content.title,
          videoUrl,
        },
      });

      postsCreated++;
      console.log(`[SocialMedia] Scheduled post for ${slot}: ${content.title}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Slot ${slot}: ${msg}`);
      console.error(`[SocialMedia] Failed slot ${slot}:`, msg);
    }
  }

  // Record LLM cost (near-zero with Ollama)
  const cost = estimateLLMCost("CONTENT", postsCreated * 800);
  await recordCost("social-media", cost, `Generated ${postsCreated} social posts`);

  // Send Telegram summary only when policy allows low/info non-guardian alerts.
  if (postsCreated > 0) {
    const policy = await getOperationalPolicy();
    if (shouldEmitAlert("social-media", "info", policy.alertSensitivity)) {
      await sendAdminAlert({
        title: `📱 Social Posts Scheduled`,
        message: `${postsCreated} posts generated for today's ${pillar} pillar.\nPlatforms: ${activePlatforms.join(", ")}\nSlots: ${POSTING_SLOTS.slice(0, postsCreated).join(", ")} UK time`,
        severity: "info",
      });
    }
  }

  if (errors.length) {
    console.error("[SocialMedia] Errors:", errors);
  }

  // Update agent lastHeartbeat
  await markHeartbeat();

  console.log(`[SocialMedia] Heartbeat complete: ${postsCreated} posts created`);
}

// ─── Content Generation ───────────────────────────────────────────────────────

interface ContentSet {
  title: string;
  facebook: string;
  instagram: string;
  twitter: string;
  twitterThread?: string[];
  linkedin: string;
  tiktokScript?: object;
  framework: string;
  imagePrompt?: string;
}

const FRAMEWORKS = ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"];

async function generateContentSet(
  pillar: ContentPillar,
  slotIndex: number,
  recentJobs: Array<{ problemType: string; postcode: string | null; updatedAt: Date }>,
  platforms: SocialPlatform[]
): Promise<ContentSet> {
  const framework = FRAMEWORKS[slotIndex % FRAMEWORKS.length];

  const jobContext = recentJobs.length > 0
    ? `Recent jobs for context (use for success stories, anonymise locations):
${recentJobs.map((j) => `- ${j.problemType} in ${j.postcode?.slice(0, 3) ?? "UK"} area`).join("\n")}`
    : "";

  const systemPrompt = `You are the Social Media Agent for LockSafe UK — a vetted locksmith platform.
Generate platform-specific content using the ${framework} framework.
Brand voice: reassuring, expert, local UK. Use British English. Never fear-monger.
Content pillar: ${pillar}
${jobContext}

Respond with valid JSON:
{
  "title": "short internal title for this post set",
  "facebook": "facebook post (200-300 chars, 1-3 emoji, 5-8 hashtags)",
  "instagram": "instagram caption (100-150 chars, energetic, 20-30 hashtags)",
  "twitter": "single tweet (max 270 chars, 2-3 hashtags)",
  "twitterThread": ["tweet 1 (hook)", "tweet 2 (body)", "tweet 3 (cta)"] or null,
  "linkedin": "professional post (400-600 chars, no hashtag spam, thought leadership tone)",
  "imagePrompt": "DALL-E prompt for a supporting image (describe scene, style: photorealistic, no text)",
  "framework": "${framework}"
}`;

  const userPrompt = `Slot ${slotIndex + 1} of 3 today. Create content for: ${pillar.replace("-", " ")}`;

  const response = await chat(Models.CONTENT, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { responseFormat: "json", temperature: 0.75, maxTokens: 1200 });

  const parsed = JSON.parse(response.content) as ContentSet;

  // Generate TikTok script for the first slot of the day
  if (slotIndex === 0 && platforms.includes(SocialPlatform.TIKTOK)) {
    try {
      const tiktok = await generateTikTokScript(parsed.title, pillar);
      parsed.tiktokScript = tiktok;
    } catch {
      // Non-critical — TikTok script generation is best-effort
    }
  }

  return parsed;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodaysPillar(): ContentPillar {
  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const match = CONTENT_PILLARS.find((p) => (p.days as readonly number[]).includes(dayOfWeek));
  return match?.name ?? "security-tips";
}

function getScheduledTime(baseDate: Date, slot: string): Date {
  const [hour, minute] = slot.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function getSocialMediaStatus() {
  const agent = await prisma.agent.findUnique({ where: { name: "social-media" } });
  const scheduledCount = await prisma.socialPost.count({ where: { status: "SCHEDULED" } });
  const pendingCount   = await prisma.socialPost.count({ where: { status: "PENDING_APPROVAL" } });
  const publishedToday = await prisma.socialPost.count({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: new Date(Date.now() - 86_400_000) },
    },
  });

  return {
    agentStatus: agent?.status ?? "not_seeded",
    lastHeartbeat: agent?.lastHeartbeat,
    budgetUsed: agent?.budgetUsedUsd ?? 0,
    scheduledPosts: scheduledCount,
    pendingApproval: pendingCount,
    publishedToday,
  };
}
