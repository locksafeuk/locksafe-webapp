/**
 * Admin Ads Sync API
 *
 * Endpoints:
 * GET /api/admin/ads/sync - Get sync status
 * POST /api/admin/ads/sync - Trigger manual sync
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  syncAllCampaigns,
  syncDailySnapshots,
  syncAdReviewStatus,
  getSyncStatus,
  type SyncOptions,
} from "@/lib/meta-sync";

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

/**
 * GET - Get sync status
 */
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getSyncStatus();

    // Get last few sync logs from snapshots
    const recentSnapshots = await import("@/lib/db").then((m) =>
      m.prisma.adPerformanceSnapshot.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          date: true,
          createdAt: true,
          campaignId: true,
          spend: true,
          impressions: true,
        },
      })
    );

    return NextResponse.json({
      success: true,
      status,
      recentSnapshots,
      config: {
        metaAccountConfigured: !!process.env.META_AD_ACCOUNT_ID,
        accessTokenConfigured: !!process.env.META_ACCESS_TOKEN,
        pixelConfigured: !!process.env.NEXT_PUBLIC_META_PIXEL_ID,
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger manual sync
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse sync options
    const body = await request.json().catch(() => ({}));
    const {
      campaignId,
      includeSnapshots = false,
      forceFullSync = false,
      dateRange,
      syncType = "full", // "full", "snapshots", "reviews"
    } = body;

    console.log(`[Admin Sync] Manual sync triggered by admin, type: ${syncType}`);

    let result: {
      success: boolean;
      campaignsUpdated?: number;
      adSetsUpdated?: number;
      adsUpdated?: number;
      snapshotsCreated?: number;
      reviewsUpdated?: number;
      errors?: string[];
      duration?: number;
    };

    switch (syncType) {
      case "snapshots": {
        // Only sync daily snapshots
        const range = dateRange || {
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          until: new Date().toISOString().split("T")[0],
        };
        const snapshotResult = await syncDailySnapshots(range);
        result = {
          success: snapshotResult.success,
          snapshotsCreated: snapshotResult.snapshotsCreated,
          errors: snapshotResult.errors,
        };
        break;
      }

      case "reviews": {
        // Only sync ad review status
        const reviewResult = await syncAdReviewStatus();
        result = {
          success: reviewResult.errors.length === 0,
          reviewsUpdated: reviewResult.updated,
          errors: reviewResult.errors,
        };
        break;
      }

      case "full":
      default: {
        // Full sync
        const syncOptions: SyncOptions = {
          campaignId,
          includeSnapshots,
          forceFullSync,
          dateRange,
        };

        const syncResult = await syncAllCampaigns(syncOptions);

        // Also sync review status
        const reviewResult = await syncAdReviewStatus();

        result = {
          success: syncResult.success,
          campaignsUpdated: syncResult.campaignsUpdated,
          adSetsUpdated: syncResult.adSetsUpdated,
          adsUpdated: syncResult.adsUpdated,
          snapshotsCreated: syncResult.snapshotsCreated,
          reviewsUpdated: reviewResult.updated,
          errors: [...syncResult.errors, ...reviewResult.errors],
          duration: syncResult.duration,
        };
        break;
      }
    }

    // Get updated status
    const updatedStatus = await getSyncStatus();

    return NextResponse.json({
      success: result.success,
      syncType,
      result,
      status: updatedStatus,
      message: result.success
        ? `Sync completed successfully`
        : `Sync completed with ${result.errors?.length || 0} errors`,
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
