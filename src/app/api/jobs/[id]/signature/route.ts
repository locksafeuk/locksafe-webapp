import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST - Submit customer signature
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      signatureData,
      signerName,
      confirmsWork,
      confirmsPrice,
      confirmsSatisfied,
      signatureGps,
    } = body;

    // Validate required fields
    if (!signatureData || !signerName) {
      return NextResponse.json(
        { success: false, error: "Signature data and signer name are required" },
        { status: 400 }
      );
    }

    // Check job exists and is in a valid status for signing
    const job = await prisma.job.findUnique({
      where: { id },
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
        signature: {
          id: job.signature.id,
          signerName: job.signature.signerName,
          signedAt: job.signature.signedAt,
        },
      });
    }

    // Get client IP and device info from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const signerIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    const deviceInfo = request.headers.get("user-agent") || "unknown";

    // Use upsert to handle both new and existing signatures
    const signature = await prisma.signature.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
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

    // Update job status to SIGNED with GPS
    await prisma.job.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureGps: signatureGps || null,
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

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        signerName: signature.signerName,
        signedAt: signature.signedAt,
      },
    });
  } catch (error: any) {
    console.error("Error submitting signature:", error);

    // Provide more detailed error message
    let errorMessage = "Failed to submit signature";
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

// GET - Get signature for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const signature = await prisma.signature.findUnique({
      where: { jobId: id },
    });

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Signature not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        signerName: signature.signerName,
        signedAt: signature.signedAt,
        confirmsWork: signature.confirmsWork,
        confirmsPrice: signature.confirmsPrice,
        confirmsSatisfied: signature.confirmsSatisfied,
      },
    });
  } catch (error) {
    console.error("Error fetching signature:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch signature" },
      { status: 500 }
    );
  }
}
