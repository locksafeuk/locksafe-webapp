/**
 * API Route: /api/admin/organic/autopilot
 *
 * CRUD operations for autopilot configuration
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

// GET - Get autopilot config
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    let config = await prisma.autopilotConfig.findFirst();

    if (!config) {
      // Create default config
      config = await prisma.autopilotConfig.create({
        data: {
          isEnabled: false,
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
          notifyOnGeneration: true,
          notifyOnPublish: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Error fetching autopilot config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

// POST - Create or update autopilot config
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      isEnabled,
      postsPerDay,
      generateAheadDays,
      requireApproval,
      publishToFacebook,
      publishToInstagram,
      publishTimes,
      pillarWeights,
      preferredFrameworks,
      emotionalAngleRotation,
      notifyOnGeneration,
      notifyOnPublish,
      notificationEmail,
    } = body;

    // Find existing config
    const existingConfig = await prisma.autopilotConfig.findFirst();

    let config;
    if (existingConfig) {
      // Update existing
      config = await prisma.autopilotConfig.update({
        where: { id: existingConfig.id },
        data: {
          isEnabled: isEnabled ?? existingConfig.isEnabled,
          postsPerDay: postsPerDay ?? existingConfig.postsPerDay,
          generateAheadDays: generateAheadDays ?? existingConfig.generateAheadDays,
          requireApproval: requireApproval ?? existingConfig.requireApproval,
          publishToFacebook: publishToFacebook ?? existingConfig.publishToFacebook,
          publishToInstagram: publishToInstagram ?? existingConfig.publishToInstagram,
          publishTimes: publishTimes ?? existingConfig.publishTimes,
          pillarWeights: pillarWeights ?? existingConfig.pillarWeights,
          preferredFrameworks: preferredFrameworks ?? existingConfig.preferredFrameworks,
          emotionalAngleRotation: emotionalAngleRotation ?? existingConfig.emotionalAngleRotation,
          notifyOnGeneration: notifyOnGeneration ?? existingConfig.notifyOnGeneration,
          notifyOnPublish: notifyOnPublish ?? existingConfig.notifyOnPublish,
          notificationEmail: notificationEmail !== undefined ? notificationEmail : existingConfig.notificationEmail,
        },
      });
    } else {
      // Create new
      config = await prisma.autopilotConfig.create({
        data: {
          isEnabled: isEnabled ?? false,
          postsPerDay: postsPerDay ?? 2,
          generateAheadDays: generateAheadDays ?? 7,
          requireApproval: requireApproval ?? true,
          publishToFacebook: publishToFacebook ?? true,
          publishToInstagram: publishToInstagram ?? true,
          publishTimes: publishTimes ?? {
            monday: ["09:00", "18:00"],
            tuesday: ["09:00", "18:00"],
            wednesday: ["09:00", "18:00"],
            thursday: ["09:00", "18:00"],
            friday: ["09:00", "18:00"],
            saturday: ["10:00", "15:00"],
            sunday: ["10:00", "15:00"],
          },
          pillarWeights: pillarWeights ?? {},
          preferredFrameworks: preferredFrameworks ?? ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
          emotionalAngleRotation: emotionalAngleRotation ?? ["trust", "urgency", "control", "benefit", "curiosity"],
          notifyOnGeneration: notifyOnGeneration ?? true,
          notifyOnPublish: notifyOnPublish ?? true,
          notificationEmail: notificationEmail || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Error saving autopilot config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save config" },
      { status: 500 }
    );
  }
}
