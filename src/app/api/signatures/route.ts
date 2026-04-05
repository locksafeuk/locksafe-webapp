import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST - Save digital signature
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobId,
      signatureData,
      signerName,
      confirmsWork,
      confirmsPrice,
      confirmsSatisfied,
    } = body;

    // Validate required fields
    if (!jobId || !signatureData || !signerName) {
      return NextResponse.json(
        { success: false, error: "Job ID, signature data, and signer name are required" },
        { status: 400 }
      );
    }

    // Check job exists and is in a valid status
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { signature: true },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if job is in a valid status for signing
    const validStatuses = ["COMPLETED", "IN_PROGRESS", "QUOTE_ACCEPTED"];
    if (!validStatuses.includes(job.status) && job.status !== "SIGNED") {
      return NextResponse.json(
        { success: false, error: `Job must be completed before signing. Current status: ${job.status}` },
        { status: 400 }
      );
    }

    // If already signed, return the existing signature
    if (job.status === "SIGNED" && job.signature) {
      return NextResponse.json({
        success: true,
        message: "Job already signed",
        signature: job.signature,
      });
    }

    // Get client IP and device info from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const signerIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    const deviceInfo = request.headers.get("user-agent") || "unknown";

    // Use upsert to handle both new and existing signatures
    const signature = await prisma.signature.upsert({
      where: { jobId },
      create: {
        jobId,
        signatureData,
        signerName,
        signerIp,
        deviceInfo,
        confirmsWork: confirmsWork ?? true,
        confirmsPrice: confirmsPrice ?? true,
        confirmsSatisfied: confirmsSatisfied ?? true,
      },
      update: {
        signatureData,
        signerName,
        signerIp,
        deviceInfo,
        confirmsWork: confirmsWork ?? true,
        confirmsPrice: confirmsPrice ?? true,
        confirmsSatisfied: confirmsSatisfied ?? true,
        signedAt: new Date(),
      },
    });

    // Update job status to SIGNED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
      },
    });

    // Update locksmith stats (only if not already signed)
    if (job.locksmithId && job.status !== "SIGNED") {
      await prisma.locksmith.update({
        where: { id: job.locksmithId },
        data: {
          totalJobs: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ success: true, signature });
  } catch (error: any) {
    console.error("Error saving signature:", error);

    // Provide more detailed error message
    let errorMessage = "Failed to save signature";
    if (error.code === "P2002") {
      errorMessage = "A signature already exists for this job";
    } else if (error.code === "P2025") {
      errorMessage = "Job not found";
    } else if (error.message) {
      errorMessage = `Signature error: ${error.message}`;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
