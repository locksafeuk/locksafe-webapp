/**
 * Cron Job: /api/cron/generate-organic
 *
 * Automatically generates organic content using AI.
 * Runs daily to ensure there's always content in the pipeline.
 *
 * Vercel Cron syntax: Run daily at 6 AM UTC
 * 0 6 * * *
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  generateOrganicPost,
  generateContentCalendar,
  CONTENT_PILLARS,
  type ContentPillarKey,
} from "@/lib/organic-content";
import { filterEnabledPlatforms } from "@/lib/social-platforms";

async function verifyAccess(request: NextRequest): Promise<boolean> {
  if (verifyCronAuth(request)) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "admin") return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron call or admin request
  const hasAccess = await verifyAccess(request);
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Check autopilot configuration
    let config = await prisma.autopilotConfig.findFirst();

    // Create default config if doesn't exist
    if (!config) {
      config = await prisma.autopilotConfig.create({
        data: {
          isEnabled: false, // Disabled by default
          postsPerDay: 1,
          generateAheadDays: 3,
          requireApproval: false,
          publishToFacebook: true,
          publishToInstagram: false,
          publishTimes: {
            monday: ["15:00"],
            tuesday: ["15:00"],
            wednesday: ["15:00"],
            thursday: ["15:00"],
            friday: ["15:00"],
            saturday: ["15:00"],
            sunday: ["15:00"],
          },
          pillarWeights: {},
          preferredFrameworks: ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
          emotionalAngleRotation: ["trust", "urgency", "control", "benefit", "curiosity"],
        },
      });
    }

    // Manual triggers require both an admin cookie AND ?force=true to avoid
    // accidental OpenAI spend from casual admin page visits.
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
    const isManualTrigger = !!token && request.nextUrl.searchParams.get("force") === "true";

    // Check if autopilot is enabled (only for automated cron, not manual)
    if (!config.isEnabled && !isManualTrigger) {
      return NextResponse.json({
        success: true,
        message: "Autopilot is disabled",
        generated: 0,
      });
    }

    // Build the content calendar from the admin-configured cadence. The
    // calendar itself is now the source of truth for how many posts we want
    // (publishTimes can vary the count per weekday); postsPerDay is the
    // per-day fallback for any weekday without configured times.
    const daysAhead = config.generateAheadDays;
    const calendar = generateContentCalendar(new Date(), daysAhead, {
      postsPerDay: config.postsPerDay,
      publishTimes: (config.publishTimes as Record<string, string[]> | null) ?? undefined,
    });
    const targetPosts = calendar.length;

    // Count existing pending/scheduled posts
    const existingPosts = await prisma.socialPost.count({
      where: {
        status: {
          in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED"],
        },
        scheduledFor: {
          gte: new Date(),
        },
      },
    });

    const postsNeeded = Math.max(0, targetPosts - existingPosts);

    if (postsNeeded === 0) {
      return NextResponse.json({
        success: true,
        message: "Content pipeline is full",
        existing: existingPosts,
        target: targetPosts,
        generated: 0,
      });
    }

    // Get or create pillars in DB
    const pillarMap = new Map<string, string>();
    for (const [key, pillarData] of Object.entries(CONTENT_PILLARS)) {
      let pillar = await prisma.contentPillar.findFirst({
        where: { name: key },
      });

      if (!pillar) {
        pillar = await prisma.contentPillar.create({
          data: {
            name: pillarData.name,
            displayName: pillarData.displayName,
            description: pillarData.description,
            color: pillarData.color,
            icon: pillarData.icon,
            toneGuidelines: [...pillarData.toneGuidelines],
            topicExamples: [...pillarData.topicExamples],
            hashtags: [...pillarData.hashtags],
            postsPerWeek: pillarData.postsPerWeek,
          },
        });
      }

      pillarMap.set(key, pillar.id);
    }

    // Generate posts for each calendar slot
    const frameworks = config.preferredFrameworks as string[];
    const angles = config.emotionalAngleRotation as string[];
    const generatedPosts: string[] = [];
    let postIndex = 0;

    for (const slot of calendar.slice(0, postsNeeded)) {
      try {
        const framework = frameworks[postIndex % frameworks.length] as 'justin-welsh' | 'russell-brunson' | 'nicholas-cole' | 'simon-sinek';
        const angle = angles[postIndex % angles.length] as 'trust' | 'urgency' | 'control' | 'benefit' | 'curiosity';

        // Generate content
        const posts = await generateOrganicPost({
          pillar: slot.pillar,
          framework,
          emotionalAngle: angle,
          includeCallToAction: postIndex % 2 === 0,
        });

        if (posts.length > 0) {
          const post = posts[0];

          // Calculate scheduled time
          const scheduledDate = new Date(slot.date);
          const [hours, minutes] = slot.time.split(":").map(Number);
          scheduledDate.setHours(hours, minutes, 0, 0);

          // Determine platforms from active social accounts
          const activeAccounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
          const activePlatforms = [...new Set(activeAccounts.map((a) => a.platform))] as ("FACEBOOK" | "INSTAGRAM" | "TWITTER" | "LINKEDIN" | "TIKTOK")[];
          // If no accounts connected yet, fall back to config flags.
          // Disabled platforms (e.g. Instagram — see @/lib/social-platforms)
          // are filtered out centrally so re-enabling is a single flag flip.
          const platforms = activePlatforms.length > 0
            ? filterEnabledPlatforms(activePlatforms)
            : ([] as typeof activePlatforms).concat(
                config.publishToFacebook ? ["FACEBOOK"] : [],
              );

          // Create post in database
          const savedPost = await prisma.socialPost.create({
            data: {
              content: post.content,
              headline: post.headline,
              hook: post.hook,
              hookType: post.hookType,
              pillarId: pillarMap.get(slot.pillar),
              hashtags: post.hashtags,
              platforms,
              aiGenerated: true,
              aiPrompt: `Auto-generated for ${slot.pillar} pillar on ${slot.date.toISOString().split("T")[0]}`,
              aiFramework: post.framework,
              emotionalAngle: post.emotionalAngle,
              status: config.requireApproval ? "PENDING_APPROVAL" : "SCHEDULED",
              scheduledFor: scheduledDate,
            },
          });

          generatedPosts.push(savedPost.id);
        }

        postIndex++;
      } catch (error) {
        console.error(`Error generating post for ${slot.pillar}:`, error);
        // Continue with next slot
      }
    }

    // Send notification if configured
    if (config.notifyOnGeneration && config.notificationEmail && generatedPosts.length > 0) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
        await resend.emails.send({
          from: "LockSafe Agents <agents@locksafe.uk>",
          to: config.notificationEmail,
          subject: `${generatedPosts.length} social posts generated${config.requireApproval ? " — awaiting approval" : " — auto-scheduled"}`,
          html: `<p>${generatedPosts.length} organic posts have been generated and ${config.requireApproval ? "are awaiting your approval" : "are automatically scheduled"}.</p>
<p><a href="${baseUrl}/admin/social">Review in Social Media Queue →</a></p>`,
        });
        console.log(`[generate-organic] Notification sent to ${config.notificationEmail}`);
      } catch (emailErr) {
        console.error("[generate-organic] Email notification failed:", emailErr);
        // Non-critical — posts still saved
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${generatedPosts.length} posts`,
      generated: generatedPosts.length,
      postIds: generatedPosts,
      requireApproval: config.requireApproval,
    });
  } catch (error) {
    console.error("Error in generate-organic cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
