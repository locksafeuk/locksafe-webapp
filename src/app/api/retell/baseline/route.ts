export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [activeConfig, totalCalls, calls7d, calls30d, lastCall, flaggedCalls7d, completedCalls7d, jobsCreated7d] = await Promise.all([
      prisma.voiceAgentConfig.findFirst({ where: { isActive: true } }),
      prisma.voiceCall.count({ where: { isTestCall: false } }),
      prisma.voiceCall.count({ where: { isTestCall: false, startedAt: { gte: sevenDaysAgo } } }),
      prisma.voiceCall.count({ where: { isTestCall: false, startedAt: { gte: thirtyDaysAgo } } }),
      prisma.voiceCall.findFirst({ where: { isTestCall: false }, orderBy: { startedAt: "desc" }, select: { startedAt: true, retellCallId: true } }),
      prisma.voiceCall.count({ where: { isTestCall: false, startedAt: { gte: sevenDaysAgo }, flaggedForReview: true } }),
      prisma.voiceCall.count({ where: { isTestCall: false, startedAt: { gte: sevenDaysAgo }, callStatus: "completed" } }),
      prisma.voiceCall.count({ where: { isTestCall: false, startedAt: { gte: sevenDaysAgo }, outcome: "job_created" } }),
    ]);

    const callToJobRate7d = calls7d > 0 ? +((jobsCreated7d / calls7d) * 100).toFixed(1) : 0;
    const completionRate7d = calls7d > 0 ? +((completedCalls7d / calls7d) * 100).toFixed(1) : 0;
    const reviewRate7d = calls7d > 0 ? +((flaggedCalls7d / calls7d) * 100).toFixed(1) : 0;

    return NextResponse.json({
      success: true,
      baseline: {
        generatedAt: now.toISOString(),
        environment: {
          hasRetellApiKey: Boolean(process.env.RETELL_API_KEY),
          hasRetellAgentId: Boolean(process.env.RETELL_AGENT_ID),
          hasRetellWebhookSecret: Boolean(process.env.RETELL_WEBHOOK_SECRET),
          configuredPhoneNumber: process.env.RETELL_PHONE_NUMBER ?? null,
        },
        config: activeConfig
          ? {
              id: activeConfig.id,
              name: activeConfig.name,
              isPaused: activeConfig.isPaused,
              language: activeConfig.language,
              voiceId: activeConfig.voiceId,
              retellAgentId: activeConfig.retellAgentId,
              retellLlmId: activeConfig.retellLlmId,
              maxCallDuration: activeConfig.maxCallDuration,
              enableDispatch: activeConfig.enableDispatch,
              enableBooking: activeConfig.enableBooking,
              enableFAQ: activeConfig.enableFAQ,
              enableEscalation: activeConfig.enableEscalation,
              updatedAt: activeConfig.updatedAt.toISOString(),
            }
          : null,
        traffic: {
          totalCalls,
          calls7d,
          calls30d,
          lastCallAt: lastCall?.startedAt?.toISOString?.() ?? null,
          lastRetellCallId: lastCall?.retellCallId ?? null,
        },
        quality: {
          flaggedCalls7d,
          reviewRate7d,
          completedCalls7d,
          completionRate7d,
          jobsCreated7d,
          callToJobRate7d,
        },
      },
    });
  } catch (error: any) {
    console.error("[API] Error building Retell baseline:", error);
    return NextResponse.json({ error: "Failed to build baseline" }, { status: 500 });
  }
}