/**
 * POST   /api/admin/google-ads/opportunities/[id]/draft
 *   → Spin a draft for one opportunity. Picks the best-rated covering
 *     locksmith (totalJobs first), runs `generateDraftPlanForLocksmith`,
 *     overrides the geoTargets with the opportunity's geo, persists as
 *     PENDING_APPROVAL.
 * DELETE /api/admin/google-ads/opportunities/[id]/draft
 *   → Mark opportunity dismissed.
 *
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { generateDraftPlanForLocksmith } from "@/lib/google-ads-onboarding";
import { extractDefaultAccountLearnings } from "@/lib/google-ads-learnings";
import { enforceDistrictLandingForDraft } from "@/lib/google-ads-district-enforcer";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body: { dailyBudget?: number; locksmithId?: string } = await req
    .json()
    .catch(() => ({}));

  const opp = await prisma.googleAdsOpportunity.findUnique({ where: { id } });
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (opp.kind !== "COVERAGE") {
    return NextResponse.json(
      { error: "Only COVERAGE opportunities can be drafted. RECRUIT opportunities need a locksmith first." },
      { status: 422 },
    );
  }
  if (opp.locksmithIds.length === 0) {
    return NextResponse.json(
      { error: "No covering locksmiths recorded for this opportunity." },
      { status: 422 },
    );
  }

  // Pick the locksmith: explicit override if provided, else best-rated.
  const where = {
    isActive: true,
    isVerified: true,
    onboardingCompleted: true,
    stripeConnectVerified: true,
    id: body.locksmithId
      ? body.locksmithId
      : { in: opp.locksmithIds },
  };
  const picked = await prisma.locksmith.findFirst({
    where,
    orderBy: [{ rating: "desc" }, { totalJobs: "desc" }],
  });
  if (!picked) {
    return NextResponse.json(
      { error: "No eligible locksmith found for this opportunity geo." },
      { status: 422 },
    );
  }

  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { lastSyncAt: "desc" },
  });
  if (!account) {
    return NextResponse.json(
      { error: "No active Google Ads account connected." },
      { status: 422 },
    );
  }

  const learnings = await extractDefaultAccountLearnings().catch(() => null);
  const enforcedLanding = await enforceDistrictLandingForDraft({
    locksmithBaseAddress: picked.baseAddress,
    contextLabel: "opportunity-draft",
  });

  const build = await generateDraftPlanForLocksmith(picked, {
    learnings,
    dailyBudget: body.dailyBudget ?? 5,
    finalUrl: enforcedLanding.finalUrl,
  });

  const draft = await prisma.googleAdsCampaignDraft.create({
    data: {
      accountId: account.id,
      status: "PENDING_APPROVAL",
      name: `${build.plan.campaignName} · scout:${opp.geoLabel}`,
      dailyBudget: build.plan.recommendedDailyBudget,
      biddingStrategy: "MANUAL_CPC",
      channel: "SEARCH",
      geoTargets: [opp.geoTargetId], // override — target the opportunity geo
      languageTargets: ["1000"],
      headlines: build.plan.headlines,
      descriptions: build.plan.descriptions,
      finalUrl: build.plan.finalUrl,
      keywords: build.plan.keywords as unknown as object[],
      negativeKeywords: build.plan.negativeKeywords,
      aiGenerated: true,
      aiPrompt: `opportunity:${opp.id} geo:${opp.geoTargetId}`,
      aiReasoning: `Manual scout draft for ${opp.geoLabel}. Score ${opp.score}, median CPC £${opp.medianCpcGbp}, ${opp.competitionTier} competition. Anchor: ${picked.companyName ?? picked.name} (${picked.totalJobs ?? 0} jobs). ${build.plan.reasoning}`,
      createdBy: "admin",
      createdByAdminId: typeof admin.id === "string" ? admin.id : undefined,
    },
  });

  await prisma.googleAdsOpportunity.update({
    where: { id: opp.id },
    data: { status: "DRAFTED", draftId: draft.id },
  });

  return NextResponse.json({
    draftId: draft.id,
    locksmithId: picked.id,
    locksmithName: picked.companyName ?? picked.name,
    keywordCount: build.plan.keywords.length,
    negativeKeywordCount: build.plan.negativeKeywords.length,
    geoTarget: opp.geoTargetId,
    cityLabel: opp.geoLabel,
    district: enforcedLanding.district,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const updated = await prisma.googleAdsOpportunity.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedBy: typeof admin.id === "string" ? admin.id : "admin",
    },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
