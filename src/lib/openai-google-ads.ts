/**
 * OpenAI helpers for Google Ads campaign generation.
 *
 * Google Search Ads use a Responsive Search Ad (RSA) shape:
 *  - 3 to 15 headlines, each <= 30 characters
 *  - 2 to 4 descriptions, each <= 90 characters
 *  - one final URL
 *
 * Plus a keyword set with match types (EXACT / PHRASE / BROAD) and
 * a negative-keyword list (free-text, lowercased).
 *
 * Reuses the LockSafe UK business context + copywriting frameworks from
 * src/lib/openai-ads.ts but constrains the output strictly to Google's
 * length limits — Meta-shape copy will violate RSA constraints.
 */

import OpenAI from "openai";
import { BUSINESS_CONTEXT, getBusinessSummary } from "./business-context";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

KEYWORDS: produce 12-25 keywords mixed across match types. Skew towards
PHRASE and EXACT for high-intent terms ("emergency locksmith london"),
use BROAD only for discovery themes. Lowercase, no quotes/brackets — the
match type is conveyed in the JSON field, not the text. No duplicates.

NEGATIVE KEYWORDS: include 8-15 obvious wasteful queries (jobs, training,
tutorial, free, cheap, salary, course, near me on its own without context,
plus the supplied competitor brands). Lowercase free-text.

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
${competitorBrands.length ? `COMPETITOR BRANDS TO ADD AS NEGATIVES: ${competitorBrands.join(", ")}` : ""}

Return a JSON object matching this exact shape (no markdown, no commentary):
{
  "campaignName": "string, 5-60 chars, includes campaign theme",
  "headlines": ["string", ... 15 items, each <= ${RSA_HEADLINE_MAX} chars],
  "descriptions": ["string", ... 4 items, each <= ${RSA_DESCRIPTION_MAX} chars],
  "keywords": [
    { "text": "string", "matchType": "EXACT"|"PHRASE"|"BROAD", "reasoning": "short" }
  ],
  "negativeKeywords": ["string", ...],
  "recommendedDailyBudget": number,
  "reasoning": "1-3 sentences explaining the angle and expected CAC"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI for Google Ads draft");

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

  const keywords: GoogleKeyword[] = dedupe(
    (parsed.keywords || [])
      .map((k) => ({
        text: String(k?.text || "").toLowerCase().trim(),
        matchType: (["EXACT", "PHRASE", "BROAD"] as const).includes(
          k?.matchType as GoogleKeywordMatchType
        )
          ? (k.matchType as GoogleKeywordMatchType)
          : ("PHRASE" as GoogleKeywordMatchType),
        reasoning: k?.reasoning ? String(k.reasoning).slice(0, 200) : undefined,
      }))
      .filter((k) => k.text.length > 0 && k.text.length <= 80),
    (k) => `${k.matchType}:${k.text}`
  ).slice(0, 30);

  if (keywords.length < 5) {
    throw new Error(`Google Ads draft requires >= 5 keywords, got ${keywords.length}`);
  }

  const negativeKeywords = dedupe(
    [...(parsed.negativeKeywords || []), ...competitorBrands]
      .map((n) => String(n).toLowerCase().trim())
      .filter((n) => n.length > 0 && n.length <= 80),
    (n) => n
  ).slice(0, 50);

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
