import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel data fetching for performance
    const [
      totalJobs,
      totalLocksmiths,
      totalCustomers,
      monthlyJobs,
      lastMonthJobs,
      completedJobs,
      pendingJobs,
      inProgressJobs,
      recentJobs,
      topLocksmiths,
      recentReviews,
      monthlyPayments,
      lastMonthPayments,
      totalPayouts,
    ] = await Promise.all([
      // Total counts
      prisma.job.count(),
      prisma.locksmith.count({ where: { isActive: true } }),
      prisma.customer.count(),

      // Monthly jobs
      prisma.job.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.job.count({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),

      // Jobs by status
      prisma.job.count({
        where: { status: { in: [JobStatus.COMPLETED, JobStatus.SIGNED] } },
      }),
      prisma.job.count({
        where: { status: JobStatus.PENDING },
      }),
      prisma.job.count({
        where: {
          status: {
            in: [
              JobStatus.ACCEPTED,
              JobStatus.ARRIVED,
              JobStatus.DIAGNOSING,
              JobStatus.QUOTED,
              JobStatus.QUOTE_ACCEPTED,
              JobStatus.IN_PROGRESS,
            ],
          },
        },
      }),

      // Recent jobs with relations
      prisma.job.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          locksmith: true,
          quote: true,
        },
      }),

      // Top locksmiths by completed jobs
      prisma.locksmith.findMany({
        take: 5,
        orderBy: { totalJobs: "desc" },
        where: { isActive: true, isVerified: true },
      }),

      // Recent reviews
      prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          locksmith: true,
          job: true,
        },
      }),

      // Monthly revenue (sum of payments)
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "succeeded",
          createdAt: { gte: startOfMonth },
        },
      }),

      // Last month revenue
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "succeeded",
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),

      // Total payouts to locksmiths
      prisma.payout.aggregate({
        _sum: { amount: true },
        where: { status: "paid" },
      }),
    ]);

    // Calculate average job value
    const avgJobValue =
      completedJobs > 0
        ? (monthlyPayments._sum.amount || 0) / monthlyJobs || 0
        : 0;

    // Calculate growth rates
    const jobGrowth =
      lastMonthJobs > 0
        ? ((monthlyJobs - lastMonthJobs) / lastMonthJobs) * 100
        : 0;

    const revenueGrowth =
      (lastMonthPayments._sum.amount || 0) > 0
        ? (((monthlyPayments._sum.amount || 0) -
            (lastMonthPayments._sum.amount || 0)) /
            (lastMonthPayments._sum.amount || 1)) *
          100
        : 0;

    return NextResponse.json({
      success: true,
      stats: {
        overview: {
          totalJobs,
          totalLocksmiths,
          totalCustomers,
          monthlyRevenue: monthlyPayments._sum.amount || 0,
          monthlyJobs,
          avgJobValue: Math.round(avgJobValue),
          jobGrowth: Math.round(jobGrowth * 10) / 10,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        },
        jobsByStatus: {
          completed: completedJobs,
          pending: pendingJobs,
          inProgress: inProgressJobs,
        },
        recentJobs: recentJobs.map((job) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          propertyType: job.propertyType,
          postcode: job.postcode,
          address: job.address,
          assessmentFee: job.assessmentFee,
          quoteAmount: job.quote?.total,
          createdAt: job.createdAt,
          acceptedAt: job.acceptedAt,
          arrivedAt: job.arrivedAt,
          completedAt: job.workCompletedAt,
          signedAt: job.signedAt,
          customer: job.customer
            ? {
                name: job.customer.name,
                phone: job.customer.phone,
                email: job.customer.email,
              }
            : null,
          locksmith: job.locksmith
            ? {
                id: job.locksmith.id,
                name: job.locksmith.name,
              }
            : null,
        })),
        topLocksmiths: topLocksmiths.map((ls) => ({
          id: ls.id,
          name: ls.name,
          companyName: ls.companyName,
          rating: ls.rating,
          totalJobs: ls.totalJobs,
          totalEarnings: ls.totalEarnings,
          isVerified: ls.isVerified,
        })),
        recentReviews: recentReviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          customerName: review.customer.name,
          locksmithName: review.locksmith.name,
          jobNumber: review.job.jobNumber,
        })),
        payouts: {
          totalPaid: totalPayouts._sum.amount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
