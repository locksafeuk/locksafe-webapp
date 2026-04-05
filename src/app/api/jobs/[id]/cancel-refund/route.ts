import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import {
  createNoShowRefund,
  getTransferForPayment,
  formatAmountFromStripe,
  ASSESSMENT_FEE_COMMISSION
} from "@/lib/stripe";
import { sendEarningsReversalEmail } from "@/lib/email";

// POST - Customer cancels job and requests refund when locksmith doesn't arrive
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get the job with all related data
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
        payments: {
          where: {
            type: "assessment",
            status: "succeeded",
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Only allow cancellation for jobs in ACCEPTED or CONFIRMED status
    const cancellableStatuses: JobStatus[] = [
      JobStatus.ACCEPTED,
      JobStatus.PENDING,
    ];

    if (!cancellableStatuses.includes(job.status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Job cannot be cancelled at this stage. The locksmith may have already arrived or started work."
        },
        { status: 400 }
      );
    }

    // Check if locksmith is overdue (ETA exceeded by at least 30 minutes buffer)
    // Or if job is still pending and 2 hours have passed
    const now = new Date();
    let canCancel = false;
    let refundReason = "";
    let isNoShow = false; // Track if this is a locksmith no-show

    if (job.status === JobStatus.ACCEPTED && job.acceptedAt && job.acceptedEta) {
      // Calculate expected arrival time
      const expectedArrival = new Date(job.acceptedAt);
      expectedArrival.setMinutes(expectedArrival.getMinutes() + job.acceptedEta);

      // Add 30-minute grace period
      const gracePeriodMs = 30 * 60 * 1000; // 30 minutes
      const deadlineWithGrace = new Date(expectedArrival.getTime() + gracePeriodMs);

      if (now > deadlineWithGrace) {
        canCancel = true;
        isNoShow = true; // This is a no-show situation
        refundReason = `Locksmith did not arrive within expected time (ETA: ${job.acceptedEta} min + 30 min grace period)`;
      }
    } else if (job.status === JobStatus.PENDING) {
      // For pending jobs, allow cancel after 2 hours if no locksmith accepted
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      if (new Date(job.createdAt) < twoHoursAgo) {
        canCancel = true;
        refundReason = "No locksmith accepted within 2 hours";
        // This is NOT a no-show since no locksmith was assigned
        isNoShow = false;
      }
    }

    // For demo/testing purposes, also allow cancellation if reason includes "test" or "demo"
    if (reason && (reason.toLowerCase().includes("test") || reason.toLowerCase().includes("demo"))) {
      canCancel = true;
      refundReason = reason;
      // Treat test/demo as no-show for testing the new flow
      if (reason.toLowerCase().includes("no-show") || reason.toLowerCase().includes("noshow")) {
        isNoShow = true;
      }
    }

    // If time condition is not met, check if manual override is allowed
    if (!canCancel) {
      // Calculate remaining time for informational purposes
      let remainingMs = 0;
      let message = "Cancellation not yet available.";

      if (job.status === JobStatus.ACCEPTED && job.acceptedAt && job.acceptedEta) {
        const expectedArrival = new Date(job.acceptedAt);
        expectedArrival.setMinutes(expectedArrival.getMinutes() + job.acceptedEta + 30);
        remainingMs = Math.max(0, expectedArrival.getTime() - now.getTime());
        const remainingMins = Math.ceil(remainingMs / 60000);
        message = `You can cancel and request a refund in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''} if the locksmith hasn't arrived.`;
      }

      return NextResponse.json({
        success: false,
        error: message,
        canCancelAt: job.acceptedAt && job.acceptedEta
          ? new Date(new Date(job.acceptedAt).getTime() + (job.acceptedEta + 30) * 60000).toISOString()
          : null,
        remainingMinutes: Math.ceil(remainingMs / 60000),
      }, { status: 400 });
    }

    // Process refund for assessment fee payment
    let refundResult = null;
    let locksmithTotalLiability = 0;
    let platformFeeKept = 0;
    const assessmentPayment = job.payments.find(p => p.type === "assessment" && p.status === "succeeded");

    if (assessmentPayment && assessmentPayment.stripePaymentId) {
      try {
        // For no-show refunds (locksmith assigned but didn't arrive):
        // - Platform KEEPS its commission (15%)
        // - Locksmith is charged the FULL refund amount
        // - This is fair: the locksmith failed to deliver, not the platform

        if (isNoShow && job.locksmith) {
          console.log(`[Cancel/Refund] Processing NO-SHOW refund for job ${job.jobNumber}`);
          console.log(`[Cancel/Refund] Locksmith ${job.locksmith.name} will be charged FULL amount`);

          // Use the new no-show refund function
          const noShowResult = await createNoShowRefund(
            assessmentPayment.stripePaymentId,
            "requested_by_customer"
          );

          locksmithTotalLiability = noShowResult.locksmithTotalLiability;
          platformFeeKept = noShowResult.platformFeeKept;

          refundResult = {
            refundId: noShowResult.refund.id,
            amount: assessmentPayment.amount,
            status: noShowResult.refund.status,
            locksmithTransferReversed: noShowResult.transferReversed,
            platformFeeKept: noShowResult.platformFeeKept,
            locksmithPenalty: noShowResult.locksmithPenalty,
            locksmithTotalLiability: noShowResult.locksmithTotalLiability,
            isNoShowRefund: true,
          };

          console.log(`[Cancel/Refund] No-show refund processed:`);
          console.log(`  - Customer refunded: £${noShowResult.totalRefunded}`);
          console.log(`  - Locksmith transfer reversed: £${noShowResult.transferReversed}`);
          console.log(`  - Platform fee kept: £${noShowResult.platformFeeKept}`);
          console.log(`  - Locksmith penalty (owes): £${noShowResult.locksmithPenalty}`);
          console.log(`  - Locksmith TOTAL liability: £${noShowResult.locksmithTotalLiability}`);

        } else {
          // For non-no-show cancellations (e.g., no locksmith accepted)
          // Use standard refund where platform also loses its fee
          console.log(`[Cancel/Refund] Processing standard refund for job ${job.jobNumber}`);

          const { createRefund } = await import("@/lib/stripe");
          const refund = await createRefund(
            assessmentPayment.stripePaymentId,
            undefined,
            "requested_by_customer",
            {
              reverseTransfer: true,
              refundApplicationFee: true, // Platform loses fee in non-no-show cases
              isNoShowRefund: false,
            }
          );

          // Get transfer info for logging
          const transfer = await getTransferForPayment(assessmentPayment.stripePaymentId);
          const transferReversed = transfer ? formatAmountFromStripe(transfer.amount) : assessmentPayment.amount * (1 - ASSESSMENT_FEE_COMMISSION);

          refundResult = {
            refundId: refund.id,
            amount: assessmentPayment.amount,
            status: refund.status,
            locksmithTransferReversed: transferReversed,
            isNoShowRefund: false,
          };
        }

        // Update payment record
        await prisma.payment.update({
          where: { id: assessmentPayment.id },
          data: { status: "refunded" },
        });

        // Update locksmith's earnings
        // For NO-SHOW: Deduct the FULL amount (they're responsible for the whole refund)
        // For non-no-show: Deduct only their share that was reversed
        if (job.locksmith) {
          const amountToDeduct = isNoShow
            ? locksmithTotalLiability  // Full refund amount for no-shows
            : (refundResult.locksmithTransferReversed || 0);

          if (amountToDeduct > 0) {
            await prisma.locksmith.update({
              where: { id: job.locksmith.id },
              data: {
                totalEarnings: {
                  decrement: amountToDeduct,
                },
              },
            });
            console.log(`[Cancel/Refund] Deducted £${amountToDeduct} from locksmith ${job.locksmith.name}'s earnings`);
          }

          // Send email notification to locksmith about the earnings reversal
          try {
            await sendEarningsReversalEmail(job.locksmith.email, {
              locksmithName: job.locksmith.name,
              jobNumber: job.jobNumber,
              jobId: job.id,
              customerName: job.customer?.name || "Customer",
              originalAmount: assessmentPayment.amount,
              reversedAmount: isNoShow ? locksmithTotalLiability : (refundResult.locksmithTransferReversed || 0),
              reason: isNoShow
                ? `Locksmith no-show - You are responsible for the FULL refund amount (£${locksmithTotalLiability.toFixed(2)}). This includes the platform commission (£${platformFeeKept.toFixed(2)}) as the no-show was your responsibility.`
                : (refundReason || "Customer requested refund"),
              refundDate: new Date(),
            });
            console.log(`[Cancel/Refund] Sent earnings reversal email to ${job.locksmith.email}`);
          } catch (emailError) {
            // Don't fail the refund if email fails
            console.error("[Cancel/Refund] Failed to send earnings reversal email:", emailError);
          }
        }

        console.log(`[Cancel/Refund] Refund processed for job ${job.jobNumber}: Customer refunded £${assessmentPayment.amount}`);
      } catch (refundError: unknown) {
        console.error("[Cancel/Refund] Error processing refund:", refundError);

        // Check if it's a Stripe error
        const stripeError = refundError as { type?: string; message?: string };
        if (stripeError.type === "StripeInvalidRequestError") {
          return NextResponse.json({
            success: false,
            error: `Unable to process refund. ${stripeError.message || "The payment may have already been refunded or is not eligible."}`,
          }, { status: 400 });
        }

        return NextResponse.json({
          success: false,
          error: "Failed to process refund. Please contact support.",
        }, { status: 500 });
      }
    }

    // Update job status to CANCELLED
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.CANCELLED,
      },
    });

    // Update application status if exists
    await prisma.locksmithApplication.updateMany({
      where: {
        jobId: id,
        status: "accepted",
      },
      data: {
        status: "cancelled_by_customer",
      },
    });

    // Log the cancellation
    console.log(`[Cancel/Refund] Job ${job.jobNumber} cancelled. Reason: ${refundReason}. Is no-show: ${isNoShow}`);

    return NextResponse.json({
      success: true,
      message: refundResult
        ? isNoShow
          ? `Job cancelled. £${refundResult.amount.toFixed(2)} refunded to customer. Locksmith charged £${locksmithTotalLiability.toFixed(2)} (full liability for no-show).`
          : `Job cancelled and £${refundResult.amount.toFixed(2)} refund initiated`
        : "Job cancelled successfully",
      refund: refundResult,
      isNoShowRefund: isNoShow,
      job: {
        id: updatedJob.id,
        jobNumber: updatedJob.jobNumber,
        status: updatedJob.status,
      },
    });

  } catch (error: unknown) {
    console.error("[Cancel/Refund] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to cancel job";
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}

// GET - Check if job is eligible for cancellation/refund
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        payments: {
          where: {
            type: "assessment",
            status: "succeeded",
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    let canCancel = false;
    let canCancelAt: Date | null = null;
    let isOverdue = false;
    let overdueMinutes = 0;
    let expectedArrivalTime: Date | null = null;
    let deadlineTime: Date | null = null;

    if (job.status === JobStatus.ACCEPTED && job.acceptedAt && job.acceptedEta) {
      // Calculate expected arrival time
      expectedArrivalTime = new Date(job.acceptedAt);
      expectedArrivalTime.setMinutes(expectedArrivalTime.getMinutes() + job.acceptedEta);

      // Deadline is ETA + 30 minute grace period
      deadlineTime = new Date(expectedArrivalTime.getTime() + 30 * 60 * 1000);
      canCancelAt = deadlineTime;

      if (now > deadlineTime) {
        canCancel = true;
        isOverdue = true;
        overdueMinutes = Math.floor((now.getTime() - expectedArrivalTime.getTime()) / 60000);
      }
    }

    const assessmentPayment = job.payments.find(p => p.type === "assessment" && p.status === "succeeded");

    return NextResponse.json({
      success: true,
      canCancel,
      canCancelAt: canCancelAt?.toISOString() || null,
      isOverdue,
      overdueMinutes,
      expectedArrivalTime: expectedArrivalTime?.toISOString() || null,
      deadlineTime: deadlineTime?.toISOString() || null,
      acceptedAt: job.acceptedAt?.toISOString() || null,
      acceptedEta: job.acceptedEta || null,
      status: job.status,
      refundAmount: assessmentPayment?.amount || 0,
    });

  } catch (error: unknown) {
    console.error("[Cancel/Refund Check] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to check cancellation status";
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
