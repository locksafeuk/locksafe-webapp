/**
 * OpenAI Integration for AI-Powered Ad Creation
 *
 * Features:
 * - Elite ad copy generation using frameworks from:
 *   - Neil Patel — Data-Driven Hooks (specific stat → curiosity → benefit)
 *   - Neil Patel — Search-Intent Promise (mirror searcher question → deliver answer)
 *   - Ryan Deiss  — Before / After / Bridge (pain → relief → product as bridge)
 *   - Ryan Deiss  — PAS + Customer Value Journey (problem → agitate → solve, awareness-stage aware)
 * - Audience suggestions based on LockSafe UK business context
 * - Performance analysis and optimization recommendations
 * - Creative fatigue detection
 * - A/B testing recommendations
 *
 * All prompts include LockSafe UK business context for accurate, relevant output.
 */

import OpenAI from 'openai';
import {
  BUSINESS_CONTEXT,
  getBusinessSummary,
  getAudienceContext,
  getSeasonalContext,
  getObjectionHandlers,
} from './business-context';
import {
  NEIL_PATEL_DATA_DRIVEN,
  NEIL_PATEL_SEARCH_INTENT,
  RYAN_DEISS_BAB,
  RYAN_DEISS_PAS,
  JUSTIN_WELSH_HOOKS,
  RUSSELL_BRUNSON_FRAMEWORKS,
  NICHOLAS_COLE_FRAMEWORKS,
  SIMON_SINEK_FRAMEWORKS,
  POWER_FRAMEWORKS,
  AD_COPY_TEMPLATES,
  POWER_HEADLINES,
} from './copywriting-frameworks';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface AdCopyRequest {
  productDescription?: string; // Optional - will use business context if not provided
  targetAudience?: string;
  goal: 'leads' | 'sales' | 'traffic' | 'awareness';
  tone?: 'professional' | 'casual' | 'urgent' | 'friendly' | 'luxury';
  copyStyle?: 'story' | 'direct' | 'why-led' | 'problem-solution' | 'benefit-stack';
  uniqueSellingPoints?: string[];
  competitors?: string[];
  /** Optional service slug from the Meta product catalog (e.g. "lock-change", "emergency-lockout"). */
  service?: string;
  /** Optional human-readable service name to anchor the copy (e.g. "Emergency Lockout"). */
  serviceName?: string;
  constraints?: {
    maxPrimaryTextLength?: number;
    maxHeadlineLength?: number;
    avoidWords?: string[];
  };
}

export interface AdCopyVariation {
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  emotionalAngle: 'urgency' | 'fear' | 'trust' | 'control' | 'benefit';
  framework: string; // Which expert framework was used
  reasoning: string;
  hookType?: string;
}

export interface AudienceSuggestion {
  name: string;
  description: string;
  demographics: {
    ageMin: number;
    ageMax: number;
    genders: ('male' | 'female' | 'all')[];
  };
  interests: string[];
  behaviors: string[];
  estimatedReach: 'narrow' | 'moderate' | 'broad';
  reasoning: string;
  suggestedBudget: {
    daily: number;
    currency: string;
  };
}

export interface PerformanceAnalysis {
  summary: string;
  issues: Array<{
    type: 'fatigue' | 'targeting' | 'creative' | 'budget' | 'timing';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
    expectedImpact: string;
  }>;
  opportunities: Array<{
    description: string;
    actionRequired: string;
    expectedImpact: string;
  }>;
  overallScore: number; // 0-100
}

export interface OptimizationSuggestion {
  type: 'copy' | 'audience' | 'budget' | 'schedule' | 'creative';
  priority: 'low' | 'medium' | 'high';
  description: string;
  action: string;
  expectedImpact: string;
  implementation?: Record<string, unknown>;
}

// ===================
// ELITE COPYWRITING SYSTEM PROMPT
// ===================

function getEliteCopywritingPrompt(): string {
  return `You are an ELITE direct-response Facebook/Instagram ad copywriter who has mastered the techniques of:

═══════════════════════════════════════════════════════════════
NEIL PATEL — DATA-DRIVEN HOOK (NP-DDH)
═══════════════════════════════════════════════════════════════
Lead with a specific, surprising number. Open a curiosity loop. Close with a clear benefit and proof.

Pattern interrupts (data-led):
${NEIL_PATEL_DATA_DRIVEN.patternInterrupts.map(p => `• "${p.formula}" — ${p.when}`).join('\n')}

One-liner conversion formulas:
${NEIL_PATEL_DATA_DRIVEN.oneLinerFormulas.map(f => `• "${f.formula}" — ${f.purpose}`).join('\n')}

Proof stack pattern (stat → mechanism → outcome):
${NEIL_PATEL_DATA_DRIVEN.proofPattern.examples.map(e => `• ${e}`).join('\n')}

═══════════════════════════════════════════════════════════════
NEIL PATEL — SEARCH-INTENT PROMISE (NP-SIP)
═══════════════════════════════════════════════════════════════
Mirror the exact question the audience is typing into Google, then deliver the answer (and the next step) in a single tight unit.

Intent-match formulas:
${NEIL_PATEL_SEARCH_INTENT.intentMatchFormulas.map(f => `• "${f.formula}"`).join('\n')}

Headline templates:
${NEIL_PATEL_SEARCH_INTENT.headlineFormulas.map(h => `• "${h.formula}" — e.g. "${h.example}"`).join('\n')}

Value-loop close lines:
${NEIL_PATEL_SEARCH_INTENT.valueLoopClose.map(c => `• "${c}"`).join('\n')}

═══════════════════════════════════════════════════════════════
RYAN DEISS — BEFORE / AFTER / BRIDGE (RD-BAB)
═══════════════════════════════════════════════════════════════
Walk the reader from pain (Before) to relief (After) using LockSafe as the literal Bridge. Direct-response gold for emergency intent.

Structure:
• BEFORE — ${RYAN_DEISS_BAB.structure.before}
• AFTER  — ${RYAN_DEISS_BAB.structure.after}
• BRIDGE — ${RYAN_DEISS_BAB.structure.bridge}

LockSafe example:
Before: "${RYAN_DEISS_BAB.locksafeExample.before}"
After:  "${RYAN_DEISS_BAB.locksafeExample.after}"
Bridge: "${RYAN_DEISS_BAB.locksafeExample.bridge}"

Risk-reversal lines to weave into the Bridge:
${RYAN_DEISS_BAB.riskReversal.map(r => `• ${r}`).join('\n')}

═══════════════════════════════════════════════════════════════
RYAN DEISS — PAS + CUSTOMER VALUE JOURNEY (RD-PAS)
═══════════════════════════════════════════════════════════════
Problem → Agitate → Solve, calibrated to the prospect's awareness stage so the same offer hits at every step of the funnel.

Customer Value Journey awareness stages:
${RYAN_DEISS_PAS.awarenessStages.map(s => `• ${s.stage.toUpperCase()} — ${s.description} → ${s.adAngle}`).join('\n')}

PAS templates:
${RYAN_DEISS_PAS.pasTemplates.map(t => `• "${t.formula}"`).join('\n')}

Direct-response close lines:
${RYAN_DEISS_PAS.drCloseLines.map(c => `• "${c}"`).join('\n')}

═══════════════════════════════════════════════════════════════
THE ULTIMATE AD FORMULA (Patel + Deiss combined)
═══════════════════════════════════════════════════════════════
${POWER_FRAMEWORKS.ultimateAdFormula.components.map(c => `${c.phase} (${c.source}): ${c.action}`).join('\n')}

EMOTIONAL ESCALATION LADDER:
${POWER_FRAMEWORKS.emotionalLadder.stages.map(s => `${s.emotion.toUpperCase()}: "${s.copy}"`).join('\n')}

═══════════════════════════════════════════════════════════════
RULES FOR POWERFUL DIRECT-RESPONSE COPY
═══════════════════════════════════════════════════════════════
1. SPECIFIC NUMBER FIRST — Open with a Patel-grade stat ("73%…", "2,500+…", "15-min average…"). Vague = forgettable.
2. MIRROR INTENT — The first line should sound like the question the reader was already asking themselves.
3. PAIN → RELIEF → BRIDGE — If using BAB, paint Before vividly enough that After feels like oxygen.
4. AGITATE WITH PROOF — PAS only works if the agitation is true. Use real consequences (no receipt, no recourse, cash-only).
5. MECHANISM > MARKETING — Tell HOW it works ("quote in writing before any work starts"), not just claim the benefit.
6. RISK REVERSAL ALWAYS — Refund-on-no-show + decline-quote-pay-only-assessment. Built-in, not on request.
7. AWARENESS STAGE AWARE — Match the angle to the stage (unaware = teach, most-aware = direct CTA).
8. ONE IDEA PER AD — Don't try to say everything.
9. CTA CLARITY — Concrete next step, low friction ("Compare verified locksmiths in 60 seconds — free").
10. NEVER fabricate a stat. If a number isn't in the proof points, don't invent one.`;
}

// ===================
// AD COPY GENERATION
// ===================

export async function generateAdCopy(request: AdCopyRequest): Promise<AdCopyVariation[]> {
  const businessContext = getBusinessSummary();
  const seasonalContext = getSeasonalContext();
  const emotionalAngles = BUSINESS_CONTEXT.emotionalAngles;
  const copywritingPrompt = getEliteCopywritingPrompt();

  const systemPrompt = `${copywritingPrompt}

═══════════════════════════════════════════════════════════════
LOCKSAFE UK BUSINESS CONTEXT
═══════════════════════════════════════════════════════════════

${businessContext}

${seasonalContext}

KEY DIFFERENTIATORS TO EMPHASIZE:
${BUSINESS_CONTEXT.killerDifferentiators.map(d => `• ${d.headline}: ${d.description}`).join('\n')}

BRAND VOICE:
• Tone: ${BUSINESS_CONTEXT.brandVoice.tone}
• Key messages: ${BUSINESS_CONTEXT.brandVoice.keyMessages.join(' | ')}
• AVOID: ${BUSINESS_CONTEXT.brandVoice.avoid.join(', ')}

PROOF POINTS TO USE:
• 2,500+ protected jobs
• £0 scam losses
• 100% dispute resolution rate
• 70% locksmith applicant rejection rate
• 15-min average response time
• Automatic refund guarantee
• GPS tracking + timestamped photos + digital signatures + PDF reports

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

Generate 4 ELITE ad copy variations for LockSafe UK. Each variation MUST:
1. Use a DIFFERENT framework from the experts above
2. Start with a POWERFUL hook (pattern interrupt or curiosity gap)
3. Include SPECIFIC proof points (numbers, mechanisms)
4. Have a clear CATEGORY positioning (anti-fraud, not just booking)
5. Include RISK REVERSAL (refund guarantee)
6. End with clear VALUE + CTA`;

  const frameworkInstructions = `
Create 4 variations, each using a DIFFERENT direct-response framework:

VARIATION 1 — NEIL PATEL DATA-DRIVEN HOOK (NP-DDH):
• Open with a specific, surprising stat from the proof points (e.g. "73%…", "2,500+…", "15-min average…").
• Curiosity gap on the second line.
• Close with a clear benefit + proof + low-friction CTA.
• framework field MUST be exactly: "Neil Patel"
• hookType: "data-driven"

VARIATION 2 — NEIL PATEL SEARCH-INTENT PROMISE (NP-SIP):
• Mirror a question the LockSafe customer is typing into Google.
• Headline answers it directly.
• Body delivers the mechanism + value-loop close.
• framework field MUST be exactly: "Neil Patel"
• hookType: "search-intent"

VARIATION 3 — RYAN DEISS BEFORE / AFTER / BRIDGE (RD-BAB):
• BEFORE: vivid, concrete pain (cash-only quote, no receipt).
• AFTER: vivid relief (PDF receipt, agreed quote, refund guarantee).
• BRIDGE: LockSafe mechanism + risk reversal.
• framework field MUST be exactly: "Ryan Deiss"
• hookType: "before-after-bridge"

VARIATION 4 — RYAN DEISS PAS + CUSTOMER VALUE JOURNEY (RD-PAS):
• PROBLEM (state the pain) → AGITATE (real consequence: no recourse) → SOLVE (mechanism + CTA).
• Calibrate the agitation to the awareness stage (problem-aware or solution-aware works best for paid social).
• framework field MUST be exactly: "Ryan Deiss"
• hookType: "pas-cvj"`;

  const userPrompt = `Create 4 ELITE Facebook ad copy variations for LockSafe UK.

GOAL: ${request.goal.toUpperCase()}
${request.serviceName || request.service ? `FOCUS SERVICE: ${request.serviceName || request.service} — anchor every variation around this specific LockSafe service offering.` : ''}
${request.targetAudience ? `TARGET AUDIENCE: ${request.targetAudience}` : ''}
${request.tone ? `TONE: ${request.tone}` : ''}
${request.copyStyle ? `PREFERRED STYLE: ${request.copyStyle}` : ''}
${request.uniqueSellingPoints?.length ? `ADDITIONAL USPs:\n${request.uniqueSellingPoints.map(u => `• ${u}`).join('\n')}` : ''}
${request.constraints?.avoidWords?.length ? `AVOID THESE WORDS: ${request.constraints.avoidWords.join(', ')}` : ''}

${frameworkInstructions}

IMPORTANT FORMATTING:
• Primary text: 100-200 characters for best engagement
• Use line breaks for readability
• Headline: 25-40 characters (max 50)
• Description: 20-30 characters
• Include emotive punctuation where appropriate

Return a JSON object with a "variations" array. Each variation MUST have:
- primaryText: The main ad copy (use \\n for line breaks)
- headline: Short, punchy headline
- description: Link description
- callToAction: CTA button (GET_QUOTE, LEARN_MORE, CONTACT_US, BOOK_NOW)
- emotionalAngle: One of "urgency", "fear", "trust", "control", "benefit"
- framework: Which framework was used — EXACTLY one of "Neil Patel" or "Ryan Deiss"
- hookType: One of "data-driven", "search-intent", "before-after-bridge", "pas-cvj"
- reasoning: Why this approach works for LockSafe UK

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85, // Slightly higher for more creative variations
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    const variations = parsed.variations || parsed;

    // Validate and clean up
    return (Array.isArray(variations) ? variations : [variations]).map((v: AdCopyVariation) => ({
      primaryText: v.primaryText || '',
      headline: v.headline || '',
      description: v.description || '',
      callToAction: v.callToAction || 'LEARN_MORE',
      emotionalAngle: v.emotionalAngle || 'benefit',
      framework: v.framework || 'Mixed',
      hookType: v.hookType || 'unknown',
      reasoning: v.reasoning || '',
    }));
  } catch (error) {
    console.error('Error generating ad copy:', error);
    throw error;
  }
}

// ===================
// SINGLE FRAMEWORK GENERATION
// ===================

export type FrameworkId =
  | 'neil-patel-data-driven'
  | 'neil-patel-search-intent'
  | 'ryan-deiss-bab'
  | 'ryan-deiss-pas'
  // Legacy aliases — accepted for backward compatibility, mapped to nearest Patel/Deiss equivalent.
  | 'justin-welsh'
  | 'russell-brunson'
  | 'nicholas-cole'
  | 'simon-sinek';

const LEGACY_FRAMEWORK_MAP: Record<string, FrameworkId> = {
  'justin-welsh': 'neil-patel-data-driven',
  'russell-brunson': 'ryan-deiss-bab',
  'nicholas-cole': 'neil-patel-search-intent',
  'simon-sinek': 'ryan-deiss-pas',
};

export async function generateCopyWithFramework(
  framework: FrameworkId,
  request: AdCopyRequest
): Promise<AdCopyVariation[]> {
  const businessContext = getBusinessSummary();

  // Map legacy framework ids onto the new Patel/Deiss equivalents.
  const resolved: FrameworkId = LEGACY_FRAMEWORK_MAP[framework] ?? framework;

  const frameworkPrompts: Record<FrameworkId, string> = {
    'neil-patel-data-driven': `
You are writing in NEIL PATEL's data-driven style. Key characteristics:
• Open with a specific, surprising stat (no fabrication — only stats from proof points).
• Curiosity loop on line two.
• Mechanism + benefit + proof close.
• Confident, analytical, never hypey.

Pattern interrupts to draw on:
${NEIL_PATEL_DATA_DRIVEN.patternInterrupts.map(p => `"${p.formula}"`).join('\n')}

One-liner conversion formulas:
${NEIL_PATEL_DATA_DRIVEN.oneLinerFormulas.map(f => `"${f.formula}"`).join('\n')}

Proof stack examples:
${NEIL_PATEL_DATA_DRIVEN.proofPattern.examples.map(e => `• ${e}`).join('\n')}

Generate 3 variations in Neil Patel's data-driven style for LockSafe UK.`,

    'neil-patel-search-intent': `
You are writing in NEIL PATEL's search-intent style. Key characteristics:
• Mirror the exact question the audience is typing into Google.
• Headline answers the question directly in plain language.
• Body delivers the mechanism + value-loop close.
• SEO-grade specificity, no fluff.

Intent-match formulas:
${NEIL_PATEL_SEARCH_INTENT.intentMatchFormulas.map(f => `"${f.formula}" — e.g. "${f.example}"`).join('\n')}

Headline templates:
${NEIL_PATEL_SEARCH_INTENT.headlineFormulas.map(h => `"${h.formula}"`).join('\n')}

Value-loop close lines:
${NEIL_PATEL_SEARCH_INTENT.valueLoopClose.map(c => `"${c}"`).join('\n')}

Generate 3 variations in Neil Patel's search-intent style for LockSafe UK.`,

    'ryan-deiss-bab': `
You are writing in RYAN DEISS's Before / After / Bridge style. Key characteristics:
• BEFORE — vivid, concrete pain (cash-only locksmith, no receipt, doubled quote).
• AFTER  — vivid relief (PDF receipt, agreed price, refund-on-no-show).
• BRIDGE — LockSafe mechanism + risk reversal makes the After possible.
• Direct-response close.

Structure:
BEFORE: ${RYAN_DEISS_BAB.structure.before}
AFTER:  ${RYAN_DEISS_BAB.structure.after}
BRIDGE: ${RYAN_DEISS_BAB.structure.bridge}

LockSafe BAB example:
Before: "${RYAN_DEISS_BAB.locksafeExample.before}"
After:  "${RYAN_DEISS_BAB.locksafeExample.after}"
Bridge: "${RYAN_DEISS_BAB.locksafeExample.bridge}"

Risk-reversal lines for the Bridge:
${RYAN_DEISS_BAB.riskReversal.map(r => `• ${r}`).join('\n')}

Generate 3 variations in Ryan Deiss's BAB style for LockSafe UK.`,

    'ryan-deiss-pas': `
You are writing in RYAN DEISS's PAS + Customer Value Journey style. Key characteristics:
• PROBLEM — name the pain in the prospect's own words.
• AGITATE — the consequence is real (no receipt, no recourse, cash-only).
• SOLVE — LockSafe mechanism + low-friction CTA.
• Calibrate to the awareness stage.

Customer Value Journey awareness stages:
${RYAN_DEISS_PAS.awarenessStages.map(s => `• ${s.stage.toUpperCase()} — ${s.description} → ${s.adAngle}`).join('\n')}

PAS templates:
${RYAN_DEISS_PAS.pasTemplates.map(t => `"${t.formula}"`).join('\n')}

Direct-response close lines:
${RYAN_DEISS_PAS.drCloseLines.map(c => `"${c}"`).join('\n')}

Generate 3 variations in Ryan Deiss's PAS-CVJ style for LockSafe UK.`,

    // Legacy aliases (kept for type completeness; resolution above redirects them).
    'justin-welsh': '',
    'russell-brunson': '',
    'nicholas-cole': '',
    'simon-sinek': '',
  };

  const promptBody = frameworkPrompts[resolved] || frameworkPrompts['neil-patel-data-driven'];

  const systemPrompt = `${promptBody}

LOCKSAFE UK CONTEXT:
${businessContext}

Generate compelling direct-response ad copy that converts.`;

  const userPrompt = `Create 3 ${resolved.replace(/-/g, ' ').toUpperCase()} style ad variations.

GOAL: ${request.goal.toUpperCase()}
${request.targetAudience ? `TARGET AUDIENCE: ${request.targetAudience}` : ''}

Return JSON with "variations" array. Each has: primaryText, headline, description, callToAction, emotionalAngle, framework, hookType, reasoning.

The "framework" field MUST be exactly "Neil Patel" or "Ryan Deiss".

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.variations || [];
  } catch (error) {
    console.error('Error generating framework copy:', error);
    throw error;
  }
}

// ===================
// HEADLINE GENERATOR (POWER HEADLINES)
// ===================

export async function generatePowerHeadlines(params: {
  angle: 'urgency' | 'trust' | 'control' | 'benefit' | 'fear' | 'curiosity';
  count?: number;
  customContext?: string;
}): Promise<string[]> {
  // First return pre-built power headlines
  const preBuiltHeadlines = POWER_HEADLINES[params.angle] || [];

  if (preBuiltHeadlines.length >= (params.count || 5)) {
    return preBuiltHeadlines.slice(0, params.count || 5);
  }

  // Generate additional headlines with AI
  const systemPrompt = `You are a headline expert combining direct-response techniques from Neil Patel (data-driven hooks, search-intent matching) and Ryan Deiss (Before/After/Bridge, PAS + Customer Value Journey).

For LockSafe UK — the UK's documented locksmith hire platform.

Existing power headlines for ${params.angle}:
${preBuiltHeadlines.join('\n')}

Generate NEW headlines in the same style.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${params.count || 5} ${params.angle} headlines for LockSafe UK${params.customContext ? `: ${params.customContext}` : ''}. Return JSON with "headlines" array.` },
    ],
    temperature: 0.9,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return preBuiltHeadlines;

  const parsed = JSON.parse(content);
  return [...preBuiltHeadlines, ...(parsed.headlines || [])].slice(0, params.count || 5);
}

// ===================
// AUDIENCE SUGGESTIONS
// ===================

export async function suggestAudiences(params: {
  productDescription?: string;
  goal: 'leads' | 'sales' | 'traffic' | 'awareness';
  location: string;
  currentAudiences?: string[];
  budget?: number;
  service?: string;
  serviceName?: string;
  tone?: string;
  additionalContext?: string;
}): Promise<AudienceSuggestion[]> {
  const businessContext = getBusinessSummary();
  const audienceContext = getAudienceContext();

  const systemPrompt = `You are a direct-response Facebook Ads targeting expert applying the audience-research playbooks of Neil Patel and Ryan Deiss to LockSafe UK.

BUSINESS CONTEXT:
${businessContext}

EXISTING TARGET AUDIENCES WE'VE IDENTIFIED:
${audienceContext}

PRINCIPLES TO APPLY:
• Ryan Deiss — Customer Value Journey: every audience must be tagged to ONE awareness stage (unaware, problem-aware, solution-aware, product-aware, most-aware). Most paid social wins are problem-aware or solution-aware.
• Ryan Deiss — Before / After / Bridge: audiences are picked based on the BEFORE state we can disrupt (locked out and being overcharged; landlord fearing tenant lockout liability; new-mover replacing locks).
• Neil Patel — Search-intent / data-driven: anchor each audience to behaviours and interests that map to a real Google query or in-market signal (not vague psychographics).
• Anti-fraud category positioning is the wedge — favour audiences who feel exposed to scam risk.

OUTPUT QUALITY BAR:
• Real Facebook interests / behaviours (not invented).
• Tight age bands tied to the persona (don't sprawl 18-65).
• Suggested daily budget calibrated to estimatedReach (narrow ~£15-25, moderate ~£25-40, broad ~£40-60).
• Each audience must be DISTINCT — no overlap with the others returned.`;

  const userPrompt = `Suggest 3 Facebook ad audiences for LockSafe UK.

GOAL: ${params.goal.toUpperCase()}
LOCATION: ${params.location}
${params.serviceName || params.service ? `FOCUS SERVICE: ${params.serviceName || params.service}` : ''}
${params.tone ? `BRAND TONE: ${params.tone}` : ''}
${params.currentAudiences?.length ? `CURRENT AUDIENCES (don't repeat): ${params.currentAudiences.join(', ')}` : ''}
${params.budget ? `TOTAL BUDGET: £${params.budget}/day` : ''}
${params.additionalContext ? `ADDITIONAL CONTEXT: ${params.additionalContext}` : ''}

For LockSafe UK, return THREE distinct audiences spanning at least two awareness stages from the Customer Value Journey. Typical strong segments:
1. Emergency seekers (problem-aware → most-aware: locked out NOW, high urgency)
2. Scam-aware customers (solution-aware: been burned before, want protection)
3. Proactive security upgraders (problem-aware: homeowners, landlords, new movers)

Return a JSON object with an "audiences" array. Each audience MUST have:
- name: Short, distinctive persona name
- description: Why this audience converts for LockSafe UK specifically (1-2 sentences)
- demographics: { ageMin, ageMax, genders: ["male", "female", or "all"] }
- interests: Array of 3-6 specific Facebook interest names
- behaviors: Array of Facebook behaviors (e.g. "Recently moved", "Small business owners")
- estimatedReach: "narrow", "moderate", or "broad"
- reasoning: Awareness-stage label + the BAB "Before" pain we can disrupt for them
- suggestedBudget: { daily: number, currency: "GBP" }

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.audiences || [];
  } catch (error) {
    console.error('Error suggesting audiences:', error);
    throw error;
  }
}

// ===================
// PERFORMANCE ANALYSIS
// ===================

export async function analyzePerformance(params: {
  campaignData: {
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    roas: number;
    frequency?: number;
    daysRunning: number;
  };
  adData?: Array<{
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    roas: number;
  }>;
  industry?: string;
  goal: 'leads' | 'sales' | 'traffic' | 'awareness';
}): Promise<PerformanceAnalysis> {
  const systemPrompt = `You are a Facebook Ads performance analyst specializing in local services, specifically locksmith services.

You're analyzing campaigns for LockSafe UK - the UK's first anti-fraud locksmith platform. Key context:
- Business model: Platform connecting customers with verified locksmiths
- Average job value: £80-250
- Assessment fee: £25-49 (paid to confirm booking)
- Key differentiator: Legal documentation (GPS, photos, signatures, PDF reports)

Industry benchmarks for local services/emergency services:
- Average CTR: 1.0-2.0% (emergency services can be higher)
- Average CPC: £0.80-£2.50
- Good ROAS for lead gen: 3x+
- Cost per lead target: £15-40
- Ad fatigue typically sets in at frequency 3+
- CTR dropping 20%+ week-over-week indicates fatigue

COPYWRITING OPTIMIZATION:
When suggesting copy improvements, reference these direct-response frameworks:
- Neil Patel — Data-Driven Hook (specific stat → curiosity → benefit)
- Neil Patel — Search-Intent Promise (mirror searcher question → deliver answer)
- Ryan Deiss  — Before / After / Bridge (pain → relief → product as bridge)
- Ryan Deiss  — PAS + Customer Value Journey (problem → agitate → solve, awareness-stage aware)`;

  const userPrompt = `Analyze this Facebook ad campaign performance for LockSafe UK:

CAMPAIGN DATA:
${JSON.stringify(params.campaignData, null, 2)}

${params.adData ? `INDIVIDUAL ADS:\n${JSON.stringify(params.adData, null, 2)}` : ''}

GOAL: ${params.goal.toUpperCase()}

Provide a comprehensive analysis with:
1. summary: Overall assessment (2-3 sentences, specific to LockSafe UK context)
2. issues: Array of problems found, each with type, severity, description, recommendation, expectedImpact
3. opportunities: Array of growth opportunities specific to locksmith industry
4. overallScore: 0-100 rating of campaign health

Consider LockSafe UK's unique positioning (anti-fraud, legal documentation) when making recommendations.

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error analyzing performance:', error);
    throw error;
  }
}

// ===================
// OPTIMIZATION SUGGESTIONS
// ===================

export async function getOptimizationSuggestions(params: {
  campaignData: Record<string, unknown>;
  currentCopy?: string;
  currentTargeting?: Record<string, unknown>;
  budget?: number;
  goal: 'leads' | 'sales' | 'traffic' | 'awareness';
}): Promise<OptimizationSuggestion[]> {
  const businessContext = getBusinessSummary();
  const copywritingPrompt = getEliteCopywritingPrompt();

  const systemPrompt = `You are a Facebook Ads optimization expert for LockSafe UK.

${businessContext}

When suggesting copy optimizations, use these expert frameworks:
${copywritingPrompt.slice(0, 2000)}...

Focus on optimizations that leverage LockSafe's unique strengths:
- Anti-fraud messaging (this is the key differentiator)
- Speed + protection combo
- Legal documentation as proof point
- Automatic refund guarantee`;

  const userPrompt = `Provide optimization suggestions for this LockSafe UK campaign:

${JSON.stringify(params, null, 2)}

Return a JSON object with a "suggestions" array. Each suggestion should have:
- type: "copy", "audience", "budget", "schedule", or "creative"
- priority: "low", "medium", or "high"
- description: What to change (specific to LockSafe UK)
- action: Specific action to take
- expectedImpact: Expected improvement
- implementation: Optional object with specific values to use

For copy suggestions, include:
- Which framework to use (Neil Patel — data-driven, Neil Patel — search-intent, Ryan Deiss — BAB, Ryan Deiss — PAS)
- Specific hook type to try
- Example copy if helpful

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
  } catch (error) {
    console.error('Error getting optimization suggestions:', error);
    throw error;
  }
}

// ===================
// AI CHAT ASSISTANT
// ===================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatWithAdAssistant(params: {
  messages: ChatMessage[];
  campaignContext?: Record<string, unknown>;
  performanceData?: Record<string, unknown>;
}): Promise<string> {
  const businessContext = getBusinessSummary();
  const objectionHandlers = getObjectionHandlers();

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are an AI Facebook Ads assistant for LockSafe UK - the UK's first anti-fraud locksmith platform.

${businessContext}

COMMON OBJECTIONS & RESPONSES:
${objectionHandlers}

COPYWRITING EXPERTISE:
You have mastered direct-response techniques from:
- NEIL PATEL: Data-driven hooks (specific stat → curiosity → benefit), search-intent matching
- RYAN DEISS: Before / After / Bridge, PAS + Customer Value Journey, conversion math

You help with:
- Analyzing ad performance and explaining results
- Generating new ad copy using expert frameworks
- Suggesting audience targeting improvements
- Answering questions about Facebook Ads best practices
- Providing optimization recommendations

Current context:
${params.campaignContext ? JSON.stringify(params.campaignContext, null, 2) : 'No campaign data available'}

Performance data:
${params.performanceData ? JSON.stringify(params.performanceData, null, 2) : 'No performance data available'}

When suggesting copy:
1. Identify the best framework for the situation
2. Reference specific techniques (pattern interrupt, epiphany bridge, etc.)
3. Always include LockSafe's key differentiators
4. Provide ready-to-use copy examples

Format responses with clear structure using markdown when helpful.`,
  };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemMessage, ...params.messages],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return response.choices[0].message.content || 'I apologize, but I could not generate a response.';
  } catch (error) {
    console.error('Error in chat:', error);
    throw error;
  }
}

// ===================
// CREATIVE REFRESH (Using Expert Frameworks)
// ===================

export async function refreshCreative(params: {
  originalCopy: {
    primaryText: string;
    headline: string;
    description: string;
  };
  performance: {
    ctr: number;
    conversions: number;
    daysRunning: number;
  };
  whatWorked?: string;
  whatDidntWork?: string;
  preferredFramework?: 'justin-welsh' | 'russell-brunson' | 'nicholas-cole' | 'simon-sinek';
}): Promise<AdCopyVariation[]> {
  const businessContext = getBusinessSummary();
  const copywritingPrompt = getEliteCopywritingPrompt();

  const systemPrompt = `You are a Facebook ad copywriter specializing in refreshing fatigued creatives for LockSafe UK.

${businessContext}

${copywritingPrompt}

Your job is to create new variations that:
1. Keep what worked from the original
2. Fix what didn't work
3. Apply DIFFERENT expert frameworks than the original
4. Bring fresh angles while maintaining LockSafe's brand voice
5. Use new hook types to re-engage the audience`;

  const userPrompt = `Refresh this LockSafe UK ad creative using different expert frameworks:

ORIGINAL:
Primary Text: ${params.originalCopy.primaryText}
Headline: ${params.originalCopy.headline}
Description: ${params.originalCopy.description}

PERFORMANCE:
CTR: ${params.performance.ctr}%
Conversions: ${params.performance.conversions}
Days Running: ${params.performance.daysRunning}

${params.whatWorked ? `WHAT WORKED: ${params.whatWorked}` : ''}
${params.whatDidntWork ? `WHAT DIDN'T WORK: ${params.whatDidntWork}` : ''}
${params.preferredFramework ? `PREFERRED FRAMEWORK: ${params.preferredFramework}` : ''}

Generate 4 refreshed variations, each using a DIFFERENT direct-response framework:
1. Neil Patel — Data-Driven Hook (specific stat, curiosity loop, mechanism close)
2. Neil Patel — Search-Intent Promise (mirror the searcher's question, deliver the answer)
3. Ryan Deiss  — Before / After / Bridge (vivid pain, vivid relief, LockSafe as bridge)
4. Ryan Deiss  — PAS + Customer Value Journey (problem, agitate, solve — awareness-stage aware)

Return JSON with a "variations" array, each with:
- primaryText
- headline
- description
- callToAction
- emotionalAngle
- framework (which expert)
- hookType (what kind of hook)
- reasoning (why this refresh will work better)

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.variations || [];
  } catch (error) {
    console.error('Error refreshing creative:', error);
    throw error;
  }
}

// ===================
// HOOK GENERATOR
// ===================

export async function generateHooks(params: {
  type: 'pattern-interrupt' | 'curiosity-gap' | 'story' | 'belief' | 'problem-agitate';
  goal: 'leads' | 'sales' | 'traffic' | 'awareness';
  count?: number;
}): Promise<string[]> {
  const hookTemplates: Record<string, string[]> = {
    'pattern-interrupt': JUSTIN_WELSH_HOOKS.patternInterrupts.map(p => p.example),
    'curiosity-gap': JUSTIN_WELSH_HOOKS.curiosityGaps,
    'story': [
      RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.locksafeExample.hook,
      "3 years ago, my mother was charged £380 for a £90 job.",
      "I built LockSafe UK after watching my family get scammed.",
    ],
    'belief': SIMON_SINEK_FRAMEWORKS.purposeStatements,
    'problem-agitate': POWER_FRAMEWORKS.problemStack.problems,
  };

  const preBuilt = hookTemplates[params.type] || [];

  if (preBuilt.length >= (params.count || 5)) {
    return preBuilt.slice(0, params.count || 5);
  }

  // Generate more with AI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert at writing ${params.type} hooks for LockSafe UK ads. Examples: ${preBuilt.join(' | ')}`,
      },
      {
        role: 'user',
        content: `Generate ${params.count || 5} ${params.type} hooks for ${params.goal} goal. Return JSON with "hooks" array.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return preBuilt;

  const parsed = JSON.parse(content);
  return [...preBuilt, ...(parsed.hooks || [])].slice(0, params.count || 5);
}

// ===================
// HEADLINE GENERATOR (Legacy support)
// ===================

export async function generateHeadlines(params: {
  topic?: string;
  style: 'question' | 'benefit' | 'how-to' | 'number' | 'curiosity' | 'urgency' | 'protection';
  count?: number;
}): Promise<string[]> {
  const emotionalAngles = BUSINESS_CONTEXT.emotionalAngles;

  // Use pre-built headlines if available
  const styleMap: Record<string, keyof typeof emotionalAngles> = {
    urgency: 'urgency',
    protection: 'fear',
    benefit: 'benefit',
  };

  if (styleMap[params.style]) {
    const angle = styleMap[params.style];
    return [...emotionalAngles[angle].headlines];
  }

  // Map to power headlines
  const powerStyleMap: Record<string, keyof typeof POWER_HEADLINES> = {
    question: 'curiosity',
    'how-to': 'benefit',
    number: 'trust',
    curiosity: 'curiosity',
  };

  const powerAngle = powerStyleMap[params.style];
  if (powerAngle && POWER_HEADLINES[powerAngle]) {
    return POWER_HEADLINES[powerAngle].slice(0, params.count || 5);
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a headline writing expert for LockSafe UK - the UK's first anti-fraud locksmith platform. Generate compelling headlines that emphasize protection, transparency, and customer control. Use techniques from Justin Welsh (pattern interrupts), Russell Brunson (urgency), Nicholas Cole (specificity), and Simon Sinek (purpose).`,
      },
      {
        role: 'user',
        content: `Generate ${params.count || 5} ${params.style} headlines for LockSafe UK${params.topic ? ` about: ${params.topic}` : ''}. Return JSON with a "headlines" array of strings.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  return parsed.headlines || [];
}

// ===================
// SERVICE-AWARE DR CREATIVES (catalog-bound)
// ===================
//
// Used by the CMO acquisition engine. For a given catalog slug, produces
// exactly N variants — one per Angle — validated against Meta limits +
// LockSafe brand voice. Each variant is structured (framework + angle +
// hookScore) so creative rotation can pick the strongest.

import {
  buildSystemPrompt as buildDRSystemPrompt,
  buildUserPrompt as buildDRUserPrompt,
  validateVariant,
  getServiceForCopy,
  DEFAULT_ANGLES,
  type AdVariant,
  type Angle,
} from "./dr-copywriting";

export interface ServiceCreativeRequest {
  slug: string;
  angles?: Angle[];
  city?: string;
}

export interface ServiceCreativeResult {
  slug: string;
  variants: AdVariant[];
  rejected: Array<{ angle: Angle; errors: string[] }>;
  tokensUsed: number;
}

export async function generateServiceAdCreatives(
  req: ServiceCreativeRequest,
): Promise<ServiceCreativeResult> {
  const service = getServiceForCopy(req.slug);
  if (!service) throw new Error(`Unknown service slug: ${req.slug}`);

  const angles = req.angles && req.angles.length ? req.angles : DEFAULT_ANGLES;

  const systemPrompt = buildDRSystemPrompt();
  const userPrompt = buildDRUserPrompt({ service, angles, city: req.city });

  const callModel = async () =>
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });

  // Try once; on schema/validation fail, retry once asking the model to fix.
  const raw = await callModel();
  let tokensUsed = raw.usage?.total_tokens ?? 0;
  let parsed = parseVariantsPayload(raw.choices[0].message.content);

  let { variants, rejected } = applyValidation(parsed, angles);

  if (rejected.length) {
    // One retry with explicit error feedback.
    const retry = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        {
          role: "user",
          content: [
            "Your previous response failed validation. Issues per variant:",
            ...rejected.map(
              (r) => `- angle=${r.angle}: ${r.errors.slice(0, 4).join("; ")}`,
            ),
            "Return the SAME JSON shape with corrected variants. Tighten character counts. Drop any banned phrases.",
          ].join("\n"),
        },
      ],
      temperature: 0.6,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });
    tokensUsed += retry.usage?.total_tokens ?? 0;
    parsed = parseVariantsPayload(retry.choices[0].message.content);
    const second = applyValidation(parsed, angles);
    variants = second.variants;
    rejected = second.rejected;
  }

  return { slug: req.slug, variants, rejected, tokensUsed };
}

function parseVariantsPayload(content: string | null | undefined): unknown[] {
  if (!content) return [];
  try {
    const obj = JSON.parse(content);
    const arr = Array.isArray(obj) ? obj : obj.variants;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function applyValidation(
  rawVariants: unknown[],
  angles: Angle[],
): { variants: AdVariant[]; rejected: Array<{ angle: Angle; errors: string[] }> } {
  const variants: AdVariant[] = [];
  const rejected: Array<{ angle: Angle; errors: string[] }> = [];

  for (let i = 0; i < angles.length; i++) {
    const expected = angles[i];
    const candidate = rawVariants[i];
    const result = validateVariant(candidate, expected);
    if (result.ok && result.cleaned) {
      variants.push(result.cleaned);
    } else {
      rejected.push({ angle: expected, errors: result.errors });
    }
  }
  return { variants, rejected };
}

