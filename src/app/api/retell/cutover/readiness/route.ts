export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateRetellCutoverReadiness } from "@/lib/retell-cutover";
import { getActiveSmsProvider, isSmsProviderConfigured } from "@/lib/sms";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [activeConfig, deployedVersion, totalCalls, jobsCreated, escalatedCalls, scorecard] =
      await Promise.all([
        prisma.voiceAgentConfig.findFirst({
          where: { isActive: true },
          select: {
            id: true,
            isPaused: true,
            speakingRate: true,
            retellAgentId: true,
            realismProfile: true,
          },
        }),
        prisma.voiceAgentConfigVersion.findFirst({
          where: { isDeployed: true },
          orderBy: { deployedAt: "desc" },
          select: {
            id: true,
            publishStatus: true,
            retellVersionId: true,
          },
        }),
        prisma.voiceCall.count({
          where: { startedAt: { gte: since24h }, isTestCall: false },
        }),
        prisma.voiceCall.count({
          where: {
            startedAt: { gte: since24h },
            isTestCall: false,
            outcome: "job_created",
          },
        }),
        prisma.voiceCall.count({
          where: {
            startedAt: { gte: since24h },
            isTestCall: false,
            wasEscalated: true,
          },
        }),
        prisma.voiceDailyScorecard.findFirst({
          where: { date: { gte: dayStart } },
          orderBy: { date: "desc" },
          select: { alertCount: true, date: true },
        }),
      ]);

    const callToJobRate = totalCalls > 0 ? (jobsCreated / totalCalls) * 100 : 0;
    const escalationRate = totalCalls > 0 ? (escalatedCalls / totalCalls) * 100 : 0;

    const smsProvider = getActiveSmsProvider();
    const hasTwilioConfigured = isSmsProviderConfigured("twilio");
    const hasZadarmaConfigured = isSmsProviderConfigured("zadarma");

    const readiness = evaluateRetellCutoverReadiness({
      env: {
        hasRetellApiKey: Boolean(process.env.RETELL_API_KEY),
        hasRetellAgentId: Boolean(process.env.RETELL_AGENT_ID),
        hasRetellWebhookSecret: Boolean(process.env.RETELL_WEBHOOK_SECRET),
        smsProvider,
        hasTwilioConfigured,
        hasZadarmaConfigured,
        hasSiteUrl: Boolean(
          process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
        ),
      },
      activeConfig: {
        exists: Boolean(activeConfig),
        isPaused: Boolean(activeConfig?.isPaused),
        speakingRate: activeConfig?.speakingRate ?? null,
        hasRetellAgentId: Boolean(activeConfig?.retellAgentId),
        hasRealismProfile: Boolean(activeConfig?.realismProfile),
      },
      deployedVersion: {
        exists: Boolean(deployedVersion),
        publishStatus: deployedVersion?.publishStatus ?? null,
        hasRetellVersionId: Boolean(deployedVersion?.retellVersionId),
      },
      last24h: {
        totalCalls,
        callToJobRate,
        escalationRate,
        alertCount: scorecard?.alertCount ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      readyForSwitch: readiness.readyForSwitch,
      overall: readiness.overall,
      checks: readiness.checks,
      stats: {
        totalCalls,
        jobsCreated,
        escalatedCalls,
        callToJobRate: +callToJobRate.toFixed(1),
        escalationRate: +escalationRate.toFixed(1),
        alertCount: scorecard?.alertCount ?? 0,
      },
    });
  } catch (error: any) {
    console.error("[API] Error building Retell cutover readiness:", error);
    return NextResponse.json(
      { error: "Failed to build Retell cutover readiness" },
      { status: 500 }
    );
  }
}
