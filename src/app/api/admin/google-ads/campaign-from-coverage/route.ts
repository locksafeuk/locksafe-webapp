/**
 * POST /api/admin/google-ads/campaign-from-coverage
 *
 * Creates a Google Ads campaign draft whose geo-targeting is derived from the
 * areas where our active, onboarded locksmiths are actually based. Any area
 * WITHOUT a locksmith is automatically excluded — the campaign will never spend
 * budget in a city we cannot service.
 *
 * The keyword plan is the same deep-research plan used in
 * scripts/create-campaign-draft.ts — 22 keywords across EXACT / PHRASE / BROAD
 * match types, 15 RSA headlines, 4 descriptions.
 *
 * Response: { draftId, status, geoTargets, coverageSummary }
 * On success the caller should redirect to /admin/integrations/google-ads/drafts/{draftId}
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getActiveCoverageGeoTargets } from "@/lib/google-ads-locations";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

// ── Campaign content (deep-research, no OpenAI call needed) ───────────────────

const CAMPAIGN_PLAN = {
  campaignName: "LockSafe | Emergency Locksmith UK | Search",

  /** 15 RSA headlines — Google rotates best-performing combos */
  headlines: [
    "Locked Out? 15 Min Response",     // 27 chars
    "Verified UK Locksmiths",           // 22 chars
    "Anti-Fraud Booking Guarantee",     // 28 chars
    "No Surprise Fees. Ever.",          // 22 chars
    "24/7 Emergency Locksmith",         // 24 chars
    "See Prices Before You Book",       // 26 chars
    "Vetted & Insured Locksmiths",      // 27 chars
    "GPS-Tracked to Your Door",         // 24 chars
    "Money-Back Guarantee",             // 20 chars
    "Emergency Locksmith Near You",     // 28 chars
    "Book in 60 Seconds",               // 18 chars
    "2,500+ Safe Jobs Completed",       // 26 chars
    "Fixed Price Lock Change",          // 23 chars
    "LockSafe — UK's Safest",           // 22 chars
    "Get a Locksmith Now",              // 20 chars
  ],

  /** 4 RSA descriptions (≤ 90 chars each) */
  descriptions: [
    "Locked out? LockSafe connects you with vetted, insured locksmiths in under 30 minutes.",
    "Anti-fraud protection built in. See upfront prices with no surprise call-out fees.",
    "All LockSafe locksmiths are background-checked, GPS-tracked & fully insured. Book now.",
    "Emergency lockout service. Transparent pricing. Money-back guarantee available 24/7.",
  ],

  keywords: [
    // EXACT — peak emergency / high-intent
    { text: "locked out of house",          matchType: "EXACT" },
    { text: "locked out of my house",       matchType: "EXACT" },
    { text: "emergency locksmith",          matchType: "EXACT" },
    { text: "24 hour locksmith",            matchType: "EXACT" },
    { text: "locksmith near me",            matchType: "EXACT" },
    { text: "emergency locksmith near me",  matchType: "EXACT" },
    { text: "lock change",                  matchType: "EXACT" },
    // PHRASE — location+service combos, specific job types
    { text: "locked out of flat",           matchType: "PHRASE" },
    { text: "emergency locksmith london",   matchType: "PHRASE" },
    { text: "lock change after break in",   matchType: "PHRASE" },
    { text: "upvc door lock replacement",   matchType: "PHRASE" },
    { text: "front door lock change",       matchType: "PHRASE" },
    { text: "broken key in lock",           matchType: "PHRASE" },
    { text: "lock repair near me",          matchType: "PHRASE" },
    { text: "high security lock installation", matchType: "PHRASE" },
    { text: "house lockout service",        matchType: "PHRASE" },
    { text: "locksmith open now",           matchType: "PHRASE" },
    // BROAD — trust / anti-rogue-trader audience
    { text: "trusted locksmith uk",         matchType: "BROAD" },
    { text: "verified locksmith service",   matchType: "BROAD" },
    { text: "fixed price locksmith",        matchType: "BROAD" },
    { text: "vetted locksmith near me",     matchType: "BROAD" },
    { text: "insured locksmith",            matchType: "BROAD" },
  ],

  negativeKeywords: [
    // Career / training
    "locksmith training", "locksmith course", "locksmith jobs",
    "locksmith apprenticeship", "become a locksmith", "locksmith salary",
    "locksmith school", "locksmith license", "locksmith certificate",
    // DIY / tools
    "locksmith tools", "locksmith kit", "locksmith supplies",
    "how to pick a lock", "diy lock", "lock picking",
    // Free / research intent
    "free locksmith", "locksmith forum", "locksmith near me free",
    // Automotive — we don't serve this
    "car locksmith", "auto locksmith", "vehicle locksmith", "car key locksmith",
    // Safe / vault — different specialist
    "safe locksmith", "safe cracking", "safe opening",
    // Competitors
    "keytek", "multilock", "banham", "direct locksmiths", "0800 locksmith",
  ],

  finalUrl: "https://locksafe.uk/quote",
  dailyBudget: 100, // £100/day — conservative for launch
  biddingStrategy: "MAXIMIZE_CONVERSIONS",

  aiReasoning:
    "Campaign strategy: Lead with TRUST and SAFETY, not just speed. " +
    "The UK locksmith market is flooded with rogue traders who overcharge vulnerable " +
    "customers. EXACT match on emergency queries captures the lockout moment; PHRASE " +
    "match expands geo coverage across UK cities; BROAD match on trust/vetting terms " +
    "targets the anti-cowboy audience uniquely aligned with LockSafe. " +
    "Geo targets are dynamically derived from active locksmith coverage — no budget " +
    "is spent in any city where we cannot dispatch a locksmith.",
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional body: { dailyBudget?: number, promptOverride?: string }
  let bodyOptions: { dailyBudget?: number } = {};
  try {
    bodyOptions = await request.json();
  } catch {
    // Empty body is fine
  }

  const dailyBudget =
    typeof bodyOptions.dailyBudget === "number" && bodyOptions.dailyBudget > 0
      ? bodyOptions.dailyBudget
      : CAMPAIGN_PLAN.dailyBudget;

  // 1. Derive geo targets from active locksmith coverage
  const { geoTargets, coverageSummary, activeLocksmithCount } =
    await getActiveCoverageGeoTargets();

  if (activeLocksmithCount === 0) {
    return NextResponse.json(
      {
        error:
          "No active onboarded locksmiths found. At least one locksmith must complete " +
          "onboarding before a coverage-based campaign can be created.",
      },
      { status: 422 },
    );
  }

  // 2. Get or create stub Google Ads account
  const account = await prisma.googleAdsAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    return NextResponse.json(
      {
        error:
          "No Google Ads account found. Connect an account at " +
          "/admin/integrations/google-ads before creating a campaign.",
      },
      { status: 422 },
    );
  }

  // 3. Ensure marketing policy row exists for google platform
  await prisma.marketingPolicy.upsert({
    where: { platform: "google" },
    update: {},
    create: {
      platform: "google",
      autonomyEnabled: false,
      maxDailySpend: dailyBudget,
      maxMonthlySpend: dailyBudget * 31,
      maxCampaignDailyBudget: dailyBudget,
      minCampaignDailyBudget: 2,
      autoApproveMaxBudget: 10,
      maxWeeklyAutoApproveSpend: 50,
      pauseRoasThreshold: 0.5,
      pauseGraceDays: 3,
      minImpressionsForPause: 500,
      notifyOnAutoAction: true,
    },
  });

  // 4. Check for an existing non-failed draft to avoid duplicates
  const existing = await prisma.googleAdsCampaignDraft.findFirst({
    where: {
      accountId: account.id,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "PAUSED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Update its geo targets to match current coverage instead of creating a duplicate
    await prisma.googleAdsCampaignDraft.update({
      where: { id: existing.id },
      data: { geoTargets },
    });

    return NextResponse.json({
      draftId: existing.id,
      status: existing.status,
      geoTargets,
      coverageSummary,
      activeLocksmithCount,
      action: "geo_targets_updated",
      message:
        `Existing draft "${existing.name}" geo targets refreshed to match ` +
        `${activeLocksmithCount} active locksmith(s): ${coverageSummary.join(", ")}.`,
    });
  }

  // 5. Create new draft
  const draft = await prisma.googleAdsCampaignDraft.create({
    data: {
      accountId: account.id,
      status: "PENDING_APPROVAL",
      name: CAMPAIGN_PLAN.campaignName,
      dailyBudget,
      biddingStrategy: CAMPAIGN_PLAN.biddingStrategy,
      targetCpa: null,
      channel: "SEARCH",
      geoTargets,          // Only cities where we have locksmiths
      languageTargets: ["1000"], // English
      headlines: CAMPAIGN_PLAN.headlines,
      descriptions: CAMPAIGN_PLAN.descriptions,
      finalUrl: CAMPAIGN_PLAN.finalUrl,
      keywords: CAMPAIGN_PLAN.keywords,
      negativeKeywords: CAMPAIGN_PLAN.negativeKeywords,
      aiGenerated: false,
      aiPrompt: "Coverage-based campaign created via admin UI",
      aiReasoning: CAMPAIGN_PLAN.aiReasoning,
    },
  });

  return NextResponse.json(
    {
      draftId: draft.id,
      status: draft.status,
      geoTargets,
      coverageSummary,
      activeLocksmithCount,
      action: "created",
      message:
        `Campaign draft created targeting ${activeLocksmithCount} coverage area(s): ` +
        `${coverageSummary.join(", ")}. ` +
        `Review and approve at /admin/integrations/google-ads/drafts/${draft.id}.`,
    },
    { status: 201 },
  );
}
