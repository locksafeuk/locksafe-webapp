import { NextRequest, NextResponse } from "next/server";
import { stripe, verifyWebhookSignature, getCheckoutSession } from "@/lib/stripe";
import { handlePaymentCompleted } from "@/lib/job-service";
import prisma from "@/lib/db";

/**
 * POST /api/payments/checkout-webhook
 *
 * Stripe webhook handler for Checkout Session events.
 * Handles:
 * - checkout.session.completed: Payment successful
 * - checkout.session.expired: Session expired
 *
 * Must be configured in Stripe Dashboard:
 * Endpoint: https://locksafe.uk/api/payments/checkout-webhook
 * Events: checkout.session.completed, checkout.session.expired
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[Checkout Webhook] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Checkout Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err) {
      console.error("[Checkout Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log(`[Checkout Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`[Checkout Webhook] Checkout completed: ${session.id}`);

        // Only process if payment was successful
        if (session.payment_status === "paid") {
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;

          const result = await handlePaymentCompleted({
            stripeCheckoutId: session.id,
            stripePaymentIntentId: paymentIntentId || undefined,
          });

          if (!result.success) {
            console.error(
              `[Checkout Webhook] Payment completion handler failed:`,
              result.error
            );
          }
        } else {
          console.log(
            `[Checkout Webhook] Session ${session.id} completed but payment status: ${session.payment_status}`
          );
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        console.log(`[Checkout Webhook] Checkout expired: ${session.id}`);

        // Update payment status to expired/failed
        await prisma.payment.updateMany({
          where: { stripeCheckoutId: session.id },
          data: { status: "failed" },
        });
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`[Checkout Webhook] Payment intent succeeded: ${paymentIntent.id}`);

        // Update any payment records matching this intent
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: paymentIntent.id },
          data: {
            status: "succeeded",
            paidAt: new Date(),
          },
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`[Checkout Webhook] Payment failed: ${paymentIntent.id}`);

        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: paymentIntent.id },
          data: { status: "failed" },
        });
        break;
      }

      default:
        console.log(`[Checkout Webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Checkout Webhook] Unhandled error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
