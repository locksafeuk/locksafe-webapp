/**
 * Google Ads Auto-Draft — per-locksmith campaign creation on onboarding.
 *
 * Triggered automatically when a locksmith completes onboarding (via
 * triggerPostOnboardingGeoSync) and also by a nightly cron that back-fills
 * any active locksmith who has never received a campaign draft.
 *
 * Strategy:
 *   • For each locksmith we extract their outward postcode (e.g. "HU1")
 *     from baseAddress and generate cheap, zero-competition keywords like
 *     "locksmith HU1", "emergency locksmith HU1", etc. — uncontested by
 *     national chains who only target city/county level.
 *   • London and high-CPC cities are gated BEFORE this function is called;
 *     do not add a second gate here — the caller (triggerPostOnboardingGeoSync)
 *     already handles that path and returns early.
 *   • Budget defaults to £8/day (cheap-market pilots; caller may override).
 *   • Draft status: PENDING_APPROVAL so a human still clicks Publish.
 *   • Dedup: never create a second draft for the same locksmith within 90 days.
 */

import prisma from "@/lib/db";
import { generateDraftPlanForLocksmith } from "@/lib/google-ads-onboarding";
import type { GoogleKeyword } from "@/lib/openai-google-ads";
import { enforceDistrictLandingForDraft } from "@/lib/google-ads-district-enforcer";

// ─── Constants ─────────────────────────────────────────────────────────────

/** Default daily budget for auto-generated per-locksmith campaigns (GBP). */
const AUTO_DRAFT_DAILY_BUDGET_GBP = 8;

/** Don't re-draft for the same locksmith within this window. */
const DEDUP_WINDOW_DAYS = 90;

/** Minimum confidence score (0–1) required for PENDING_APPROVAL vs DRAFT. */
const CONFIDENCE_THRESHOLD = 0.6;

// ─── Postcode helpers ──────────────────────────────────────────────────────

/**
 * Extracts the UK outward postcode from a human-readable address.
 * E.g. "42 Spring Rd, Hull, HU1 2AB" → "HU1"
 *      "18 Albion St, Leeds, LS1 6JL, UK" → "LS1"
 */
function extractOutwardPostcode(address: string | null | undefined): string | null {
  if (!address) return null;
  // Full UK postcode first (e.g. "HU1 2AB") — capture the outward part
  const fullMatch = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s+\d[A-Z]{2}\b/i);
  if (fullMatch) return fullMatch[1].toUpperCase();
  // Outward-only fallback (e.g. someone stored "HU1" or "LS1")
  const outwardMatch = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/i);
  if (outwardMatch) return outwardMatch[1].toUpperCase();
  return null;
}

/**
 * Builds a small set of highly specific, low-competition keywords
 * targeting the outward postcode directly.  These postcodes are invisible
 * to national chains who bid on "locksmith london" / "locksmith uk" and
 * give us uncontested top-of-page impressions for a fraction of the CPC.
 */
function buildPostcodeKeywords(
  outwardPostcode: string,
  cityLabel: string | null,
): GoogleKeyword[] {
  const pc = outwardPostcode.toLowerCase();
  const keywords: GoogleKeyword[] = [
    // ── Postcode-level (hyper-local, almost zero competition) ──────────────
    { text: `locksmith ${pc}`,           matchType: "PHRASE", reasoning: "Hyper-local postcode intent" },
    { text: `emergency locksmith ${pc}`, matchType: "PHRASE", reasoning: "Emergency + postcode" },
    { text: `locked out ${pc}`,          matchType: "PHRASE", reasoning: "Emergency lockout + postcode" },
    { text: `lock change ${pc}`,         matchType: "PHRASE", reasoning: "Non-emergency job + postcode" },
    { text: `24 hour locksmith ${pc}`,   matchType: "PHRASE", reasoning: "24hr availability + postcode" },
    { text: `locksmith near ${pc}`,      matchType: "PHRASE", reasoning: "Proximity intent + postcode" },
    { text: `${pc} locksmith`,           matchType: "EXACT",  reasoning: "Postcode-first exact search" },
    { text: `${pc} emergency locksmith`, matchType: "EXACT",  reasoning: "Postcode + emergency exact" },
  ];

  // ── City-level (slightly broader but still cheap vs London/national) ────
  if (cityLabel) {
    const city = cityLabel.toLowerCase();
    keywords.push(
      { text: `locksmith ${city}`,           matchType: "PHRASE", reasoning: "City-level intent" },
      { text: `emergency locksmith ${city}`,  matchType: "PHRASE", reasoning: "Emergency + city" },
      { text: `locked out in ${city}`,        matchType: "PHRASE", reasoning: "Lockout + city" },
      { text: `24 hour locksmith ${city}`,    matchType: "PHRASE", reasoning: "24hr + city" },
      { text: `cheap locksmith ${city}`,      matchType: "PHRASE", reasoning: "Price-sensitive + city" },
    );
  }

  return keywords;
}

// ─── Confidence scoring ────────────────────────────────────────────────────

interface DraftConfidenceInput {
  hasPostcode: boolean;
  hasCityLabel: boolean;
  headlineCount: number;
  descriptionCount: number;
  keywordCount: number;
}

/**
 * Simple inline confidence scorer (0–1).
 * Keeps auto-draft creation fast and dependency-free — no LLM call needed
 * just to decide whether to set PENDING_APPROVAL vs DRAFT.
 */
function scoreDraftConfidence(input: DraftConfidenceInput): number {
  let score = 0;
  if (input.hasPostcode)  score += 0.30; // postcode keywords = biggest differentiator
  if (input.hasCityLabel) score += 0.20; // city context → better copy
  if (input.headlineCount  >= 10) score += 0.20;
  if (input.descriptionCount >= 3) score += 0.15;
  if (input.keywordCount   >= 10) score += 0.15;
  return Math.min(score, 1);
}

// ─── Result types ──────────────────────────────────────────────────────────

export interface AutoDraftResult {
  success: boolean;
  draftId?: string;
  draftName?: string;
  status?: string;
  locksmithId: string;
  locksmithName: string;
  cityLabel: string | null;
  outwardPostcode: string | null;
  confidence: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface BackfillResult {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  results: AutoDraftResult[];
}

// ─── Main: create a single draft ──────────────────────────────────────────

/**
 * Attempts to auto-create a Google Ads campaign draft for a locksmith.
 *
 * Safe to call fire-and-forget:
 *   autoCreateOnboardingCampaignDraft(locksmithId).catch(console.error)
 *
 * @param locksmithId  Locksmith DB ID
 * @param dailyBudget  Override daily budget (default: £8)
 * @param dryRun       If true, skips DB writes (used for preview/testing)
 */
export async function autoCreateOnboardingCampaignDraft(
  locksmithId: string,
  dailyBudget = AUTO_DRAFT_DAILY_BUDGET_GBP,
  dryRun = false,
): Promise<AutoDraftResult> {
  // 1. Fetch the locksmith
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
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
    },
  });

  if (!locksmith) {
    return { success: false, locksmithId, locksmithName: "unknown", cityLabel: null, outwardPostcode: null, confidence: 0, error: "Locksmith not found" };
  }

  if (!locksmith.isActive) {
    return { success: false, locksmithId, locksmithName: locksmith.name, cityLabel: null, outwardPostcode: null, confidence: 0, skipped: true, skipReason: "Locksmith is not active" };
  }

  // 2. Dedup check — don't re-create a draft within the dedup window
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const existingDraft = await prisma.googleAdsCampaignDraft.findFirst({
    where: {
      aiPrompt: { contains: locksmithId },
      createdAt: { gte: dedupCutoff },
    },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  if (existingDraft) {
    return {
      success: true,
      locksmithId,
      locksmithName: locksmith.name,
      cityLabel: null,
      outwardPostcode: null,
      confidence: 0,
      skipped: true,
      skipReason: `Draft already exists within ${DEDUP_WINDOW_DAYS}d window: "${existingDraft.name}" (${existingDraft.status}, created ${existingDraft.createdAt.toISOString().slice(0, 10)})`,
    };
  }

  // 3. Get the active Google Ads account (required for accountId FK)
  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, customerId: true },
  });

  if (!account) {
    return {
      success: false,
      locksmithId,
      locksmithName: locksmith.name,
      cityLabel: null,
      outwardPostcode: null,
      confidence: 0,
      error: "No active Google Ads account found — connect one at /admin/integrations/google-ads",
    };
  }

  // 4. Attempt to load learnings (non-fatal — first locksmith has none)
  let learnings = null;
  try {
    const { extractLearningsForClient } = await import("@/lib/google-ads-learnings");
    const { getGoogleAdsClientForAccount } = await import("@/lib/google-ads");
    const client = await getGoogleAdsClientForAccount(account.id).catch(() => null);
    if (client) {
      learnings = await extractLearningsForClient(client, { windowDays: 90 }).catch(() => null);
    }
  } catch {
    // Non-fatal: no learnings for first locksmith
  }

  // 5. Enforce district landing URL + generation
  let enforcedLanding;
  try {
    enforcedLanding = await enforceDistrictLandingForDraft({
      locksmithBaseAddress: locksmith.baseAddress,
      contextLabel: `auto-onboarding:${locksmith.id}`,
    });
  } catch (err) {
    return {
      success: false,
      locksmithId,
      locksmithName: locksmith.name,
      cityLabel: null,
      outwardPostcode: extractOutwardPostcode(locksmith.baseAddress),
      confidence: 0,
      skipped: true,
      skipReason: err instanceof Error ? err.message : String(err),
    };
  }

  // 6. Generate the plan via the existing onboarding generator
  let build;
  try {
    build = await generateDraftPlanForLocksmith(locksmith, {
      dailyBudget,
      learnings,
      finalUrl: enforcedLanding.finalUrl,
    });
  } catch (err) {
    return {
      success: false,
      locksmithId,
      locksmithName: locksmith.name,
      cityLabel: null,
      outwardPostcode: null,
      confidence: 0,
      error: `generateDraftPlanForLocksmith failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const { plan, geoTargets, cityLabel } = build;

  // 7. Build postcode-level keywords and prepend them (postcode first = highest weight)
  const outwardPostcode = extractOutwardPostcode(locksmith.baseAddress);
  const postcodeKeywords = outwardPostcode
    ? buildPostcodeKeywords(outwardPostcode, cityLabel)
    : [];

  // Merge: postcode-level first, then plan keywords, dedup by text+matchType, cap 60
  const seen = new Set<string>();
  const mergedKeywords: GoogleKeyword[] = [];
  for (const kw of [...postcodeKeywords, ...plan.keywords]) {
    const key = `${kw.matchType}:${kw.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedKeywords.push(kw);
    if (mergedKeywords.length >= 60) break;
  }

  // 8. Score confidence and decide initial status
  const confidence = scoreDraftConfidence({
    hasPostcode:      !!outwardPostcode,
    hasCityLabel:     !!cityLabel,
    headlineCount:    plan.headlines.length,
    descriptionCount: plan.descriptions.length,
    keywordCount:     mergedKeywords.length,
  });

  const draftStatus = confidence >= CONFIDENCE_THRESHOLD ? "PENDING_APPROVAL" : "DRAFT";

  // 9. Build the final campaign name (postcode badge makes it instantly recognisable)
  const campaignLabel = [
    locksmith.companyName || locksmith.name,
    outwardPostcode ? `(${outwardPostcode})` : cityLabel ? `(${cityLabel})` : null,
  ].filter(Boolean).join(" ");
  const campaignName = `Locksmith — ${campaignLabel}`.slice(0, 60);

  // 10. Write to DB (skip in dry-run)
  if (dryRun) {
    return {
      success: true,
      draftId: "dry-run",
      draftName: campaignName,
      status: draftStatus,
      locksmithId,
      locksmithName: locksmith.name,
      cityLabel,
      outwardPostcode,
      confidence,
    };
  }

  const draft = await prisma.googleAdsCampaignDraft.create({
    data: {
      accountId:        account.id,
      status:           draftStatus,
      name:             campaignName,
      dailyBudget:      dailyBudget,
      biddingStrategy:  "MANUAL_CPC",
      channel:          "SEARCH",
      locationMatchType: "PRESENCE",
      geoTargets,
      languageTargets:  ["1000"], // English
      headlines:        plan.headlines,
      descriptions:     plan.descriptions,
      finalUrl:         plan.finalUrl,
      keywords:         mergedKeywords as unknown as object[],
      negativeKeywords: plan.negativeKeywords,
      aiGenerated:      true,
      aiPrompt:         `auto-onboarding:${locksmithId}`,
      aiReasoning:      [
        plan.reasoning,
        outwardPostcode
          ? `Postcode-level keywords added for ${outwardPostcode} (${postcodeKeywords.length} terms) — uncontested by national chains.`
          : "No outward postcode found in baseAddress — postcode-level keywords skipped.",
        `Confidence score: ${(confidence * 100).toFixed(0)}% → status: ${draftStatus}.`,
      ].join(" "),
    },
    select: { id: true, name: true, status: true },
  });

  // 11. Telegram alert (non-fatal)
  try {
    const { sendAdminAlert } = await import("@/lib/telegram");
    const icon = draftStatus === "PENDING_APPROVAL" ? "✅" : "📝";
    await sendAdminAlert({
      title: `${icon} Auto-draft created — ${locksmith.name}`,
      message:
        `Campaign draft auto-generated for **${locksmith.companyName || locksmith.name}**.\n\n` +
        `📍 Location: ${cityLabel ?? "Unknown"}${outwardPostcode ? ` (${outwardPostcode})` : ""}\n` +
        `💰 Budget: £${dailyBudget}/day\n` +
        `🔑 Keywords: ${mergedKeywords.length} (incl. ${postcodeKeywords.length} postcode-level)\n` +
        `📊 Confidence: ${(confidence * 100).toFixed(0)}%\n` +
        `📋 Status: **${draftStatus}**\n\n` +
        `👉 Review at /admin/integrations/google-ads/drafts`,
      severity: draftStatus === "PENDING_APPROVAL" ? "info" : "warning",
    }).catch(() => {});
  } catch {
    // Non-fatal
  }

  return {
    success: true,
    draftId:      draft.id,
    draftName:    draft.name,
    status:       draft.status,
    locksmithId,
    locksmithName: locksmith.name,
    cityLabel,
    outwardPostcode,
    confidence,
  };
}

// ─── Backfill: process all eligible existing locksmiths ───────────────────

/**
 * Finds every active locksmith who has NO auto-generated campaign draft in
 * the last DEDUP_WINDOW_DAYS and creates one for each.
 *
 * Designed to be called by:
 *   a) The nightly Vercel cron  (/api/cron/auto-draft-existing-locksmiths)
 *   b) The admin manual trigger  (/api/admin/google-ads/auto-draft-backfill)
 *
 * @param limit    Max locksmiths to process in one run (prevents timeout)
 * @param dryRun   If true, skips DB writes — returns preview of what would happen
 */
export async function backfillExistingLocksmithDrafts(
  limit = 20,
  dryRun = false,
): Promise<BackfillResult> {
  const result: BackfillResult = { processed: 0, created: 0, skipped: 0, errors: 0, results: [] };

  // Find all active locksmiths
  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" }, // oldest first = original locksmiths get drafted first
    take: limit * 3, // Fetch more than limit to account for skips
  });

  if (locksmiths.length === 0) return result;

  // Bulk-check which locksmiths already have a recent auto-draft
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const existingDrafts = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      aiPrompt: { startsWith: "auto-onboarding:" },
      createdAt: { gte: dedupCutoff },
    },
    select: { aiPrompt: true },
  });

  // Build set of locksmith IDs that already have a draft
  const alreadyDrafted = new Set(
    existingDrafts
      .map((d) => d.aiPrompt?.replace("auto-onboarding:", ""))
      .filter(Boolean) as string[],
  );

  // Process eligible locksmiths (stop once we hit `limit` creations)
  for (const ls of locksmiths) {
    if (result.created >= limit) break;

    result.processed++;

    if (alreadyDrafted.has(ls.id)) {
      result.skipped++;
      result.results.push({
        success: true,
        locksmithId: ls.id,
        locksmithName: ls.name,
        cityLabel: null,
        outwardPostcode: null,
        confidence: 0,
        skipped: true,
        skipReason: `Already has a draft within ${DEDUP_WINDOW_DAYS}d`,
      });
      continue;
    }

    try {
      const draftResult = await autoCreateOnboardingCampaignDraft(ls.id, AUTO_DRAFT_DAILY_BUDGET_GBP, dryRun);
      result.results.push(draftResult);

      if (draftResult.skipped) {
        result.skipped++;
      } else if (draftResult.success) {
        result.created++;
        // Mark as drafted to prevent duplicate in this run
        alreadyDrafted.add(ls.id);
      } else {
        result.errors++;
      }
    } catch (err) {
      result.errors++;
      result.results.push({
        success: false,
        locksmithId: ls.id,
        locksmithName: ls.name,
        cityLabel: null,
        outwardPostcode: null,
        confidence: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Summary Telegram alert (non-fatal)
  if (!dryRun && result.created > 0) {
    try {
      const { sendAdminAlert } = await import("@/lib/telegram");
      await sendAdminAlert({
        title: `📋 Auto-draft backfill complete`,
        message:
          `Processed **${result.processed}** locksmiths.\n` +
          `✅ Created: ${result.created} drafts\n` +
          `⏭ Skipped: ${result.skipped} (already have draft)\n` +
          `❌ Errors: ${result.errors}\n\n` +
          `👉 Review drafts at /admin/integrations/google-ads/drafts`,
        severity: "info",
      }).catch(() => {});
    } catch {
      // Non-fatal
    }
  }

  return result;
}
