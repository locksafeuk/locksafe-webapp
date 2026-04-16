import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/admin/payments - Get all payments with stats
export async function GET(request: NextRequest) {
  try {
    // Get all payments with job details
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            assessmentFee: true,
            assessmentPaid: true,
            customer: {
              select: {
                name: true,
                email: true,
              },
            },
            locksmith: {
              select: {
                name: true,
                companyName: true,
              },
            },
            quote: {
              select: {
                total: true,
              },
            },
          },
        },
      },
    });

    // Calculate stats
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const succeededPayments = payments.filter(p => p.status === "succeeded");

    const totalRevenue = succeededPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAssessmentFees = succeededPayments
      .filter(p => p.type === "assessment")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalWorkPayments = succeededPayments
      .filter(p => p.type === "quote")
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate deductions (assessment fees that were applied to work quotes)
    const totalDeductions = payments
      .filter(p => p.type === "quote" && p.status === "succeeded" && p.job.assessmentPaid)
      .reduce((sum, p) => sum + p.job.assessmentFee, 0);

    const thisMonthPayments = succeededPayments.filter(
      p => new Date(p.createdAt) >= thisMonthStart
    );
    const lastMonthPayments = succeededPayments.filter(
      p => new Date(p.createdAt) >= lastMonthStart && new Date(p.createdAt) <= lastMonthEnd
    );

    const stats = {
      totalRevenue,
      totalAssessmentFees,
      totalWorkPayments,
      totalDeductions,
      paymentCount: succeededPayments.length,
      thisMonth: thisMonthPayments.reduce((sum, p) => sum + p.amount, 0),
      lastMonth: lastMonthPayments.reduce((sum, p) => sum + p.amount, 0),
    };

    return NextResponse.json({
      success: true,
      payments,
      stats,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
