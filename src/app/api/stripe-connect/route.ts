import { NextRequest, NextResponse } from "next/server";
import {
  createConnectAccount,
  createAccountLink,
  getConnectAccountStatus,
  createLoginLink,
  getAccountBalance,
  listTransfers,
  listPayouts,
  stripe,
} from "@/lib/stripe";
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

  // Fallback - this won't work with Stripe but at least shows the error
  return "http://localhost:3000";
}

// POST /api/stripe-connect - Create a new connected account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, locksmithId, businessProfile } = body;

    if (!email || !locksmithId) {
      return NextResponse.json(
        { error: "Email and locksmithId are required" },
        { status: 400 }
      );
    }

    // Check if locksmith exists
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
    });

    if (!locksmith) {
      return NextResponse.json(
        { error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Get the base URL from request
    const baseUrl = getBaseUrl(request);
    console.log("[Stripe Connect] Using base URL:", baseUrl);

    const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
    const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

    // Check if already has a Stripe account
    if (locksmith.stripeConnectId) {
      // Create new onboarding link for existing account
      const accountLink = await createAccountLink(locksmith.stripeConnectId, returnUrl, refreshUrl);

      return NextResponse.json({
        success: true,
        accountId: locksmith.stripeConnectId,
        onboardingUrl: accountLink.url,
        existing: true,
      });
    }

    // Create the connected account
    const account = await createConnectAccount(email, locksmithId, businessProfile);

    // Save the Stripe account ID to the locksmith's profile
    await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        stripeConnectId: account.id,
        stripeConnectOnboarded: false,
        stripeConnectVerified: false,
      },
    });

    // Create onboarding link
    const accountLink = await createAccountLink(account.id, returnUrl, refreshUrl);

    return NextResponse.json({
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error("Error creating Stripe Connect account:", error);
    return NextResponse.json(
      { error: "Failed to create connected account" },
      { status: 500 }
    );
  }
}

// GET /api/stripe-connect?accountId=xxx - Get account status and details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const action = searchParams.get("action");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Get login link for Stripe dashboard
    if (action === "login") {
      const loginLink = await createLoginLink(accountId);
      return NextResponse.json({
        success: true,
        loginUrl: loginLink.url,
      });
    }

    // Get balance
    if (action === "balance") {
      const balance = await getAccountBalance(accountId);
      return NextResponse.json({
        success: true,
        balance,
      });
    }

    // Get transfers
    if (action === "transfers") {
      const limit = parseInt(searchParams.get("limit") || "10");
      const transfers = await listTransfers(accountId, limit);
      return NextResponse.json({
        success: true,
        transfers,
      });
    }

    // Get payouts
    if (action === "payouts") {
      const limit = parseInt(searchParams.get("limit") || "10");
      const payouts = await listPayouts(accountId, limit);
      return NextResponse.json({
        success: true,
        payouts,
      });
    }

    // Default: Get account status
    const status = await getConnectAccountStatus(accountId);

    return NextResponse.json({
      success: true,
      account: status,
    });
  } catch (error) {
    console.error("Error getting Stripe Connect status:", error);
    return NextResponse.json(
      { error: "Failed to get account status" },
      { status: 500 }
    );
  }
}

// PATCH /api/stripe-connect - Sync account status from Stripe
// This is called when locksmith returns from onboarding to ensure DB is in sync
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId, accountId } = body;

    if (!locksmithId && !accountId) {
      return NextResponse.json(
        { error: "locksmithId or accountId is required" },
        { status: 400 }
      );
    }

    // Find the locksmith
    let locksmith;
    if (locksmithId) {
      locksmith = await prisma.locksmith.findUnique({
        where: { id: locksmithId },
      });
    } else if (accountId) {
      locksmith = await prisma.locksmith.findFirst({
        where: { stripeConnectId: accountId },
      });
    }

    if (!locksmith) {
      return NextResponse.json(
        { error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (!locksmith.stripeConnectId) {
      return NextResponse.json({
        success: true,
        message: "No Stripe Connect account linked",
        status: {
          hasAccount: false,
          onboarded: false,
          verified: false,
        },
      });
    }

    // Fetch the current account status from Stripe
    console.log(`[Stripe Connect Sync] Fetching status for account ${locksmith.stripeConnectId}`);

    const account = await stripe.accounts.retrieve(locksmith.stripeConnectId);

    const isOnboarded = account.details_submitted === true;
    const isVerified = account.charges_enabled === true && account.payouts_enabled === true;

    console.log(`[Stripe Connect Sync] Account ${locksmith.stripeConnectId} status:`, {
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      capabilities: account.capabilities,
      requirements_due: account.requirements?.currently_due?.length || 0,
      isOnboarded,
      isVerified,
    });

    // Update database if status changed
    const wasOnboarded = locksmith.stripeConnectOnboarded;
    const wasVerified = locksmith.stripeConnectVerified;

    if (wasOnboarded !== isOnboarded || wasVerified !== isVerified) {
      await prisma.locksmith.update({
        where: { id: locksmith.id },
        data: {
          stripeConnectOnboarded: isOnboarded,
          stripeConnectVerified: isVerified,
        },
      });

      console.log(`[Stripe Connect Sync] Updated locksmith ${locksmith.id}:`, {
        onboarded: `${wasOnboarded} -> ${isOnboarded}`,
        verified: `${wasVerified} -> ${isVerified}`,
      });
    } else {
      console.log(`[Stripe Connect Sync] No changes needed for locksmith ${locksmith.id}`);
    }

    return NextResponse.json({
      success: true,
      message: "Account status synced",
      status: {
        hasAccount: true,
        accountId: locksmith.stripeConnectId,
        onboarded: isOnboarded,
        verified: isVerified,
        previousOnboarded: wasOnboarded,
        previousVerified: wasVerified,
        changed: wasOnboarded !== isOnboarded || wasVerified !== isVerified,
        requirements: account.requirements?.currently_due || [],
      },
    });
  } catch (error) {
    console.error("Error syncing Stripe Connect status:", error);
    return NextResponse.json(
      { error: "Failed to sync account status" },
      { status: 500 }
    );
  }
}
