import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get locksmith with their jobs
    const locksmith = await prisma.locksmith.findUnique({
      where: { id },
      include: {
        jobs: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            customer: true,
            quote: true,
          },
        },
        payouts: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Get pending jobs in locksmith's coverage areas (available to apply for)
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        postcode: {
          in: locksmith.coverageAreas.map((area) => ({
            startsWith: area,
          })) as any,
        },
      },
      include: {
        customer: true,
        applications: {
          where: { locksmithId: id },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Alternative: get all pending jobs if coverage area filtering doesn't work well
    const allPendingJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
      },
      include: {
        customer: true,
        applications: {
          where: { locksmithId: id },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Calculate earnings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const monthlyEarnings = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "succeeded",
        createdAt: { gte: startOfMonth },
        job: {
          locksmithId: id,
        },
      },
    });

    const weeklyEarnings = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "succeeded",
        createdAt: { gte: startOfWeek },
        job: {
          locksmithId: id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      locksmith: {
        id: locksmith.id,
        name: locksmith.name,
        companyName: locksmith.companyName,
        rating: locksmith.rating,
        totalJobs: locksmith.totalJobs,
        totalEarnings: locksmith.totalEarnings,
        isVerified: locksmith.isVerified,
        stripeConnectOnboarded: locksmith.stripeConnectOnboarded,
        stripeConnectVerified: locksmith.stripeConnectVerified,
      },
      activeJobs: locksmith.jobs
        .filter((job) =>
          ([
            JobStatus.ACCEPTED,
            JobStatus.ARRIVED,
            JobStatus.DIAGNOSING,
            JobStatus.QUOTED,
            JobStatus.QUOTE_ACCEPTED,
            JobStatus.IN_PROGRESS,
          ] as JobStatus[]).includes(job.status)
        )
        .map((job) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          propertyType: job.propertyType,
          postcode: job.postcode,
          address: job.address,
          assessmentFee: job.assessmentFee,
          quoteTotal: job.quote?.total,
          createdAt: job.createdAt,
          acceptedAt: job.acceptedAt,
          arrivedAt: job.arrivedAt,
          customer: {
            name: job.customer.name,
            phone: job.customer.phone,
          },
        })),
      pendingJobs: allPendingJobs
        .filter((job) => job.applications.length === 0) // Not yet applied
        .map((job) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          propertyType: job.propertyType,
          postcode: job.postcode,
          address: job.address,
          createdAt: job.createdAt,
          customer: {
            name: job.customer.name,
            phone: job.customer.phone,
          },
        })),
      completedJobs: locksmith.jobs
        .filter((job) =>
          ([JobStatus.COMPLETED, JobStatus.SIGNED] as JobStatus[]).includes(job.status)
        )
        .map((job) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          quoteTotal: job.quote?.total,
          completedAt: job.workCompletedAt,
        })),
      earnings: {
        weekly: weeklyEarnings._sum.amount || 0,
        monthly: monthlyEarnings._sum.amount || 0,
        total: locksmith.totalEarnings,
      },
      recentPayouts: locksmith.payouts.map((payout) => ({
        id: payout.id,
        amount: payout.amount,
        netAmount: payout.netAmount,
        status: payout.status,
        paidAt: payout.paidAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching locksmith dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
