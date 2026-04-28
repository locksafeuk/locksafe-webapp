/**
 * Google Ads Performance Sync Cron Job
 *
 * Mirrors /api/cron/sync-meta-performance. Pulls daily campaign metrics from
 * every connected GoogleAdsAccount and upserts AdPerformanceSnapshot rows
 * with platform="google".
 *
 * Schedule: every 6 hours.
 *   Cron: 0 *\/6 * * *
 *   Authorisation: `Authorization: Bearer $CRON_SECRET`
 *
 * Optional JSON body: { "lookbackDays": 7, "dateRange": { "since": "...", "until": "..." } }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  syncAllGoogleAdsAccounts,
  getGoogleAdsSyncStatus,
} from "@/lib/google-ads-sync";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

export async function POST(request: NextRequest) {
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

  let options: { lookbackDays?: number; dateRange?: { since: string; until: string } } = {};
  try {
    const body = await request.json();
    options = body || {};
  } catch {
    // Empty body OK
  }

  try {
    const result = await syncAllGoogleAdsAccounts(options);
    const duration = Date.now() - startTime;

    console.log(
      `[Cron] Google Ads sync done in ${duration}ms:`,
      `${result.accountsProcessed} accounts,`,
      `${result.campaignsObserved} campaigns,`,
      `${result.snapshotsWritten} snapshots`,
    );

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      duration,
      metrics: {
        accountsProcessed: result.accountsProcessed,
        campaignsObserved: result.campaignsObserved,
        snapshotsWritten: result.snapshotsWritten,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Google Ads sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}

/**
 * GET — health check. No auth so it can be polled by the admin dashboard.
 */
export async function GET() {
  try {
    const status = await getGoogleAdsSyncStatus();
    return NextResponse.json({
      success: true,
      status: "healthy",
      ...status,
      endpoints: {
        cronSync: "POST /api/cron/sync-google-ads-performance",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
