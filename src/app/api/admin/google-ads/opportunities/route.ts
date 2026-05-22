/**
 * GET  /api/admin/google-ads/opportunities       — list latest opportunities
 * POST /api/admin/google-ads/opportunities/scan  — handled in sibling /scan route
 *
 * Returns the most recent batch (latest `computedAt`) of `GoogleAdsOpportunity`
 * rows, split by kind (COVERAGE | RECRUIT), with NEW rows first.
 *
 * Auth: admin only.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Most recent batch only — opportunities replay every Monday so older
  // batches are kept for trend analysis but hidden from the default view.
  const latest = await prisma.googleAdsOpportunity.findFirst({
    orderBy: { computedAt: "desc" },
    select: { computedAt: true },
  });

  if (!latest) {
    return NextResponse.json({
      computedAt: null,
      coverage: [],
      recruit: [],
    });
  }

  // 1-hour fuzz around the batch timestamp so opportunities written across the
  // run all surface together.
  const windowMs = 60 * 60 * 1000;
  const since = new Date(latest.computedAt.getTime() - windowMs);

  const rows = await prisma.googleAdsOpportunity.findMany({
    where: { computedAt: { gte: since } },
    orderBy: [{ status: "asc" }, { score: "desc" }],
    take: 200,
  });

  const coverage = rows.filter((r) => r.kind === "COVERAGE");
  const recruit = rows.filter((r) => r.kind === "RECRUIT");

  return NextResponse.json({
    computedAt: latest.computedAt.toISOString(),
    coverage,
    recruit,
  });
}
