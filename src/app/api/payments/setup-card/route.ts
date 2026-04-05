import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateStripeCustomer,
  createSetupIntent,
  getSetupIntent,
  updateCustomerDefaultPaymentMethod,
} from "@/lib/stripe";
import prisma from "@/lib/db";

// POST - Create a SetupIntent to save card for future use
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, email, name, phone, jobId } = body;

    console.log("[Setup Card] Creating setup intent for customer:", { customerId, email, jobId });

    if (!customerId && !email) {
      return NextResponse.json(
        { error: "Customer ID or email is required" },
        { status: 400 }
      );
    }

    let customer = null;
    let stripeCustomerId: string;

    // Get or create the database customer
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      // If customer already has a Stripe customer ID, use it
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

        // Save Stripe customer ID to database
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripeCustomerId },
        });
      }
    } else {
      // Guest checkout - create Stripe customer with email
      const stripeCustomer = await getOrCreateStripeCustomer(
        email,
        name || "Guest Customer",
        phone,
        { source: "guest_checkout" }
      );
      stripeCustomerId = stripeCustomer.id;
    }

    // Create SetupIntent
    const setupIntent = await createSetupIntent(stripeCustomerId, {
      customerId: customerId || "guest",
      jobId: jobId || "",
    });

    console.log("[Setup Card] Created setup intent:", setupIntent.id);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      stripeCustomerId,
    });
  } catch (error: any) {
    console.error("[Setup Card] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create setup intent" },
      { status: 500 }
    );
  }
}

// PUT - Confirm card was saved and update customer's default payment method
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupIntentId, customerId } = body;

    console.log("[Setup Card] Confirming setup intent:", { setupIntentId, customerId });

    if (!setupIntentId) {
      return NextResponse.json(
        { error: "Setup intent ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the setup intent
    const setupIntent = await getSetupIntent(setupIntentId);

    if (setupIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Setup intent not succeeded. Status: ${setupIntent.status}` },
        { status: 400 }
      );
    }

    const paymentMethodId = setupIntent.payment_method as string;

    // Update customer's default payment method in Stripe
    if (setupIntent.customer) {
      await updateCustomerDefaultPaymentMethod(
        setupIntent.customer as string,
        paymentMethodId
      );
    }

    // Update database customer if customerId provided
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          stripePaymentMethodId: paymentMethodId,
        },
      });
    }

    console.log("[Setup Card] Card saved successfully:", paymentMethodId);

    return NextResponse.json({
      success: true,
      paymentMethodId,
      message: "Card saved successfully",
    });
  } catch (error: any) {
    console.error("[Setup Card] Error confirming:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm card setup" },
      { status: 500 }
    );
  }
}
