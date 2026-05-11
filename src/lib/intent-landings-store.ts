/**
 * DB-first intent-landing store.
 *
 * Strategy:
 *   1. Read the `IntentLanding` collection from MongoDB.
 *   2. Merge on top of the static seed in `intent-landings.ts` (DB wins by slug).
 *   3. If the DB call fails (e.g. no `DATABASE_URL` at build time), gracefully
 *      fall back to the static seed so SSG never breaks the deploy.
 *
 * All callers (SSG pages, sitemap, admin dashboards) should prefer the async
 * helpers in this module. The original sync helpers in `intent-landings.ts`
 * remain as the static fallback.
 */

import "server-only";

import { prisma } from "@/lib/db";
import {
  INTENT_LANDINGS as STATIC_LANDINGS,
} from "@/lib/intent-landings";
import {
  parseIntentBlocks,
  type IntentLanding,
} from "@/lib/intent-landing";

let _cache: { landings: IntentLanding[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

function clearCache() {
  _cache = null;
}

/**
 * Parse a DB row's JSON content back into a strongly-typed IntentLanding.
 * Defensive — the JSON column is `any` shape and may have been hand-edited.
 */
function rowToLanding(row: {
  slug: string;
  title: string;
  pillarKeyword: string | null;
  intentTags: string[];
  isActive: boolean;
  position: number;
  content: unknown;
}): IntentLanding {
  const raw = (row.content && typeof row.content === "object" ? row.content : {}) as Record<string, unknown>;
  const blocks = parseIntentBlocks(raw.blocks);
  return {
    slug: row.slug,
    title: row.title,
    pillarKeyword: row.pillarKeyword ?? undefined,
    intentTags: row.intentTags ?? [],
    isActive: row.isActive,
    position: row.position,
    h1: typeof raw.h1 === "string" ? raw.h1 : row.title,
    intro: typeof raw.intro === "string" ? raw.intro : undefined,
    emotionalHook: typeof raw.emotionalHook === "string" ? raw.emotionalHook : undefined,
    heroSubcopy: typeof raw.heroSubcopy === "string" ? raw.heroSubcopy : undefined,
    emotionalHookB: typeof raw.emotionalHookB === "string" ? raw.emotionalHookB : undefined,
    heroSubcopyB: typeof raw.heroSubcopyB === "string" ? raw.heroSubcopyB : undefined,
    heroImageUrl: typeof raw.heroImageUrl === "string" ? raw.heroImageUrl : undefined,
    seoCopy: typeof raw.seoCopy === "string" ? raw.seoCopy : undefined,
    metaTitle: typeof raw.metaTitle === "string" ? raw.metaTitle : undefined,
    metaDescription: typeof raw.metaDescription === "string" ? raw.metaDescription : undefined,
    serviceFilter:
      raw.serviceFilter && typeof raw.serviceFilter === "object"
        ? (raw.serviceFilter as IntentLanding["serviceFilter"])
        : { serviceSlugs: [] },
    faqs: Array.isArray(raw.faqs) ? (raw.faqs as IntentLanding["faqs"]) : [],
    blocks,
  };
}

async function fetchDbLandings(): Promise<IntentLanding[]> {
  try {
    const rows = await prisma.intentLanding.findMany({
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(rowToLanding);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[intent-landings-store] DB unavailable, using static seed:", err instanceof Error ? err.message : err);
    }
    return [];
  }
}

/**
 * Returns the merged, deduped list of landings.
 *
 * DB row wins over static seed when slugs collide. Static seed entries that
 * are not present in the DB are still served — this lets us ship new content
 * via code commits without backfilling the DB first.
 */
export async function loadAllIntentLandings(): Promise<IntentLanding[]> {
  if (_cache && _cache.expiresAt > Date.now()) return _cache.landings;

  const dbLandings = await fetchDbLandings();
  const dbSlugs = new Set(dbLandings.map((l) => l.slug));
  const merged = [
    ...dbLandings,
    ...STATIC_LANDINGS.filter((l) => !dbSlugs.has(l.slug)),
  ].sort((a, b) => a.position - b.position);

  _cache = { landings: merged, expiresAt: Date.now() + CACHE_TTL_MS };
  return merged;
}

export async function loadActiveIntentLandings(): Promise<IntentLanding[]> {
  const all = await loadAllIntentLandings();
  return all.filter((l) => l.isActive !== false);
}

export async function loadAllIntentLandingSlugs(): Promise<string[]> {
  const active = await loadActiveIntentLandings();
  return active.map((l) => l.slug);
}

export async function loadIntentLandingBySlug(
  slug: string,
): Promise<IntentLanding | undefined> {
  const all = await loadActiveIntentLandings();
  return all.find((l) => l.slug === slug);
}

/** Resolve a list of related-cluster slugs to landing records. */
export async function loadIntentLandingsBySlugs(
  slugs: readonly string[],
): Promise<IntentLanding[]> {
  if (slugs.length === 0) return [];
  const all = await loadActiveIntentLandings();
  return slugs
    .map((s) => all.find((l) => l.slug === s))
    .filter((l): l is IntentLanding => Boolean(l));
}

/**
 * Invalidate the in-memory cache. Call this from admin write paths so the
 * next read reflects the new DB state. (Next.js `revalidatePath` handles the
 * HTML cache; this handles the per-request memo cache.)
 */
export function invalidateIntentLandingsCache() {
  clearCache();
}
