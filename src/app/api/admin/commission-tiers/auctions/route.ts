import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const auctions = await prisma.jobAuction.findMany({
      include: {
        job: {
          select: {
            jobNumber: true,
            address: true,
            postcode: true,
          },
        },
        acceptedBy: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = auctions.map((a) => ({
      id: a.id,
      jobId: a.jobId,
      jobNumber: a.job.jobNumber,
      address: a.job.address,
      postcode: a.job.postcode,
      state: a.state,
      currentStep: a.currentStep,
      currentRate: a.currentRate,
      nextDropAt: a.nextDropAt?.toISOString() ?? null,
      notifiedCount: a.notifiedLocksmithIds.length,
      acceptedBy: a.acceptedBy?.name ?? null,
      acceptedRate: a.acceptedRate ?? null,
      acceptedAt: a.acceptedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ auctions: formatted });
  } catch (error) {
    console.error("[auctions] Failed to load:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load auctions", auctions: [] },
      { status: 500 }
    );
  }
}
