import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentIntentWithTransfer,
  getOrCreateStripeCustomer,
  formatAmountFromStripe,
  getCommissionRate,
} from "@/lib/stripe";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      amount,
      jobId,
      customerId,
      locksmithId,
      applicationId,
      quoteId,
      locksmithStripeAccountId, // Optional: can be passed directly or fetched
      customerEmail, // For guest checkout
      customerName,
      customerPhone,
    } = body;

    console.log("[Payment Intent] Creating payment intent:", { type, amount, jobId, locksmithId });

    if (!type || !amount || !jobId) {
      console.error("[Payment Intent] Missing required fields:", { type, amount, jobId });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      console.error("[Payment Intent] Invalid amount:", amount);
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Get locksmith's Stripe Connect account if not provided
    let locksmithStripeId = locksmithStripeAccountId;
    let locksmith = null;

    if (locksmithId && !locksmithStripeId) {
      locksmith = await prisma.locksmith.findUnique({
        where: { id: locksmithId },
      });

      if (locksmith?.stripeConnectId && locksmith?.stripeConnectVerified) {
        locksmithStripeId = locksmith.stripeConnectId;
        console.log("[Payment Intent] Found locksmith Stripe account:", locksmithStripeId);
      } else {
        console.log("[Payment Intent] Locksmith does not have verified Stripe Connect");
      }
    }

    // Get or create Stripe customer for card saving
    let stripeCustomerId: string | undefined;

    if (customerId && customerId !== "guest") {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (customer) {
        if (customer.stripeCustomerId) {
          stripeCustomerId = customer.stripeCustomerId;
        } else {
          // Create Stripe customer
          const stripeCustomer = await getOrCreateStripeCustomer(
            customer.email,
            customer.name,
            customer.phone,
            { customerId: customer.id }
          );
          stripeCustomerId = stripeCustomer.id;

          // Save to database
          await prisma.customer.update({
            where: { id: customer.id },
            data: { stripeCustomerId },
          });
        }
      }
    } else if (customerEmail) {
      // Guest checkout with email
      const stripeCustomer = await getOrCreateStripeCustomer(
        customerEmail,
        customerName || "Guest Customer",
        customerPhone
      );
      stripeCustomerId = stripeCustomer.id;
    }

    let paymentIntent;
    const finalAmount = amount;

    if (type === "assessment_fee") {
      console.log("[Payment Intent] Creating assessment fee payment intent for £" + amount);

      paymentIntent = await createPaymentIntentWithTransfer(
        amount,
        locksmithStripeId || null,
        "assessment_fee",
        {
          jobId,
          customerId: customerId || "guest",
          locksmithId: locksmithId || "",
          applicationId: applicationId || "",
        },
        stripeCustomerId
      );
    } else if (type === "work_quote") {
      // NOTE: Assessment fee and work quote are SEPARATE payments
      // Assessment fee is NOT deducted from the work quote
      // Each has its own commission rate:
      // - Assessment fee: 15% platform commission
      // - Work quote: 25% platform commission

      console.log("[Payment Intent] Creating work quote payment intent for £" + finalAmount);
      console.log("[Payment Intent] Note: Assessment fee is a separate payment, not deducted from work quote");

      paymentIntent = await createPaymentIntentWithTransfer(
        finalAmount,
        locksmithStripeId || null,
        "work_quote",
        {
          jobId,
          customerId: customerId || "guest",
          locksmithId: locksmithId || "",
          quoteId: quoteId || "",
        },
        stripeCustomerId
      );
    } else {
      console.error("[Payment Intent] Invalid payment type:", type);
      return NextResponse.json(
        { error: "Invalid payment type" },
        { status: 400 }
      );
    }

    // Calculate fee breakdown for response based on payment type
    // Assessment fee: 15% commission, Work quote: 25% commission
    const commissionRate = getCommissionRate(type as "assessment_fee" | "work_quote");
    const platformFee = finalAmount * commissionRate;
    const locksmithShare = finalAmount - platformFee;

    console.log("[Payment Intent] Successfully created:", {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      platformFee,
      locksmithShare,
      transfersToLocksmith: !!locksmithStripeId,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      finalAmount,
      originalAmount: amount,
      platformFee,
      locksmithShare,
      stripeCustomerId,
      transfersToLocksmith: !!locksmithStripeId,
    });
  } catch (error: any) {
    console.error("[Payment Intent] Error creating payment intent:", error);

    // Handle specific Stripe errors
    if (error.type === "StripeCardError") {
      return NextResponse.json(
        { error: error.message || "Card error" },
        { status: 400 }
      );
    }

    if (error.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: "Invalid request to payment provider" },
        { status: 400 }
      );
    }

    if (error.type === "StripeAuthenticationError") {
      console.error("[Payment Intent] Stripe authentication failed - check API keys");
      return NextResponse.json(
        { error: "Payment configuration error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
