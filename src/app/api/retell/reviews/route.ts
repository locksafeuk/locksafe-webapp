export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeCompositeQaScore, normalizeQaReviewInput } from "@/lib/retell-qa";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callId = request.nextUrl.searchParams.get("callId");
    const where = callId ? { callId } : {};

    const reviews = await prisma.voiceCallReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totals = reviews.length;
    const avgNaturalness =
      totals > 0
        ? +(reviews.reduce((sum, item) => sum + (item.naturalnessScore ?? 0), 0) / totals).toFixed(2)
        : 0;
    const compositeScores = reviews
      .map((review) => computeCompositeQaScore(review))
      .filter((score): score is number => score !== null);
    const avgComposite =
      compositeScores.length > 0
        ? +(compositeScores.reduce((sum, score) => sum + score, 0) / compositeScores.length).toFixed(
            2
          )
        : 0;

    return NextResponse.json({
      success: true,
      reviews,
      metrics: { totals, avgNaturalness, avgComposite },
    });
  } catch (error: any) {
    console.error("[API] Error listing voice reviews:", error);
    return NextResponse.json({ error: "Failed to list voice reviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const normalized = normalizeQaReviewInput(body ?? {});
    if (!normalized.ok) {
      const issues = "errors" in normalized ? normalized.errors : ["invalid_payload"];
      return NextResponse.json(
        { error: "Invalid review payload", issues },
        { status: 400 }
      );
    }

    const payload = normalized.review;
    const review = await prisma.voiceCallReview.create({
      data: {
        callId: payload.callId,
        reviewerId: admin.email || "admin",
        labels: payload.labels,
        notes: payload.notes,
        naturalnessScore: payload.naturalnessScore,
        accuracyScore: payload.accuracyScore,
        empathyScore: payload.empathyScore,
        complianceScore: payload.complianceScore,
        shouldEscalate: payload.shouldEscalate,
        isGoldenExample: payload.isGoldenExample,
      },
    });

    await prisma.voiceCall.update({
      where: { id: payload.callId },
      data: {
        flaggedForReview: payload.shouldEscalate,
        reviewNotes: payload.notes ? payload.notes.slice(0, 500) : undefined,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      review,
      compositeScore: computeCompositeQaScore(payload),
    });
  } catch (error: any) {
    console.error("[API] Error creating voice review:", error);
    return NextResponse.json({ error: "Failed to create voice review" }, { status: 500 });
  }
}
