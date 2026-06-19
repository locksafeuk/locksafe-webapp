import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";
import { applySubscriberDiscount } from "@/lib/subscriptions";
import { applyReferralCredit, revertReferralCredit } from "@/lib/referrals";

/**
 * POST /api/payments/create-checkout
 *
 * Creates a Stripe Checkout Session for call-out fee payment.
 * Returns a short payment URL that can be sent via SMS.
 *
 * Input: {
 *   jobId: string,
 *   customerId: string,
 *   locksmithId: string,
 *   applicationId: string,
 *   amount: number (pounds)
 * }
 *
 * Returns: {
 *   checkoutUrl: string,
 *   sessionId: string,
 *   expiresAt: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, customerId, locksmithId, applicationId, amount, type, successUrl, cancelUrl } = body;

    // Payment type drives commission rate + product label. Default to call-out.
    const paymentType: "assessment_fee" | "callout" | "work_quote" =
      type === "assessment_fee" || type === "work_quote" ? type : "callout";

    // Validate required fields
    if (!jobId || !customerId || !locksmithId || !applicationId) {
      return NextResponse.json(
        { success: false, error: "jobId, customerId, locksmithId, and applicationId are required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "number" || amount < 1) {
      return NextResponse.json(
        { success: false, error: "amount must be a positive number (in pounds)" },
        { status: 400 }
      );
    }

    // Fetch all needed data
    const [job, customer, locksmith, application] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, jobNumber: true, status: true },
      }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, email: true, phone: true },
      }),
      prisma.locksmith.findUnique({
        where: { id: locksmithId },
        select: {
          id: true,
          name: true,
          stripeConnectId: true,
          stripeConnectVerified: true,
        },
      }),
      prisma.locksmithApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, status: true },
      }),
    ]);

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // ── Apply discount chain ─────────────────────────────────────────
    // 1. LockSafe Cover discount (50% off or free callout)
    const subscriberResult = await applySubscriberDiscount(customerId, amount);
    const afterSubscriber = subscriberResult.fee;
    const subscriberDiscount = amount - afterSubscriber;

    // 2. Referral credit
    const creditResult = await applyReferralCredit(customerId, afterSubscriber);
    const finalAmount = creditResult.finalAmount;
    // ─────────────────────────────────────────────────────────────────

    // Create Stripe Checkout Session
    let session;
    try {
      if (finalAmount < 0.3) {
        // Below Stripe minimum — skip Stripe, mark payment succeeded directly
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const payment = await prisma.payment.create({
          data: {
            jobId: job.id,
            customerId: customer.id,
            type: "callout",
            amount: finalAmount,
            originalAmount: amount,
            subscriberDiscount,
            referralCreditApplied: creditResult.creditApplied,
            platformSubsidy: subscriberDiscount,
            status: "succeeded",
            paidAt: new Date(),
          },
        });
        return NextResponse.json({
          success: true,
          checkoutUrl: null,
          sessionId: null,
          paymentId: payment.id,
          expiresAt: expiresAt.toISOString(),
          zeroCost: true,
        });
      }

      session = await createCheckoutSession({
        amount: finalAmount,
        jobId: job.id,
        customerId: customer.id,
        locksmithId: locksmith.id,
        applicationId: application.id,
        customerEmail: customer.email,
        customerName: customer.name,
        locksmithName: locksmith.name,
        jobNumber: job.jobNumber,
        locksmithStripeAccountId: locksmith.stripeConnectVerified
          ? locksmith.stripeConnectId
          : null,
        paymentType,
        ...(typeof successUrl === "string" && successUrl ? { successUrl } : {}),
        ...(typeof cancelUrl === "string" && cancelUrl ? { cancelUrl } : {}),
      });
    } catch (stripeError) {
      // Rollback discounts applied
      if (creditResult.creditApplied > 0) {
        await revertReferralCredit(customerId, creditResult.creditApplied);
      }
      if (subscriberResult.freeCallout) {
        await prisma.subscription.updateMany({
          where: { customerId, status: { in: ["active", "trialing"] } },
          data: { freeCallouts: { increment: 1 } },
        });
      }
      throw stripeError;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = await prisma.payment.create({
      data: {
        jobId: job.id,
        customerId: customer.id,
        type: "callout",
        amount: finalAmount,
        originalAmount: amount,
        subscriberDiscount,
        referralCreditApplied: creditResult.creditApplied,
        platformSubsidy: subscriberDiscount,
        status: "pending",
        stripeCheckoutId: session.id,
        paymentUrl: session.url,
        paymentUrlExpiresAt: expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      paymentId: payment.id,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[API] Create checkout error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
