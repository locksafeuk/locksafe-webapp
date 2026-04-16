import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredBlacklistedTokens } from "@/lib/auth";

/**
 * Cron job to clean up expired blacklisted tokens
 * This should be called daily to remove tokens that have already expired
 *
 * Vercel Cron: Add to vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-blacklisted-tokens",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is coming from Vercel Cron or has the correct auth header
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🧹 Starting cleanup of expired blacklisted tokens...");

    await cleanupExpiredBlacklistedTokens();

    console.log("✅ Cleanup completed successfully");

    return NextResponse.json({
      success: true,
      message: "Expired blacklisted tokens cleaned up successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error cleaning up blacklisted tokens:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup blacklisted tokens",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
