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
      ...(typesFilter ? { actionType: { in: typesFilter } } : {}),
    },
    select: {
      id: true,
      actionType: true,
      reason: true,
      agentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  // Split into protected vs rejectable
  const toReject = stale.filter((a: { actionType: string }) =>
    !SAFELIST_TYPES.includes(a.actionType)
  );
  const protected_ = stale.filter((a: { actionType: string }) =>
    SAFELIST_TYPES.includes(a.actionType)
  );

  if (!dryRun && toReject.length > 0) {
    await prismaAny.agentApproval.updateMany({
      where: { id: { in: toReject.map((a: { id: string }) => a.id) } },
      data: {
        status: "rejected",
        resolution:
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
      toReject: toReject.map((a: { id: string; actionType: string; reason: string; createdAt: Date }) => ({
        id: a.id,
        actionType: a.actionType,
        reason: a.reason,
        age: `${Math.floor((Date.now() - a.createdAt.getTime()) / 86_400_000)}d`,
      })),
      protected: protected_.map((a: { id: string; actionType: string; reason: string }) => ({
        id: a.id,
        actionType: a.actionType,
        reason: a.reason,
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
      by: ["actionType"],
      where: { status: "pending" },
      _count: { _all: true },
      orderBy: { _count: { actionType: "desc" } },
    }),
    prismaAny.agentApproval.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, actionType: true, reason: true },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleCount = await prismaAny.agentApproval.count({
    where: {
      status: "pending",
      createdAt: { lt: sevenDaysAgo },
      actionType: { notIn: SAFELIST_TYPES },
    },
  });

  return NextResponse.json({
    total,
    staleCount,
    safelistTypes: SAFELIST_TYPES,
    byType: byType.map((b: { actionType: string; _count: { _all: number } }) => ({
      actionType: b.actionType,
      count: b._count._all,
      safelist: SAFELIST_TYPES.includes(b.actionType),
    })),
    oldest: oldest
      ? {
          age: `${Math.floor((Date.now() - oldest.createdAt.getTime()) / 86_400_000)}d`,
          actionType: oldest.actionType,
          reason: oldest.reason,
        }
      : null,
    hint: staleCount > 0
      ? `POST with {dryRun:true} to preview, {dryRun:false} to execute cleanup of ${staleCount} stale approvals.`
      : "Queue looks healthy.",
  });
}
