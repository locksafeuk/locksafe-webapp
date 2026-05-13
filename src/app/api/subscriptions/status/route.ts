import { NextRequest, NextResponse } from "next/server";
import { getCustomerSubscription } from "@/lib/subscriptions";

/**
 * GET /api/subscriptions/status?customerId=xxx
 * Returns the customer's subscription status.
 */
export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ subscription: null });
    }

    const sub = await getCustomerSubscription(customerId);

    if (!sub) return NextResponse.json({ subscription: null });

    return NextResponse.json({
      subscription: {
        status: sub.status,
        plan: sub.plan,
        freeCallouts: sub.freeCallouts,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    });
  } catch {
    return NextResponse.json({ subscription: null });
  }
}
