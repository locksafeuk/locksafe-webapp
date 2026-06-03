/**
 * Agent Reflection Engine
 *
 * Hybrid grading:
 *   1. Deterministic outcome classifier (`gradeOutcome`) — pure rules.
 *   2. REASONING LLM tier writes narrative + lessons ONLY for WIN/LOSS.
 *   3. Lessons feed back into AgentMemory so the next heartbeat reads them.
 *
 * Reused across every subagent (Opportunity Scout first, Ads-Specialist
 * + Copywriter next). Keep the surface tiny and side-effect explicit.
 */

import prisma from "@/lib/db";
import { chat } from "@/lib/llm-router";
import { storeMemory } from "@/agents/core/memory";
import { applyReflectionToPlaybook } from "@/lib/google-ads-playbook";

export type ReflectionOutcome = "WIN" | "LOSS" | "INCONCLUSIVE" | "NEUTRAL";
export type ReflectionMetric =
  | "roas"
  | "cpa"
  | "ctr"
  | "conversionRate"
  | "score_accuracy"
  | "spend_efficiency";

export interface GradeInput {
  metric: ReflectionMetric;
  expected: number | null;
  actual: number | null;
  /** Sample size (e.g. impressions, clicks). Drives confidence. */
  sampleSize?: number;
  /** Minimum sample size below which we always return INCONCLUSIVE. */
  minSampleSize?: number;
}

export interface GradedOutcome {
  outcome: ReflectionOutcome;
  delta: number | null;
  confidence: number;
}

const DEFAULT_MIN_SAMPLE: Record<ReflectionMetric, number> = {
  roas: 30, // clicks
  cpa: 20,
  ctr: 500, // impressions
  conversionRate: 50,
  score_accuracy: 1,
  spend_efficiency: 10,
};

/**
 * Deterministic outcome grading. Same metric in, same outcome out — no LLM.
 *
 * Threshold conventions:
 *   - "ratio metrics" (roas, ctr, conversionRate, score_accuracy, spend_efficiency)
 *     WIN if actual >= 1.2 × expected, LOSS if actual <= 0.5 × expected.
 *   - "cost metrics" (cpa) inverted — WIN if actual <= 0.8 × expected,
 *     LOSS if actual >= 1.5 × expected.
 */
export function gradeOutcome(input: GradeInput): GradedOutcome {
  const { metric, expected, actual, sampleSize } = input;
  const minSample = input.minSampleSize ?? DEFAULT_MIN_SAMPLE[metric];

  if (expected == null || actual == null) {
    return { outcome: "INCONCLUSIVE", delta: null, confidence: 0 };
  }
  if (sampleSize != null && sampleSize < minSample) {
    return {
      outcome: "INCONCLUSIVE",
      delta: actual - expected,
      confidence: Math.min(0.3, (sampleSize ?? 0) / Math.max(1, minSample)),
    };
  }

  const delta = actual - expected;
  const ratio = expected === 0 ? (actual > 0 ? Infinity : 1) : actual / expected;
  const isCost = metric === "cpa";

  let outcome: ReflectionOutcome;
  if (isCost) {
    if (ratio <= 0.8) outcome = "WIN";
    else if (ratio >= 1.5) outcome = "LOSS";
    else outcome = "NEUTRAL";
  } else {
    if (ratio >= 1.2) outcome = "WIN";
    else if (ratio <= 0.5) outcome = "LOSS";
    else outcome = "NEUTRAL";
  }

  // Confidence: sample-size driven, capped at 0.95.
  const confidence = sampleSize != null
    ? Math.min(0.95, 0.4 + (Math.log10(Math.max(1, sampleSize)) / 5))
    : 0.6;

  return { outcome, delta, confidence };
}

export interface ReflectionContext {
  agentName: string;
  subjectType: string;
  subjectId: string;
  /** Human-readable subject label, e.g. "Bristol drafted campaign (geo 1006886)". */
  subjectLabel: string;
  /** Free-form context the LLM should consider. */
  facts: Record<string, unknown>;
  decisionId?: string;
  executionId?: string;
  windowDays?: number;
}

export interface RecordReflectionInput extends ReflectionContext {
  graded: GradedOutcome;
  metric: ReflectionMetric;
  expectedValue: number | null;
  actualValue: number | null;
  /** If false, skip the LLM narrative even for WIN/LOSS (e.g. budget exhausted). */
  enableLLM?: boolean;
}

const NARRATIVE_SYSTEM = `You are the reflection engine for an autonomous marketing agent at LockSafe UK, a locksmith marketplace.
You read a single decision and its measured outcome, then produce a TERSE post-mortem.

Output STRICT JSON only:
{
  "narrative": "2-3 sentence root-cause analysis. Be specific about cause and effect.",
  "lessons": ["short imperative lesson 1", "lesson 2", "lesson 3"]
}

Rules:
- Lessons MUST be actionable imperatives ("Avoid X", "Boost Y for Z geos", "Add negative keyword Q").
- Maximum 5 lessons. Each ≤ 120 chars.
- No emojis, no markdown, no preamble.`;

async function generateNarrative(
  ctx: ReflectionContext & { graded: GradedOutcome; metric: string; expectedValue: number | null; actualValue: number | null },
): Promise<{ narrative: string; lessons: string[] } | null> {
  const userPrompt = `Agent: ${ctx.agentName}
Subject: ${ctx.subjectLabel} (${ctx.subjectType}/${ctx.subjectId})
Metric: ${ctx.metric}
Expected: ${ctx.expectedValue}
Actual: ${ctx.actualValue}
Delta: ${ctx.graded.delta}
Outcome: ${ctx.graded.outcome}
Window: ${ctx.windowDays ?? 28} days
Confidence: ${ctx.graded.confidence.toFixed(2)}

Facts:
${JSON.stringify(ctx.facts, null, 2)}

Produce the reflection JSON now.`;

  try {
    const resp = await chat(
      "REASONING",
      [
        { role: "system", content: NARRATIVE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3,
        responseFormat: "json",
        timeoutMs: 60_000,
        allowOpenAIFallback: true,
        fallbackSeverity: "medium",
      },
    );

    const parsed = JSON.parse(resp.content);
    const narrative = typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
    const rawLessons: unknown = parsed.lessons;
    const lessons = Array.isArray(rawLessons)
      ? rawLessons
          .filter((l): l is string => typeof l === "string")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .slice(0, 5)
      : [];

    if (!narrative) return null;
    return { narrative, lessons };
  } catch (err) {
    console.warn("[reflection] narrative generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Persist a reflection. Optionally calls REASONING tier for WIN/LOSS narratives,
 * then writes each lesson back into AgentMemory so the next heartbeat sees it.
 */
export async function recordReflection(input: RecordReflectionInput) {
  const shouldNarrate =
    (input.enableLLM ?? true) &&
    (input.graded.outcome === "WIN" || input.graded.outcome === "LOSS");

  const llm = shouldNarrate ? await generateNarrative(input) : null;
  const narrative = llm?.narrative ?? null;
  const lessons = llm?.lessons ?? [];

  const reflection = await prisma.agentReflection.create({
    data: {
      agentName: input.agentName,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      decisionId: input.decisionId,
      executionId: input.executionId,
      windowDays: input.windowDays ?? 28,
      outcome: input.graded.outcome,
      metric: input.metric,
      expectedValue: input.expectedValue ?? undefined,
      actualValue: input.actualValue ?? undefined,
      delta: input.graded.delta ?? undefined,
      confidence: input.graded.confidence,
      narrative: narrative ?? undefined,
      lessons,
    },
  });

  if (lessons.length > 0) {
    await applyLessonsToMemory(input.agentName, lessons, {
      subjectLabel: input.subjectLabel,
      outcome: input.graded.outcome,
    });

    // Self-update the campaign playbook from this measured outcome. No-ops for
    // anything that isn't an ads-specialist campaign WIN/LOSS, and never throws.
    await applyReflectionToPlaybook({
      agentName: input.agentName,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectLabel: input.subjectLabel,
      outcome: input.graded.outcome,
      metric: input.metric,
      lessons,
    });

    await prisma.agentReflection.update({
      where: { id: reflection.id },
      data: { appliedAt: new Date() },
    });
  }

  return reflection;
}

/**
 * Write each lesson as a long-term AgentMemory row tagged for the next
 * heartbeat to pick up via `getRelevantMemories`.
 */
export async function applyLessonsToMemory(
  agentName: string,
  lessons: string[],
  ctx: { subjectLabel: string; outcome: ReflectionOutcome },
) {
  for (const lesson of lessons) {
    try {
      await storeMemory(
        agentName,
        `[${ctx.outcome} · ${ctx.subjectLabel}] ${lesson}`,
        "pattern",
        ctx.outcome === "LOSS" ? 0.85 : 0.75,
        {
          scope: "shared",
          strategicCategory: "tactical",
          tags: ["reflection", ctx.outcome.toLowerCase()],
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      );
    } catch (err) {
      console.warn(`[reflection] failed to persist lesson for ${agentName}:`, err);
    }
  }
}
