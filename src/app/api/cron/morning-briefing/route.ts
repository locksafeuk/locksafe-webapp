/**
 * Cron: /api/cron/morning-briefing
 * Schedule: 0 8 * * * (08:00 UTC daily)
 *
 * Sends a daily KPI digest to Telegram and logs the briefing.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runMorningBriefing } from "@/agents/workflows/morning-briefing";

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const result = await runMorningBriefing();
    return NextResponse.json({
      success: result.success,
      errors: result.errors,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    console.error("[morning-briefing] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
