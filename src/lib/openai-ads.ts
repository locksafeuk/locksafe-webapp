/**
 * OpenAI Integration for AI-Powered Ad Creation
 *
 * Features:
 * - Elite ad copy generation using frameworks from:
 *   - Justin Welsh (pattern interrupts, hooks, one-liners)
 *   - Russell Brunson (Hook-Story-Offer, Epiphany Bridge)
 *   - Nicholas Cole (Category Design, specificity)
 *   - Simon Sinek (Start with Why, purpose-driven)
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
  return `You are an ELITE Facebook/Instagram ad copywriter who has mastered the techniques of:

═══════════════════════════════════════════════════════════════
JUSTIN WELSH - Pattern Interrupts & Hook Mastery
═══════════════════════════════════════════════════════════════
Key techniques:
${JUSTIN_WELSH_HOOKS.patternInterrupts.map(p => `• "${p.formula}" → ${p.when}`).join('\n')}

One-liner power formulas:
${JUSTIN_WELSH_HOOKS.oneLinerFormulas.map(f => `• "${f.formula}" → ${f.purpose}`).join('\n')}

═══════════════════════════════════════════════════════════════
RUSSELL BRUNSON - Hook-Story-Offer & Epiphany Bridge
═══════════════════════════════════════════════════════════════
HOOK-STORY-OFFER Framework:
• HOOK: Pattern interrupt + curiosity gap (stop the scroll)
• STORY: Relatable struggle → epiphany moment → transformation
• OFFER: Clear value + urgency + risk reversal

Example for LockSafe UK:
Hook: "${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.locksafeExample.hook}"
Story: "${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.locksafeExample.story}"
Offer: "${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.locksafeExample.offer}"

EPIPHANY BRIDGE (emotional transformation):
${RUSSELL_BRUNSON_FRAMEWORKS.epiphanyBridge.stages.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Risk Reversal statements to use:
${RUSSELL_BRUNSON_FRAMEWORKS.riskReversal.map(r => `• ${r}`).join('\n')}

═══════════════════════════════════════════════════════════════
NICHOLAS COLE - Category Design & Specificity
═══════════════════════════════════════════════════════════════
CATEGORY DESIGN: Don't compete. Create and own a new category.
Our Category: "${NICHOLAS_COLE_FRAMEWORKS.categoryDesign.ourCategory}"
Position: ${NICHOLAS_COLE_FRAMEWORKS.categoryDesign.positioningStatement}

SPECIFICITY RULES (vague = forgettable, specific = believable):
${NICHOLAS_COLE_FRAMEWORKS.specificityRules.rules.map(r => `• BAD: "${r.bad}" → GOOD: "${r.good}"`).join('\n')}

"WHY NOW" Framework (create urgency to act):
${NICHOLAS_COLE_FRAMEWORKS.whyNow.triggers.map(t => `• ${t.type}: "${t.example}"`).join('\n')}

═══════════════════════════════════════════════════════════════
SIMON SINEK - Start with Why & Golden Circle
═══════════════════════════════════════════════════════════════
GOLDEN CIRCLE: People don't buy WHAT you do, they buy WHY you do it.

LockSafe UK's Golden Circle:
• WHY: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.why}
• HOW: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.how}
• WHAT: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.what}

Purpose-driven hooks:
${SIMON_SINEK_FRAMEWORKS.purposeStatements.map(s => `• "${s}"`).join('\n')}

Belief-driven copy pattern:
${SIMON_SINEK_FRAMEWORKS.beliefCopy.map(b => `• Belief: "${b.belief}" → Proof: "${b.proof}"`).join('\n')}

═══════════════════════════════════════════════════════════════
THE ULTIMATE AD FORMULA (All Experts Combined)
═══════════════════════════════════════════════════════════════
${POWER_FRAMEWORKS.ultimateAdFormula.components.map(c => `${c.phase} (${c.source}): ${c.action}`).join('\n')}

EMOTIONAL ESCALATION LADDER:
${POWER_FRAMEWORKS.emotionalLadder.stages.map(s => `${s.emotion.toUpperCase()}: "${s.copy}"`).join('\n')}

═══════════════════════════════════════════════════════════════
RULES FOR POWERFUL COPY
═══════════════════════════════════════════════════════════════
1. HOOK FIRST - First line must stop the scroll. Use pattern interrupts.
2. SPECIFIC > VAGUE - Use numbers, mechanisms, proof points.
3. EMOTION BEFORE LOGIC - Connect with feelings, then justify with facts.
4. CATEGORY OWNER - Position as "UK's first anti-fraud platform", not "another booking site".
5. RISK REVERSAL - Always include the automatic refund guarantee.
6. STORY SELLS - Use founder story or customer journey where appropriate.
7. WHY BEFORE WHAT - Lead with purpose when building trust.
8. FUTURE PACING - Help reader visualize the protected outcome.
9. ONE IDEA PER AD - Don't try to say everything.
10. CTA CLARITY - Make the next step obvious and low-friction.`;
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
Create 4 variations, each using a DIFFERENT copywriting framework:

VARIATION 1 - JUSTIN WELSH STYLE:
• Start with pattern interrupt hook
• Use one-liner power format
• Short, punchy, high-impact
• Hook type: "${JUSTIN_WELSH_HOOKS.patternInterrupts[0].formula}"

VARIATION 2 - RUSSELL BRUNSON STYLE:
• Use Hook-Story-Offer structure
• Include mini epiphany bridge
• Founder story or customer journey
• End with strong offer + risk reversal

VARIATION 3 - NICHOLAS COLE STYLE:
• Lead with category positioning
• Maximum specificity (numbers, mechanisms)
• "Why Now" urgency trigger
• Clear differentiation from competitors

VARIATION 4 - SIMON SINEK STYLE:
• Start with WHY (purpose/belief)
• Connect emotionally first
• Then explain HOW and WHAT
• Purpose-driven messaging`;

  const userPrompt = `Create 4 ELITE Facebook ad copy variations for LockSafe UK.

GOAL: ${request.goal.toUpperCase()}
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
- framework: Which expert framework was used ("Justin Welsh", "Russell Brunson", "Nicholas Cole", "Simon Sinek")
- hookType: What type of hook was used (pattern interrupt, curiosity gap, story, belief, etc.)
- reasoning: Why this approach works for LockSafe UK

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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

export async function generateCopyWithFramework(
  framework: 'justin-welsh' | 'russell-brunson' | 'nicholas-cole' | 'simon-sinek',
  request: AdCopyRequest
): Promise<AdCopyVariation[]> {
  const businessContext = getBusinessSummary();

  const frameworkPrompts: Record<string, string> = {
    'justin-welsh': `
You are writing in JUSTIN WELSH's style. Key characteristics:
• Pattern interrupt opening - stop the scroll with unexpected statement
• One-liner power - maximum impact in minimum words
• Curiosity gaps - make them need to know more
• Direct, confident tone

Hook formulas to use:
${JUSTIN_WELSH_HOOKS.patternInterrupts.map(p => `"${p.formula}"`).join('\n')}

One-liner formulas:
${JUSTIN_WELSH_HOOKS.oneLinerFormulas.map(f => `"${f.formula}"`).join('\n')}

Generate 3 variations in Justin Welsh's style for LockSafe UK.`,

    'russell-brunson': `
You are writing in RUSSELL BRUNSON's style. Key characteristics:
• Hook-Story-Offer structure
• Epiphany Bridge - take reader through your realization
• Urgency triggers (ethical urgency)
• Risk reversal close

Use this structure:
${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.structure.hook}
${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.structure.story}
${RUSSELL_BRUNSON_FRAMEWORKS.hookStoryOffer.structure.offer}

LockSafe's Epiphany Bridge:
${Object.entries(RUSSELL_BRUNSON_FRAMEWORKS.epiphanyBridge.locksafeJourney).map(([k, v]) => `${k}: "${v}"`).join('\n')}

Generate 3 variations in Russell Brunson's style for LockSafe UK.`,

    'nicholas-cole': `
You are writing in NICHOLAS COLE's style. Key characteristics:
• Category Design - create and own a new category
• Maximum specificity - numbers, mechanisms, proof
• "Why Now" urgency
• Clear differentiation

Category positioning:
"${NICHOLAS_COLE_FRAMEWORKS.categoryDesign.positioningStatement}"

Specificity rules:
${NICHOLAS_COLE_FRAMEWORKS.specificityRules.rules.map(r => `BAD: "${r.bad}" → GOOD: "${r.good}"`).join('\n')}

Generate 3 variations in Nicholas Cole's style for LockSafe UK.`,

    'simon-sinek': `
You are writing in SIMON SINEK's style. Key characteristics:
• Start with WHY - purpose before product
• Golden Circle - Why → How → What
• Belief-driven copy
• Emotional connection first

LockSafe's Golden Circle:
WHY: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.why}
HOW: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.how}
WHAT: ${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.what}

Belief statements:
${SIMON_SINEK_FRAMEWORKS.beliefCopy.map(b => `"${b.belief}" → "${b.proof}"`).join('\n')}

Generate 3 variations in Simon Sinek's style for LockSafe UK.`,
  };

  const systemPrompt = `${frameworkPrompts[framework]}

LOCKSAFE UK CONTEXT:
${businessContext}

Generate compelling ad copy that converts.`;

  const userPrompt = `Create 3 ${framework.replace('-', ' ').toUpperCase()} style ad variations.

GOAL: ${request.goal.toUpperCase()}
${request.targetAudience ? `TARGET AUDIENCE: ${request.targetAudience}` : ''}

Return JSON with "variations" array. Each has: primaryText, headline, description, callToAction, emotionalAngle, framework, hookType, reasoning.

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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
  const systemPrompt = `You are a headline expert combining techniques from Justin Welsh, Russell Brunson, Nicholas Cole, and Simon Sinek.

For LockSafe UK - UK's first anti-fraud locksmith platform.

Existing power headlines for ${params.angle}:
${preBuiltHeadlines.join('\n')}

Generate NEW headlines in the same style.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
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
}): Promise<AudienceSuggestion[]> {
  const businessContext = getBusinessSummary();
  const audienceContext = getAudienceContext();

  const systemPrompt = `You are a Facebook Ads targeting expert specializing in local services and emergency services.

IMPORTANT: You are creating audiences for LockSafe UK specifically. Here is the business context:

${businessContext}

EXISTING TARGET AUDIENCES WE'VE IDENTIFIED:
${audienceContext}

NICHOLAS COLE's CATEGORY POSITIONING:
${NICHOLAS_COLE_FRAMEWORKS.categoryDesign.positioningStatement}

Your suggestions should:
- Be specific and actionable (real Facebook interests and behaviors)
- Match the goal (emergency lockouts need different targeting than security upgrades)
- Consider the dual-audience nature (customers AND locksmiths use this platform)
- Leverage pain points specific to locksmith services (fear of scams, need for speed, etc.)
- Align with our anti-fraud category positioning`;

  const userPrompt = `Suggest 3 Facebook ad audiences for LockSafe UK.

GOAL: ${params.goal.toUpperCase()}
LOCATION: ${params.location}
${params.currentAudiences?.length ? `CURRENT AUDIENCES (don't repeat): ${params.currentAudiences.join(', ')}` : ''}
${params.budget ? `TOTAL BUDGET: £${params.budget}/day` : ''}

For LockSafe UK, consider these audience types:
1. Emergency seekers (locked out NOW, high urgency)
2. Scam-aware customers (been burned before, want protection)
3. Proactive security upgraders (homeowners, landlords, new movers)

Return a JSON object with an "audiences" array. Each audience should have:
- name: Short name for the audience
- description: Why this audience would convert for LockSafe UK specifically
- demographics: { ageMin, ageMax, genders: ["male", "female", or "all"] }
- interests: Array of Facebook interest names (be specific)
- behaviors: Array of Facebook behaviors
- estimatedReach: "narrow", "moderate", or "broad"
- reasoning: Why this audience is good for LockSafe UK and this goal
- suggestedBudget: { daily: number, currency: "GBP" }

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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
When suggesting copy improvements, reference these expert frameworks:
- Justin Welsh: Pattern interrupts, one-liners
- Russell Brunson: Hook-Story-Offer structure
- Nicholas Cole: Specificity, category positioning
- Simon Sinek: Start with Why`;

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
      model: 'gpt-4-turbo-preview',
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
- Which expert framework to use (Justin Welsh, Russell Brunson, Nicholas Cole, Simon Sinek)
- Specific hook type to try
- Example copy if helpful

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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
You have mastered techniques from:
- JUSTIN WELSH: Pattern interrupts, one-liners, scroll-stopping hooks
- RUSSELL BRUNSON: Hook-Story-Offer, Epiphany Bridge, urgency triggers
- NICHOLAS COLE: Category Design, specificity, "Why Now" positioning
- SIMON SINEK: Start with Why, Golden Circle, purpose-driven messaging

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
      model: 'gpt-4-turbo-preview',
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

Generate 4 refreshed variations, each using a DIFFERENT expert framework:
1. Justin Welsh style (pattern interrupt, one-liner)
2. Russell Brunson style (hook-story-offer)
3. Nicholas Cole style (category, specificity)
4. Simon Sinek style (why-led, belief-driven)

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
      model: 'gpt-4-turbo-preview',
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
    model: 'gpt-4-turbo-preview',
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
    model: 'gpt-4-turbo-preview',
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
