export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RETELL_SIMULATION_SCENARIOS, scoreSimulationOutput } from "@/lib/retell-simulations";

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const versionId = typeof body?.versionId === "string" ? body.versionId : undefined;
    const scenarioKey = typeof body?.scenario === "string" ? body.scenario : undefined;

    const scenarios = scenarioKey
      ? RETELL_SIMULATION_SCENARIOS.filter((s) => s.key === scenarioKey)
      : RETELL_SIMULATION_SCENARIOS;

    const runs = [];

    for (const scenario of scenarios) {
      const transcript = typeof body?.transcript === "string" ? body.transcript : "";
      const collectedFields = Array.isArray(body?.collectedFields)
        ? body.collectedFields.filter((x: any) => typeof x === "string")
        : ["name", "postcode", "phone"];
      const naturalnessScore = typeof body?.naturalnessScore === "number" ? body.naturalnessScore : 3.8;
      const escalated = Boolean(body?.escalated);

      const scored = scoreSimulationOutput({
        transcript,
        collectedFields,
        naturalnessScore,
        escalated,
        scenario,
      });

      const run = await prisma.voiceSimulationRun.create({
        data: {
          versionId,
          scenario: scenario.key,
          inputJson: {
            collectedFields,
            naturalnessScore,
            escalated,
          },
          outputJson: {
            transcript,
            ...scored,
          },
          passed: scored.passed,
          score: scored.score,
          failureReason: scored.failureReason,
          runBy: admin.email || "admin",
        },
      });

      runs.push(run);
    }

    const passRate = runs.length > 0 ? +((runs.filter((r) => r.passed).length / runs.length) * 100).toFixed(1) : 0;

    return NextResponse.json({ success: true, runs, metrics: { total: runs.length, passRate } });
  } catch (error: any) {
    console.error("[API] Error running voice simulations:", error);
    return NextResponse.json({ error: "Failed to run simulations" }, { status: 500 });
  }
}
