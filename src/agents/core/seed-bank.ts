/**
 * Keyword Seed Bank
 *
 * Adaptive store for keyword seeds used by Opportunity Scout (and future
 * keyword-driven agents). Replaces the static BASELINE_SEEDS array.
 *
 * Lifecycle:
 *   - Seeds enter via `addSeed(...)` (baseline import, learnings extractor,
 *     reflection on a successful opportunity, etc).
 *   - Scout reads top-N via `getTopSeeds({ limit })`.
 *   - Reflection cron calls `applyReflection({ keyword, outcome })` 7/14/28d
 *     after a draft to bump win/loss counters and recompute score.
 *
 * Score is Wilson-ish: (winCount + 1) / (winCount + lossCount + 2). New seeds
 * default to 1.0 (optimistic) so they get used; bad seeds decay below 0.3 and
 * fall off the top-N list.
 */

import prisma from "@/lib/db";
import type { ReflectionOutcome } from "@/agents/core/reflection";

/**
 * Fallback seeds used only when the KeywordSeed table is empty.
 * IMPORTANT: Do NOT include terms that are in BASELINE_NEGATIVE_KEYWORDS
 * (e.g. "auto locksmith" = car locksmith — we explicitly block those).
 * Planner seeds must only be positive service intent terms.
 */
export const FALLBACK_BASELINE_SEEDS = [
  "locksmith",
  "emergency locksmith",
  "24 hour locksmith",
  "locked out",
  "lock change",
  "door lock repair",
  "lock replacement",
  "upvc locksmith",
] as const;

/**
 * Student and HMO keyword seeds.
 *
 * High value in cities with large student populations (Hull, Sheffield, Leeds,
 * Nottingham) and rental/HMO stock. The Keyword Planner naturally returns low
 * volume for these in other cities so they won't pollute non-student geos.
 *
 * "hmo locksmith" and "landlord locksmith" target the letting agent / property
 * manager segment — repeat customers who need lock changes between tenancies.
 */
export const STUDENT_HMO_SEEDS = [
  "student locksmith",
  "hmo locksmith",
  "student accommodation locksmith",
  "landlord locksmith",
  "tenant lockout",
  "lock change between tenants",
] as const;

/**
 * Idempotent seeder — inserts student/HMO keyword seeds as "experimental"
 * category so they get scored but stay in their own bucket for reflection.
 * Safe to call multiple times (addSeed is idempotent).
 */
export async function seedStudentHmoKeywords(): Promise<void> {
  for (const kw of STUDENT_HMO_SEEDS) {
    await addSeed(kw, {
      category: "experimental",
      source: "student-hmo-init",
      notes:
        "High-value in student / HMO cities (Hull, Sheffield, Leeds, Nottingham). " +
        "Low planner volume in non-student cities — safe as global seed.",
    });
  }
}

export interface GetTopSeedsOptions {
  limit?: number;
  minScore?: number;
  includeCategories?: string[];
}

/**
 * Pull the highest-scoring active seeds. Falls back to the baseline array if
 * the table is empty (first-run protection).
 */
export async function getTopSeeds(opts: GetTopSeedsOptions = {}): Promise<string[]> {
  const limit = opts.limit ?? 12;
  const minScore = opts.minScore ?? 0;

  const where: Record<string, unknown> = {
    isActive: true,
    score: { gte: minScore },
  };
  if (opts.includeCategories && opts.includeCategories.length > 0) {
    where.category = { in: opts.includeCategories };
  }

  // Fetch a wider pool and re-rank by effective score (score × stabilityWeight).
  // Prisma can't ORDER BY a computed field without a raw query, so we fetch
  // limit×4 rows and sort in application code.
  const rows = await prisma.keywordSeed.findMany({
    where,
    take: limit * 4,
  });

  if (rows.length === 0) {
    return [...FALLBACK_BASELINE_SEEDS];
  }

  // Effective score = reflection win-rate × stability weight.
  //   score          = Wilson-ish (winCount+1)/(winCount+lossCount+2)
  //   stabilityWeight = 0.25 for new/unverified → 1.0 for stable (4+ scans, low variance)
  //
  // This ensures a keyword that appeared once with a 100% win rate (1 win, 0 losses)
  // doesn't outrank a keyword with 8 stable wins and moderate variance.
  const sorted = (rows as Array<Record<string, unknown>>)
    .map((r) => ({
      keyword: r.keyword as string,
      effectiveScore: (r.score as number) * ((r.stabilityWeight as number | undefined) ?? 0.25),
    }))
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .slice(0, limit);

  return sorted.map((r) => r.keyword);
}

/**
 * Seed categories. The first set are the original engine-driven buckets;
 * the second set are Phase 2a discovery families produced by the postcode
 * keyword generator. Categories drive per-family budget caps later (e.g.
 * "trust_signal" gets higher daily cap than "service_long_tail" because
 * lower CPC + higher intent → better ROI room).
 */
export type SeedCategory =
  | "baseline"
  | "learned"
  | "competitor"
  | "experimental"
  | "negative"
  // ── Phase 2a families ─────────────────────────────────────────────────
  | "postcode_local"
  | "service_long_tail"
  | "trust_signal"
  | "b2b_specialist"
  | "research_intent";

export interface AddSeedOptions {
  category?: SeedCategory;
  source?: string;
  notes?: string;
}

/**
 * Idempotent insert. If the keyword already exists, only refresh the source +
 * notes (do NOT reset score/counters).
 */
export async function addSeed(keyword: string, opts: AddSeedOptions = {}) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return null;

  const existing = await prisma.keywordSeed.findUnique({ where: { keyword: normalized } });
  if (existing) {
    if (opts.source || opts.notes) {
      return prisma.keywordSeed.update({
        where: { id: existing.id },
        data: {
          firstSeenSource: existing.firstSeenSource ?? opts.source,
          notes: opts.notes ?? existing.notes,
        },
      });
    }
    return existing;
  }

  return prisma.keywordSeed.create({
    data: {
      keyword: normalized,
      category: opts.category ?? "learned",
      firstSeenSource: opts.source ?? "unknown",
      notes: opts.notes,
      // Default score 1.0 (optimistic) — new seeds get used once, then graded.
    },
  });
}

/**
 * Mark a batch of seeds as "used" right now. Called at the end of every
 * Opportunity Scout heartbeat so we know which seeds drove which decisions.
 */
export async function markSeedsUsed(keywords: string[]) {
  const normalized = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return 0;

  const result = await prisma.keywordSeed.updateMany({
    where: { keyword: { in: normalized } },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });
  return result.count;
}

/**
 * Return all keywords that have been marked as negative via the admin seed bank.
 * These are injected into campaign draft negative keyword lists at build time.
 */
export async function getNegativeSeedKeywords(): Promise<string[]> {
  const rows = await prisma.keywordSeed.findMany({
    where: { category: "negative" },
    select: { keyword: true },
  });
  return rows.map((r) => r.keyword);
}

/**
 * Update score + counters for a single seed based on a reflection outcome.
 */
export async function applyReflection({
  keyword,
  outcome,
}: {
  keyword: string;
  outcome: ReflectionOutcome;
}) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return null;

  const seed = await prisma.keywordSeed.findUnique({ where: { keyword: normalized } });
  if (!seed) return null;

  const winCount = seed.winCount + (outcome === "WIN" ? 1 : 0);
  const lossCount = seed.lossCount + (outcome === "LOSS" ? 1 : 0);
  const inconclusiveCount =
    seed.inconclusiveCount + (outcome === "INCONCLUSIVE" || outcome === "NEUTRAL" ? 1 : 0);

  // Wilson-ish smoothing keeps new seeds usable while still penalising
  // consistent losers. Pure win-rate would over-react to a single signal.
  const score = (winCount + 1) / (winCount + lossCount + 2);

  return prisma.keywordSeed.update({
    where: { id: seed.id },
    data: {
      winCount,
      lossCount,
      inconclusiveCount,
      score,
      lastWinAt: outcome === "WIN" ? new Date() : seed.lastWinAt,
      lastLossAt: outcome === "LOSS" ? new Date() : seed.lastLossAt,
    },
  });
}
