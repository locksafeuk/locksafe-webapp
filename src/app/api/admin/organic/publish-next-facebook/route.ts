/**
 * POST /api/admin/organic/publish-next-facebook
 *
 * Dashboard helper: publishes one eligible organic post to Facebook now.
 * Chooses the next post by status priority and schedule time.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { publishToFacebook } from "@/lib/social-publisher";
import { formatPostForPlatform } from "@/lib/organic-content";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;

  return payload;
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const facebookAccount = await prisma.socialAccount.findFirst({
      where: { platform: "FACEBOOK", isActive: true },
    });

    if (!facebookAccount) {
      return NextResponse.json(
        { success: false, error: "Facebook account not configured in Social Accounts" },
        { status: 400 },
      );
    }

    const now = new Date();

    const nextPost = await prisma.socialPost.findFirst({
      where: {
        status: { in: ["APPROVED", "DRAFT", "PENDING_APPROVAL", "SCHEDULED"] },
        AND: [
          {
            OR: [
              { platforms: { has: "FACEBOOK" } },
              { platforms: { isEmpty: true } },
            ],
          },
          {
            OR: [
              { scheduledFor: null },
              { scheduledFor: { lte: now } },
            ],
          },
        ],
      },
      include: { pillar: true },
      orderBy: [
        { scheduledFor: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (!nextPost) {
      return NextResponse.json(
        { success: false, error: "No eligible organic post found to publish" },
        { status: 404 },
      );
    }

    await prisma.socialPost.update({
      where: { id: nextPost.id },
      data: { status: "PUBLISHING" },
    });

    const fbContent = formatPostForPlatform(
      {
        content: nextPost.content,
        headline: nextPost.headline || "",
        hook: nextPost.hook || "",
        hookType: nextPost.hookType || "",
        hashtags: nextPost.hashtags,
        framework: nextPost.aiFramework || "",
        emotionalAngle: nextPost.emotionalAngle || "",
        pillar:
          (nextPost.pillar?.name as
            | "anti-fraud"
            | "tips"
            | "stories"
            | "behind-scenes"
            | "stats"
            | "engagement") || "tips",
        reasoning: "",
      },
      "facebook",
    );

    const fbResult = await publishToFacebook({
      pageId: facebookAccount.pageId || facebookAccount.accountId,
      pageAccessToken: facebookAccount.pageAccessToken || facebookAccount.accessToken,
      message: fbContent,
      imageUrl: nextPost.imageUrl || undefined,
    });

    if (!fbResult.success) {
      await prisma.socialPost.update({
        where: { id: nextPost.id },
        data: {
          status: "FAILED",
          publishError: fbResult.error || "Facebook publish failed",
        },
      });
      return NextResponse.json({
        success: false,
        error: fbResult.error || "Facebook publish failed",
        postId: nextPost.id,
      });
    }

    await prisma.socialPost.update({
      where: { id: nextPost.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        facebookPostId: fbResult.postId || null,
        publishError: null,
      },
    });

    return NextResponse.json({
      success: true,
      postId: nextPost.id,
      facebookPostId: fbResult.postId,
      message: "Published next post to Facebook",
    });
  } catch (error) {
    console.error("Error publishing next Facebook post:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to publish next Facebook post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
