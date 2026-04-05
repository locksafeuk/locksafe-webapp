import { NextRequest, NextResponse } from "next/server";
import { createAccountLink } from "@/lib/stripe";
import prisma from "@/lib/db";

// Helper to get the base URL from request
function getBaseUrl(request: NextRequest): string {
  // Try to get from environment first
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Get from request headers
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback
  return "http://localhost:3000";
}

// POST /api/stripe-connect/onboard - Create a new onboarding link for existing account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, locksmithId } = body;

    let stripeAccountId = accountId;

    // If locksmithId is provided but not accountId, look up the accountId
    if (!stripeAccountId && locksmithId) {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: locksmithId },
        select: { stripeConnectId: true },
      });

      if (!locksmith) {
        return NextResponse.json(
          { error: "Locksmith not found" },
          { status: 404 }
        );
      }

      if (!locksmith.stripeConnectId) {
        return NextResponse.json(
          { error: "Locksmith does not have a Stripe Connect account. Please use the main setup flow." },
          { status: 400 }
        );
      }

      stripeAccountId = locksmith.stripeConnectId;
    }

    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "accountId or locksmithId is required" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(request);
    const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
    const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

    const accountLink = await createAccountLink(stripeAccountId, returnUrl, refreshUrl);

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error("Error creating onboarding link:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
