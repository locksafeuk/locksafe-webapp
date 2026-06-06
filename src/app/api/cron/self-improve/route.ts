/**
 * Cron: self-improvement experiment run.
 *
 * Measures outcome metrics, runs the bounded hill-climb adjuster for each
 * tunable parameter, records the decision, and (when
 * CONTROL_PLANE_SELFIMPROVE_ENFORCE=true) applies the change. Default is shadow:
 * it records suggestions without altering live values.
 *
 * Schedule conservatively (e.g. daily) so each change has a full measurement
 * window before the next adjustment.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runSelfImprovement } from "@/agents/self-improvement/runner";
import { PrismaMetricProvider, PrismaParameterStore } from "@/agents/self-improvement/adapters/prisma";

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runSelfImprovement({
      metrics: new PrismaMetricProvider(7),
      store: new PrismaParameterStore(),
    });
    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    console.error("[cron/self-improve] failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}

// Allow manual GET trigger from the Vercel cron scheduler too.
export const GET = POST;
