/**
 * Agent API: Stats Endpoint
 *
 * GET /api/agent/stats - Get dashboard statistics
 *
 * Returns real-time stats for admin agent operations.
 */

import { verifyApiKey } from "@/lib/agent-auth";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = verifyApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel data fetching
    const [
      // Today's stats
      todayJobs,
      todayCompletedJobs,
      todayRevenue,

      // This week
      weekJobs,
      weekCompletedJobs,
      weekRevenue,

      // This month
      monthJobs,
      monthCompletedJobs,
      monthRevenue,

      // Current state
      pendingJobs,
      activeJobs,

      // Locksmiths
      totalLocksmiths,
      availableLocksmiths,
      verifiedLocksmiths,

      // Customers
      totalCustomers,
      newCustomersToday,

      // Urgent items
      urgentPendingJobs, // Jobs pending > 30 mins
      expiringInsurance,
      pendingPayouts,

      // Average response time (last 24 hours)
      recentApplications,
    ] = await Promise.all([
      // Today's jobs
      prisma.job.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.job.count({
        where: {
          signedAt: { gte: startOfToday },
          status: JobStatus.SIGNED,
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "succeeded",
          createdAt: { gte: startOfToday },
        },
      }),

      // This week
      prisma.job.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.job.count({
        where: {
          signedAt: { gte: startOfWeek },
          status: JobStatus.SIGNED,
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "succeeded",
          createdAt: { gte: startOfWeek },
        },
      }),

      // This month
      prisma.job.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.job.count({
        where: {
          signedAt: { gte: startOfMonth },
          status: JobStatus.SIGNED,
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "succeeded",
          createdAt: { gte: startOfMonth },
        },
      }),

      // Current pending jobs
      prisma.job.count({ where: { status: JobStatus.PENDING } }),

      // Active jobs (accepted through in-progress)
      prisma.job.count({
        where: {
          status: {
            in: [
              JobStatus.ACCEPTED,
              JobStatus.EN_ROUTE,
              JobStatus.ARRIVED,
              JobStatus.DIAGNOSING,
              JobStatus.QUOTED,
              JobStatus.QUOTE_ACCEPTED,
              JobStatus.IN_PROGRESS,
              JobStatus.PENDING_CUSTOMER_CONFIRMATION,
            ],
          },
        },
      }),

      // Locksmiths
      prisma.locksmith.count({ where: { isActive: true } }),
      prisma.locksmith.count({ where: { isActive: true, isAvailable: true } }),
      prisma.locksmith.count({ where: { isActive: true, isVerified: true } }),

      // Customers
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: startOfToday } } }),

      // Urgent: Jobs pending > 30 minutes
      prisma.job.count({
        where: {
          status: JobStatus.PENDING,
          createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
        },
      }),

      // Insurance expiring in 7 days
      prisma.locksmith.count({
        where: {
          isActive: true,
          insuranceExpiryDate: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),

      // Pending payouts
      prisma.payout.count({ where: { status: "pending" } }),

      // Recent applications for response time
      prisma.locksmithApplication.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { eta: true },
      }),
    ]);

    // Calculate average ETA from recent applications
    const avgEta =
      recentApplications.length > 0
        ? Math.round(
            recentApplications.reduce((sum, app) => sum + app.eta, 0) /
              recentApplications.length,
          )
        : 0;

    // Calculate completion rate
    const completionRate =
      todayJobs > 0 ? Math.round((todayCompletedJobs / todayJobs) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        today: {
          jobs: todayJobs,
          completed: todayCompletedJobs,
          revenue: todayRevenue._sum.amount || 0,
          completionRate,
        },
        week: {
          jobs: weekJobs,
          completed: weekCompletedJobs,
          revenue: weekRevenue._sum.amount || 0,
        },
        month: {
          jobs: monthJobs,
          completed: monthCompletedJobs,
          revenue: monthRevenue._sum.amount || 0,
        },
        current: {
          pendingJobs,
          activeJobs,
          avgEtaMinutes: avgEta,
        },
        locksmiths: {
          total: totalLocksmiths,
          available: availableLocksmiths,
          verified: verifiedLocksmiths,
          availabilityRate:
            totalLocksmiths > 0
              ? Math.round((availableLocksmiths / totalLocksmiths) * 100)
              : 0,
        },
        customers: {
          total: totalCustomers,
          newToday: newCustomersToday,
        },
        alerts: {
          urgentPendingJobs,
          expiringInsurance,
          pendingPayouts,
          total: urgentPendingJobs + expiringInsurance + pendingPayouts,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Agent API] Error fetching stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
