/**
 * API Route: /api/admin/organic/[id]
 *
 * Handles operations on individual organic posts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

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

// GET - Get single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: {
        pillar: true,
        imageTemplate: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

// PUT - Update post
export async function PUT(
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
    const {
      content,
      headline,
      hook,
      hookType,
      imageUrl,
      imageTemplateId,
      videoUrl,
      carouselImages,
      pillarId,
      hashtags,
      platforms,
      emotionalAngle,
      status,
      scheduledFor,
      approvedBy,
      approvedAt,
      rejectionReason,
    } = body;

    // Check if post exists
    const existingPost = await prisma.socialPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (content !== undefined) updateData.content = content;
    if (headline !== undefined) updateData.headline = headline;
    if (hook !== undefined) updateData.hook = hook;
    if (hookType !== undefined) updateData.hookType = hookType;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imageTemplateId !== undefined) updateData.imageTemplateId = imageTemplateId;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (carouselImages !== undefined) updateData.carouselImages = carouselImages;
    if (pillarId !== undefined) updateData.pillarId = pillarId;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (platforms !== undefined) updateData.platforms = platforms;
    if (emotionalAngle !== undefined) updateData.emotionalAngle = emotionalAngle;
    if (status !== undefined) updateData.status = status;
    if (scheduledFor !== undefined) updateData.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;
    if (approvedAt !== undefined) updateData.approvedAt = approvedAt ? new Date(approvedAt) : null;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;

    const post = await prisma.socialPost.update({
      where: { id },
      data: updateData,
      include: {
        pillar: true,
        imageTemplate: true,
      },
    });

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update post" },
      { status: 500 }
    );
  }
}

// DELETE - Delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingPost = await prisma.socialPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    // Don't delete published posts, archive them instead
    if (existingPost.status === "PUBLISHED") {
      await prisma.socialPost.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });

      return NextResponse.json({
        success: true,
        message: "Post archived (was published)",
      });
    }

    await prisma.socialPost.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Post deleted",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
