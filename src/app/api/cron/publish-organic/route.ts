/**
 * Cron Job: /api/cron/publish-organic
 *
 * Auto-publishes scheduled organic posts when their scheduled time arrives.
 * Should run every 5-15 minutes.
 *
 * Vercel Cron syntax: Run every 5 minutes
 * 0/5 * * * *
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  publishToFacebook,
  publishToInstagram,
} from "@/lib/social-publisher";
import { formatPostForPlatform } from "@/lib/organic-content";

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
    const payload = verifyToken(token);
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
    const now = new Date();

    // Find posts that are scheduled and ready to publish
    const postsToPublish = await prisma.socialPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        pillar: true,
      },
      take: 10, // Process up to 10 posts per run
    });

    if (postsToPublish.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No posts to publish",
        processed: 0,
      });
    }

    // Get social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
    });

    type AccountType = typeof accounts[number];
    const facebookAccount = accounts.find((a: AccountType) => a.platform === "FACEBOOK");
    const instagramAccount = accounts.find((a: AccountType) => a.platform === "INSTAGRAM");

    const results: Array<{
      postId: string;
      success: boolean;
      platforms: {
        facebook?: { success: boolean; postId?: string; error?: string };
        instagram?: { success: boolean; postId?: string; error?: string };
      };
    }> = [];

    for (const post of postsToPublish) {
      // Update status to publishing
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHING" },
      });

      const platformResults: {
        facebook?: { success: boolean; postId?: string; error?: string };
        instagram?: { success: boolean; postId?: string; error?: string };
      } = {};

      // Publish to Facebook if platform is selected
      if (post.platforms.includes("FACEBOOK") && facebookAccount) {
        const fbContent = formatPostForPlatform(
          {
            content: post.content,
            headline: post.headline || "",
            hook: post.hook || "",
            hookType: post.hookType || "",
            hashtags: post.hashtags,
            framework: post.aiFramework || "",
            emotionalAngle: post.emotionalAngle || "",
            pillar: (post.pillar?.name as 'anti-fraud' | 'tips' | 'stories' | 'behind-scenes' | 'stats' | 'engagement') || "tips",
            reasoning: "",
          },
          "facebook"
        );

        const fbResult = await publishToFacebook({
          pageId: facebookAccount.pageId || facebookAccount.accountId,
          pageAccessToken: facebookAccount.pageAccessToken || facebookAccount.accessToken,
          message: fbContent,
          imageUrl: post.imageUrl || undefined,
        });

        platformResults.facebook = {
          success: fbResult.success,
          postId: fbResult.postId,
          error: fbResult.error,
        };
      }

      // Publish to Instagram if platform is selected and has image
      if (post.platforms.includes("INSTAGRAM") && instagramAccount && post.imageUrl) {
        const igContent = formatPostForPlatform(
          {
            content: post.content,
            headline: post.headline || "",
            hook: post.hook || "",
            hookType: post.hookType || "",
            hashtags: post.hashtags,
            framework: post.aiFramework || "",
            emotionalAngle: post.emotionalAngle || "",
            pillar: (post.pillar?.name as 'anti-fraud' | 'tips' | 'stories' | 'behind-scenes' | 'stats' | 'engagement') || "tips",
            reasoning: "",
          },
          "instagram"
        );

        const igResult = await publishToInstagram({
          instagramAccountId: instagramAccount.accountId,
          accessToken: instagramAccount.accessToken,
          caption: igContent,
          imageUrl: post.imageUrl,
          carouselItems: post.carouselImages.length > 0 ? post.carouselImages : undefined,
        });

        platformResults.instagram = {
          success: igResult.success,
          postId: igResult.postId,
          error: igResult.error,
        };
      }

      // Determine final status
      const anySuccess = Boolean(platformResults.facebook?.success || platformResults.instagram?.success);

      // Update post with results
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: anySuccess ? "PUBLISHED" : "FAILED",
          publishedAt: anySuccess ? new Date() : null,
          facebookPostId: platformResults.facebook?.postId || null,
          instagramPostId: platformResults.instagram?.postId || null,
          publishError: !anySuccess
            ? `Facebook: ${platformResults.facebook?.error || "Not attempted"}; Instagram: ${platformResults.instagram?.error || "Not attempted"}`
            : null,
        },
      });

      results.push({
        postId: post.id,
        success: anySuccess,
        platforms: platformResults,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Published ${successCount} posts, ${failedCount} failed`,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in publish-organic cron:", error);
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
