/**
 * Admin API for DistrictLandingPage management.
 *
 * GET   /api/admin/district-landing             — list all pages (stats + rows)
 * GET   /api/admin/district-landing?district=X  — single page by district
 * POST  /api/admin/district-landing             — regenerate a district page
 *         body: { district: string }
 * PATCH /api/admin/district-landing             — update metadata / status
 *         body: { district: string, isPublished?: boolean, contentSource?: "needs_refresh" | "ai_generated", adminNotes?: string }
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  ensureDistrictLandingPage,
  REGENERATE_AFTER_DAYS,
} from "@/lib/district-landing/ensure-landing";
import { NoCoverageError } from "@/lib/district-landing/assemble-facts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.type === "admin" ? payload : null;
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const district = searchParams.get("district")?.trim().toUpperCase();

  if (district) {
    const page = await prisma.districtLandingPage.findUnique({
      where: { district },
    });
    if (!page) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ page });
  }

  const pages = await prisma.districtLandingPage.findMany({
    select: {
      id: true, district: true, slug: true,
      anchorTown: true, region: true,
      contentSource: true, llmModel: true,
      isPublished: true, generatedAt: true,
      publishedAt: true, updatedAt: true,
      adminNotes: true,
    },
    orderBy: { district: "asc" },
  });

  const now = Date.now();
  const staleMs = REGENERATE_AFTER_DAYS * 24 * 60 * 60 * 1000;

  const stats = {
    total:         pages.length,
    published:     pages.filter((p: { isPublished: boolean }) => p.isPublished).length,
    unpublished:   pages.filter((p: { isPublished: boolean }) => !p.isPublished).length,
    needsRefresh:  pages.filter((p: { contentSource: string }) => p.contentSource === "needs_refresh").length,
    manualOverride: pages.filter((p: { contentSource: string }) => p.contentSource === "manual_override").length,
    stale:         pages.filter((p: { generatedAt: Date | null }) =>
      p.generatedAt && (now - p.generatedAt.getTime()) > staleMs
    ).length,
  };

  return NextResponse.json({ pages, stats });
}

// ── POST — trigger (re)generation ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { district?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const district = body.district?.trim().toUpperCase();
  if (!district) {
    return NextResponse.json({ error: "Missing required field: district" }, { status: 400 });
  }

  // Force regeneration by temporarily setting contentSource to "needs_refresh"
  // so ensure-landing skips the freshness guard.
  const existing = await prisma.districtLandingPage.findUnique({
    where: { district },
    select: { contentSource: true },
  });

  if (existing) {
    await prisma.districtLandingPage.update({
      where: { district },
      data: { contentSource: "needs_refresh" },
    });
  }

  try {
    const result = await ensureDistrictLandingPage(district);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof NoCoverageError) {
      return NextResponse.json(
        { error: `No coverage for district ${district}: ${err.reason}` },
        { status: 422 }
      );
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH — update status / metadata ────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    district?:     string;
    isPublished?:  boolean;
    contentSource?: "needs_refresh" | "ai_generated" | "manual_override";
    adminNotes?:   string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const district = body.district?.trim().toUpperCase();
  if (!district) {
    return NextResponse.json({ error: "Missing required field: district" }, { status: 400 });
  }

  const existing = await prisma.districtLandingPage.findUnique({
    where: { district },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "District page not found" }, { status: 404 });
  }

  // Build the update object — only include provided fields
  const data: Record<string, unknown> = {};
  if (typeof body.isPublished  === "boolean") {
    data.isPublished = body.isPublished;
    if (body.isPublished) data.publishedAt = new Date();
  }
  if (body.contentSource !== undefined) {
    const allowed = ["needs_refresh", "ai_generated", "manual_override"];
    if (!allowed.includes(body.contentSource)) {
      return NextResponse.json({ error: "Invalid contentSource value" }, { status: 400 });
    }
    data.contentSource = body.contentSource;
  }
  if (typeof body.adminNotes === "string") {
    data.adminNotes = body.adminNotes.trim();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const page = await prisma.districtLandingPage.update({
    where: { district },
    data,
    select: {
      id: true, district: true, slug: true,
      anchorTown: true, contentSource: true,
      isPublished: true, generatedAt: true, publishedAt: true,
      adminNotes: true, updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, page });
}
