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
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  generateOrganicPost,
  generateContentCalendar,
  CONTENT_PILLARS,
  type ContentPillarKey,
} from "@/lib/organic-content";

// Verify cron secret or admin authentication
async function verifyAccess(request: NextRequest): Promise<boolean> {
  // Check cron secret first
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check admin authentication via cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "admin") {
      return true;
    }
  }

  // Allow in development without auth
  if (!cronSecret && process.env.NODE_ENV === "development") {
    return true;
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
          postsPerDay: 2,
          generateAheadDays: 7,
          requireApproval: true,
          publishToFacebook: true,
          publishToInstagram: true,
          publishTimes: {
            monday: ["09:00", "18:00"],
            tuesday: ["09:00", "18:00"],
            wednesday: ["09:00", "18:00"],
            thursday: ["09:00", "18:00"],
            friday: ["09:00", "18:00"],
            saturday: ["10:00", "15:00"],
            sunday: ["10:00", "15:00"],
          },
          pillarWeights: {},
          preferredFrameworks: ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
          emotionalAngleRotation: ["trust", "urgency", "control", "benefit", "curiosity"],
        },
      });
    }

    // For manual triggers, we can skip the autopilot enabled check
    // by checking if it's an admin request
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
    const isManualTrigger = !!token;

    // Check if autopilot is enabled (only for automated cron, not manual)
    if (!config.isEnabled && !isManualTrigger) {
      return NextResponse.json({
        success: true,
        message: "Autopilot is disabled",
        generated: 0,
      });
    }

    // Calculate how many posts we need
    const daysAhead = config.generateAheadDays;
    const postsPerDay = config.postsPerDay;
    const targetPosts = daysAhead * postsPerDay;

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

    // Generate content calendar
    const calendar = generateContentCalendar(new Date(), daysAhead);

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

          // Determine platforms
          const platforms: ("FACEBOOK" | "INSTAGRAM")[] = [];
          if (config.publishToFacebook) platforms.push("FACEBOOK");
          if (config.publishToInstagram) platforms.push("INSTAGRAM");

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
      // TODO: Send email notification
      console.log(`Generated ${generatedPosts.length} posts, notification would be sent to ${config.notificationEmail}`);
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
