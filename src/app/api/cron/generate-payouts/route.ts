import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Platform fee percentage (15%)
const PLATFORM_FEE_PERCENTAGE = 0.15;

// Secret key for cron authorization (set in environment)
const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

/**
 * Weekly Payout Generation Cron Job
 *
 * This endpoint should be called by an external cron service (e.g., cron-job.org)
 * to automatically generate pending payouts for locksmiths.
 *
 * SETUP INSTRUCTIONS FOR CRON-JOB.ORG:
 * =====================================
 * 1. Go to https://cron-job.org and create a free account
 * 2. Click "CREATE CRONJOB"
 * 3. Configure:
 *    - Title: "LockSafe Weekly Payout Generation"
 *    - URL: https://your-domain.com/api/cron/generate-payouts
 *    - Schedule: Weekly (e.g., every Monday at 2:00 AM)
 *      - Expression: 0 2 * * 1 (At 02:00 on Monday)
 *    - Request Method: POST
 *    - Headers:
 *      - Authorization: Bearer YOUR_CRON_SECRET
 *      - Content-Type: application/json
 *    - Request Body: {} (empty JSON object)
 * 4. Save and enable the cron job
 *
 * ENVIRONMENT VARIABLE:
 * Add CRON_SECRET to your .env file with a secure random string
 * Example: CRON_SECRET=your-secure-random-string-here
 *
 * ALTERNATIVE: Vercel Cron (if using Vercel)
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/generate-payouts",
 *     "schedule": "0 2 * * 1"
 *   }]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Also check for Vercel cron header
    const vercelCron = request.headers.get("x-vercel-cron");

    if (token !== CRON_SECRET && !vercelCron) {
      console.log("[Cron] Unauthorized request to generate-payouts");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting weekly payout generation...");

    // Find all completed/signed jobs that haven't been paid out yet
    const existingPayouts = await prisma.payout.findMany({
      select: { jobIds: true },
    });

    const paidOutJobIds = new Set(existingPayouts.flatMap((p) => p.jobIds));

    // Get completed jobs with payments
    const completedJobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "SIGNED"] },
        locksmithId: { not: null },
      },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          where: { status: "succeeded" },
        },
      },
    });

    // Filter out jobs that have already been paid out
    const unpaidJobs = completedJobs.filter((job) => !paidOutJobIds.has(job.id));

    console.log(`[Cron] Found ${unpaidJobs.length} unpaid jobs`);

    // Group by locksmith
    const locksmithJobsMap = new Map<string, typeof unpaidJobs>();

    for (const job of unpaidJobs) {
      if (!job.locksmith) continue;

      const locksmithId = job.locksmith.id;
      if (!locksmithJobsMap.has(locksmithId)) {
        locksmithJobsMap.set(locksmithId, []);
      }
      locksmithJobsMap.get(locksmithId)!.push(job);
    }

    // Create payouts for each locksmith
    const createdPayouts = [];
    const now = new Date();

    for (const [locksmithId, jobs] of locksmithJobsMap) {
      // Calculate total earnings from jobs
      let grossAmount = 0;
      const jobIds: string[] = [];

      for (const job of jobs) {
        const jobTotal = job.payments.reduce((sum, p) => sum + p.amount, 0);
        if (jobTotal > 0) {
          grossAmount += jobTotal;
          jobIds.push(job.id);
        }
      }

      if (grossAmount <= 0 || jobIds.length === 0) continue;

      const platformFee = grossAmount * PLATFORM_FEE_PERCENTAGE;
      const netAmount = grossAmount - platformFee;

      // Determine actual period from job dates
      const jobDates = jobs
        .map((j) => j.workCompletedAt || j.signedAt || j.createdAt)
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());

      const actualPeriodStart = jobDates[0] || now;
      const actualPeriodEnd = jobDates[jobDates.length - 1] || now;

      const payout = await prisma.payout.create({
        data: {
          locksmithId,
          amount: grossAmount,
          platformFee,
          netAmount,
          status: "pending",
          periodStart: actualPeriodStart,
          periodEnd: actualPeriodEnd,
          jobIds,
        },
      });

      createdPayouts.push({
        id: payout.id,
        locksmithId,
        locksmithName: jobs[0].locksmith?.name,
        netAmount,
        jobCount: jobIds.length,
      });

      console.log(
        `[Cron] Created payout for ${jobs[0].locksmith?.name}: £${netAmount.toFixed(2)} (${jobIds.length} jobs)`
      );
    }

    console.log(`[Cron] Weekly payout generation complete. Created ${createdPayouts.length} payouts.`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      createdCount: createdPayouts.length,
      payouts: createdPayouts,
      message: createdPayouts.length > 0
        ? `Successfully created ${createdPayouts.length} pending payout(s)`
        : "No new payouts to create",
    });
  } catch (error) {
    console.error("[Cron] Error generating payouts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate payouts" },
      { status: 500 }
    );
  }
}

// GET endpoint for health check / status
export async function GET(request: NextRequest) {
  // Simple health check - no auth required
  const pendingPayouts = await prisma.payout.count({
    where: { status: "pending" },
  });

  const lastPayout = await prisma.payout.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, status: true },
  });

  return NextResponse.json({
    success: true,
    status: "healthy",
    pendingPayouts,
    lastPayoutCreated: lastPayout?.createdAt || null,
    lastPayoutStatus: lastPayout?.status || null,
  });
}
