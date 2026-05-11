/**
 * Problem-aware INTENT taxonomy — distinct from the service catalog.
 *
 * Where `services-catalog.ts` lists the *services* a locksmith performs
 * ("lock change", "broken key extraction"), this file lists the *intents*
 * a customer carries when they search ("I'm locked out at night", "We've
 * been burgled, need locks changed now"). Intents map 1:N to services and
 * carry pillar-keyword + tag metadata used to cluster pages for topical
 * authority.
 *
 * Used by the /intent/[slug] and /intent/[slug]/in/[city] routes.
 */

import type { ServiceSlug } from "@/lib/services-catalog";

export type IntentUrgency = "emergency" | "urgent" | "planned";

export interface IntentDefinition {
  slug: string;
  title: string;
  pillarKeyword: string;
  intentTags: string[];
  urgency: IntentUrgency;
  /** Catalog services that satisfy this intent (priority order). */
  serviceSlugs: ServiceSlug[];
  /** Other intents semantically related (for cross-linking). */
  relatedIntents?: string[];
}

/**
 * Pillar keywords — anchor topics for topical authority. Every intent &
 * landing references one of these so the sitemap can boost priorities
 * when ≥2 pages share a pillar.
 */
export const PILLAR_KEYWORDS = [
  "emergency-locksmith",
  "locked-out",
  "lock-change",
  "burglary-repair",
  "commercial-locksmith",
  "auto-locksmith",
] as const;

export type PillarKeyword = (typeof PILLAR_KEYWORDS)[number];

export const INTENTS: readonly IntentDefinition[] = [
  {
    slug: "locked-out-at-night",
    title: "Locked Out at Night",
    pillarKeyword: "locked-out",
    intentTags: ["locked-out", "night", "urgent", "emergency"],
    urgency: "emergency",
    serviceSlugs: ["emergency-locksmith", "locked-out"],
    relatedIntents: ["locked-out-of-house-no-keys", "key-snapped-in-lock"],
  },
  {
    slug: "locked-out-of-house-no-keys",
    title: "Locked Out of House With No Spare Keys",
    pillarKeyword: "locked-out",
    intentTags: ["locked-out", "house", "no-keys", "urgent"],
    urgency: "emergency",
    serviceSlugs: ["locked-out", "emergency-locksmith"],
    relatedIntents: ["locked-out-at-night", "lost-house-keys"],
  },
  {
    slug: "lost-house-keys",
    title: "Lost House Keys — Should I Change the Locks?",
    pillarKeyword: "lock-change",
    intentTags: ["lost-keys", "lock-change", "security"],
    urgency: "urgent",
    serviceSlugs: ["lock-change", "emergency-locksmith"],
    relatedIntents: ["locked-out-of-house-no-keys", "moving-in-change-locks"],
  },
  {
    slug: "key-snapped-in-lock",
    title: "Key Snapped in the Lock",
    pillarKeyword: "locked-out",
    intentTags: ["broken-key", "locked-out", "urgent"],
    urgency: "emergency",
    serviceSlugs: ["broken-key-extraction", "lock-change", "emergency-locksmith"],
    relatedIntents: ["locked-out-at-night", "upvc-door-wont-lock"],
  },
  {
    slug: "burgled-need-locks-changed",
    title: "We've Been Burgled — Need Locks Changed Now",
    pillarKeyword: "burglary-repair",
    intentTags: ["burglary", "lock-change", "security", "urgent"],
    urgency: "emergency",
    serviceSlugs: ["burglary-lock-repair", "lock-change", "emergency-locksmith"],
    relatedIntents: ["upvc-door-wont-lock", "moving-in-change-locks"],
  },
  {
    slug: "upvc-door-wont-lock",
    title: "UPVC Door Won't Lock or Won't Open",
    pillarKeyword: "lock-change",
    intentTags: ["upvc", "door", "lock-repair", "urgent"],
    urgency: "urgent",
    serviceSlugs: ["upvc-door-lock-repair", "lock-change"],
    relatedIntents: ["key-snapped-in-lock", "burgled-need-locks-changed"],
  },
  {
    slug: "moving-in-change-locks",
    title: "Just Moved In — Should I Change the Locks?",
    pillarKeyword: "lock-change",
    intentTags: ["moving-in", "new-home", "lock-change", "security"],
    urgency: "planned",
    serviceSlugs: ["lock-change"],
    relatedIntents: ["lost-house-keys", "landlord-changing-tenant-locks"],
  },
  {
    slug: "landlord-changing-tenant-locks",
    title: "Landlord — Changing Locks Between Tenants",
    pillarKeyword: "lock-change",
    intentTags: ["landlord", "tenant", "lock-change", "compliance"],
    urgency: "planned",
    serviceSlugs: ["landlord-lock-change", "lock-change"],
    relatedIntents: ["moving-in-change-locks"],
  },
  {
    slug: "locked-out-of-car",
    title: "Locked Out of My Car",
    pillarKeyword: "auto-locksmith",
    intentTags: ["car", "auto", "locked-out", "urgent"],
    urgency: "emergency",
    serviceSlugs: ["car-key-replacement", "emergency-locksmith"],
    relatedIntents: ["lost-car-keys"],
  },
  {
    slug: "lost-car-keys",
    title: "Lost My Car Keys — Need a Replacement",
    pillarKeyword: "auto-locksmith",
    intentTags: ["car", "auto", "lost-keys", "key-replacement"],
    urgency: "urgent",
    serviceSlugs: ["car-key-replacement"],
    relatedIntents: ["locked-out-of-car"],
  },
  {
    slug: "office-lockout",
    title: "Office Lockout — Commercial Locksmith Needed",
    pillarKeyword: "commercial-locksmith",
    intentTags: ["commercial", "office", "business", "locked-out"],
    urgency: "emergency",
    serviceSlugs: ["commercial-locksmith", "emergency-locksmith", "locked-out"],
    relatedIntents: ["safe-stuck-shut"],
  },
  {
    slug: "safe-stuck-shut",
    title: "Safe Won't Open — Locked or Forgotten Combination",
    pillarKeyword: "commercial-locksmith",
    intentTags: ["safe", "commercial", "specialist"],
    urgency: "urgent",
    serviceSlugs: ["safe-opening"],
    relatedIntents: ["office-lockout"],
  },
] as const satisfies readonly IntentDefinition[];

export const getAllIntentSlugs = (): string[] => INTENTS.map((i) => i.slug);

export const getIntentBySlug = (slug: string): IntentDefinition | undefined =>
  INTENTS.find((i) => i.slug === slug);

/** Find related intents — explicit `relatedIntents` first, then by tag overlap. */
export function getRelatedIntents(slug: string, limit = 4): IntentDefinition[] {
  const intent = getIntentBySlug(slug);
  if (!intent) return [];
  const explicit = (intent.relatedIntents || [])
    .map((s) => getIntentBySlug(s))
    .filter((i): i is IntentDefinition => Boolean(i));
  if (explicit.length >= limit) return explicit.slice(0, limit);

  const have = new Set([slug, ...explicit.map((i) => i.slug)]);
  const tagSet = new Set(intent.intentTags);
  const scored = INTENTS.filter((i) => !have.has(i.slug))
    .map((i) => ({
      i,
      score: i.intentTags.reduce((acc, t) => acc + (tagSet.has(t) ? 1 : 0), 0),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.i);

  return [...explicit, ...scored].slice(0, limit);
}

/** Group intents by pillar keyword — used for topical-authority clustering. */
export function getIntentsByPillar(pillar: string): IntentDefinition[] {
  return INTENTS.filter((i) => i.pillarKeyword === pillar);
}
