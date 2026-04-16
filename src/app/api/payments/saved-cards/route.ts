import { NextRequest, NextResponse } from "next/server";
import { listPaymentMethods, detachPaymentMethod } from "@/lib/stripe";
import prisma from "@/lib/db";

// GET - List customer's saved payment methods
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    // Get customer from database
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!customer.stripeCustomerId) {
      return NextResponse.json({
        paymentMethods: [],
        defaultPaymentMethodId: null,
      });
    }

    // Get payment methods from Stripe
    const paymentMethods = await listPaymentMethods(customer.stripeCustomerId);

    // Format the response
    const formattedMethods = paymentMethods.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expiryMonth: pm.card.exp_month,
            expiryYear: pm.card.exp_year,
            funding: pm.card.funding,
          }
        : null,
      created: pm.created,
      isDefault: pm.id === customer.stripePaymentMethodId,
    }));

    return NextResponse.json({
      paymentMethods: formattedMethods,
      defaultPaymentMethodId: customer.stripePaymentMethodId,
      stripeCustomerId: customer.stripeCustomerId,
    });
  } catch (error: any) {
    console.error("[Saved Cards] Error listing payment methods:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list payment methods" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a saved payment method
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, paymentMethodId } = body;

    if (!customerId || !paymentMethodId) {
      return NextResponse.json(
        { error: "Customer ID and payment method ID are required" },
        { status: 400 }
      );
    }

    // Get customer from database
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Detach the payment method from Stripe
    await detachPaymentMethod(paymentMethodId);

    // If this was the default payment method, clear it from database
    if (customer.stripePaymentMethodId === paymentMethodId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { stripePaymentMethodId: null },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment method removed",
    });
  } catch (error: any) {
    console.error("[Saved Cards] Error removing payment method:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
