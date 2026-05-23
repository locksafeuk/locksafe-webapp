import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { advanceAuction } from "@/lib/job-auction";


/**
 * Advance Auctions Cron — runs every minute.
 *
 * Finds all RUNNING auctions where nextDropAt <= now and advances them
 * to the next commission step (or marks them EXPIRED and alerts admin).
 *
 * NOTE: 1-minute Vercel cron requires a Pro plan.
 * On Hobby, use an external scheduler (cron-job.org) set to every minute.
 *
 * Schedule: "* * * * *"  (every minute)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const overdueAuctions = await prisma.jobAuction.findMany({
      where: {
        state: "RUNNING",
        nextDropAt: { lte: now },
      },
      select: { jobId: true },
    });

    console.log(`[advance-auctions] Found ${overdueAuctions.length} overdue auction(s)`);

    const results: { jobId: string; status: string }[] = [];

    for (const { jobId } of overdueAuctions) {
      try {
        await advanceAuction(jobId);
        results.push({ jobId, status: "advanced" });
      } catch (err) {
        console.error(`[advance-auctions] Failed to advance auction ${jobId}:`, err);
        results.push({ jobId, status: "error" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: overdueAuctions.length,
      results,
    });
  } catch (err) {
    console.error("[advance-auctions] Cron error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
