/**
 * Cron: weekly Google Ads Opportunity Scout run.
 *
 * Triggered Monday 04:00 UTC via vercel.json. Calls the Opportunity Scout
 * subagent which:
 *   1. Builds the coverage universe.
 *   2. Calls Google Keyword Planner per UK city we cover.
 *   3. Persists ranked GoogleAdsOpportunity rows.
 *   4. Repeats against uncovered cities (Recruit-Here report).
 *   5. Auto-drafts the top-3 covered opportunities if a high-rep locksmith
 *      anchors them.
 *
 * Hardened for ad-hoc admin runs:
 *   - GET allowed for browser-trigger debugging (still needs CRON_SECRET).
 *   - POST is the canonical Vercel cron entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { runOpportunityScoutHeartbeat } from "@/agents/cmo/subagents/opportunity-scout/agent";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

async function run(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await runOpportunityScoutHeartbeat();
    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startTime,
      ...result,
    });
  } catch (error) {
    console.error("[Cron] google-ads-opportunity-scout failed", error);
    return NextResponse.json(
      {
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
