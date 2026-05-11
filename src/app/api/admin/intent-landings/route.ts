/**
 * Admin CRUD for intent landings.
 *
 * GET    /api/admin/intent-landings              → list
 * POST   /api/admin/intent-landings              → create
 *
 * Writes invalidate the per-request memo cache, regenerate the affected
 * SSG paths (`/intent/[slug]` + index + sitemap), and return the saved row.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  invalidateIntentLandingsCache,
  loadAllIntentLandings,
} from "@/lib/intent-landings-store";
import {
  parseIntentBlocks,
  type IntentLanding,
} from "@/lib/intent-landing";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pickContent(body: Record<string, unknown>): IntentLanding {
  // Best-effort coercion. We only persist the fields we know about.
  const blocks = parseIntentBlocks(body.blocks);
  return {
    slug: String(body.slug ?? ""),
    title: String(body.title ?? ""),
    pillarKeyword: typeof body.pillarKeyword === "string" ? body.pillarKeyword : undefined,
    intentTags: Array.isArray(body.intentTags)
      ? (body.intentTags as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    isActive: body.isActive !== false,
    position: typeof body.position === "number" ? body.position : 0,
    h1: typeof body.h1 === "string" ? body.h1 : String(body.title ?? ""),
    intro: typeof body.intro === "string" ? body.intro : undefined,
    emotionalHook: typeof body.emotionalHook === "string" ? body.emotionalHook : undefined,
    heroSubcopy: typeof body.heroSubcopy === "string" ? body.heroSubcopy : undefined,
    emotionalHookB: typeof body.emotionalHookB === "string" ? body.emotionalHookB : undefined,
    heroSubcopyB: typeof body.heroSubcopyB === "string" ? body.heroSubcopyB : undefined,
    heroImageUrl: typeof body.heroImageUrl === "string" ? body.heroImageUrl : undefined,
    seoCopy: typeof body.seoCopy === "string" ? body.seoCopy : undefined,
    metaTitle: typeof body.metaTitle === "string" ? body.metaTitle : undefined,
    metaDescription: typeof body.metaDescription === "string" ? body.metaDescription : undefined,
    serviceFilter:
      body.serviceFilter && typeof body.serviceFilter === "object"
        ? (body.serviceFilter as IntentLanding["serviceFilter"])
        : { serviceSlugs: [] },
    faqs: Array.isArray(body.faqs) ? (body.faqs as IntentLanding["faqs"]) : [],
    blocks,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const merged = await loadAllIntentLandings();
  // Mark which entries are DB-backed vs static-only so the UI can hint.
  const dbRows = await prisma.intentLanding.findMany({ select: { slug: true } });
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  return NextResponse.json({
    landings: merged.map((l) => ({
      slug: l.slug,
      title: l.title,
      pillarKeyword: l.pillarKeyword ?? null,
      intentTags: l.intentTags,
      isActive: l.isActive,
      position: l.position,
      hasABTest: Boolean(l.emotionalHookB),
      faqCount: l.faqs.length,
      source: dbSlugs.has(l.slug) ? "db" : "static",
    })),
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
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const existing = await prisma.intentLanding.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Landing with slug "${slug}" already exists` },
      { status: 409 },
    );
  }

  const content = pickContent({ ...body, slug });
  const row = await prisma.intentLanding.create({
    data: {
      slug,
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

  return NextResponse.json({ ok: true, slug: row.slug });
}
