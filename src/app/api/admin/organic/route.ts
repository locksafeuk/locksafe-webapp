/**
 * API Route: /api/admin/organic
 *
 * Handles CRUD operations for organic social media posts
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

// GET - List all organic posts
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const pillar = searchParams.get("pillar");
    const platform = searchParams.get("platform");
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build filter
    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (pillar && pillar !== "all") {
      // Find pillar by name
      const pillarDoc = await prisma.contentPillar.findFirst({
        where: { name: pillar },
      });
      if (pillarDoc) {
        where.pillarId = pillarDoc.id;
      }
    }

    if (platform && platform !== "all") {
      where.platforms = { has: platform.toUpperCase() };
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: {
          pillar: true,
          imageTemplate: true,
        },
        orderBy: [
          { scheduledFor: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.socialPost.count({ where }),
    ]);

    // Get pillar stats
    const pillarStats = await prisma.socialPost.groupBy({
      by: ["pillarId"],
      _count: { id: true },
    });

    // Get status stats
    const statusStats = await prisma.socialPost.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        byPillar: pillarStats,
        byStatus: statusStats,
      },
    });
  } catch (error) {
    console.error("Error fetching organic posts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

// POST - Create new organic post
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
      aiGenerated,
      aiPrompt,
      aiFramework,
      emotionalAngle,
      status,
      scheduledFor,
    } = body;

    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content is required" },
        { status: 400 }
      );
    }

    const post = await prisma.socialPost.create({
      data: {
        content,
        headline,
        hook,
        hookType,
        imageUrl,
        imageTemplateId,
        videoUrl,
        carouselImages: carouselImages || [],
        pillarId,
        hashtags: hashtags || [],
        platforms: platforms || ["FACEBOOK", "INSTAGRAM"],
        aiGenerated: aiGenerated || false,
        aiPrompt,
        aiFramework,
        emotionalAngle,
        status: status || "DRAFT",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
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
    console.error("Error creating organic post:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create post" },
      { status: 500 }
    );
  }
}
