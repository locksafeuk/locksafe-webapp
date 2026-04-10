import { NextRequest, NextResponse } from "next/server";
import { handleLocksmithApplication } from "@/lib/job-service";
import { isLocksmithAuthenticated } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * POST /api/jobs/apply
 *
 * Emergency workflow: Locksmith applies for a job with call-out fee.
 * This triggers:
 * 1. Creates LocksmithApplication
 * 2. Creates Stripe Checkout Session
 * 3. Creates Payment record
 * 4. Sends SMS to customer with locksmith details + payment link
 *
 * Input: {
 *   jobId: string,
 *   locksmithId: string, (optional - uses session if authenticated)
 *   estimatedETA: number, (minutes)
 *   callOutFee: number, (pounds)
 *   message?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, locksmithId, estimatedETA, callOutFee, message } = body;

    // Validate required fields
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "jobId is required" },
        { status: 400 }
      );
    }

    if (!estimatedETA || typeof estimatedETA !== "number" || estimatedETA < 1) {
      return NextResponse.json(
        { success: false, error: "estimatedETA must be a positive number (minutes)" },
        { status: 400 }
      );
    }

    if (!callOutFee || typeof callOutFee !== "number" || callOutFee < 1) {
      return NextResponse.json(
        { success: false, error: "callOutFee must be a positive number (pounds)" },
        { status: 400 }
      );
    }

    // Get locksmith ID - from session or body
    let resolvedLocksmithId = locksmithId;

    if (!resolvedLocksmithId) {
      const session = await isLocksmithAuthenticated();
      if (session) {
        resolvedLocksmithId = session.id;
      }
    }

    if (!resolvedLocksmithId) {
      return NextResponse.json(
        { success: false, error: "locksmithId is required or must be authenticated" },
        { status: 401 }
      );
    }

    // Verify the job exists and is in a valid state
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, jobNumber: true },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.status !== "PENDING" && job.status !== "PHONE_INITIATED") {
      return NextResponse.json(
        {
          success: false,
          error: `Job ${job.jobNumber} is not accepting applications (status: ${job.status})`,
        },
        { status: 409 }
      );
    }

    // Handle the application
    const result = await handleLocksmithApplication({
      jobId,
      locksmithId: resolvedLocksmithId,
      callOutFee,
      estimatedETA,
      message,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      application: result.application,
      payment: result.payment,
      message: "Application submitted. Customer has been sent payment link via SMS.",
    });
  } catch (error) {
    console.error("[API] Jobs apply error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
