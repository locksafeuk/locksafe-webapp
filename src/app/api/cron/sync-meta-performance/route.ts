import { NextRequest, NextResponse } from "next/server";
import {
  syncAllCampaigns,
  syncAdReviewStatus,
  getSyncStatus,
} from "@/lib/meta-sync";

// Secret key for cron authorization (set in environment)
const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

/**
 * Meta Performance Sync Cron Job
 *
 * This endpoint should be called by an external cron service (e.g., cron-job.org)
 * to automatically sync ad performance metrics from Meta.
 *
 * SETUP INSTRUCTIONS FOR CRON-JOB.ORG:
 * =====================================
 * 1. Go to https://cron-job.org and create a free account
 * 2. Click "CREATE CRONJOB"
 * 3. Configure:
 *    - Title: "LockSafe Meta Performance Sync"
 *    - URL: https://your-domain.com/api/cron/sync-meta-performance
 *    - Schedule: Every 6 hours
 *      - Cron Expression: 0 star-slash-6 star star star (At minute 0 past every 6th hour)
 *    - Request Method: POST
 *    - Headers: Authorization: Bearer YOUR_CRON_SECRET
 *    - Request Body: {} or {"includeSnapshots": true}
 * 4. Save and enable the cron job
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET: Secure random string for authorization
 * - META_ACCESS_TOKEN: Your Meta Marketing API access token
 * - META_AD_ACCOUNT_ID: Your Meta Ad Account ID (act_xxxxx)
 *
 * ALTERNATIVE: Vercel Cron - Add to vercel.json crons array
 *
 * SYNC OPTIONS:
 * - includeSnapshots: Create daily performance snapshots (default: false)
 * - forceFullSync: Ignore lastSyncAt and sync all data (default: false)
 * - dateRange: Custom date range with since and until in YYYY-MM-DD format
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authorization
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Also check for Vercel cron header
    const vercelCron = request.headers.get("x-vercel-cron");

    if (token !== CRON_SECRET && !vercelCron) {
      console.log("[Cron] Unauthorized request to sync-meta-performance");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting Meta performance sync...");

    // Parse options from request body
    let options: {
      includeSnapshots?: boolean;
      forceFullSync?: boolean;
      dateRange?: { since: string; until: string };
    } = {};

    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // Empty body is fine, use defaults
    }

    // Run the sync
    const syncResult = await syncAllCampaigns({
      includeSnapshots: options.includeSnapshots ?? true, // Enable by default in cron
      forceFullSync: options.forceFullSync,
      dateRange: options.dateRange,
    });

    // Also sync ad review status
    const reviewResult = await syncAdReviewStatus();

    const duration = Date.now() - startTime;

    console.log(
      `[Cron] Meta sync completed in ${duration}ms:`,
      `${syncResult.campaignsUpdated} campaigns,`,
      `${syncResult.adSetsUpdated} ad sets,`,
      `${syncResult.adsUpdated} ads,`,
      `${syncResult.snapshotsCreated} snapshots,`,
      `${reviewResult.updated} review statuses updated`
    );

    // Log errors if any
    const allErrors = [...syncResult.errors, ...reviewResult.errors];
    if (allErrors.length > 0) {
      console.warn("[Cron] Sync completed with errors:", allErrors);
    }

    return NextResponse.json({
      success: syncResult.success,
      timestamp: new Date().toISOString(),
      duration,
      metrics: {
        campaignsUpdated: syncResult.campaignsUpdated,
        adSetsUpdated: syncResult.adSetsUpdated,
        adsUpdated: syncResult.adsUpdated,
        snapshotsCreated: syncResult.snapshotsCreated,
        reviewStatusesUpdated: reviewResult.updated,
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
      message: syncResult.success
        ? "Meta performance sync completed successfully"
        : "Sync completed with errors",
    });
  } catch (error) {
    console.error("[Cron] Error syncing Meta performance:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync Meta performance",
        details: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check and status
 * Returns sync status without requiring authentication
 */
export async function GET() {
  try {
    const status = await getSyncStatus();

    return NextResponse.json({
      success: true,
      status: "healthy",
      isConfigured: status.isConfigured,
      lastSyncAt: status.lastSyncAt,
      metrics: {
        campaignsWithData: status.campaignsWithData,
        totalSpend: status.totalSpend,
        totalImpressions: status.totalImpressions,
        totalConversions: status.totalConversions,
      },
      endpoints: {
        manualSync: "POST /api/admin/ads/sync",
        cronSync: "POST /api/cron/sync-meta-performance",
      },
    });
  } catch (error) {
    console.error("[Cron] Error getting sync status:", error);
    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
