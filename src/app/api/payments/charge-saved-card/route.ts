import { NextRequest, NextResponse } from "next/server";
import {
  chargeSavedCard,
  formatAmountFromStripe,
  getCommissionRate,
} from "@/lib/stripe";
import prisma from "@/lib/db";
import { sendTransferNotificationEmail } from "@/lib/email";

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
    const platformFee = amount * commissionRate;
    const locksmithShare = amount - platformFee;

    console.log("[Charge Saved Card] Charging:", {
      amount,
      platformFee,
      locksmithShare,
      stripeCustomerId: customer.stripeCustomerId,
      locksmithStripeAccountId: locksmith.stripeConnectId,
    });

    // Charge the saved card with transfer to locksmith
    const paymentIntent = await chargeSavedCard(
      amount,
      customer.stripeCustomerId,
      customer.stripePaymentMethodId,
      locksmith.stripeConnectId,
      type,
      {
        jobId,
        customerId,
        locksmithId,
        applicationId,
        quoteId,
      }
    );

    console.log("[Charge Saved Card] Payment successful:", paymentIntent.id);

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        jobId,
        type: type === "assessment_fee" ? "assessment" : "quote",
        amount,
        status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
        stripePaymentId: paymentIntent.id,
      },
    });

    // Update job status based on payment type
    if (type === "assessment_fee") {
      await prisma.job.update({
        where: { id: jobId },
        data: { assessmentPaid: true },
      });
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
        console.log("[Charge Saved Card] Sent transfer notification to:", locksmith.email);
      } catch (emailError) {
        console.error("[Charge Saved Card] Failed to send email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
      status: paymentIntent.status,
      amount,
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
