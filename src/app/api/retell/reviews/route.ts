export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    return NextResponse.json({ success: true, reviews, metrics: { totals, avgNaturalness } });
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
    const callId = typeof body?.callId === "string" ? body.callId : "";
    if (!callId) {
      return NextResponse.json({ error: "Missing callId" }, { status: 400 });
    }

    const review = await prisma.voiceCallReview.create({
      data: {
        callId,
        reviewerId: admin.email || "admin",
        labels: Array.isArray(body?.labels) ? body.labels.filter((x: any) => typeof x === "string") : [],
        notes: typeof body?.notes === "string" ? body.notes : null,
        naturalnessScore: typeof body?.naturalnessScore === "number" ? body.naturalnessScore : null,
        accuracyScore: typeof body?.accuracyScore === "number" ? body.accuracyScore : null,
        empathyScore: typeof body?.empathyScore === "number" ? body.empathyScore : null,
        complianceScore: typeof body?.complianceScore === "number" ? body.complianceScore : null,
        shouldEscalate: Boolean(body?.shouldEscalate),
        isGoldenExample: Boolean(body?.isGoldenExample),
      },
    });

    await prisma.voiceCall.update({
      where: { id: callId },
      data: {
        flaggedForReview: Boolean(body?.shouldEscalate),
        reviewNotes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : undefined,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error("[API] Error creating voice review:", error);
    return NextResponse.json({ error: "Failed to create voice review" }, { status: 500 });
  }
}
