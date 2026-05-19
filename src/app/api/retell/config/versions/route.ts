export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ success: true, versions: [] });
    }

    const versions = await prisma.voiceAgentConfigVersion.findMany({
      where: { configId: config.id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        title: true,
        notes: true,
        isDeployed: true,
        deployedAt: true,
        publishStatus: true,
        publishedAt: true,
        publishError: true,
        retellVersionId: true,
        createdAt: true,
        createdBy: true,
      },
    });

    return NextResponse.json({ success: true, versions });
  } catch (error: any) {
    console.error("[API] Error listing config versions:", error);
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : undefined;
    const notes = typeof body?.notes === "string" ? body.notes : undefined;
    const createdBy = typeof body?.createdBy === "string" ? body.createdBy : "admin";

    const config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: "Active voice config not found" }, { status: 404 });
    }

    const latest = await prisma.voiceAgentConfigVersion.findFirst({
      where: { configId: config.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    const version = await prisma.voiceAgentConfigVersion.create({
      data: {
        configId: config.id,
        version: nextVersion,
        title,
        notes,
        createdBy,
        systemPrompt: config.systemPrompt,
        greetingMessage: config.greetingMessage,
        fallbackMessage: config.fallbackMessage,
        language: config.language,
        speakingRate: config.speakingRate,
        voiceId: config.voiceId,
        realismProfile: config.realismProfile,
        maxCallDuration: config.maxCallDuration,
        silenceTimeout: config.silenceTimeout,
        enableRecording: config.enableRecording,
        businessHoursStart: config.businessHoursStart,
        businessHoursEnd: config.businessHoursEnd,
        afterHoursMessage: config.afterHoursMessage,
        enableDispatch: config.enableDispatch,
        enableBooking: config.enableBooking,
        enableFAQ: config.enableFAQ,
        enableEscalation: config.enableEscalation,
        isPaused: config.isPaused,
        pauseReason: config.pauseReason,
        blockedNumbers: config.blockedNumbers,
        retellAgentId: config.retellAgentId,
        retellLlmId: config.retellLlmId,
      },
    });

    return NextResponse.json({ success: true, version });
  } catch (error: any) {
    console.error("[API] Error creating config version:", error);
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }
}