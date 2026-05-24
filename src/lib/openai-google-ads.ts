/**
 * Google Ads campaign generation via the LLM router (local-first).
 *
 * Google Search Ads use a Responsive Search Ad (RSA) shape:
 *  - 3 to 15 headlines, each <= 30 characters
 *  - 2 to 4 descriptions, each <= 90 characters
 *  - one final URL
 *
 * Plus a keyword set with match types (EXACT / PHRASE / BROAD) and
 * a negative-keyword list (free-text, lowercased).
 *
 * Uses Models.QUALITY (qwen3:32b local-first) with explicit OpenAI fallback
 * only for high-severity failures.
 */

import { chat, Models } from "@/lib/llm-router";
import { BUSINESS_CONTEXT, getBusinessSummary } from "./business-context";
import {
  BASELINE_LOCKSMITH_KEYWORDS,
  BASELINE_NEGATIVE_KEYWORDS,
  COMPETITOR_BRAND_NEGATIVES,
  mergeKeywords,
  mergeNegativeKeywords,
} from "./google-ads-keywords";

export const RSA_HEADLINE_MAX = 30;
export const RSA_DESCRIPTION_MAX = 90;
export const RSA_HEADLINE_TARGET_COUNT = 15;
export const RSA_DESCRIPTION_TARGET_COUNT = 4;

export type GoogleKeywordMatchType = "EXACT" | "PHRASE" | "BROAD";

export interface GoogleKeyword {
  text: string;
  matchType: GoogleKeywordMatchType;
  reasoning?: string;
}

export interface GoogleAdsDraftPlan {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  keywords: GoogleKeyword[];
  negativeKeywords: string[];
  campaignName: string;
  recommendedDailyBudget: number; // GBP
  reasoning: string;
}

export interface GenerateGoogleAdsDraftRequest {
  /** Free-form prompt: e.g. "London emergency lockout, push refund guarantee angle" */
  prompt: string;
  /** Defaults to https://locksafe.uk/quote */
  finalUrl?: string;
  /** Defaults to 15 (LockSafe UK conservative test budget) */
  recommendedDailyBudget?: number;
  /** Optional list of competitor brand terms the agent should add as negatives */
  competitorBrands?: string[];
}

function clipString(s: string, max: number): string {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function dedupe<T>(arr: T[], keyFn: (v: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = keyFn(v).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/**
 * Generate a complete Google Ads RSA + keyword plan for a single campaign.
 * Output is validated and clipped to RSA limits — never trust the LLM blindly.
 */
export async function generateGoogleAdsDraftPlan(
  request: GenerateGoogleAdsDraftRequest
): Promise<GoogleAdsDraftPlan> {
  const finalUrl = request.finalUrl || "https://locksafe.uk/quote";
  const competitorBrands = request.competitorBrands ?? [];

  const businessContext = getBusinessSummary();

  const systemPrompt = `You are a senior Google Ads strategist for LockSafe UK,
a London-first anti-fraud locksmith booking platform. Generate ONE Google Search
campaign at a time, optimised for the goal in the user's prompt. You MUST follow
RSA constraints exactly:
- Exactly ${RSA_HEADLINE_TARGET_COUNT} headlines, each <= ${RSA_HEADLINE_MAX} characters.
- Exactly ${RSA_DESCRIPTION_TARGET_COUNT} descriptions, each <= ${RSA_DESCRIPTION_MAX} characters.
- Headlines should be varied: feature, benefit, brand, urgency, proof, CTA.
- Use British English spellings (e.g. "24/7 locksmith", "favourites").
- Include the keyword theme in at least 3 headlines for Quality Score.
- No claims of being "cheapest" or "guaranteed lowest price".
- Risk reversal allowed: "Automatic refund guarantee".

KEYWORDS — CRITICAL RULES (we are paying real money per click):
• We already have a hardcoded baseline of ~35 high-intent locksmith keywords.
  Your job is to ADD campaign-specific terms ON TOP of that baseline — do NOT
  repeat terms from the baseline, and do NOT produce generic terms already
  covered (e.g. "emergency locksmith", "locked out", "24 hour locksmith").
• Produce 10-20 ADDITIONAL keywords specific to the prompt's theme/geography.
• Match type rules for this LAUNCH campaign (no historical conversion data):
    – EXACT: use for high-intent emergency terms where we know the intent
      is to book NOW (e.g. exact city + service combos).
    – PHRASE: use for [city] + service and [service] + [property type] patterns.
    – BROAD: DO NOT USE for this launch. We have zero conversion history.
      Broad match without conversion data = wasted spend. Omit entirely.
• Lowercase, no quotes/brackets in the text field.

NEGATIVE KEYWORDS — CRITICAL RULES:
• We already have a hardcoded list of ~80 permanent negatives (jobs, training,
  DIY, tools, wrong product types, review sites, etc.).
• Your job is to ADD campaign-specific negatives that the baseline doesn't cover.
• Produce at least 20 ADDITIONAL negatives specific to this campaign's theme.
  Think: wrong city names in the area (if geo-specific), wrong property types,
  seasonal misfires, competitor services adjacent to this theme, etc.
• Lowercase free-text (no brackets/quotes).

BUSINESS CONTEXT:
${businessContext}

KILLER DIFFERENTIATORS:
${BUSINESS_CONTEXT.killerDifferentiators.map((d) => `• ${d.headline}: ${d.description}`).join("\n")}

PROOF POINTS (use specifics, not vague claims):
• 2,500+ protected jobs
• £0 customer scam losses
• 100% dispute resolution rate
• 15-minute average response time
• 70% locksmith applicant rejection rate (vetting bar)
• Automatic refund guarantee on every booking`;

  const userPrompt = `Create one Google Ads search campaign.

PROMPT: ${request.prompt}
FINAL URL: ${finalUrl}
RECOMMENDED DAILY BUDGET (GBP): ${request.recommendedDailyBudget ?? 15}
${competitorBrands.length ? `EXTRA COMPETITOR BRANDS TO BLOCK: ${competitorBrands.join(", ")}` : ""}

REMINDER:
- Do NOT include keywords already in our baseline (emergency locksmith, locked out,
  24 hour locksmith, lock change, broken lock, etc.) — add campaign-specific terms only.
- Do NOT use BROAD match — EXACT and PHRASE only for this launch campaign.
- Include at least 20 additional negative keywords beyond the permanent baseline.
- All keywords lowercase, no brackets or quotes in the text field.

Return a JSON object matching this exact shape (no markdown, no commentary):
{
  "campaignName": "string, 5-60 chars, includes campaign theme",
  "headlines": ["string", ... 15 items, each <= ${RSA_HEADLINE_MAX} chars],
  "descriptions": ["string", ... 4 items, each <= ${RSA_DESCRIPTION_MAX} chars],
  "keywords": [
    { "text": "string", "matchType": "EXACT"|"PHRASE", "reasoning": "short" }
  ],
  "negativeKeywords": ["string", ... at least 20 additional terms],
  "recommendedDailyBudget": number,
  "reasoning": "1-3 sentences explaining the angle and expected CAC"
}`;

  const response = await chat(
    Models.QUALITY,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7,
      maxTokens: 2500,
      responseFormat: "json",
      allowOpenAIFallback: true,
      fallbackSeverity: "high",
    }
  );

  const content = response.content;
  if (!content) throw new Error("No response from LLM router for Google Ads draft");

  let parsed: Partial<GoogleAdsDraftPlan>;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Failed to parse Google Ads draft JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Validate + sanitise — never trust raw LLM output for paid spend.
  const headlines = dedupe(
    (parsed.headlines || []).map((h) => clipString(String(h).trim(), RSA_HEADLINE_MAX)),
    (h) => h
  ).slice(0, RSA_HEADLINE_TARGET_COUNT);

  const descriptions = dedupe(
    (parsed.descriptions || []).map((d) => clipString(String(d).trim(), RSA_DESCRIPTION_MAX)),
    (d) => d
  ).slice(0, RSA_DESCRIPTION_TARGET_COUNT);

  if (headlines.length < 3) {
    throw new Error(`Google Ads draft requires >= 3 headlines, got ${headlines.length}`);
  }
  if (descriptions.length < 2) {
    throw new Error(`Google Ads draft requires >= 2 descriptions, got ${descriptions.length}`);
  }

  // Parse the LLM-generated keywords, strip any BROAD that slipped through.
  const llmKeywords: GoogleKeyword[] = dedupe(
    (parsed.keywords || [])
      .map((k) => ({
        text: String(k?.text || "").toLowerCase().trim(),
        matchType: (["EXACT", "PHRASE"] as const).includes(
          k?.matchType as "EXACT" | "PHRASE"
        )
          ? (k.matchType as "EXACT" | "PHRASE")
          : ("PHRASE" as GoogleKeywordMatchType),
        reasoning: k?.reasoning ? String(k.reasoning).slice(0, 200) : undefined,
      }))
      // Silently drop any BROAD match — not allowed until we have conversion data.
      .filter((k) => k.text.length > 0 && k.text.length <= 80 && k.matchType !== "BROAD"),
    (k) => `${k.matchType}:${k.text}`
  );

  // Merge baseline + LLM keywords. Baseline always comes first (preserved).
  // Hard-cap at 50 to stay well within Google Ads limits.
  const keywords: GoogleKeyword[] = mergeKeywords(
    // Strip BROAD from baseline too for launch — only EXACT and PHRASE.
    BASELINE_LOCKSMITH_KEYWORDS.filter((k) => k.matchType !== "BROAD"),
    llmKeywords,
  ).slice(0, 50);

  if (keywords.length < 5) {
    throw new Error(`Google Ads draft requires >= 5 keywords, got ${keywords.length}`);
  }

  // Merge: baseline permanents + LLM-generated additions + competitor brands
  // passed to this call + our built-in competitor/aggregator brand list.
  // No hard cap — Google Ads supports thousands of negative keywords at
  // campaign level.  We impose a generous 500-term cap to prevent oversized
  // DB payloads while still allowing comprehensive coverage.
  const negativeKeywords = mergeNegativeKeywords(
    BASELINE_NEGATIVE_KEYWORDS,
    (parsed.negativeKeywords || []).map((n) => String(n).toLowerCase().trim()).filter(Boolean),
    competitorBrands,
    COMPETITOR_BRAND_NEGATIVES,
  ).filter((n) => n.length <= 80).slice(0, 500);

  const recommendedDailyBudget = Math.max(
    1,
    Math.min(
      500,
      Number(parsed.recommendedDailyBudget) ||
        request.recommendedDailyBudget ||
        15
    )
  );

  const campaignName = String(parsed.campaignName || "LockSafe Search").slice(0, 60);
  const reasoning = String(parsed.reasoning || "").slice(0, 1000);

  return {
    campaignName,
    headlines,
    descriptions,
    finalUrl,
    keywords,
    negativeKeywords,
    recommendedDailyBudget,
    reasoning,
  };
}
