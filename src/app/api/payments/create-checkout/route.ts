import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

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
    const { jobId, customerId, locksmithId, applicationId, amount } = body;

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

    // Create Stripe Checkout Session
    const session = await createCheckoutSession({
      amount,
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
      paymentType: "callout",
    });

    // Create or update Payment record
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = await prisma.payment.create({
      data: {
        jobId: job.id,
        customerId: customer.id,
        type: "callout",
        amount,
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
