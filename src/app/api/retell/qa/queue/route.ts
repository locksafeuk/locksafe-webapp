export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { prioritizeQaQueue, type QaQueueCall } from "@/lib/retell-qa";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.max(
      1,
      Math.min(Number(request.nextUrl.searchParams.get("limit") || 25), 100)
    );
    const lookbackHours = Math.max(
      1,
      Math.min(Number(request.nextUrl.searchParams.get("lookbackHours") || 72), 24 * 14)
    );

    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const calls = await prisma.voiceCall.findMany({
      where: {
        startedAt: { gte: since },
        isTestCall: false,
      },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        startedAt: true,
        durationSeconds: true,
        outcome: true,
        wasEscalated: true,
        flaggedForReview: true,
        isTestCall: true,
        callStatus: true,
        callerPhone: true,
        callCategory: true,
        urgencyLevel: true,
        _count: { select: { reviews: true } },
      },
    });

    const queueInput: QaQueueCall[] = calls.map((call) => ({
      id: call.id,
      startedAt: call.startedAt ?? null,
      durationSeconds: call.durationSeconds ?? null,
      outcome: call.outcome ?? null,
      wasEscalated: call.wasEscalated,
      flaggedForReview: call.flaggedForReview,
      isTestCall: call.isTestCall,
      callStatus: call.callStatus ?? null,
      reviewCount: call._count?.reviews ?? 0,
    }));

    const prioritized = prioritizeQaQueue(queueInput).slice(0, limit);
    const meta = new Map(calls.map((call) => [call.id, call]));

    const queue = prioritized.map((entry) => {
      const source = meta.get(entry.id);
      return {
        callId: entry.id,
        startedAt: entry.startedAt,
        durationSeconds: entry.durationSeconds,
        outcome: entry.outcome,
        wasEscalated: entry.wasEscalated,
        flaggedForReview: entry.flaggedForReview,
        callStatus: entry.callStatus,
        priority: entry.priority,
        reasons: entry.reasons,
        reviewCount: entry.reviewCount,
        callerPhone: source?.callerPhone ?? null,
        callCategory: source?.callCategory ?? null,
        urgencyLevel: source?.urgencyLevel ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      queue,
      windowHours: lookbackHours,
      candidateCount: calls.length,
    });
  } catch (error: any) {
    console.error("[API] Error building QA queue:", error);
    return NextResponse.json({ error: "Failed to build QA queue" }, { status: 500 });
  }
}
