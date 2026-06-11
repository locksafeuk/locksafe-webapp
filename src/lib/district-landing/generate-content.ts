/**
 * District-Landing Content Generator
 *
 * Takes structured facts → calls the LLM (Ollama-first, OpenAI fallback)
 * → validates → returns parsed content blocks ready for persistence.
 *
 * Retry strategy:
 *   • 1st attempt: standard prompt, temperature 0.6
 *   • If validator fails (banned phrase or missing block): retry once
 *     with the offending phrases pinned to the forbidden list and a
 *     softer "be specific, not template" emphasis
 *   • 2nd failure: throw — caller decides what to do (campaign
 *     orchestrator blocks the draft creation)
 *
 * No hand-curated template fallback. The whole point of this build
 * is to avoid template prose; falling back to one would defeat the
 * SEO thesis.
 */

import { chat, Models } from "@/lib/llm-router";
import type { DistrictFacts } from "@/lib/district-landing/assemble-facts";
import {
  validateLLMOutput,
  type RawContent,
  type ValidationResult,
} from "@/lib/district-landing/validate-content";

// ── Public types ────────────────────────────────────────────────────────────

export interface GenerationResult {
  content:        RawContent;
  modelUsed:      string;   // e.g. "ollama:qwen3:32b" or "openai:gpt-4o-mini"
  attempts:       number;   // 1 or 2
  validationLog:  ValidationResult[];
}

export class ContentGenerationError extends Error {
  public readonly attempts: ValidationResult[];
  constructor(message: string, attempts: ValidationResult[]) {
    super(message);
    this.name = "ContentGenerationError";
    this.attempts = attempts;
  }
}

// ── The prompt — the heart of the system ───────────────────────────────────

/**
 * Build the system + user prompt pair for a given district's facts.
 * Two reasons this is a function not a template literal:
 *   1. Retry can append phrases to the banned list
 *   2. We omit data the facts don't have (e.g. nearbyOutcodes empty)
 */
export function buildPrompt(
  facts: DistrictFacts,
  extraBanned: string[] = [],
): { system: string; user: string } {
  const factsBlock = formatFactsBlock(facts);
  const extraBanList = extraBanned.length > 0
    ? `\n\n  Additional forbidden phrases (DO NOT USE — they appeared in a prior attempt):\n  ${extraBanned.map((p) => `    • "${p}"`).join("\n  ")}`
    : "";

  const system =
`You are writing the website copy for a real UK locksmith business
called LockSafe. The page is for a specific UK postcode district. It
must read like a confident local tradesperson wrote it — never like
programmatic SEO content.

GROUNDING RULES — STRICT
  • Use ONLY the facts in the FACTS block below.
  • If a fact is missing, omit that detail. NEVER invent numbers, named
    streets, named landmarks, customer counts, response times, ratings,
    or business history.
  • The brand is "LockSafe". Refer to the company as "LockSafe" or
    "we" — never name an individual engineer. The engineer's BASE
    LOCATION (a town/area) IS in the facts and CAN be referenced.

CLAIMABLE TRUST SIGNALS (verifiable, safe to mention)
  • DBS-checked engineers (AI-verified at onboarding)
  • Insured / public liability (AI-verified certificates)
  • Fixed price agreed before any work starts
  • Real local engineer, not a national call-centre
  • Around-the-clock dispatch (LockSafe operates 24/7)
  • GPS-tracked engineer on the way

FEE POLICY — STATE TRUTHFULLY (CRITICAL)
  • LockSafe DOES charge a call-out / assessment fee. This is true and
    must never be denied. "Fixed price agreed up front" means the TOTAL
    price (including the call-out) is disclosed and agreed before any
    work starts — it does NOT mean the service is free or that there is
    no call-out fee.
  • If a FAQ or any copy touches on call-out charges, answer truthfully:
    YES, a call-out fee applies, and it is shown to the customer up front
    as part of a fixed, agreed price with no hidden extras. NEVER answer
    "no" to "do you charge for call-outs?" — that is a false statement.
  • Safe framings: "transparent, fixed pricing agreed before any work",
    "no hidden fees" (the call-out is disclosed, not hidden). Unsafe:
    anything implying the visit or call-out itself is free.

FORBIDDEN PHRASES — ABSOLUTE
  The following must NEVER appear in your output. Some are template
  tells Google flags as low-quality; others are accreditations LockSafe
  does not currently hold (using them would be misrepresentation under
  UK consumer protection law).

    • "MLA", "MLA-approved", "MLA approved", "MLA member", "MLA licensed"
    • "Master locksmiths", "Master Locksmiths Association", "master-locksmith"
    • "Which? Trusted Trader"
    • "Checkatrade"
    • "Trustmark", "Trading Standards approved"
    • "Need a locksmith in X?" (any variant of this construction)
    • "Verified locksmiths covering all postcodes"
    • "Look no further", "Don't hesitate", "Do not hesitate"
    • "Best locksmith in X", "Leading locksmith", "Premier locksmith"
    • "Top-rated locksmith", "Trusted by thousands"
    • "Click here", "Call now!" (with exclamation), "Affordable prices"
    • "Wide range of services", "Competitive prices"
    • "No call-out fee", "no call out fee", "free call-out", "free callout",
      "no charge for call-outs", or answering "No" to whether call-outs are
      charged (ALL FALSE — LockSafe charges a call-out fee, see FEE POLICY)
    • SEO-tail template openers — any sentence shaped like:
        - "Reliable [X] Services for [Town] Residents"
        - "Professional [X] in [Town]"
        - "Trusted [X] Provider for [Town]"
        - "[X] You Can Trust"
        - "Quality [X] at Affordable Prices"
      Open the page like a person introduces themselves — not like a
      keyword stuffer. Mention the district code or town naturally; do
      not wrap it in a corporate-marketing frame.${extraBanList}

WRITING STYLE
  • Voice: confident, honest, local UK tradesperson. Not corporate.
  • No exclamation marks anywhere.
  • Vary sentence rhythm — mix short and longer sentences naturally.
  • State trust facts BRIEFLY when relevant. Do not preach or repeat.
  • If you reference nearby outcodes, name them ("we also cover RG2
    and RG30 from the same workshop"), not generic phrases.

ANSWER-FIRST FAQ STRUCTURE (for AI search / featured snippets) — IMPORTANT
  • Each FAQ answer MUST open with a direct, self-contained answer to the
    exact question in the FIRST 1-2 sentences — no preamble, no "Great
    question", no restating the question. A reader (or an AI engine) must
    get the full answer from those opening sentences alone.
  • Lead with the concrete fact FROM THE FACTS BLOCK: a yes/no, the
    response-time band given in the facts, a "what happens" — never a
    response time you made up. E.g. Q "Do you cover my area in RG1?" →
    A "Yes. Our nearest engineer works from [base location in facts],
    inside the coverage radius for RG1, so this district is fully served."
  • After that opening answer you may add ONE sentence of useful detail.
    Keep each answer 2-4 sentences total. Do not pad.
  • Phrase each question the way a real customer would type or speak it
    into Google or an AI assistant (natural language, often starting with
    how/what/do/can/how much), not as a keyword string.

OUTPUT FORMAT — STRICT JSON
  Return ONE JSON object, no markdown wrapper, no commentary before
  or after. The object MUST have exactly these keys:

  {
    "heroHeadline":      string,   // 6-12 words, district-specific
    "heroSubcopy":       string,   // ONE sentence supporting the headline
    "introParagraph":    string,   // 3-5 sentences introducing the district + LockSafe
    "coverageNarrative": string,   // 1 paragraph: where we cover from, how
                                   //   many engineers, typical response.
                                   //   Refer to LockSafe ("we", "LockSafe"),
                                   //   never name an engineer.
    "whyChooseUs":       string,   // 1 paragraph anti-shark voice:
                                   //   real local engineer, fixed price,
                                   //   no call-centre. Brief, not preachy.
    "faqs": [                      // 4-6 entries. Each answer ANSWER-FIRST:
                                   //   direct answer in sentence 1, then ≤1
                                   //   detail sentence. See ANSWER-FIRST rule.
      { "question": string, "answer": string }
    ],
    "localTrustAnchors": [string]  // 3-5 short bullets, ≤8 words each.
                                   //   E.g. "DBS-checked engineer",
                                   //   "Within 8 miles of every RG1 postcode",
                                   //   "Fixed price agreed up front"
  }`;

  const user =
`FACTS for this generation:

${factsBlock}

Write the JSON object now.`;

  return { system, user };
}

// ── Facts → prompt-readable block ──────────────────────────────────────────

function formatFactsBlock(facts: DistrictFacts): string {
  const lines: string[] = [];
  lines.push(`  District:             ${facts.district}`);
  if (facts.anchorTown) lines.push(`  Anchor town:          ${facts.anchorTown}`);
  if (facts.region)     lines.push(`  Region:               ${facts.region}`);
  if (facts.country)    lines.push(`  Country:              ${facts.country}`);
  if (facts.nearbyOutcodes.length > 0) {
    lines.push(
      `  Nearby outcodes we also cover: ${facts.nearbyOutcodes.join(", ")}`,
    );
  }
  lines.push("");
  lines.push("  Engineer (DO NOT NAME — use LockSafe / 'we' only):");
  if (facts.featuredEngineerBaseLocation) {
    lines.push(`    Engineer's base location: ${facts.featuredEngineerBaseLocation}`);
  }
  if (facts.featuredEngineerRadiusMi) {
    lines.push(`    Engineer's coverage radius: ${facts.featuredEngineerRadiusMi} miles`);
  }
  if (facts.featuredEngineerTravelMins) {
    lines.push(`    Typical response time: ${facts.featuredEngineerTravelMins}`);
  }
  if (facts.featuredEngineerYears) {
    lines.push(`    Engineer's years of experience: ${facts.featuredEngineerYears}`);
  }
  lines.push(`    LockSafe engineers covering this district: ${facts.totalEngineersCount}`);
  lines.push("");
  lines.push("  Verified trust signals (CLAIMABLE — all true for LockSafe):");
  const t = facts.trustSignals;
  if (t.dbsChecked)        lines.push("    • DBS-checked engineers");
  if (t.insured)           lines.push("    • Insured (public liability)");
  if (t.fixedPriceProcess) lines.push("    • Fixed price agreed before any work starts");
  if (t.realLocalEngineer) lines.push("    • Real local engineer, not a national call-centre");
  if (t.twentyFourSeven)   lines.push("    • Around-the-clock dispatch (24/7)");
  if (t.gpsTracked)        lines.push("    • GPS-tracked engineer dispatched");
  return lines.join("\n");
}

// ── Main entry point ───────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 60_000;

export async function generateDistrictContent(facts: DistrictFacts): Promise<GenerationResult> {
  const attemptsLog: ValidationResult[] = [];
  let extraBanned: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { system, user } = buildPrompt(facts, extraBanned);

    const llmResponse = await chat(
      Models.CONTENT,
      [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
      {
        temperature:           attempt === 1 ? 0.6 : 0.5,
        responseFormat:        "json",
        timeoutMs:             GENERATION_TIMEOUT_MS,
        allowOpenAIFallback:   true,
        // High severity = router's "emergency" path: lets this call reach OpenAI
        // even when the global fallback toggle/min-severity would block a "low"
        // call. Needed so prod page generation works on OpenAI when Ollama isn't
        // reachable (serverless). Cost is trivial (gpt-4o-mini, ~$0.001/page).
        fallbackSeverity:      "high",
      },
    );

    const validation = validateLLMOutput(llmResponse.content);
    attemptsLog.push(validation);

    if (validation.ok && validation.parsed) {
      return {
        content:       validation.parsed,
        modelUsed:     llmResponse.usedFallback
          ? `openai:${llmResponse.model}`
          : `ollama:${llmResponse.model}`,
        attempts:      attempt,
        validationLog: attemptsLog,
      };
    }

    // Retry path — pin any new banned-phrase hits explicitly
    extraBanned = Array.from(new Set([...extraBanned, ...validation.bannedHits]));

    console.warn(
      `[district-landing] generation attempt ${attempt} failed for ${facts.district}: `
      + `banned=${validation.bannedHits.length} missing=${validation.missing.join(",") || "—"} `
      + `malformed=${validation.malformed ?? false}`,
    );
  }

  throw new ContentGenerationError(
    `Failed to generate valid content for ${facts.district} after 2 attempts`,
    attemptsLog,
  );
}
