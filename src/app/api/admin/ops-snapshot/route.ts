/**
 * GET /api/admin/ops-snapshot
 *
 * Single-request snapshot of all operational domain metrics.
 * Used by the main admin dashboard for the "Live Operations" tile grid.
 * Auto-polled every 30s by the dashboard client.
 *
 * Auth: admin JWT cookie (auth_token)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFromCookies } from "@/lib/agent-api-auth";
import { classifyModel } from "@/lib/classify-model";

export async function GET() {
  const admin = await requireAdminFromCookies();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const [
    activeJobsCount,
    awaitingSignatureCount,
    totalLocksmithCount,
    pendingVerificationCount,
    pendingPayoutsCount,
    openDisputesCount,
    agents,
    pendingApprovalsCount,
    scheduledPostsCount,
    draftPostsCount,
    activeEmailCampaignsCount,
    todayVoiceCallsCount,
    inProgressVoiceCallsCount,
    recentExecutions,
    activeAdCampaignsCount,
  ] = await Promise.all([
    prisma.job.count({
      where: { status: { in: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "DIAGNOSING", "QUOTED", "IN_PROGRESS"] } },
    }),
    prisma.job.count({ where: { status: "PENDING_CUSTOMER_CONFIRMATION" } }),
    prisma.locksmith.count({}),
    prisma.locksmith.count({ where: { isVerified: false } }),
    prisma.payout.count({ where: { status: "pending" } }),
    prisma.dispute.count({
      where: { status: { in: ["needs_response", "warning_needs_response"] } },
    }),
    prisma.agent.findMany({
      select: { status: true, lastHeartbeat: true },
      orderBy: { name: "asc" },
    }),
    prisma.agentApproval.count({ where: { status: "pending" } }),
    prisma.socialPost.count({ where: { status: "SCHEDULED" } }),
    prisma.socialPost.count({ where: { status: "DRAFT" } }),
    prisma.emailCampaign.count({ where: { status: { in: ["SCHEDULED", "SENDING"] } } }),
    prisma.voiceCall.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.voiceCall.count({ where: { callStatus: "in_progress" } }),
    prisma.agentExecution.findMany({
      where: { startedAt: { gte: oneDayAgo }, model: { not: null } },
      select: { model: true },
    }),
    prisma.adCampaign.count({ where: { status: "ACTIVE" } }),
  ]);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const lastHeartbeat = agents
    .map((a) => a.lastHeartbeat)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;

  const total       = recentExecutions.length;
  const localCount  = recentExecutions.filter((e) => classifyModel(e.model) === "local").length;
  const openaiCount = recentExecutions.filter((e) => classifyModel(e.model) === "openai").length;
  const lastModel   = recentExecutions[0]?.model ?? null;

  return NextResponse.json({
    ops: {
      activeJobs:        activeJobsCount,
      awaitingSignature: awaitingSignatureCount,
    },
    people: {
      totalLocksmiths:     totalLocksmithCount,
      pendingVerification: pendingVerificationCount,
    },
    finance: {
      pendingPayouts: pendingPayoutsCount,
    },
    safety: {
      openDisputes: openDisputesCount,
    },
    agents: {
      active:           activeAgents,
      total:            agents.length,
      lastHeartbeat:    lastHeartbeat?.toISOString() ?? null,
      pendingApprovals: pendingApprovalsCount,
      llmRuntime: {
        localPct:   total > 0 ? Math.round((localCount / total) * 100) : null,
        openaiPct:  total > 0 ? Math.round((openaiCount / total) * 100) : null,
        lastModel,
      },
    },
    marketing: {
      scheduledPosts:      scheduledPostsCount,
      draftPosts:          draftPostsCount,
      activeEmailCampaigns: activeEmailCampaignsCount,
      activeAdCampaigns:   activeAdCampaignsCount,
    },
    voice: {
      todayCalls:      todayVoiceCallsCount,
      inProgressCalls: inProgressVoiceCallsCount,
    },
    timestamp: new Date().toISOString(),
  });
}
