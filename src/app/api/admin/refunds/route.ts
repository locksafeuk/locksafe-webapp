import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { ASSESSMENT_FEE_COMMISSION, WORK_QUOTE_COMMISSION } from "@/lib/stripe";

// Helper to verify admin auth
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.type === "admin";
}

// GET - List all refunded payments with details
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get refunded payments with related job and locksmith info
    const refundedPayments = await prisma.payment.findMany({
      where: {
        status: "refunded",
      },
      include: {
        job: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            locksmith: {
              select: {
                id: true,
                name: true,
                companyName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      skip,
      take: limit,
    });

    // Get total count for pagination
    const totalCount = await prisma.payment.count({
      where: {
        status: "refunded",
      },
    });

    // Calculate stats
    const stats = await prisma.payment.aggregate({
      where: {
        status: "refunded",
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Get refunds by type
    const refundsByType = await prisma.payment.groupBy({
      by: ["type"],
      where: {
        status: "refunded",
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Calculate amounts
    // For no-show refunds (most refunds are no-shows):
    // - Platform KEEPS its commission
    // - Locksmith pays the FULL refund amount
    // For other refunds:
    // - Platform loses its commission
    // - Locksmith only loses their share

    const totalRefunded = stats._sum.amount || 0;

    // Calculate by payment type
    // Assessment fees: 15% commission, Work quotes: 25% commission
    let assessmentRefunds = 0;
    let workQuoteRefunds = 0;

    for (const r of refundsByType) {
      if (r.type === "assessment") {
        assessmentRefunds = r._sum.amount || 0;
      } else if (r.type === "quote") {
        workQuoteRefunds = r._sum.amount || 0;
      }
    }

    // For no-show refunds, platform keeps its fee
    // Assuming most refunds are no-shows, platform fees are kept
    // The locksmith is charged the full amount
    const assessmentPlatformFee = assessmentRefunds * ASSESSMENT_FEE_COMMISSION;
    const workQuotePlatformFee = workQuoteRefunds * WORK_QUOTE_COMMISSION;

    // Platform fees kept (not lost) for no-show refunds
    const platformFeesKept = assessmentPlatformFee + workQuotePlatformFee;

    // Locksmith is charged FULL amount for no-shows
    // This is the total customer refund amount
    const locksmithTotalLiability = totalRefunded;

    return NextResponse.json({
      success: true,
      refunds: refundedPayments.map((payment) => {
        // Calculate commission based on payment type
        const commissionRate = payment.type === "assessment"
          ? ASSESSMENT_FEE_COMMISSION
          : payment.type === "quote"
            ? WORK_QUOTE_COMMISSION
            : ASSESSMENT_FEE_COMMISSION;

        const platformFee = payment.amount * commissionRate;
        const locksmithOriginalShare = payment.amount * (1 - commissionRate);

        return {
          id: payment.id,
          amount: payment.amount,
          type: payment.type,
          stripePaymentId: payment.stripePaymentId,
          createdAt: payment.createdAt,
          refundedAt: payment.updatedAt,
          // For no-show refunds:
          // - Platform fee is KEPT
          // - Locksmith pays FULL amount
          platformFeeKept: platformFee,
          locksmithOriginalShare,
          locksmithTotalLiability: payment.amount, // Full amount for no-shows
          job: payment.job ? {
            id: payment.job.id,
            jobNumber: payment.job.jobNumber,
            status: payment.job.status,
            problemType: payment.job.problemType,
            address: payment.job.address,
            postcode: payment.job.postcode,
          } : null,
          customer: payment.job?.customer ? {
            id: payment.job.customer.id,
            name: payment.job.customer.name,
            email: payment.job.customer.email,
            phone: payment.job.customer.phone,
          } : null,
          locksmith: payment.job?.locksmith ? {
            id: payment.job.locksmith.id,
            name: payment.job.locksmith.name,
            companyName: payment.job.locksmith.companyName,
            email: payment.job.locksmith.email,
          } : null,
        };
      }),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalRefunds: stats._count,
        totalRefundedAmount: totalRefunded,
        // NEW: For no-show refunds, platform KEEPS fees
        platformFeesKept: platformFeesKept,
        // Locksmith pays full refund amount (not just their share)
        locksmithTotalLiability: locksmithTotalLiability,
        // Commission rates for reference
        assessmentCommissionRate: ASSESSMENT_FEE_COMMISSION,
        workQuoteCommissionRate: WORK_QUOTE_COMMISSION,
        byType: refundsByType.map((r) => {
          const commissionRate = r.type === "assessment"
            ? ASSESSMENT_FEE_COMMISSION
            : WORK_QUOTE_COMMISSION;
          const totalAmount = r._sum.amount || 0;
          return {
            type: r.type,
            count: r._count,
            amount: totalAmount,
            platformFeeKept: totalAmount * commissionRate,
            locksmithLiability: totalAmount, // Full amount for no-shows
          };
        }),
        // Info note about the policy
        policyNote: "For no-show refunds, platform keeps commission and locksmith pays the FULL refund amount.",
      },
    });
  } catch (error) {
    console.error("Error fetching refunds:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}
