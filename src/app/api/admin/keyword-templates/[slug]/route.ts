/**
 * GET    /api/admin/keyword-templates/[slug] → fetch single (merged)
 * PATCH  /api/admin/keyword-templates/[slug] → upsert DB override
 * DELETE /api/admin/keyword-templates/[slug] → remove DB override
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  invalidateKeywordTemplatesCache,
  loadKeywordTemplateBySlug,
  citiesForTemplate,
} from "@/lib/keyword-templates-store";
import { KEYWORD_TEMPLATES as STATIC_TEMPLATES } from "@/lib/keyword-templates";
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

function pickContent(
  body: Record<string, unknown>,
  fallback: KeywordTemplateContent,
): KeywordTemplateContent {
  const c =
    body.content && typeof body.content === "object"
      ? (body.content as Record<string, unknown>)
      : {};
  const str = (v: unknown, fb: string | undefined) =>
    typeof v === "string" ? (v.trim().length > 0 ? v : undefined) : fb;
  return {
    metaTitle: str(c.metaTitle, fallback.metaTitle),
    metaDescription: str(c.metaDescription, fallback.metaDescription),
    h1: str(c.h1, fallback.h1),
    intro: str(c.intro, fallback.intro),
    emotionalHook: str(c.emotionalHook, fallback.emotionalHook),
    heroSubcopy: str(c.heroSubcopy, fallback.heroSubcopy),
    seoCopy: str(c.seoCopy, fallback.seoCopy),
    ctaLabel: str(c.ctaLabel, fallback.ctaLabel),
    trustBullets: Array.isArray(c.trustBullets)
      ? (c.trustBullets as unknown[]).filter((v): v is string => typeof v === "string")
      : (fallback.trustBullets ?? []),
    faqs: Array.isArray(c.faqs)
      ? (c.faqs as unknown[])
          .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
          .map((v) => ({
            question: typeof v.question === "string" ? v.question : "",
            answer: typeof v.answer === "string" ? v.answer : "",
          }))
          .filter((f) => f.question && f.answer)
      : (fallback.faqs ?? []),
  };
}

function revalidateAllForTemplate(t: KeywordTemplate) {
  for (const citySlug of citiesForTemplate(t)) {
    revalidatePath(`/${t.slug}-in-${citySlug}`);
  }
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/seo/keywords");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const tpl = await loadKeywordTemplateBySlug(slug);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbRow = await prisma.keywordTemplate.findUnique({ where: { slug } });
  return NextResponse.json({
    template: tpl,
    pageCount: citiesForTemplate(tpl).length,
    source: dbRow ? "db" : "static",
    updatedAt: dbRow?.updatedAt ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const current = await loadKeywordTemplateBySlug(slug);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : current.label;
  const citiesMode =
    body.citiesMode === "selected" ? "selected" : body.citiesMode === "all" ? "all" : current.citiesMode;
  const selectedCities = Array.isArray(body.selectedCities)
    ? (body.selectedCities as unknown[])
        .filter((v): v is string => typeof v === "string")
        .filter((s) => Boolean(ukCitiesData[s]))
    : current.selectedCities;
  const content = pickContent(body, current.content);

  await prisma.keywordTemplate.upsert({
    where: { slug },
    create: {
      slug,
      label,
      pillarKeyword:
        typeof body.pillarKeyword === "string" ? body.pillarKeyword : current.pillarKeyword ?? null,
      intentTags: Array.isArray(body.intentTags)
        ? (body.intentTags as unknown[]).filter((v): v is string => typeof v === "string")
        : current.intentTags,
      isActive: typeof body.isActive === "boolean" ? body.isActive : current.isActive,
      position: typeof body.position === "number" ? body.position : current.position,
      citiesMode,
      selectedCities,
      content: content as unknown as object,
      updatedBy: String((admin as { sub?: string }).sub ?? ""),
    },
    update: {
      label,
      pillarKeyword:
        typeof body.pillarKeyword === "string" ? body.pillarKeyword : current.pillarKeyword ?? null,
      intentTags: Array.isArray(body.intentTags)
        ? (body.intentTags as unknown[]).filter((v): v is string => typeof v === "string")
        : current.intentTags,
      isActive: typeof body.isActive === "boolean" ? body.isActive : current.isActive,
      position: typeof body.position === "number" ? body.position : current.position,
      citiesMode,
      selectedCities,
      content: content as unknown as object,
      updatedBy: String((admin as { sub?: string }).sub ?? ""),
    },
  });

  invalidateKeywordTemplatesCache();
  // Revalidate against the OLD city set AND the new one so removed cities also drop.
  revalidateAllForTemplate(current);
  const next = await loadKeywordTemplateBySlug(slug);
  if (next) revalidateAllForTemplate(next);

  return NextResponse.json({
    ok: true,
    slug,
    pageCount: next ? citiesForTemplate(next).length : 0,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const dbRow = await prisma.keywordTemplate.findUnique({ where: { slug } });
  if (!dbRow) {
    return NextResponse.json(
      { error: "No DB override to remove (entry is static-only)" },
      { status: 404 },
    );
  }
  const before = await loadKeywordTemplateBySlug(slug);
  await prisma.keywordTemplate.delete({ where: { slug } });

  invalidateKeywordTemplatesCache();
  if (before) revalidateAllForTemplate(before);
  const stillExists = STATIC_TEMPLATES.some((t) => t.slug === slug);
  if (stillExists) {
    const after = await loadKeywordTemplateBySlug(slug);
    if (after) revalidateAllForTemplate(after);
  }

  return NextResponse.json({ ok: true, slug, revertedToStatic: stillExists });
}
