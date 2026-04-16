import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Platform fee percentage (15%)
const PLATFORM_FEE_PERCENTAGE = 0.15;

// Helper to verify admin auth
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

interface LocksmithEarnings {
  locksmithId: string;
  locksmithName: string;
  companyName: string | null;
  email: string;
  jobCount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  jobIds: string[];
  jobs: Array<{
    id: string;
    jobNumber: string;
    total: number;
    completedAt: Date;
  }>;
}

// GET - Preview pending earnings that would be included in payouts
export async function GET(request: NextRequest) {
  try {
    // Verify admin auth
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find all completed/signed jobs that haven't been paid out yet
    // A job is "paid out" if its ID appears in any payout's jobIds array
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
            companyName: true,
            email: true,
            stripeConnectId: true,
            stripeConnectOnboarded: true,
          },
        },
        payments: {
          where: { status: "succeeded" },
        },
        quote: true,
      },
      orderBy: { workCompletedAt: "desc" },
    });

    // Filter out jobs that have already been paid out
    const unpaidJobs = completedJobs.filter((job) => !paidOutJobIds.has(job.id));

    // Group by locksmith and calculate earnings
    const locksmithEarningsMap = new Map<string, LocksmithEarnings>();

    for (const job of unpaidJobs) {
      if (!job.locksmith) continue;

      const locksmithId = job.locksmith.id;

      // Calculate total from succeeded payments
      const jobTotal = job.payments.reduce((sum, p) => sum + p.amount, 0);

      if (jobTotal <= 0) continue;

      const platformFee = jobTotal * PLATFORM_FEE_PERCENTAGE;
      const netAmount = jobTotal - platformFee;

      if (!locksmithEarningsMap.has(locksmithId)) {
        locksmithEarningsMap.set(locksmithId, {
          locksmithId,
          locksmithName: job.locksmith.name,
          companyName: job.locksmith.companyName,
          email: job.locksmith.email,
          jobCount: 0,
          grossAmount: 0,
          platformFee: 0,
          netAmount: 0,
          jobIds: [],
          jobs: [],
        });
      }

      const earnings = locksmithEarningsMap.get(locksmithId)!;
      earnings.jobCount += 1;
      earnings.grossAmount += jobTotal;
      earnings.platformFee += platformFee;
      earnings.netAmount += netAmount;
      earnings.jobIds.push(job.id);
      earnings.jobs.push({
        id: job.id,
        jobNumber: job.jobNumber,
        total: jobTotal,
        completedAt: job.workCompletedAt || job.signedAt || job.createdAt,
      });
    }

    const pendingEarnings = Array.from(locksmithEarningsMap.values()).filter(
      (e) => e.netAmount > 0
    );

    // Sort by net amount descending
    pendingEarnings.sort((a, b) => b.netAmount - a.netAmount);

    // Calculate totals
    const totals = {
      totalLocksmiths: pendingEarnings.length,
      totalJobs: pendingEarnings.reduce((sum, e) => sum + e.jobCount, 0),
      totalGross: pendingEarnings.reduce((sum, e) => sum + e.grossAmount, 0),
      totalPlatformFees: pendingEarnings.reduce((sum, e) => sum + e.platformFee, 0),
      totalNet: pendingEarnings.reduce((sum, e) => sum + e.netAmount, 0),
    };

    return NextResponse.json({
      success: true,
      pendingEarnings,
      totals,
      message: pendingEarnings.length > 0
        ? `Found ${totals.totalJobs} unpaid jobs for ${totals.totalLocksmiths} locksmiths`
        : "No unpaid jobs found",
    });
  } catch (error) {
    console.error("Error fetching pending earnings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pending earnings" },
      { status: 500 }
    );
  }
}

// POST - Generate pending payouts for selected or all locksmiths
export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { locksmithIds } = body; // Optional: specific locksmiths to generate payouts for

    // Find all completed/signed jobs that haven't been paid out yet
    const existingPayouts = await prisma.payout.findMany({
      select: { jobIds: true },
    });

    const paidOutJobIds = new Set(existingPayouts.flatMap((p) => p.jobIds));

    // Build query for completed jobs
    const whereClause: Record<string, unknown> = {
      status: { in: ["COMPLETED", "SIGNED"] },
      locksmithId: { not: null },
    };

    if (locksmithIds && Array.isArray(locksmithIds) && locksmithIds.length > 0) {
      whereClause.locksmithId = { in: locksmithIds };
    }

    const completedJobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            companyName: true,
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
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7); // Last 7 days as default period

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

      const actualPeriodStart = jobDates[0] || periodStart;
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
        include: {
          locksmith: {
            select: {
              name: true,
              companyName: true,
              email: true,
            },
          },
        },
      });

      createdPayouts.push(payout);
    }

    return NextResponse.json({
      success: true,
      createdCount: createdPayouts.length,
      payouts: createdPayouts.map((p) => ({
        id: p.id,
        locksmithName: p.locksmith.name,
        companyName: p.locksmith.companyName,
        grossAmount: p.amount,
        platformFee: p.platformFee,
        netAmount: p.netAmount,
        jobCount: p.jobIds.length,
      })),
      message: createdPayouts.length > 0
        ? `Successfully created ${createdPayouts.length} pending payout(s)`
        : "No payouts to create - all jobs have already been paid out",
    });
  } catch (error) {
    console.error("Error generating payouts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate payouts" },
      { status: 500 }
    );
  }
}
