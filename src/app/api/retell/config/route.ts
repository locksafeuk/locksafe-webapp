export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { generateVoiceAgentPrompt } from "@/lib/retell-handler";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });

    if (!config) {
      config = await prisma.voiceAgentConfig.create({
        data: {
          name: "default",
          isActive: true,
          systemPrompt: generateVoiceAgentPrompt(),
          greetingMessage: "Hello, thank you for calling LockSafe UK. I'm Sarah, your AI receptionist. How can I help you today?",
          fallbackMessage: "I'm sorry, I didn't quite catch that. Could you please repeat?",
          language: "en-GB",
          businessHoursStart: "00:00",
          businessHoursEnd: "23:59",
        },
      });
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error("[API] Error fetching config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });

    const updateData: any = {};
    const allowedFields = [
      "systemPrompt", "greetingMessage", "fallbackMessage",
      "language", "speakingRate", "voiceId",
      "maxCallDuration", "silenceTimeout", "enableRecording",
      "businessHoursStart", "businessHoursEnd", "afterHoursMessage",
      "enableDispatch", "enableBooking", "enableFAQ", "enableEscalation",
      "isPaused", "pauseReason", "blockedNumbers",
      "retellAgentId", "retellLlmId",
    ];

    for (const field of allowedFields) {
      if (body?.[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (config) {
      config = await prisma.voiceAgentConfig.update({
        where: { id: config.id },
        data: updateData,
      });
    } else {
      config = await prisma.voiceAgentConfig.create({
        data: {
          name: "default",
          isActive: true,
          systemPrompt: body?.systemPrompt ?? generateVoiceAgentPrompt(),
          ...updateData,
        },
      });
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error("[API] Error updating config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
