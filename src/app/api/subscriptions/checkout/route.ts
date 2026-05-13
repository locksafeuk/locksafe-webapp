import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionCheckout } from "@/lib/subscriptions";

/**
 * POST /api/subscriptions/checkout
 * Creates a Stripe Checkout session for LockSafe Cover.
 *
 * Body: { customerId: string, plan: "cover_monthly" | "cover_annual" }
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, plan } = body as {
      customerId: string;
      plan: "cover_monthly" | "cover_annual";
    };

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? "https://www.locksafe.uk";
    const url = await createSubscriptionCheckout(
      customerId,
      plan ?? "cover_monthly",
      `${origin}/customer/dashboard?cover=activated`,
      `${origin}/customer/dashboard?cover=cancelled`
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[Subscription] Checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
}
