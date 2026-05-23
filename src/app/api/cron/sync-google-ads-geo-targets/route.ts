/**
 * Google Ads Geo Targets Sync Cron Job
 *
 * Daily safety-net that re-syncs location targeting on all PUBLISHED Google Ads
 * campaigns to match the current active locksmith coverage. Removes cities where
 * we no longer have active locksmiths and adds cities where we've expanded.
 *
 * This is the scheduled counterpart to the real-time trigger fired from
 * /api/locksmith/accept-terms when a new locksmith completes onboarding.
 *
 * Schedule (cron-job.org): daily at 3:00 AM UTC
 *   Cron expression: 0 3 * * *
 *   Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runScheduledGeoSync } from "@/lib/google-ads-locations";


export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const startTime = Date.now();

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledGeoSync();

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: result.success,
      campaignsSynced: result.campaignsSynced,
      coverageSummary: result.coverageSummary,
      errors: result.errors,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/sync-google-ads-geo-targets] Unhandled error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
