export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const seed = typeof body?.seed === "number" ? body.seed : Math.floor(Math.random() * 100);

    const active = await prisma.voiceExperiment.findFirst({
      where: { status: "running" },
      orderBy: { createdAt: "desc" },
    });

    if (!active) {
      return NextResponse.json({ success: true, assignedVersionId: null, reason: "no_active_experiment" });
    }

    const challengerWins = seed % 100 < active.trafficSplit;
    const assignedVersionId = challengerWins ? active.challengerVersionId : active.controlVersionId;

    return NextResponse.json({
      success: true,
      experimentId: active.id,
      assignedVersionId,
      bucket: challengerWins ? "challenger" : "control",
      stopLossThreshold: active.stopLossThreshold,
    });
  } catch (error: any) {
    console.error("[API] Error assigning experiment bucket:", error);
    return NextResponse.json({ error: "Failed to assign experiment bucket" }, { status: 500 });
  }
}
