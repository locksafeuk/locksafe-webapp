/**
 * Admin: poster image library review.
 *   GET  ?status=PENDING_REVIEW  → counts by status + the assets for that status
 *   POST { id, action: "approve" | "reject" } → set APPROVED / REJECTED
 *
 * The agent only ever posts APPROVED assets, so this is the human quality gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import type { PosterAssetStatus } from "@prisma/client";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const STATUSES: PosterAssetStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED", "USED"];

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const status = (new URL(request.url).searchParams.get("status") || "PENDING_REVIEW") as PosterAssetStatus;

  const grouped = await prisma.posterAsset.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<string, number> = { PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0, USED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  const assets = await prisma.posterAsset.findMany({
    where: { status: STATUSES.includes(status) ? status : "PENDING_REVIEW" },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, url: true, theme: true, model: true, visionReason: true, createdAt: true, status: true, qaVerdict: true, qaReport: true, qaGate1Reason: true },
  });

  return NextResponse.json({ success: true, counts, assets });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ success: false, error: "Provide id and action ('approve'|'reject')" }, { status: 400 });
  }
  const status: PosterAssetStatus = body.action === "approve" ? "APPROVED" : "REJECTED";
  await prisma.posterAsset.update({
    where: { id: body.id },
    data: { status, reviewedAt: new Date(), reviewedBy: String((admin as { email?: string }).email ?? "admin") },
  });
  return NextResponse.json({ success: true, id: body.id, status });
}
