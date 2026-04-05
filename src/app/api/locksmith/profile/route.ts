import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getConnectAccountStatus, getAccountBalance, listPayouts, listTransfers, PLATFORM_FEE_PERCENT } from "@/lib/stripe";

// Locksmith receives 85% of the total (100% - 15% platform fee)
const LOCKSMITH_SHARE_RATE = 1 - PLATFORM_FEE_PERCENT;

// GET - Get locksmith profile with Stripe status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locksmithId = searchParams.get("locksmithId");

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      include: {
        _count: {
          select: {
            jobs: true,
            reviews: true,
          },
        },
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Calculate earnings from completed jobs
    const completedJobs = await prisma.job.findMany({
      where: {
        locksmithId: locksmithId,
        status: { in: ["COMPLETED", "SIGNED"] },
      },
      include: {
        quote: true,
        payments: {
          where: { status: "succeeded" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Calculate locksmith's share of earnings (85% after platform fee)
    let totalEarnings = 0;
    let thisMonthEarnings = 0;
    let lastMonthEarnings = 0;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    for (const job of completedJobs) {
      // Total job value = quote total + assessment fee
      const quoteTotal = job.quote?.total || 0;
      const assessmentFee = job.assessmentFee || 0;
      const totalJobValue = quoteTotal + assessmentFee;

      // Locksmith receives 85% of the total job value (after 15% platform fee)
      const locksmithShare = totalJobValue * LOCKSMITH_SHARE_RATE;

      totalEarnings += locksmithShare;

      const jobDate = new Date(job.createdAt);
      if (jobDate >= thisMonthStart) {
        thisMonthEarnings += locksmithShare;
      } else if (jobDate >= lastMonthStart && jobDate <= lastMonthEnd) {
        lastMonthEarnings += locksmithShare;
      }
    }

    // Recent jobs for the earnings page (showing locksmith's share)
    const recentJobs = completedJobs.slice(0, 10).map((job) => {
      const totalJobValue = (job.quote?.total || 0) + (job.assessmentFee || 0);
      const locksmithShare = totalJobValue * LOCKSMITH_SHARE_RATE;
      return {
        id: job.id,
        jobNumber: job.jobNumber,
        date: job.createdAt,
        amount: Math.round(locksmithShare * 100) / 100, // Locksmith's 85% share
        totalValue: totalJobValue, // Original job value for reference
        type: job.problemType,
        status: job.status,
      };
    });

    // Get Stripe Connect status and real transfer data if connected
    let stripeStatus = null;
    let stripeBalance = null;
    let recentPayouts = null;
    let stripeTransfers = null;
    const stripeEarnings = {
      totalFromStripe: 0,
      thisMonthFromStripe: 0,
      transferCount: 0,
    };

    if (locksmith.stripeConnectId) {
      try {
        stripeStatus = await getConnectAccountStatus(locksmith.stripeConnectId);

        if (stripeStatus.payoutsEnabled) {
          stripeBalance = await getAccountBalance(locksmith.stripeConnectId);
          recentPayouts = await listPayouts(locksmith.stripeConnectId, 5);

          // Get real transfer data from Stripe
          stripeTransfers = await listTransfers(locksmith.stripeConnectId, 50);

          // Calculate total earnings from Stripe transfers (more accurate)
          const now = new Date();
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          stripeEarnings.transferCount = stripeTransfers.length;
          stripeEarnings.totalFromStripe = stripeTransfers.reduce((sum, t) => sum + t.amount, 0);
          stripeEarnings.thisMonthFromStripe = stripeTransfers
            .filter(t => t.created >= thisMonthStart)
            .reduce((sum, t) => sum + t.amount, 0);
        }
      } catch (error) {
        console.error("Error fetching Stripe status:", error);
        // Stripe account might not exist or be accessible
        stripeStatus = {
          connected: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          error: "Unable to fetch Stripe account status",
        };
      }
    }

    // Use Stripe transfer data if available, otherwise use calculated earnings
    const finalTotalEarnings = stripeEarnings.totalFromStripe > 0
      ? stripeEarnings.totalFromStripe
      : Math.round(totalEarnings * 100) / 100;

    const finalThisMonth = stripeEarnings.thisMonthFromStripe > 0
      ? stripeEarnings.thisMonthFromStripe
      : Math.round(thisMonthEarnings * 100) / 100;

    // Calculate pending payout - jobs that are completed but payment might still be processing
    const pendingJobs = await prisma.job.findMany({
      where: {
        locksmithId: locksmithId,
        status: { in: ["COMPLETED", "SIGNED"] },
      },
      include: {
        quote: true,
        payments: {
          where: { status: { in: ["pending", "processing"] } },
        },
      },
    });

    // Pending payout = jobs with pending payments (locksmith's share)
    const pendingPayout = pendingJobs.reduce((sum, job) => {
      const pendingPayments = job.payments.reduce((pSum, p) => pSum + p.amount, 0);
      // Locksmith gets 85% of pending payments
      return sum + (pendingPayments * LOCKSMITH_SHARE_RATE);
    }, 0);

    return NextResponse.json({
      success: true,
      profile: {
        id: locksmith.id,
        name: locksmith.name,
        companyName: locksmith.companyName,
        email: locksmith.email,
        phone: locksmith.phone,
        rating: locksmith.rating,
        reviewCount: locksmith._count.reviews,
        totalJobs: locksmith.totalJobs,
        isVerified: locksmith.isVerified,
        yearsExperience: locksmith.yearsExperience,
        profileImage: locksmith.profileImage,
        coverageAreas: locksmith.coverageAreas,
        // Location & Coverage
        baseLat: locksmith.baseLat,
        baseLng: locksmith.baseLng,
        baseAddress: locksmith.baseAddress,
        coverageRadius: locksmith.coverageRadius,
        // Pricing
        defaultAssessmentFee: locksmith.defaultAssessmentFee,
        // Insurance & Documentation
        insuranceDocumentUrl: locksmith.insuranceDocumentUrl,
        insuranceExpiryDate: locksmith.insuranceExpiryDate,
        insuranceStatus: locksmith.insuranceStatus,
        insuranceVerifiedAt: locksmith.insuranceVerifiedAt,
        certificationDocumentUrl: locksmith.certificationDocumentUrl,
        onboardingCompleted: locksmith.onboardingCompleted,
        termsAcceptedAt: locksmith.termsAcceptedAt,
        // Availability status
        isAvailable: locksmith.isAvailable,
        lastAvailabilityChange: locksmith.lastAvailabilityChange,
      },
      earnings: {
        totalEarnings: finalTotalEarnings,
        thisMonth: finalThisMonth,
        lastMonth: Math.round(lastMonthEarnings * 100) / 100,
        pendingPayout: Math.round(pendingPayout * 100) / 100,
        averageJobValue: completedJobs.length > 0
          ? Math.round((finalTotalEarnings / completedJobs.length) * 100) / 100
          : 0,
        totalCompletedJobs: completedJobs.length,
        thisMonthJobs: completedJobs.filter(j => new Date(j.createdAt) >= thisMonthStart).length,
        platformFeeRate: PLATFORM_FEE_PERCENT * 100, // 15%
        locksmithShareRate: LOCKSMITH_SHARE_RATE * 100, // 85%
        // Additional Stripe data for transparency
        stripeTransferCount: stripeEarnings.transferCount,
        dataSource: stripeEarnings.totalFromStripe > 0 ? "stripe" : "calculated",
      },
      recentJobs,
      stripe: {
        connected: !!locksmith.stripeConnectId,
        onboarded: locksmith.stripeConnectOnboarded,
        verified: locksmith.stripeConnectVerified,
        accountId: locksmith.stripeConnectId,
        status: stripeStatus ? {
          chargesEnabled: stripeStatus.chargesEnabled,
          payoutsEnabled: stripeStatus.payoutsEnabled,
          detailsSubmitted: stripeStatus.detailsSubmitted,
        } : null,
        balance: stripeBalance,
        recentPayouts,
        recentTransfers: stripeTransfers?.slice(0, 5) || null,
      },
    });
  } catch (error) {
    console.error("Error fetching locksmith profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH - Update locksmith profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId, ...updates } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    // Only allow certain fields to be updated
    const allowedFields = ["name", "companyName", "phone", "coverageAreas", "services", "yearsExperience", "profileImage", "baseLat", "baseLng", "baseAddress", "coverageRadius", "certificationDocumentUrl", "defaultAssessmentFee"];
    const filteredUpdates: Record<string, unknown> = {};

    for (const key of allowedFields) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: filteredUpdates,
    });

    return NextResponse.json({
      success: true,
      locksmith: {
        id: locksmith.id,
        name: locksmith.name,
        companyName: locksmith.companyName,
        email: locksmith.email,
        phone: locksmith.phone,
      },
    });
  } catch (error) {
    console.error("Error updating locksmith profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
