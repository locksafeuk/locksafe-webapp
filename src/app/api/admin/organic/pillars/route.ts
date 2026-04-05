/**
 * API Route: /api/admin/organic/pillars
 *
 * CRUD operations for content pillars
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { CONTENT_PILLARS } from "@/lib/organic-content";

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

// GET - List all pillars
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get pillars from database
    let pillars = await prisma.contentPillar.findMany({
      orderBy: { name: "asc" },
    });

    // If no pillars in DB, seed from defaults
    if (pillars.length === 0) {
      const defaultPillars = Object.values(CONTENT_PILLARS);

      await Promise.all(
        defaultPillars.map((p) =>
          prisma.contentPillar.create({
            data: {
              name: p.name,
              displayName: p.displayName,
              description: p.description,
              color: p.color,
              icon: p.icon,
              toneGuidelines: [...p.toneGuidelines] as string[],
              topicExamples: [...p.topicExamples],
              hashtags: [...p.hashtags],
              postsPerWeek: p.postsPerWeek,
            },
          })
        )
      );

      pillars = await prisma.contentPillar.findMany({
        orderBy: { name: "asc" },
      });
    }

    // Get post counts per pillar
    const postCounts = await prisma.socialPost.groupBy({
      by: ["pillarId"],
      _count: { id: true },
    });

    const pillarsWithCounts = pillars.map((p) => ({
      ...p,
      postCount: postCounts.find((pc: { pillarId: string | null; _count: { id: number } }) => pc.pillarId === p.id)?._count.id || 0,
    }));

    return NextResponse.json({
      success: true,
      pillars: pillarsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching pillars:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pillars" },
      { status: 500 }
    );
  }
}

// POST - Create new pillar
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      displayName,
      description,
      color,
      icon,
      toneGuidelines,
      topicExamples,
      hashtags,
      postsPerWeek,
      preferredDays,
      preferredTimes,
    } = body;

    // Validate required fields
    if (!name || !displayName || !description) {
      return NextResponse.json(
        { success: false, error: "Name, displayName, and description are required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.contentPillar.findFirst({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Pillar with this name already exists" },
        { status: 400 }
      );
    }

    const pillar = await prisma.contentPillar.create({
      data: {
        name,
        displayName,
        description,
        color: color || "#3B82F6",
        icon: icon || "Lightbulb",
        toneGuidelines: toneGuidelines || [],
        topicExamples: topicExamples || [],
        hashtags: hashtags || [],
        postsPerWeek: postsPerWeek || 2,
        preferredDays: preferredDays || [],
        preferredTimes: preferredTimes || [],
      },
    });

    return NextResponse.json({
      success: true,
      pillar,
    });
  } catch (error) {
    console.error("Error creating pillar:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create pillar" },
      { status: 500 }
    );
  }
}

// PUT - Update pillar
export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Pillar ID is required" },
        { status: 400 }
      );
    }

    const pillar = await prisma.contentPillar.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      pillar,
    });
  } catch (error) {
    console.error("Error updating pillar:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update pillar" },
      { status: 500 }
    );
  }
}
