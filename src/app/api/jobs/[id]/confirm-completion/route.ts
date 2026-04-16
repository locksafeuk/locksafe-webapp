import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  stripe,
  formatAmountForStripe,
  formatAmountFromStripe,
  PLATFORM_FEE_PERCENT,
} from "@/lib/stripe";
import {
  sendJobCompletionEmail,
  sendTransferNotificationEmail,
  sendPaymentReceiptEmail,
} from "@/lib/email";
import { SITE_URL } from "@/lib/config";
import { notifyJobSigned, notifyPaymentReceived } from "@/lib/telegram";

// Platform commission rate (15%)
const PLATFORM_COMMISSION_RATE = PLATFORM_FEE_PERCENT;

// POST - Customer confirms job completion, signs, and payment is processed
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

    if (!confirmsWork || !confirmsPrice || !confirmsSatisfied) {
      return NextResponse.json(
        { success: false, error: "All confirmations are required" },
        { status: 400 }
      );
    }

    // Get the job with all related data
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
        quote: true,
        payments: {
          where: { status: "succeeded" },
        },
        signature: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if job is in a valid status for confirmation
    const validConfirmStatuses = ["PENDING_CUSTOMER_CONFIRMATION", "COMPLETED"];
    if (!validConfirmStatuses.includes(job.status)) {
      // If already signed, return success
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

      return NextResponse.json(
        { success: false, error: `Job cannot be confirmed in status: ${job.status}` },
        { status: 400 }
      );
    }

    // Get client IP and device info
    const forwardedFor = request.headers.get("x-forwarded-for");
    const signerIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    const deviceInfo = request.headers.get("user-agent") || "unknown";

    // Calculate payment amounts
    const quoteTotal = job.quote?.total || 0;
    const assessmentFee = job.assessmentFee || 0;
    const assessmentFeePaid = job.payments
      .filter((p) => p.type === "assessment" && p.status === "succeeded")
      .reduce((sum, p) => sum + p.amount, 0);

    // Final amount to charge (quote total minus assessment fee already paid)
    const finalAmount = Math.max(0, quoteTotal - assessmentFeePaid);

    // Platform commission is 15% of the amount being charged NOW (finalAmount)
    // The assessment fee already had its own 15% platform fee deducted when it was charged
    const platformCommissionOnFinal = Math.round(finalAmount * PLATFORM_COMMISSION_RATE * 100) / 100;

    // Locksmith receives 85% of the final amount being charged now
    const locksmithAmountFromFinal = Math.round((finalAmount - platformCommissionOnFinal) * 100) / 100;

    // Total platform earnings from this job = 15% of assessment fee + 15% of final payment
    const platformCommissionOnAssessment = Math.round(assessmentFee * PLATFORM_COMMISSION_RATE * 100) / 100;
    const totalPlatformCommission = platformCommissionOnAssessment + platformCommissionOnFinal;

    // Total locksmith earnings from this job = 85% of assessment fee + 85% of final payment
    const locksmithAmountFromAssessment = Math.round((assessmentFee - platformCommissionOnAssessment) * 100) / 100;
    const totalLocksmithEarnings = locksmithAmountFromAssessment + locksmithAmountFromFinal;

    console.log("[Job Completion] Payment calculation:", {
      quoteTotal,
      assessmentFee,
      assessmentFeePaid,
      finalAmount,
      platformCommissionOnFinal,
      locksmithAmountFromFinal,
      totalPlatformCommission,
      totalLocksmithEarnings,
      hasQuote: !!job.quote,
    });

    let paymentResult = null;
    let transferResult = null;

    // Only process payment if there's actually an amount to charge
    // Skip payment if: no quote, quote = 0, or assessment fee covers the quote
    if (finalAmount > 0 && job.locksmith) {
      // Check if customer has a saved payment method
      const customerStripeId = job.customer?.stripeCustomerId;
      const customerPaymentMethod = job.customer?.stripePaymentMethodId;

      if (!customerStripeId || !customerPaymentMethod) {
        console.warn("[Job Completion] Customer doesn't have a saved payment method:", {
          customerId: job.customerId,
          customerEmail: job.customer?.email,
          stripeCustomerId: customerStripeId,
          stripePaymentMethodId: customerPaymentMethod,
          finalAmount,
        });
        // Don't block completion - record payment as pending collection
        paymentResult = {
          status: "pending_collection",
          amount: finalAmount,
          message: "Customer card not on file - payment needs to be collected manually",
        };

        // Record the payment as pending
        await prisma.payment.create({
          data: {
            jobId: job.id,
            type: "final_payment",
            amount: finalAmount,
            status: "pending",
            stripePaymentId: `pending_${Date.now()}`,
          },
        });

        console.log(`[Job Completion] Created pending payment record for £${finalAmount}`);
      } else {
        // Customer has saved card - try to charge it
        console.log("[Job Completion] Charging saved card:", {
          stripeCustomerId: customerStripeId,
          paymentMethodId: customerPaymentMethod,
          amount: finalAmount,
          platformFee: platformCommissionOnFinal,
          locksmithShare: locksmithAmountFromFinal,
        });
        try {
          // Check if locksmith has Stripe Connect
          const locksmithStripeAccountId = job.locksmith.stripeConnectId;

          // Debug logging
          console.log("[Job Completion] Locksmith Stripe Connect status:", {
            locksmithId: job.locksmith.id,
            locksmithName: job.locksmith.name,
            stripeConnectId: locksmithStripeAccountId,
            stripeConnectOnboarded: job.locksmith.stripeConnectOnboarded,
            stripeConnectVerified: job.locksmith.stripeConnectVerified,
          });

          // Use Stripe Connect if locksmith has a connected account ID
          // Note: We check stripeConnectId exists - if it exists, we can transfer to it
          // The stripeConnectVerified flag may not always be updated correctly by webhooks
          if (locksmithStripeAccountId) {
            console.log("[Job Completion] Using Stripe Connect transfer to:", locksmithStripeAccountId);

            // Create a payment intent with automatic transfer to locksmith using SAVED CARD
            // Stripe destination charges: customer pays finalAmount, platform keeps application_fee_amount, locksmith gets the rest
            const paymentIntent = await stripe.paymentIntents.create({
              amount: formatAmountForStripe(finalAmount),
              currency: "gbp",
              customer: customerStripeId, // Use saved customer
              payment_method: customerPaymentMethod, // Use saved payment method
              off_session: true, // Charge without customer present
              confirm: true, // Immediately confirm and charge
              transfer_data: {
                destination: locksmithStripeAccountId,
              },
              // Application fee is 15% of the amount being charged (finalAmount)
              application_fee_amount: formatAmountForStripe(platformCommissionOnFinal),
              metadata: {
                type: "work_quote",
                jobId: job.id,
                jobNumber: job.jobNumber,
                customerId: job.customerId,
                locksmithId: job.locksmithId || "",
                quoteTotal: quoteTotal.toString(),
                assessmentFeeDeducted: assessmentFeePaid.toString(),
                amountCharged: finalAmount.toString(),
                // Store in pence for consistency with webhook processing
                platformFee: formatAmountForStripe(platformCommissionOnFinal).toString(),
                locksmithShare: formatAmountForStripe(locksmithAmountFromFinal).toString(),
              },
              description: `LockSafe Work Payment - Job ${job.jobNumber}`,
            });

            paymentResult = {
              paymentIntentId: paymentIntent.id,
              status: paymentIntent.status,
              amount: formatAmountFromStripe(paymentIntent.amount),
              transferToLocksmith: locksmithAmountFromFinal,
              platformFee: platformCommissionOnFinal,
            };

            // Record the payment
            await prisma.payment.create({
              data: {
                jobId: job.id,
                type: "final_payment",
                amount: finalAmount,
                status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
                stripePaymentId: paymentIntent.id,
              },
            });

            // If locksmith has Stripe Connect, the transfer is automatic via destination charges
            transferResult = {
              type: "destination_charge",
              transferredToLocksmith: locksmithAmountFromFinal, // 85% of finalAmount
              platformCommission: platformCommissionOnFinal, // 15% of finalAmount
              stripeAccountId: locksmithStripeAccountId,
            };

            console.log(`[Job Completion] Payment processed with transfer:
              - Charged: £${finalAmount}
              - Platform fee: £${platformCommissionOnFinal}
              - Locksmith receives: £${locksmithAmountFromFinal}
              - Transferred to: ${locksmithStripeAccountId}`);
          } else {
            // Locksmith doesn't have Stripe Connect account - charge customer and record for manual payout
            console.log("[Job Completion] Locksmith doesn't have Stripe Connect account ID, charging customer and recording for manual payout");

            // Still charge the customer's saved card (but without transfer)
            const paymentIntent = await stripe.paymentIntents.create({
              amount: formatAmountForStripe(finalAmount),
              currency: "gbp",
              customer: customerStripeId,
              payment_method: customerPaymentMethod,
              off_session: true,
              confirm: true,
              metadata: {
                type: "work_quote",
                jobId: job.id,
                jobNumber: job.jobNumber,
                customerId: job.customerId,
                locksmithId: job.locksmithId || "",
                quoteTotal: quoteTotal.toString(),
                amountCharged: finalAmount.toString(),
                // Store in pence for consistency with webhook processing
                platformFee: formatAmountForStripe(platformCommissionOnFinal).toString(),
                locksmithShare: formatAmountForStripe(locksmithAmountFromFinal).toString(),
                payoutType: "manual",
              },
              description: `LockSafe Work Payment - Job ${job.jobNumber}`,
            });

            paymentResult = {
              paymentIntentId: paymentIntent.id,
              status: paymentIntent.status,
              amount: formatAmountFromStripe(paymentIntent.amount),
            };

            // Record the payment as needing manual payout to locksmith
            await prisma.payment.create({
              data: {
                jobId: job.id,
                type: "final_payment",
                amount: finalAmount,
                status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
                stripePaymentId: paymentIntent.id,
              },
            });

            transferResult = {
              type: "manual_payout_required",
              locksmithAmount: locksmithAmountFromFinal,
              platformCommission: platformCommissionOnFinal,
              note: "Locksmith needs to complete Stripe Connect onboarding to receive automatic payouts",
            };

            console.log(`[Job Completion] Payment charged: £${finalAmount}, awaiting manual payout to locksmith`);
          }
        } catch (paymentError: any) {
          console.error("[Job Completion] Payment processing error:", paymentError);

          // Handle specific Stripe errors
          if (paymentError.type === "StripeCardError") {
            return NextResponse.json(
              {
                success: false,
                error: paymentError.message || "Card was declined",
                code: "CARD_DECLINED",
                declineCode: paymentError.decline_code,
              },
              { status: 400 }
            );
          }

          if (paymentError.code === "authentication_required") {
            return NextResponse.json(
              {
                success: false,
                error: "Card requires additional authentication. Customer needs to re-enter card details.",
                code: "AUTHENTICATION_REQUIRED",
              },
              { status: 400 }
            );
          }

          // For other errors, fail the request
          return NextResponse.json(
            {
              success: false,
              error: `Payment failed: ${paymentError.message}`,
              code: "PAYMENT_FAILED",
            },
            { status: 500 }
          );
        }
      }
    } else {
      console.log("[Job Completion] No additional payment needed, assessment fee covers the quote or no amount to charge");
    }

    // Create or update signature
    const signature = await prisma.signature.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
        signatureData,
        signerName,
        signerIp,
        deviceInfo,
        confirmsWork,
        confirmsPrice,
        confirmsSatisfied,
      },
      update: {
        signatureData,
        signerName,
        signerIp,
        deviceInfo,
        confirmsWork,
        confirmsPrice,
        confirmsSatisfied,
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

    // Update locksmith stats with their total earnings from this job (85% of total)
    if (job.locksmithId) {
      await prisma.locksmith.update({
        where: { id: job.locksmithId },
        data: {
          totalJobs: { increment: 1 },
          // totalEarnings is the locksmith's share (85% of total job value)
          // But assessment fee earnings were already added when that payment was processed
          // So we only add the locksmith's share from the final payment
          totalEarnings: { increment: locksmithAmountFromFinal },
        },
      });
    }

    // Send completion emails
    const baseUrl = request.headers.get("origin") || SITE_URL;

    // Send to customer
    if (job.customer?.email) {
      try {
        await sendJobCompletionEmail(job.customer.email, {
          customerName: job.customer.name,
          jobNumber: job.jobNumber,
          locksmithName: job.locksmith?.name || "Your Locksmith",
          totalPaid: quoteTotal,
          reportUrl: `${baseUrl}/job/${job.id}/report`,
        });

        // Send payment receipt
        await sendPaymentReceiptEmail(job.customer.email, {
          customerName: job.customer.name,
          jobNumber: job.jobNumber,
          locksmithName: job.locksmith?.name || "Your Locksmith",
          paymentType: "work_quote",
          quoteTotal,
          assessmentFeeDeducted: assessmentFeePaid,
          amountPaid: finalAmount > 0 ? finalAmount : 0,
          paymentDate: new Date(),
          address: job.address,
        });
      } catch (emailError) {
        console.error("[Job Completion] Failed to send customer emails:", emailError);
      }
    }

    // Send to locksmith
    if (job.locksmith?.email) {
      try {
        await sendTransferNotificationEmail(job.locksmith.email, {
          locksmithName: job.locksmith.name,
          amount: locksmithAmountFromFinal, // Amount they receive from this payment
          jobNumber: job.jobNumber,
          customerName: job.customer?.name || "Customer",
          platformFee: platformCommissionOnFinal,
        });
      } catch (emailError) {
        console.error("[Job Completion] Failed to send locksmith email:", emailError);
      }
    }

    // Send Telegram notifications (non-blocking)
    notifyJobSigned({
      jobNumber: job.jobNumber,
      jobId: job.id,
      locksmithName: job.locksmith?.name || "Locksmith",
      customerName: job.customer?.name || "Customer",
      total: quoteTotal,
      locksmithEarnings: totalLocksmithEarnings,
      platformFee: totalPlatformCommission,
    }).catch((err) => console.error("[Telegram] Failed to send job signed notification:", err));

    if (finalAmount > 0) {
      notifyPaymentReceived({
        jobNumber: job.jobNumber,
        jobId: job.id,
        customerName: job.customer?.name || "Customer",
        locksmithName: job.locksmith?.name || "Locksmith",
        amount: finalAmount,
        paymentType: "final_payment",
      }).catch((err) => console.error("[Telegram] Failed to send payment notification:", err));
    }

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        signerName: signature.signerName,
        signedAt: signature.signedAt,
      },
      payment: paymentResult,
      transfer: transferResult,
      summary: {
        quoteTotal,
        assessmentFee,
        assessmentFeePaid,
        finalAmountCharged: finalAmount,
        // Breakdown of this payment
        platformCommissionOnFinal,
        locksmithReceivesFromFinal: locksmithAmountFromFinal,
        // Total earnings from full job
        totalPlatformCommission,
        totalLocksmithEarnings,
      },
    });
  } catch (error: any) {
    console.error("[Job Completion] Error processing completion:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process job completion" },
      { status: 500 }
    );
  }
}
