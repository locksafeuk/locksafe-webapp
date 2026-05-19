export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeExperimentSummary } from "@/lib/retell-experiments";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const experiments = await prisma.voiceExperiment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, experiments });
  } catch (error: any) {
    console.error("[API] Error listing experiments:", error);
    return NextResponse.json({ error: "Failed to list experiments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const mode = body?.action;

    if (mode === "evaluate") {
      const experimentId = typeof body?.experimentId === "string" ? body.experimentId : "";
      if (!experimentId) {
        return NextResponse.json({ error: "Missing experimentId" }, { status: 400 });
      }

      const result = await computeExperimentSummary(experimentId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json({ success: true, experiment: result.experiment, summary: result.summary });
    }

    const name = typeof body?.name === "string" ? body.name : "Voice Experiment";
    const controlVersionId = typeof body?.controlVersionId === "string" ? body.controlVersionId : null;
    const challengerVersionId = typeof body?.challengerVersionId === "string" ? body.challengerVersionId : null;

    if (!controlVersionId || !challengerVersionId) {
      return NextResponse.json({ error: "controlVersionId and challengerVersionId are required" }, { status: 400 });
    }

    const experiment = await prisma.voiceExperiment.create({
      data: {
        name,
        status: "running",
        controlVersionId,
        challengerVersionId,
        trafficSplit: typeof body?.trafficSplit === "number" ? body.trafficSplit : 50,
        stopLossThreshold:
          typeof body?.stopLossThreshold === "number" ? body.stopLossThreshold : 15,
        createdBy: admin.email || "admin",
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, experiment });
  } catch (error: any) {
    console.error("[API] Error creating/evaluating experiment:", error);
    return NextResponse.json({ error: "Failed to process experiment" }, { status: 500 });
  }
}
