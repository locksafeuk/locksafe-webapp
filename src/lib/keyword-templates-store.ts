import "server-only";

import { prisma } from "@/lib/db";
import {
  KEYWORD_TEMPLATES as STATIC_TEMPLATES,
  type KeywordTemplate,
  type KeywordTemplateContent,
} from "@/lib/keyword-templates";
import { ukCitiesData, type CityData } from "@/lib/uk-cities-data";

/**
 * Runtime source of truth for KeywordTemplates. DB rows from the
 * `KeywordTemplate` Prisma model are layered on top of the static seed in
 * `keyword-templates.ts`; DB wins by slug. A 30s in-memory cache prevents
 * the loader from hammering Mongo on the SSG/edge hot paths.
 */

const CACHE_TTL_MS = 30 * 1000;
let _cache: { at: number; data: KeywordTemplate[] } | null = null;

function rowToTemplate(row: {
  slug: string;
  label: string;
  pillarKeyword: string | null;
  intentTags: string[];
  isActive: boolean;
  position: number;
  citiesMode: string;
  selectedCities: string[];
  content: unknown;
}): KeywordTemplate {
  const content =
    row.content && typeof row.content === "object"
      ? (row.content as KeywordTemplateContent)
      : ({} as KeywordTemplateContent);
  return {
    slug: row.slug,
    label: row.label,
    pillarKeyword: row.pillarKeyword ?? undefined,
    intentTags: row.intentTags ?? [],
    isActive: row.isActive,
    position: row.position,
    citiesMode: row.citiesMode === "selected" ? "selected" : "all",
    selectedCities: row.selectedCities ?? [],
    content,
  };
}

async function fetchDbTemplates(): Promise<KeywordTemplate[]> {
  try {
    const rows = await prisma.keywordTemplate.findMany({
      orderBy: { position: "asc" },
    });
    return rows.map(rowToTemplate);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[keyword-templates-store] DB unreachable, using static seed:", err);
    }
    return [];
  }
}

export async function loadAllKeywordTemplates(): Promise<KeywordTemplate[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.data;
  }
  const dbTemplates = await fetchDbTemplates();
  const dbSlugs = new Set(dbTemplates.map((t) => t.slug));
  const merged = [
    ...dbTemplates,
    ...STATIC_TEMPLATES.filter((t) => !dbSlugs.has(t.slug)),
  ].sort((a, b) => a.position - b.position);
  _cache = { at: Date.now(), data: merged };
  return merged;
}

export async function loadActiveKeywordTemplates(): Promise<KeywordTemplate[]> {
  const all = await loadAllKeywordTemplates();
  return all.filter((t) => t.isActive !== false);
}

export async function loadKeywordTemplateBySlug(
  slug: string,
): Promise<KeywordTemplate | null> {
  const all = await loadAllKeywordTemplates();
  return all.find((t) => t.slug === slug) ?? null;
}

export function invalidateKeywordTemplatesCache() {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Page-generation helpers
// ---------------------------------------------------------------------------

/** Resolve the list of city slugs a given template applies to. */
export function citiesForTemplate(template: KeywordTemplate): string[] {
  if (template.citiesMode === "selected") {
    return template.selectedCities.filter((s) => Boolean(ukCitiesData[s]));
  }
  return Object.keys(ukCitiesData);
}

/**
 * Build the `[keywordSlug]` URL parameters every active template would
 * generate. Each entry is the fully-rendered slug ready for
 * `/{keywordSlug}` (i.e. already includes `-in-{city}`).
 */
export async function generateKeywordPageParams(): Promise<Array<{ keywordSlug: string }>> {
  const templates = await loadActiveKeywordTemplates();
  const params: Array<{ keywordSlug: string }> = [];
  for (const tpl of templates) {
    for (const citySlug of citiesForTemplate(tpl)) {
      params.push({ keywordSlug: `${tpl.slug}-in-${citySlug}` });
    }
  }
  return params;
}

/**
 * Reverse-parse a `/{keywordSlug}` URL into its template + city pair.
 * Returns null when the slug doesn't match any active template×city combo,
 * which is the cue for the route to call `notFound()`.
 */
export async function resolveKeywordPage(keywordSlug: string): Promise<{
  template: KeywordTemplate;
  city: CityData;
} | null> {
  const templates = await loadActiveKeywordTemplates();
  // Templates are matched longest-stem-first so e.g. `emergency-locksmith-near-me`
  // wins over `locksmith-near-me` for the URL
  // `/emergency-locksmith-near-me-in-london`.
  const sorted = [...templates].sort((a, b) => b.slug.length - a.slug.length);
  for (const tpl of sorted) {
    const stem = `${tpl.slug}-in-`;
    if (!keywordSlug.startsWith(stem)) continue;
    const citySlug = keywordSlug.slice(stem.length);
    const city = ukCitiesData[citySlug];
    if (!city) continue;
    if (!citiesForTemplate(tpl).includes(citySlug)) continue;
    return { template: tpl, city };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Token interpolation
// ---------------------------------------------------------------------------

const DEFAULT_RESPONSE = "30-45 minute";

function buildTokenMap(city: CityData): Record<string, string> {
  const areas = city.areas.slice(0, 5).join(", ");
  const landmarks = city.landmarks.slice(0, 3).join(", ");
  return {
    city: city.name,
    region: city.region,
    county: city.county,
    areas: areas || city.name,
    landmarks: landmarks || city.name,
    response: city.avgResponseTime || DEFAULT_RESPONSE,
    population: city.population,
  };
}

const TOKEN_RE = /\{(city|region|county|areas|landmarks|response|population)\}/g;

export function interpolate(input: string, city: CityData): string {
  const map = buildTokenMap(city);
  return input.replace(TOKEN_RE, (_, key: keyof typeof map) => map[key] ?? "");
}

/**
 * Render a full keyword landing by interpolating every string field in
 * `template.content` against a city. Returns a plain object the page
 * component can consume directly.
 */
export interface RenderedKeywordLanding {
  slug: string;          // full URL slug, e.g. "locksmith-near-me-in-london"
  template: KeywordTemplate;
  city: CityData;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  emotionalHook?: string;
  heroSubcopy?: string;
  seoCopy?: string;
  trustBullets: string[];
  faqs: Array<{ question: string; answer: string }>;
  ctaLabel: string;
}

export function renderKeywordLanding(
  template: KeywordTemplate,
  city: CityData,
): RenderedKeywordLanding {
  const c = template.content;
  const lerp = (s: string | undefined, fallback: string) =>
    interpolate(s && s.trim().length > 0 ? s : fallback, city);
  return {
    slug: `${template.slug}-in-${city.slug}`,
    template,
    city,
    metaTitle: lerp(c.metaTitle, `${template.label} in {city} | LockSafe UK`),
    metaDescription: lerp(
      c.metaDescription,
      `${template.label} — vetted local locksmiths in {city}, {response} response.`,
    ),
    h1: lerp(c.h1, `${template.label} in {city}`),
    intro: lerp(c.intro, `Find a vetted ${template.label.toLowerCase()} in {city}.`),
    emotionalHook: c.emotionalHook ? interpolate(c.emotionalHook, city) : undefined,
    heroSubcopy: c.heroSubcopy ? interpolate(c.heroSubcopy, city) : undefined,
    seoCopy: c.seoCopy ? interpolate(c.seoCopy, city) : undefined,
    trustBullets: (c.trustBullets ?? []).map((b) => interpolate(b, city)),
    faqs: (c.faqs ?? []).map((f) => ({
      question: interpolate(f.question, city),
      answer: interpolate(f.answer, city),
    })),
    ctaLabel: lerp(c.ctaLabel, `Find a locksmith in {city}`),
  };
}
