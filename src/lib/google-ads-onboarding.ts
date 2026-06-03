/**
 * Per-locksmith Google Ads draft generator.
 *
 * Given a single onboarded Locksmith, produce a campaign draft that:
 *   1. Targets ONLY the geos that locksmith physically covers.
 *   2. Re-uses the keywords that have already converted on the account
 *      (extracted via `google-ads-learnings.extractLearnings*`).
 *   3. Re-uses negative keywords that have already burned money on the
 *      account, plus the permanent baseline list.
 *   4. Generates locksmith-specific RSA copy via the LLM router, seeded
 *      with the proven-headline library so the output stays on-brand.
 *
 * Output is the same shape the rest of the pipeline already understands
 * (`GoogleAdsDraftPlan`) so it can be persisted to `GoogleAdsCampaignDraft`
 * straight away.
 *
 * Strategy notes (locked in by user direction):
 *   - The very FIRST locksmith on the account has no learnings to draw on,
 *     so the generator falls back to BASELINE keywords + the deep-research
 *     campaign plan headlines/descriptions. We never block draft creation
 *     just because the learnings payload is empty.
 *   - Geo derivation: prefer the locksmith's borough/city (resolved via
 *     `google-ads-locations`); fall back to UK-wide if nothing matches.
 *   - Budget: keep small for per-locksmith pilots (£10/day default) so a
 *     single dispatch failure doesn't burn money in their area.
 */

import type { Locksmith } from "@prisma/client";

import { BUSINESS_CONTEXT, getBusinessSummary } from "@/lib/business-context";
import { chat, Models } from "@/lib/llm-router";
import { renderPlaybookForPrompt } from "@/lib/google-ads-playbook";
import {
  BASELINE_LOCKSMITH_KEYWORDS,
  BASELINE_NEGATIVE_KEYWORDS,
  COMPETITOR_BRAND_NEGATIVES,
  mergeKeywords,
  mergeNegativeKeywords,
} from "@/lib/google-ads-keywords";
import { getNegativeSeedKeywords } from "@/agents/core/seed-bank";
import { scrubForbiddenAdCopy } from "@/lib/google-ads-copy-guard";
import {
  type GoogleAdsLearnings,
  provenKeywordsToGoogleKeywords,
} from "@/lib/google-ads-learnings";
import {
  UK_GEO_IDS,
  type UKGeoKey,
  resolveLocksmithGeo as resolveGeoCanonical,
} from "@/lib/google-ads-locations";
import {
  RSA_DESCRIPTION_MAX,
  RSA_DESCRIPTION_TARGET_COUNT,
  RSA_HEADLINE_MAX,
  RSA_HEADLINE_TARGET_COUNT,
  type GoogleAdsDraftPlan,
  type GoogleKeyword,
} from "@/lib/openai-google-ads";

// ─── Public types ───────────────────────────────────────────────────────────

export interface GenerateLocksmithDraftOptions {
  /** Override the £/day budget. Defaults to 10 for per-locksmith pilots. */
  dailyBudget?: number;
  /**
   * Override the final URL. Defaults to the LockSafe intent landing for the
   * locksmith's resolved city, falling back to /quote.
   */
  finalUrl?: string;
  /** Pre-fetched learnings — pass to avoid a second extraction call. */
  learnings?: GoogleAdsLearnings | null;
}

export interface LocksmithDraftBuild {
  plan: GoogleAdsDraftPlan;
  geoTargets: string[];
  cityLabel: string | null;
  usedLearnings: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function clip(s: string, max: number): string {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
  }
  return out;
}

/**
 * Resolve a locksmith's base location to a (geoId, cityKey) pair, with
 * graceful fallback to UK-wide.
 */
function resolveLocksmithGeo(
  locksmith: Pick<Locksmith, "baseAddress" | "baseLat" | "baseLng">,
): {
  geoTargets: string[];
  cityLabel: string | null;
  cityKey: UKGeoKey | null;
} {
  // Delegate to the canonical resolver in google-ads-locations: it matches the
  // address text first, then falls back to nearest-city by lat/lng. This is why
  // coords-only locksmiths (no recognisable town word in baseAddress) now resolve
  // to their actual town instead of defaulting to UK-wide.
  const r = resolveGeoCanonical({
    baseAddress: locksmith.baseAddress,
    baseLat: locksmith.baseLat,
    baseLng: locksmith.baseLng,
  });
  if (r) {
    return { geoTargets: [r.geoId], cityLabel: r.label, cityKey: r.cityKey };
  }
  return { geoTargets: [UK_GEO_IDS.uk], cityLabel: null, cityKey: null };
}

/**
 * Default landing URL convention used by the SEO intent landings.
 * If the city slug doesn't exist as an intent landing, the LockSafe app
 * falls back to /quote via the route handler — so this is always safe.
 */
function defaultFinalUrlForCity(cityLabel: string | null): string {
  if (!cityLabel) return "https://www.locksafe.uk/quote";
  return `https://www.locksafe.uk/locksmith-${slugify(cityLabel)}`;
}

// ─── Geo-modify proven keywords ─────────────────────────────────────────────

/**
 * For a locksmith in city X, augment every proven keyword with "{kw} {city}"
 * PHRASE variants. This is the safest way to localise without going BROAD.
 */
function localiseKeywords(
  proven: GoogleKeyword[],
  cityLabel: string | null,
): GoogleKeyword[] {
  if (!cityLabel) return proven;
  const city = cityLabel.toLowerCase();
  const out: GoogleKeyword[] = [...proven];
  const seen = new Set(out.map((k) => `${k.matchType}:${k.text.toLowerCase()}`));
  for (const kw of proven) {
    if (kw.text.includes(city)) continue;
    // Only add a localised PHRASE variant for the broadest service terms,
    // not for already-specific phrases. Otherwise we explode KW count.
    if (kw.text.length > 30) continue;
    const localised = {
      text: `${kw.text} ${city}`,
      matchType: "PHRASE" as const,
      reasoning: `Localised to ${cityLabel}`,
    };
    const key = `${localised.matchType}:${localised.text.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(localised);
    }
  }
  return out;
}

// ─── RSA copy generator ────────────────────────────────────────────────────

interface CopyGenerationInput {
  locksmithName: string;
  cityLabel: string | null;
  yearsExperience: number;
  rating: number;
  totalJobs: number;
  finalUrl: string;
  provenHeadlines: string[];
  provenDescriptions: string[];
}

async function generateRsaCopy(
  input: CopyGenerationInput,
): Promise<{ headlines: string[]; descriptions: string[]; reasoning: string }> {
  const businessContext = getBusinessSummary();
  const cityClause = input.cityLabel
    ? `Local market: ${input.cityLabel}.`
    : "Market: United Kingdom (no specific city resolved).";

  const provenSamples = input.provenHeadlines.length
    ? `\n\nALREADY-PROVEN HEADLINES (use these as inspiration, don't copy verbatim):\n${input.provenHeadlines.slice(0, 12).map((h) => `• ${h}`).join("\n")}`
    : "";
  const provenDescSamples = input.provenDescriptions.length
    ? `\n\nALREADY-PROVEN DESCRIPTIONS:\n${input.provenDescriptions.slice(0, 6).map((d) => `• ${d}`).join("\n")}`
    : "";

  // Read the self-learning playbook so the agent applies accumulated, measured
  // best-practice to this campaign. DB-backed and fully guarded: any failure
  // leaves `playbookBlock` empty and copy generation proceeds unchanged.
  let playbookBlock = "";
  try {
    const rendered = await renderPlaybookForPrompt();
    if (rendered) playbookBlock = `\n\n${rendered}`;
  } catch (err) {
    console.warn("[google-ads-onboarding] playbook read failed (continuing without it):", err instanceof Error ? err.message : err);
  }

  const systemPrompt = `You are a senior Google Ads strategist for LockSafe UK.
You write Responsive Search Ad copy for ONE specific vetted locksmith on the
LockSafe platform. The ad MUST:
- Use British English.
- Reference local context (city/borough) when supplied.
- Lead with TRUST: vetted, insured, anti-fraud booking guarantee.
- Never claim "cheapest" or "guaranteed lowest price".
- Stay strictly within RSA character limits:
    • Headlines: exactly ${RSA_HEADLINE_TARGET_COUNT}, each <= ${RSA_HEADLINE_MAX} chars.
    • Descriptions: exactly ${RSA_DESCRIPTION_TARGET_COUNT}, each <= ${RSA_DESCRIPTION_MAX} chars.

BUSINESS CONTEXT:
${businessContext}

PROOF POINTS:
${BUSINESS_CONTEXT.killerDifferentiators.slice(0, 3).map((d) => `• ${d.headline}`).join("\n")}
${provenSamples}${provenDescSamples}${playbookBlock}`;

  const userPrompt = `Write RSA copy for this locksmith:

LOCKSMITH: ${input.locksmithName}
${cityClause}
YEARS EXPERIENCE: ${input.yearsExperience}
RATING: ${input.rating.toFixed(1)}/5
JOBS COMPLETED ON LOCKSAFE: ${input.totalJobs}
FINAL URL: ${input.finalUrl}

Return a JSON object (no markdown, no commentary):
{
  "headlines": ["string", ... ${RSA_HEADLINE_TARGET_COUNT} items, each <= ${RSA_HEADLINE_MAX} chars],
  "descriptions": ["string", ... ${RSA_DESCRIPTION_TARGET_COUNT} items, each <= ${RSA_DESCRIPTION_MAX} chars],
  "reasoning": "1-2 sentence justification of the angle"
}`;

  const response = await chat(
    Models.QUALITY,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7,
      maxTokens: 1500,
      responseFormat: "json",
      allowOpenAIFallback: true,
      fallbackSeverity: "high",
    },
  );

  const raw = response.content;
  let parsed: { headlines?: unknown; descriptions?: unknown; reasoning?: unknown } = {};
  try {
    parsed = JSON.parse(raw ?? "{}");
  } catch {
    parsed = {};
  }

  const headlines = scrubForbiddenAdCopy(
    dedupe(
      (Array.isArray(parsed.headlines) ? parsed.headlines : [])
        .map((h) => clip(String(h).trim(), RSA_HEADLINE_MAX)),
    ),
  ).slice(0, RSA_HEADLINE_TARGET_COUNT);

  const descriptions = scrubForbiddenAdCopy(
    dedupe(
      (Array.isArray(parsed.descriptions) ? parsed.descriptions : [])
        .map((d) => clip(String(d).trim(), RSA_DESCRIPTION_MAX)),
    ),
  ).slice(0, RSA_DESCRIPTION_TARGET_COUNT);

  return {
    headlines,
    descriptions,
    reasoning: String(parsed.reasoning ?? "").slice(0, 500),
  };
}

// ─── Fallback RSA copy (used when no learnings AND LLM call returns empty) ──

function fallbackHeadlines(cityLabel: string | null): string[] {
  const city = cityLabel ?? "UK";
  return [
    `${city} Locksmith — 24/7`,
    "Vetted & Insured Locksmiths",
    "Upfront Fixed Pricing",
    "Anti-Fraud Booking Guarantee",
    "Book in 60 Seconds",
    "15 Min Response Time",
    `Trusted ${city} Locksmith`,
    "Fixed Price Lock Change",
    "Money-Back Guarantee",
    "See Prices Before Booking",
    "Emergency Locksmith Help",
    "LockSafe Verified Tradie",
    "GPS-Tracked to Your Door",
    "Insured & Background-Checked",
    "Get a Locksmith Now",
  ]
    .map((h) => clip(h, RSA_HEADLINE_MAX))
    .slice(0, RSA_HEADLINE_TARGET_COUNT);
}

function fallbackDescriptions(cityLabel: string | null): string[] {
  const city = cityLabel ?? "the UK";
  return [
    `LockSafe connects you with vetted, insured locksmiths in ${city} in under 30 minutes.`,
    "Anti-fraud protection built in. See the full price up front before any work starts.",
    "All LockSafe locksmiths are background-checked, GPS-tracked & fully insured. Book now.",
    "Emergency lockout service. Transparent pricing. Money-back guarantee available 24/7.",
  ].map((d) => clip(d, RSA_DESCRIPTION_MAX)).slice(0, RSA_DESCRIPTION_TARGET_COUNT);
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function generateDraftPlanForLocksmith(
  locksmith: Pick<
    Locksmith,
    "id" | "name" | "companyName" | "baseAddress" | "baseLat" | "baseLng" | "yearsExperience" | "rating" | "totalJobs"
  >,
  options: GenerateLocksmithDraftOptions = {},
): Promise<LocksmithDraftBuild> {
  const learnings = options.learnings ?? null;

  // 1. Geo
  const { geoTargets, cityLabel } = resolveLocksmithGeo(locksmith);

  // 2. Final URL
  const finalUrl = options.finalUrl ?? defaultFinalUrlForCity(cityLabel);

  // 3. Keyword set
  const provenKwsRaw = learnings
    ? provenKeywordsToGoogleKeywords(
        [...learnings.topConvertingKeywords, ...learnings.searchTermCandidates],
        { maxCostPerConv: 25, max: 30 },
      )
    : [];
  const provenKws = localiseKeywords(provenKwsRaw, cityLabel);

  // BASELINE first, then proven, then dedup. Cap to 50.
  const keywords: GoogleKeyword[] = mergeKeywords(
    BASELINE_LOCKSMITH_KEYWORDS.filter((k) => k.matchType !== "BROAD"),
    provenKws,
  ).slice(0, 50);

  // 4. Negative keyword set (baseline + admin-marked seeds + learnings + competitors)
  const dbNegatives = await getNegativeSeedKeywords();
  const negativeKeywords = mergeNegativeKeywords(
    BASELINE_NEGATIVE_KEYWORDS,
    dbNegatives,
    learnings?.searchTermNegativeCandidates ?? [],
    learnings?.zeroConvKeywords?.map((k) => k.text) ?? [],
    COMPETITOR_BRAND_NEGATIVES,
  ).filter((n) => n.length <= 80).slice(0, 500);

  // 5. RSA copy
  const provenHeadlines = learnings
    ? Array.from(new Set(learnings.bestPerformingAds.flatMap((a) => a.headlines))).slice(0, 20)
    : [];
  const provenDescriptions = learnings
    ? Array.from(new Set(learnings.bestPerformingAds.flatMap((a) => a.descriptions))).slice(0, 10)
    : [];

  let headlines: string[] = [];
  let descriptions: string[] = [];
  let copyReasoning = "";

  try {
    const copy = await generateRsaCopy({
      locksmithName: locksmith.companyName || locksmith.name,
      cityLabel,
      yearsExperience: locksmith.yearsExperience ?? 0,
      rating: locksmith.rating ?? 5,
      totalJobs: locksmith.totalJobs ?? 0,
      finalUrl,
      provenHeadlines,
      provenDescriptions,
    });
    headlines = copy.headlines;
    descriptions = copy.descriptions;
    copyReasoning = copy.reasoning;
  } catch (err) {
    copyReasoning = `LLM copy generation failed: ${err instanceof Error ? err.message : String(err)} — using fallback`;
  }

  if (headlines.length < 3) headlines = fallbackHeadlines(cityLabel);
  if (descriptions.length < 2) descriptions = fallbackDescriptions(cityLabel);

  // 6. Pack the plan
  const recommendedDailyBudget = options.dailyBudget ?? 10;
  const campaignName = `Locksmith — ${locksmith.companyName || locksmith.name}${cityLabel ? ` (${cityLabel})` : ""}`.slice(0, 60);

  const reasoning = [
    `Per-locksmith pilot draft for ${locksmith.companyName || locksmith.name}.`,
    cityLabel ? `Targeting ${cityLabel}.` : "Targeting United Kingdom (no city resolved).",
    learnings
      ? `Seeded with ${learnings.topConvertingKeywords.length} converting keywords and ${learnings.bestPerformingAds.length} proven RSAs from last ${learnings.windowDays}d (cost £${learnings.totals.cost.toFixed(2)}, conv ${learnings.totals.conversions}).`
      : "No historical learnings available — using baseline keyword set only.",
    copyReasoning,
  ].filter(Boolean).join(" ");

  const plan: GoogleAdsDraftPlan = {
    campaignName,
    headlines,
    descriptions,
    finalUrl,
    keywords,
    negativeKeywords,
    recommendedDailyBudget,
    reasoning,
  };

  return {
    plan,
    geoTargets,
    cityLabel,
    usedLearnings: !!learnings && (learnings.topConvertingKeywords.length > 0 || learnings.bestPerformingAds.length > 0),
  };
}
