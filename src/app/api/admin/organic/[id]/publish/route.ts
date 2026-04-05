/**
 * API Route: /api/admin/organic/[id]/publish
 *
 * Publishes an organic post to Facebook and/or Instagram
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

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

// POST - Publish post to selected platforms
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { platforms } = body; // ['facebook', 'instagram'] or ['facebook'] or ['instagram']

    // Get the post
    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: { pillar: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    // Check if already published
    if (post.status === "PUBLISHED") {
      return NextResponse.json(
        { success: false, error: "Post is already published" },
        { status: 400 }
      );
    }

    // Get social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
    });

    type AccountType = typeof accounts[number];
    const facebookAccount = accounts.find((a: AccountType) => a.platform === "FACEBOOK");
    const instagramAccount = accounts.find((a: AccountType) => a.platform === "INSTAGRAM");

    // Update status to publishing
    await prisma.socialPost.update({
      where: { id },
      data: { status: "PUBLISHING" },
    });

    const results: {
      facebook?: { success: boolean; postId?: string; error?: string };
      instagram?: { success: boolean; postId?: string; error?: string };
    } = {};

    const publishToFB = platforms?.includes("facebook") ?? post.platforms.includes("FACEBOOK");
    const publishToIG = platforms?.includes("instagram") ?? post.platforms.includes("INSTAGRAM");

    // Publish to Facebook
    if (publishToFB && facebookAccount) {
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

      results.facebook = {
        success: fbResult.success,
        postId: fbResult.postId,
        error: fbResult.error,
      };
    }

    // Publish to Instagram
    if (publishToIG && instagramAccount && post.imageUrl) {
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

      results.instagram = {
        success: igResult.success,
        postId: igResult.postId,
        error: igResult.error,
      };
    } else if (publishToIG && !post.imageUrl) {
      results.instagram = {
        success: false,
        error: "Instagram requires an image",
      };
    }

    // Determine final status
    const anySuccess = results.facebook?.success || results.instagram?.success;
    const allFailed =
      (publishToFB && !results.facebook?.success) &&
      (publishToIG && !results.instagram?.success);

    // Update post with results
    await prisma.socialPost.update({
      where: { id },
      data: {
        status: allFailed ? "FAILED" : "PUBLISHED",
        publishedAt: anySuccess ? new Date() : null,
        facebookPostId: results.facebook?.postId || null,
        instagramPostId: results.instagram?.postId || null,
        publishError: allFailed
          ? `Facebook: ${results.facebook?.error || "Not attempted"}; Instagram: ${results.instagram?.error || "Not attempted"}`
          : null,
      },
    });

    return NextResponse.json({
      success: anySuccess,
      results,
      message: anySuccess
        ? "Post published successfully"
        : "Failed to publish to all platforms",
    });
  } catch (error) {
    console.error("Error publishing post:", error);

    // Update status to failed
    await prisma.socialPost.update({
      where: { id },
      data: {
        status: "FAILED",
        publishError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { success: false, error: "Failed to publish post" },
      { status: 500 }
    );
  }
}
