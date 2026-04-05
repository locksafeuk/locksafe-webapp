import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Helper to verify admin auth
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.type === "admin";
}

// GET - List all payouts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const locksmithId = searchParams.get("locksmithId");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (locksmithId) {
      where.locksmithId = locksmithId;
    }

    const payouts = await prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            companyName: true,
            email: true,
          },
        },
      },
      take: 100,
    });

    // Aggregate stats
    const stats = await prisma.payout.groupBy({
      by: ["status"],
      _sum: { amount: true, platformFee: true, netAmount: true },
      _count: true,
    });

    const totalPaid = await prisma.payout.aggregate({
      _sum: { amount: true, platformFee: true, netAmount: true },
      where: { status: "paid" },
    });

    const pendingPayouts = await prisma.payout.aggregate({
      _sum: { amount: true },
      where: { status: "pending" },
    });

    return NextResponse.json({
      success: true,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        platformFee: p.platformFee,
        netAmount: p.netAmount,
        status: p.status,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        jobIds: p.jobIds,
        locksmith: {
          id: p.locksmith.id,
          name: p.locksmith.name,
          companyName: p.locksmith.companyName,
          email: p.locksmith.email,
        },
      })),
      stats: {
        totalPaid: totalPaid._sum.amount || 0,
        totalPlatformFees: totalPaid._sum.platformFee || 0,
        totalNetPaid: totalPaid._sum.netAmount || 0,
        pendingAmount: pendingPayouts._sum.amount || 0,
        byStatus: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// POST - Process payouts
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

    const { payoutIds } = await request.json();

    if (!payoutIds || !Array.isArray(payoutIds) || payoutIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No payout IDs provided" },
        { status: 400 }
      );
    }

    // Update payouts to processing status
    await prisma.payout.updateMany({
      where: {
        id: { in: payoutIds },
        status: "pending",
      },
      data: {
        status: "processing",
      },
    });

    // In production, this would trigger actual Stripe transfers
    // For now, we'll simulate processing and mark as paid
    const processedPayouts = await prisma.payout.updateMany({
      where: {
        id: { in: payoutIds },
        status: "processing",
      },
      data: {
        status: "paid",
        paidAt: new Date(),
        stripePayoutId: `po_simulated_${Date.now()}`,
      },
    });

    // Update locksmith earnings
    const payouts = await prisma.payout.findMany({
      where: { id: { in: payoutIds } },
    });

    for (const payout of payouts) {
      await prisma.locksmith.update({
        where: { id: payout.locksmithId },
        data: {
          totalEarnings: { increment: payout.netAmount },
        },
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: processedPayouts.count,
      message: `Successfully processed ${processedPayouts.count} payout(s)`,
    });
  } catch (error) {
    console.error("Error processing payouts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process payouts" },
      { status: 500 }
    );
  }
}
