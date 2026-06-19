import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";
import { handlePaymentCompleted } from "@/lib/job-service";

/**
 * GET /api/payments/finalize-checkout?session_id=cs_...
 *
 * Backup finalizer for the hosted Checkout flow. The Stripe webhook
 * (checkout.session.completed → handlePaymentCompleted) is the PRIMARY path
 * that assigns the job after payment. This endpoint lets the success-return
 * page ALSO finalize, so a delayed or missed webhook can't leave a paid job
 * unassigned. Idempotent: handlePaymentCompleted no-ops if the payment is
 * already marked succeeded, so calling both is safe.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: "session_id is required" },
      { status: 400 },
    );
  }

  try {
    const session = await getCheckoutSession(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        paid: false,
        status: session.payment_status,
      });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    const result = await handlePaymentCompleted({
      stripeCheckoutId: session.id,
      stripePaymentIntentId: paymentIntentId || undefined,
      applicationId: (session.metadata?.applicationId as string) || undefined,
    });

    return NextResponse.json({
      success: result.success,
      paid: true,
      error: result.error,
    });
  } catch (error) {
    console.error("[API] finalize-checkout error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to finalize checkout" },
      { status: 500 },
    );
  }
}
