import { NextRequest, NextResponse } from "next/server";
import {
  chargeSavedCard,
  formatAmountFromStripe,
  getCommissionRate,
} from "@/lib/stripe";
import prisma from "@/lib/db";
import { sendTransferNotificationEmail } from "@/lib/email";
import { applyReferralCredit, revertReferralCredit, triggerReferralReward } from "@/lib/referrals";

// POST - Charge a saved card for assessment fee or final payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type, // "assessment_fee" or "work_quote"
      amount,
      jobId,
      customerId,
      locksmithId,
      applicationId,
      quoteId,
    } = body;

    console.log("[Charge Saved Card] Request:", { type, amount, jobId, customerId, locksmithId });

    // Validate required fields
    if (!type || !amount || !jobId || !customerId || !locksmithId) {
      return NextResponse.json(
        { error: "Missing required fields: type, amount, jobId, customerId, locksmithId" },
        { status: 400 }
      );
    }

    // Validate payment type
    if (type !== "assessment_fee" && type !== "work_quote") {
      return NextResponse.json(
        { error: "Invalid payment type. Must be 'assessment_fee' or 'work_quote'" },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Get customer with saved payment method
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!customer.stripeCustomerId || !customer.stripePaymentMethodId) {
      return NextResponse.json(
        { error: "Customer does not have a saved payment method" },
        { status: 400 }
      );
    }

    // Get locksmith to check for Stripe Connect account
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
    });

    if (!locksmith) {
      return NextResponse.json(
        { error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Check if locksmith has verified Stripe Connect account
    if (!locksmith.stripeConnectId || !locksmith.stripeConnectVerified) {
      return NextResponse.json(
        { error: "Locksmith does not have a verified Stripe Connect account" },
        { status: 400 }
      );
    }

    // Get job for reference
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Calculate platform fee based on payment type
    // Assessment fee: 15% commission, Work quote: 25% commission
    const commissionRate = getCommissionRate(type as "assessment_fee" | "work_quote");

    // Apply referral credits (only on assessment fee for first-job discount)
    let creditApplied = 0;
    let chargeAmount = amount;
    if (type === "assessment_fee") {
      const creditResult = await applyReferralCredit(customerId, amount);
      creditApplied = creditResult.creditApplied;
      chargeAmount = creditResult.finalAmount;
    }

    const platformFee = chargeAmount * commissionRate;
    const locksmithShare = chargeAmount - platformFee;

    console.log("[Charge Saved Card] Charging:", {
      originalAmount: amount,
      creditApplied,
      chargeAmount,
      platformFee,
      locksmithShare,
      stripeCustomerId: customer.stripeCustomerId,
      locksmithStripeAccountId: locksmith.stripeConnectId,
    });

    // If the entire amount is covered by credits, skip Stripe
    let paymentIntent: { id: string; status: string } | null = null;
    if (chargeAmount > 0) {
      paymentIntent = await chargeSavedCard(
        chargeAmount,
        customer.stripeCustomerId!,
        customer.stripePaymentMethodId!,
        locksmith.stripeConnectId!,
        type,
        {
          jobId,
          customerId,
          locksmithId,
          applicationId,
          quoteId,
        }
      );

      if (!paymentIntent || paymentIntent.status === "requires_payment_method") {
        // Revert credit deduction on failure
        if (creditApplied > 0) await revertReferralCredit(customerId, creditApplied);
        return NextResponse.json({ error: "Payment failed" }, { status: 402 });
      }
    }

    console.log("[Charge Saved Card] Payment successful:", paymentIntent?.id ?? "covered by credits");

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        jobId,
        type: type === "assessment_fee" ? "assessment" : "quote",
        amount: chargeAmount,
        status: paymentIntent ? (paymentIntent.status === "succeeded" ? "succeeded" : "pending") : "succeeded",
        stripePaymentId: paymentIntent?.id,
      },
    });

    // Update job status based on payment type
    if (type === "assessment_fee") {
      await prisma.job.update({
        where: { id: jobId },
        data: { assessmentPaid: true },
      });
    }

    // Trigger referral reward if this is the first completed payment on this customer's first job
    if (type === "assessment_fee") {
      triggerReferralReward(customerId, jobId).catch(console.error);
    }

    // Send notification email to locksmith
    if (locksmith.email) {
      try {
        await sendTransferNotificationEmail(locksmith.email, {
          locksmithName: locksmith.name,
          amount: locksmithShare,
          jobNumber: job.jobNumber,
          customerName: customer.name,
          platformFee,
        });
      } catch (emailError) {
        console.error("[Charge Saved Card] Failed to send email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent?.id,
      paymentId: payment.id,
      status: paymentIntent?.status ?? "succeeded",
      amount: chargeAmount,
      creditApplied,
      platformFee,
      locksmithShare,
      message: `${type === "assessment_fee" ? "Assessment fee" : "Final payment"} charged successfully`,
    });
  } catch (error: any) {
    console.error("[Charge Saved Card] Error:", error);

    // Handle specific Stripe errors
    if (error.type === "StripeCardError") {
      return NextResponse.json(
        { error: error.message || "Card was declined", code: error.code },
        { status: 400 }
      );
    }

    if (error.code === "authentication_required") {
      return NextResponse.json(
        {
          error: "Card requires authentication. Please use the standard payment flow.",
          requiresAction: true,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to charge card" },
      { status: 500 }
    );
  }
}
