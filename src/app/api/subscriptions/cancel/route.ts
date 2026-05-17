import { NextRequest, NextResponse } from "next/server";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/subscriptions";

/**
 * POST /api/subscriptions/cancel
 * Body: { customerId: string }
 * Cancels the subscription at period end via Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId } = body as { customerId: string };

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    await cancelSubscriptionAtPeriodEnd(customerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Subscription] Cancel error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
