/**
 * POST /api/admin/approvals/bulk-cleanup
 *
 * Bulk-rejects stale pending approvals that have no real value.
 * Protects safelisted approval types from bulk action.
 *
 * Body:
 *   { olderThanDays?: number, dryRun?: boolean, types?: string[] }
 *
 * Returns:
 *   { rejected: number, protected: number, dryRun: boolean, details: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// These approval types are NEVER bulk-rejected — they require human eyes
const SAFELIST_TYPES = [
  "HUMAN_ESCALATION",
  "CRITICAL_ALERT",
  "BUDGET_EXCEEDED",
  "PAYMENT_FAILED",
  "SECURITY_ISSUE",
  "LOCKSMITH_COMPLAINT",
  "REFUND_REQUEST",
];

// Low-value types that are safe to auto-reject when stale
const BULK_REJECTABLE_TYPES = [
  "NEW_CAMPAIGN_DRAFT",
  "SOCIAL_POST",
  "KEYWORD_CHANGE",
  "BID_ADJUSTMENT_SUGGESTION",
  "CONTENT_GENERATION",
  "REPORT",
];

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const olderThanDays: number = typeof body.olderThanDays === "number" ? body.olderThanDays : 7;
  const dryRun: boolean = body.dryRun !== false; // default to dry run — must opt-in to real deletion
  const typesFilter: string[] | null = Array.isArray(body.types) ? body.types : null;

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;

  // Find stale pending approvals
  const stale = await prismaAny.agentApproval.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
      ...(typesFilter ? { type: { in: typesFilter } } : {}),
    },
    select: {
      id: true,
      type: true,
      title: true,
      agentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  // Split into protected vs rejectable
  const toReject = stale.filter((a: { type: string }) =>
    !SAFELIST_TYPES.includes(a.type)
  );
  const protected_ = stale.filter((a: { type: string }) =>
    SAFELIST_TYPES.includes(a.type)
  );

  if (!dryRun && toReject.length > 0) {
    await prismaAny.agentApproval.updateMany({
      where: { id: { in: toReject.map((a: { id: string }) => a.id) } },
      data: {
        status: "rejected",
        rejectedReason:
          `Auto-rejected by bulk cleanup: stale approval older than ${olderThanDays} days ` +
          `with no human review. Platform discipline policy (see /admin/agents/policy).`,
        resolvedAt: new Date(),
        resolvedBy: admin.id,
      },
    });
  }

  return NextResponse.json({
    dryRun,
    cutoffDate: cutoff.toISOString(),
    olderThanDays,
    rejected: dryRun ? 0 : toReject.length,
    wouldReject: toReject.length,
    protected: protected_.length,
    details: {
      toReject: toReject.map((a: { id: string; type: string; title: string; createdAt: Date }) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        age: `${Math.floor((Date.now() - a.createdAt.getTime()) / 86_400_000)}d`,
      })),
      protected: protected_.map((a: { id: string; type: string; title: string }) => ({
        id: a.id,
        type: a.type,
        title: a.title,
      })),
    },
    message: dryRun
      ? `DRY RUN — would reject ${toReject.length} approvals (${protected_.length} protected). Set dryRun:false to execute.`
      : `Rejected ${toReject.length} stale approvals. ${protected_.length} safelisted approvals protected.`,
  });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return stats on current approval queue health
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;

  const [total, byType, oldest] = await Promise.all([
    prismaAny.agentApproval.count({ where: { status: "pending" } }),
    prismaAny.agentApproval.groupBy({
      by: ["type"],
      where: { status: "pending" },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
    }),
    prismaAny.agentApproval.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, type: true, title: true },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleCount = await prismaAny.agentApproval.count({
    where: {
      status: "pending",
      createdAt: { lt: sevenDaysAgo },
      type: { notIn: SAFELIST_TYPES },
    },
  });

  return NextResponse.json({
    total,
    staleCount,
    safelistTypes: SAFELIST_TYPES,
    byType: byType.map((b: { type: string; _count: { _all: number } }) => ({
      type: b.type,
      count: b._count._all,
      safelist: SAFELIST_TYPES.includes(b.type),
    })),
    oldest: oldest
      ? {
          age: `${Math.floor((Date.now() - oldest.createdAt.getTime()) / 86_400_000)}d`,
          type: oldest.type,
          title: oldest.title,
        }
      : null,
    hint: staleCount > 0
      ? `POST with {dryRun:true} to preview, {dryRun:false} to execute cleanup of ${staleCount} stale approvals.`
      : "Queue looks healthy.",
  });
}
