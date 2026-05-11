/**
 * Admin CRUD for keyword templates.
 *
 * GET  /api/admin/keyword-templates  → list (merged with static seed)
 * POST /api/admin/keyword-templates  → create new template
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  invalidateKeywordTemplatesCache,
  loadAllKeywordTemplates,
  citiesForTemplate,
} from "@/lib/keyword-templates-store";
import type { KeywordTemplate, KeywordTemplateContent } from "@/lib/keyword-templates";
import { ukCitiesData } from "@/lib/uk-cities-data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pickContent(body: Record<string, unknown>): KeywordTemplateContent {
  const c = body.content && typeof body.content === "object"
    ? (body.content as Record<string, unknown>)
    : {};
  const str = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v : undefined);
  return {
    metaTitle: str(c.metaTitle),
    metaDescription: str(c.metaDescription),
    h1: str(c.h1),
    intro: str(c.intro),
    emotionalHook: str(c.emotionalHook),
    heroSubcopy: str(c.heroSubcopy),
    seoCopy: str(c.seoCopy),
    ctaLabel: str(c.ctaLabel),
    trustBullets: Array.isArray(c.trustBullets)
      ? (c.trustBullets as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
    faqs: Array.isArray(c.faqs)
      ? (c.faqs as unknown[])
          .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
          .map((v) => ({
            question: typeof v.question === "string" ? v.question : "",
            answer: typeof v.answer === "string" ? v.answer : "",
          }))
          .filter((f) => f.question && f.answer)
      : [],
  };
}

function summarise(t: KeywordTemplate, source: "db" | "static") {
  const cities = citiesForTemplate(t).length;
  return {
    slug: t.slug,
    label: t.label,
    pillarKeyword: t.pillarKeyword ?? null,
    intentTags: t.intentTags,
    isActive: t.isActive,
    position: t.position,
    citiesMode: t.citiesMode,
    selectedCitiesCount: t.selectedCities.length,
    pageCount: cities,
    faqCount: t.content.faqs?.length ?? 0,
    source,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await loadAllKeywordTemplates();
  const dbRows = await prisma.keywordTemplate.findMany({ select: { slug: true } });
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  const totalCities = Object.keys(ukCitiesData).length;
  return NextResponse.json({
    totalCities,
    templates: all.map((t) => summarise(t, dbSlugs.has(t.slug) ? "db" : "static")),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "slug must be lowercase kebab-case" },
      { status: 400 },
    );
  }
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });

  // Slug must not end in `-in-{city}` (would collide with the URL builder).
  for (const city of Object.keys(ukCitiesData)) {
    if (slug.endsWith(`-in-${city}`)) {
      return NextResponse.json(
        { error: `slug cannot end with "-in-${city}" — that suffix is reserved for city expansion` },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.keywordTemplate.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Keyword template "${slug}" already exists` },
      { status: 409 },
    );
  }

  const citiesMode = body.citiesMode === "selected" ? "selected" : "all";
  const selectedCities = Array.isArray(body.selectedCities)
    ? (body.selectedCities as unknown[])
        .filter((v): v is string => typeof v === "string")
        .filter((s) => Boolean(ukCitiesData[s]))
    : [];

  const content = pickContent(body);
  const row = await prisma.keywordTemplate.create({
    data: {
      slug,
      label,
      pillarKeyword: typeof body.pillarKeyword === "string" ? body.pillarKeyword : null,
      intentTags: Array.isArray(body.intentTags)
        ? (body.intentTags as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      isActive: body.isActive !== false,
      position: typeof body.position === "number" ? body.position : 0,
      citiesMode,
      selectedCities,
      content: content as unknown as object,
      updatedBy: String((admin as { sub?: string }).sub ?? ""),
    },
  });

  invalidateKeywordTemplatesCache();
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/seo/keywords");

  return NextResponse.json({ ok: true, slug: row.slug, pageCount: citiesForTemplate({
    ...row,
    pillarKeyword: row.pillarKeyword ?? undefined,
    citiesMode: row.citiesMode === "selected" ? "selected" : "all",
    content: content,
  } as KeywordTemplate).length });
}
