import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST - Create quote for a job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobId,
      locksmithId,
      lockType,
      defect,
      difficulty,
      parts,
      labourCost,
      labourTime,
    } = body;

    // Calculate totals
    const partsTotal = parts.reduce(
      (sum: number, part: { total: number }) => sum + part.total,
      0
    );
    const subtotal = partsTotal + labourCost;
    const vat = subtotal * 0.2; // 20% VAT
    const total = subtotal + vat;

    const quote = await prisma.quote.create({
      data: {
        jobId,
        locksmithId,
        lockType,
        defect,
        difficulty,
        parts,
        labourCost,
        labourTime,
        partsTotal,
        subtotal,
        vat,
        total,
      },
    });

    // Update job status to QUOTED
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "QUOTED" },
    });

    return NextResponse.json({ success: true, quote });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

// PATCH - Accept or decline quote
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, accepted } = body;

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        accepted,
        acceptedAt: accepted ? new Date() : null,
        declinedAt: !accepted ? new Date() : null,
      },
      include: {
        job: true,
      },
    });

    // Update job status based on decision
    await prisma.job.update({
      where: { id: quote.jobId },
      data: {
        status: accepted ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED",
      },
    });

    return NextResponse.json({ success: true, quote });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
