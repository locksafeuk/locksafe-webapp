import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  FREE_CALLOUTS_PER_PERIOD,
  SUBSCRIBER_DISCOUNT_MULTIPLIER,
} from "@/lib/subscriptions";

/**
 * GET /api/payments/preview?customerId=&amount=
 *
 * Read-only calculation of discount breakdown. Does NOT apply any credits.
 * Used to show price breakdown to customers before they pay.
 */
export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customerId");
    const rawAmount = request.nextUrl.searchParams.get("amount");

    if (!customerId || !rawAmount) {
      return NextResponse.json(
        { error: "customerId and amount are required" },
        { status: 400 },
      );
    }

    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 },
      );
    }

    // Look up subscription and referral credits in parallel
    const [subscription, customer] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          customerId,
          status: { in: ["active", "trialing"] },
        },
        select: {
          plan: true,
          status: true,
          freeCallouts: true,
        },
      }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { referralCredits: true },
      }),
    ]);

    const isSubscriber = !!subscription;
    const hasFreeCallout =
      isSubscriber && (subscription.freeCallouts ?? 0) >= FREE_CALLOUTS_PER_PERIOD;

    let afterSubscriber = amount;
    let subscriberDiscount = 0;
    let freeCallout = false;

    if (isSubscriber) {
      if (hasFreeCallout) {
        afterSubscriber = 0;
        subscriberDiscount = amount;
        freeCallout = true;
      } else {
        afterSubscriber = parseFloat(
          (amount * SUBSCRIBER_DISCOUNT_MULTIPLIER).toFixed(2),
        );
        subscriberDiscount = parseFloat((amount - afterSubscriber).toFixed(2));
      }
    }

    const availableCredits = customer?.referralCredits ?? 0;
    const referralCredit = Math.min(availableCredits, afterSubscriber);
    const finalAmount = parseFloat(
      Math.max(0, afterSubscriber - referralCredit).toFixed(2),
    );

    return NextResponse.json({
      originalAmount: amount,
      subscriberDiscount,
      freeCallout,
      referralCredit,
      finalAmount,
      isSubscriber,
      plan: subscription?.plan ?? null,
    });
  } catch (error) {
    console.error("Payment preview error:", error);
    return NextResponse.json(
      { error: "Failed to calculate preview" },
      { status: 500 },
    );
  }
}
