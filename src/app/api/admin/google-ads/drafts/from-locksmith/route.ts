/**
 * POST /api/admin/google-ads/drafts/from-locksmith
 *
 * Generates a fresh GoogleAdsCampaignDraft for ONE specific onboarded
 * locksmith, seeded with the account's historical learnings (best-performing
 * keywords, proven ad copy, blocked search terms).
 *
 * Body: { locksmithId: string, dailyBudget?: number, finalUrl?: string,
 *         skipLearnings?: boolean }
 *
 * Response: { draftId, geoTargets, cityLabel, usedLearnings,
 *             keywordCount, negativeKeywordCount, learningsSummary }
 *
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { generateDraftPlanForLocksmith } from "@/lib/google-ads-onboarding";
import { extractDefaultAccountLearnings } from "@/lib/google-ads-learnings";
import { extractUkPostcode } from "@/lib/location-display";
import { enforceDistrictLandingForDraft } from "@/lib/google-ads-district-enforcer";
import {
  enforceDraftGuardrails,
  isAutoPerLocksmithGenerationEnabled,
  PLAYBOOK_GUARDRAILS,
} from "@/lib/google-ads-draft-enforcement";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/**
 * GET — list onboarded locksmiths eligible for per-locksmith draft creation.
 * Used by the admin UI dropdown.
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      isVerified: true,
      onboardingCompleted: true,
      stripeConnectVerified: true,
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      rating: true,
      totalJobs: true,
    },
    orderBy: [{ totalJobs: "desc" }, { rating: "desc" }],
    take: 200,
  });

  return NextResponse.json({
    locksmiths: locksmiths.map((locksmith) => {
      const postcode = extractUkPostcode(locksmith.baseAddress);
      return {
        ...locksmith,
        baseAddress: postcode,
        basePostcode: postcode,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Feature flag — auto-per-locksmith draft generation is DISABLED until the
  // click-to-locksmith attribution layer exists. Re-enable by setting
  // ENABLE_AUTO_PER_LOCKSMITH_DRAFTS=true in the environment.
  // Decision date: 2026-06-03 (see HANDOFF-self-learning-playbook §6).
  if (!isAutoPerLocksmithGenerationEnabled()) {
    return NextResponse.json(
      {
        error: "auto_per_locksmith_disabled",
        message:
          "Per-locksmith draft generation is currently disabled. Use the manual draft form at /admin/integrations/google-ads/drafts/new instead. To re-enable, set ENABLE_AUTO_PER_LOCKSMITH_DRAFTS=true.",
      },
      { status: 503 },
    );
  }

  let body: {
    locksmithId?: string;
    dailyBudget?: number;
    finalUrl?: string;
    skipLearnings?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is acceptable but locksmithId is required
  }

  if (!body.locksmithId || typeof body.locksmithId !== "string") {
    return NextResponse.json(
      { error: "locksmithId is required" },
      { status: 400 },
    );
  }

  // 1. Fetch the locksmith (strict eligibility gates)
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: body.locksmithId },
    select: {
      id: true,
      name: true,
      companyName: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      yearsExperience: true,
      rating: true,
      totalJobs: true,
      isActive: true,
      isVerified: true,
      onboardingCompleted: true,
      stripeConnectVerified: true,
    },
  });

  if (!locksmith) {
    return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });
  }
  if (
    !locksmith.isActive ||
    !locksmith.isVerified ||
    !locksmith.onboardingCompleted ||
    !locksmith.stripeConnectVerified
  ) {
    return NextResponse.json(
      {
        error:
          "Locksmith is not fully eligible (must be active, verified, onboarded, and Stripe Connect verified).",
        eligibility: {
          isActive: locksmith.isActive,
          isVerified: locksmith.isVerified,
          onboardingCompleted: locksmith.onboardingCompleted,
          stripeConnectVerified: locksmith.stripeConnectVerified,
        },
      },
      { status: 422 },
    );
  }

  // 2. Default Google Ads account
  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    return NextResponse.json(
      {
        error:
          "No active Google Ads account connected. Connect one at /admin/integrations/google-ads first.",
      },
      { status: 422 },
    );
  }

  try {
    // 3. Pull learnings unless caller opted out
    const learnings = body.skipLearnings
      ? null
      : await extractDefaultAccountLearnings().catch((err) => {
          console.warn("[from-locksmith] learnings extract failed:", err);
          return null;
        });

    // 4. Build the plan
    const enforcedLanding = await enforceDistrictLandingForDraft({
      explicitFinalUrl: body.finalUrl,
      locksmithBaseAddress: locksmith.baseAddress,
      contextLabel: "from-locksmith",
    });

    const { plan, geoTargets, cityLabel, usedLearnings } =
      await generateDraftPlanForLocksmith(locksmith, {
        dailyBudget: body.dailyBudget,
        finalUrl: enforcedLanding.finalUrl,
        learnings,
      });

    // 5. Persist as PENDING_APPROVAL draft (gated by structural guardrails)
    const enforced = enforceDraftGuardrails({
      accountId: account.id,
      status: "PENDING_APPROVAL",
      name: plan.campaignName,
      dailyBudget: plan.recommendedDailyBudget,
      // Use playbook-enforced bidding strategy — Liverpool Test loss showed
      // MANUAL_CPC at this scale converts at 0%. See google-ads-campaign-playbook.md §9.
      biddingStrategy: PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY,
      channel: "SEARCH",
      locationMatchType: "PRESENCE",
      geoTargets,
      languageTargets: ["1000"],
      headlines: plan.headlines,
      descriptions: plan.descriptions,
      finalUrl: plan.finalUrl,
      keywords: plan.keywords as unknown as object[],
      negativeKeywords: plan.negativeKeywords,
      aiGenerated: true,
      aiPrompt: `from-locksmith:${locksmith.id} ${locksmith.companyName || locksmith.name}`,
      aiReasoning: plan.reasoning,
      createdBy: "admin",
      createdByAdminId: typeof admin.id === "string" ? admin.id : undefined,
    });
    if (!enforced.ok) {
      return NextResponse.json(
        {
          error: "guardrail_violation",
          message:
            "Draft does not meet the Liverpool playbook guardrails. Fix the generator before retrying.",
          violations: enforced.violations,
        },
        { status: 422 },
      );
    }
    if (enforced.appliedFixes.length > 0) {
      console.warn(
        "[from-locksmith] draft auto-corrected by playbook guardrails",
        { locksmithId: locksmith.id, appliedFixes: enforced.appliedFixes },
      );
    }
    const draft = await prisma.googleAdsCampaignDraft.create({
      data: enforced.data as Parameters<
        typeof prisma.googleAdsCampaignDraft.create
      >[0]["data"],
    });

    return NextResponse.json(
      {
        draftId: draft.id,
        status: draft.status,
        geoTargets,
        cityLabel,
        usedLearnings,
        keywordCount: plan.keywords.length,
        negativeKeywordCount: plan.negativeKeywords.length,
        learningsSummary: learnings
          ? {
              windowDays: learnings.windowDays,
              totals: learnings.totals,
              topConvertingKeywords: learnings.topConvertingKeywords.length,
              searchTermCandidates: learnings.searchTermCandidates.length,
              searchTermNegativeCandidates: learnings.searchTermNegativeCandidates.length,
              bestPerformingAds: learnings.bestPerformingAds.length,
            }
          : null,
        district: enforcedLanding.district,
        message: `Draft created for ${locksmith.companyName || locksmith.name}${cityLabel ? ` (${cityLabel})` : ""}. Review at /admin/integrations/google-ads/drafts/${draft.id}.`,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[from-locksmith] draft generation failed:", message, err);
    return NextResponse.json(
      { error: `Draft generation failed: ${message}` },
      { status: 500 },
    );
  }
}
