/**
 * Google Ads Suggestion Analysis Cron
 *
 * Runs after the performance sync (every 6 hours). Reads AdPerformanceSnapshot
 * data for all PUBLISHED campaigns and generates CampaignSuggestion rows via
 * Hermes (local Ollama tool-calling model). No Google Ads mutations are fired
 * here — suggestions sit in PENDING until a human approves them.
 *
 * Also runs the weekly reflection step when invoked with ?reflect=1 or when
 * the day-of-week is Monday.
 *
 * Schedule: 0 *\/6 * * * (every 6 hours)
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runFullSuggestionCycle, reflectOnApprovalPatterns } from "@/lib/google-ads-suggestions";
import { runCampaignLadder } from "@/lib/campaign-ladder";


export async function POST(request: NextRequest) {
  const start = Date.now();

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceReflect = url.searchParams.get("reflect") === "1";
  const isMonday = new Date().getDay() === 1;

  try {
    // 1. Standard keyword/budget suggestion cycle (existing)
    const cycleResult = await runFullSuggestionCycle();

    // 2. ROAS ladder — evaluate campaign progression, emit rung suggestions
    const ladderResult = await runCampaignLadder();

    // 3. Weekly reflection (Mondays or ?reflect=1)
    let reflectionResult = null;
    if (forceReflect || isMonday) {
      reflectionResult = await reflectOnApprovalPatterns();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      cycle: cycleResult,
      ladder: {
        campaignsEvaluated: ladderResult.campaignsEvaluated,
        suggestionsCreated: ladderResult.suggestionsCreated,
        decisions: ladderResult.decisions,
        errors: ladderResult.errors.length > 0 ? ladderResult.errors : undefined,
      },
      reflection: reflectionResult,
    });
  } catch (err) {
    console.error("[Cron] google-ads-suggestions error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), duration: Date.now() - start },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    description: "Google Ads suggestion analysis cron. POST to trigger.",
    schedule: "0 */6 * * * (every 6 hours)",
  });
}
