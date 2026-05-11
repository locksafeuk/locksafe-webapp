/**
 * GET    /api/admin/intent-landings/[slug] → fetch single (merged) landing
 * PATCH  /api/admin/intent-landings/[slug] → upsert DB override
 * DELETE /api/admin/intent-landings/[slug] → remove DB override (revert to static if present)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  invalidateIntentLandingsCache,
  loadIntentLandingBySlug,
} from "@/lib/intent-landings-store";
import {
  parseIntentBlocks,
  type IntentLanding,
} from "@/lib/intent-landing";
import { INTENT_LANDINGS as STATIC_LANDINGS } from "@/lib/intent-landings";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

function pickContent(body: Record<string, unknown>, fallback: IntentLanding): IntentLanding {
  const blocks =
    body.blocks !== undefined ? parseIntentBlocks(body.blocks) : fallback.blocks;
  return {
    slug: fallback.slug,
    title: typeof body.title === "string" ? body.title : fallback.title,
    pillarKeyword:
      typeof body.pillarKeyword === "string" ? body.pillarKeyword : fallback.pillarKeyword,
    intentTags: Array.isArray(body.intentTags)
      ? (body.intentTags as unknown[]).filter((t): t is string => typeof t === "string")
      : fallback.intentTags,
    isActive: typeof body.isActive === "boolean" ? body.isActive : fallback.isActive,
    position: typeof body.position === "number" ? body.position : fallback.position,
    h1: typeof body.h1 === "string" ? body.h1 : fallback.h1,
    intro: typeof body.intro === "string" ? body.intro : fallback.intro,
    emotionalHook:
      typeof body.emotionalHook === "string" ? body.emotionalHook : fallback.emotionalHook,
    heroSubcopy:
      typeof body.heroSubcopy === "string" ? body.heroSubcopy : fallback.heroSubcopy,
    emotionalHookB:
      typeof body.emotionalHookB === "string" ? body.emotionalHookB : fallback.emotionalHookB,
    heroSubcopyB:
      typeof body.heroSubcopyB === "string" ? body.heroSubcopyB : fallback.heroSubcopyB,
    heroImageUrl:
      typeof body.heroImageUrl === "string" ? body.heroImageUrl : fallback.heroImageUrl,
    seoCopy: typeof body.seoCopy === "string" ? body.seoCopy : fallback.seoCopy,
    metaTitle: typeof body.metaTitle === "string" ? body.metaTitle : fallback.metaTitle,
    metaDescription:
      typeof body.metaDescription === "string" ? body.metaDescription : fallback.metaDescription,
    serviceFilter:
      body.serviceFilter && typeof body.serviceFilter === "object"
        ? (body.serviceFilter as IntentLanding["serviceFilter"])
        : fallback.serviceFilter,
    faqs: Array.isArray(body.faqs) ? (body.faqs as IntentLanding["faqs"]) : fallback.faqs,
    blocks,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  if (!landing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbRow = await prisma.intentLanding.findUnique({ where: { slug } });
  return NextResponse.json({
    landing,
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fallback to whichever is currently live (DB or static seed).
  const current = await loadIntentLandingBySlug(slug);
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = pickContent(body, current);

  const row = await prisma.intentLanding.upsert({
    where: { slug },
    create: {
      slug,
      title: content.title,
      pillarKeyword: content.pillarKeyword ?? null,
      intentTags: content.intentTags,
      isActive: content.isActive !== false,
      position: content.position,
      content: content as unknown as object,
      updatedBy: String((admin as { sub?: string }).sub ?? ""),
    },
    update: {
      title: content.title,
      pillarKeyword: content.pillarKeyword ?? null,
      intentTags: content.intentTags,
      isActive: content.isActive !== false,
      position: content.position,
      content: content as unknown as object,
      updatedBy: String((admin as { sub?: string }).sub ?? ""),
    },
  });

  invalidateIntentLandingsCache();
  revalidatePath("/intent");
  revalidatePath(`/intent/${slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true, slug: row.slug, updatedAt: row.updatedAt });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const dbRow = await prisma.intentLanding.findUnique({ where: { slug } });
  if (!dbRow) {
    return NextResponse.json(
      { error: "No DB override to remove (entry is static-only)" },
      { status: 404 },
    );
  }
  await prisma.intentLanding.delete({ where: { slug } });

  invalidateIntentLandingsCache();
  revalidatePath("/intent");
  revalidatePath(`/intent/${slug}`);
  revalidatePath("/sitemap.xml");

  const stillExists = STATIC_LANDINGS.some((l) => l.slug === slug);
  return NextResponse.json({ ok: true, slug, revertedToStatic: stillExists });
}
