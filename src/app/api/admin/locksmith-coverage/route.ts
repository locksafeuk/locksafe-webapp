/**
 * Admin API for LocksmithCoverage management.
 *
 * GET    /api/admin/locksmith-coverage             — list all rows (with locksmith name + computed load)
 * GET    /api/admin/locksmith-coverage?district=X  — list rows for one district
 * GET    /api/admin/locksmith-coverage?locksmith=Y — list rows for one locksmith
 * POST   /api/admin/locksmith-coverage             — add a coverage row
 * PATCH  /api/admin/locksmith-coverage             — update capacity / pause state
 * DELETE /api/admin/locksmith-coverage?id=Z        — remove a row
 *
 * Auth: admin JWT cookie (same pattern as the rest of /admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  extractDistrict,
  currentWeeklyLoad,
  getCoverageForDistrict,
} from "@/lib/locksmith-coverage";

// Same pattern as the lib — `LocksmithCoverage` is recognised once the user
// runs `npx prisma generate`. Until then the typed client doesn't see it.
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
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const district  = searchParams.get("district");
  const locksmith = searchParams.get("locksmith");

  // Single-district view returns the rich verdict (includes per-locksmith load).
  if (district) {
    const verdict = await getCoverageForDistrict(district);
    return NextResponse.json({ verdict });
  }

  const where: Record<string, unknown> = {};
  if (locksmith) where.locksmithId = locksmith;

  const rows = await prisma.locksmithCoverage.findMany({
    where,
    include: {
      locksmith: {
        select: { id: true, name: true, isActive: true, isAvailable: true, onboardingCompleted: true },
      },
    },
    orderBy: [{ postcodeDistrict: "asc" }, { locksmith: { name: "asc" } }],
  });

  // Compute live load for each row. N+1 queries — but coverage rows are
  // bounded (a few hundred at most) and each load query is index-served.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withLoad = await Promise.all(
    rows.map(async (r: any) => ({
      id:                r.id,
      locksmithId:       r.locksmithId,
      locksmithName:     r.locksmith.name,
      locksmithActive:   r.locksmith.isActive && r.locksmith.onboardingCompleted,
      postcodeDistrict:  r.postcodeDistrict,
      city:              r.city,
      region:            r.region,
      weeklyCapacity:    r.weeklyCapacity,
      currentLoad:       await currentWeeklyLoad(r.locksmithId, r.postcodeDistrict),
      isPaused:          r.isPaused,
      pauseReason:       r.pauseReason,
      pausedUntil:       r.pausedUntil,
      source:            r.source,
      confidenceScore:   r.confidenceScore,
      lastConfirmedAt:   r.lastConfirmedAt,
    })),
  );

  return NextResponse.json({ coverages: withLoad });
}

// ── POST (create or upsert) ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { locksmithId, postcodeDistrict, city, region, weeklyCapacity } = body;

  if (!locksmithId || !postcodeDistrict) {
    return NextResponse.json(
      { error: "locksmithId and postcodeDistrict are required" }, { status: 400 },
    );
  }
  const district = extractDistrict(postcodeDistrict);
  if (!district) {
    return NextResponse.json(
      { error: `"${postcodeDistrict}" is not a valid UK postcode district (expected e.g. "RG1", "SK4", "MK9")` },
      { status: 400 },
    );
  }

  const lock = await prisma.locksmith.findUnique({ where: { id: locksmithId } });
  if (!lock) return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });

  const row = await prisma.locksmithCoverage.upsert({
    where: { locksmithId_postcodeDistrict: { locksmithId, postcodeDistrict: district } },
    create: {
      locksmithId,
      postcodeDistrict: district,
      city:             city ?? null,
      region:           region ?? null,
      weeklyCapacity:   typeof weeklyCapacity === "number" ? weeklyCapacity : 5,
      source:           "manual",
      confidenceScore:  1.0,
    },
    update: {
      city:             city ?? null,
      region:           region ?? null,
      weeklyCapacity:   typeof weeklyCapacity === "number" ? weeklyCapacity : undefined,
      lastConfirmedAt:  new Date(),
    },
  });

  return NextResponse.json({ coverage: row });
}

// ── PATCH (update capacity / pause / confirm) ───────────────────────────────

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, weeklyCapacity, isPaused, pauseReason, pausedUntil, confirm } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof weeklyCapacity === "number") data.weeklyCapacity = weeklyCapacity;
  if (typeof isPaused === "boolean")      data.isPaused        = isPaused;
  if (pauseReason !== undefined)          data.pauseReason     = pauseReason;
  if (pausedUntil !== undefined)
    data.pausedUntil = pausedUntil ? new Date(pausedUntil) : null;
  if (confirm)                            data.lastConfirmedAt = new Date();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const updated = await prisma.locksmithCoverage.update({ where: { id }, data });
  return NextResponse.json({ coverage: updated });
}

// ── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.locksmithCoverage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
