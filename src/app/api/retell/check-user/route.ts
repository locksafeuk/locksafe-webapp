export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNewCustomer } from "@/lib/telegram";
import { verifyRetellSignature } from "@/lib/retell-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-retell-signature",
};

// Handle OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Retell AI Custom Tool: Check if user exists, create if not
 *
 * Called during phone call via Retell custom function to
 * check/create customer account in the LockSafe system.
 *
 * Returns onboarding status (passwordSet, locationConfirmed) so
 * Sarah knows whether the customer needs to complete onboarding after payment.
 *
 * Retell sends: { name, args: { phone, email, full_name, ... }, call: { call_id, ... } }
 * OR with "args only" payload: { phone, email, full_name, ... }
 *
 * IMPORTANT: Returns 200 even on logical errors so Retell doesn't retry.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let retellCallId: string | undefined;

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    // Verify Retell signature (skip in development)
    const verification = await verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid && process.env.NODE_ENV === "production") {
      console.error(`[Retell check-user] Auth failed: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Retell check-user] Invalid JSON body:", parseErr);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          message: "I had a technical issue. Let me try again.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Extract Retell call context for logging
    retellCallId = body.call?.call_id || body.retell_call_id;

    // Retell sends tool call args - may be nested under "args" or at top level
    const args = body.args || body;
    // Retell sends "phone" but legacy code used "phone_number" - accept both
    const phone_number = args.phone || args.phone_number;
    const { email, full_name, caller_name, postcode } = args;

    console.log("[Retell check-user] Request:", {
      retellCallId: retellCallId || "N/A",
      email: email ? "[provided]" : "[missing]",
      phone: phone_number ? "[provided]" : "[missing]",
      name: full_name || caller_name || "[missing]",
    });

    // Try to find by phone first (since caller_phone_number is always available)
    let customer: any = null;

    if (phone_number) {
      // Normalize phone for lookup
      let normalizedPhone = phone_number.replace(/[\s\-]/g, "");
      if (normalizedPhone.startsWith("0044")) {
        normalizedPhone = "+" + normalizedPhone.substring(2);
      } else if (
        normalizedPhone.startsWith("44") &&
        !normalizedPhone.startsWith("+")
      ) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "+44" + normalizedPhone.substring(1);
      } else if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+44" + normalizedPhone;
      }

      customer = await prisma.customer.findFirst({
        where: {
          phone: {
            in: [
              normalizedPhone,
              phone_number,
              phone_number.replace(/\s+/g, ""),
            ],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailVerified: true,
          onboardingCompleted: true,
          passwordSet: true,
          locationConfirmed: true,
        },
      });
    }

    // Fallback: check by email
    if (!customer && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.toLowerCase().trim();
      if (emailRegex.test(normalizedEmail)) {
        customer = await prisma.customer.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            emailVerified: true,
            onboardingCompleted: true,
            passwordSet: true,
            locationConfirmed: true,
          },
        });
      }
    }

    if (customer) {
      // Check for active jobs
      const activeJobs = await prisma.job.count({
        where: {
          customerId: customer.id,
          status: {
            in: [
              "PENDING",
              "ACCEPTED",
              "EN_ROUTE",
              "ARRIVED",
              "DIAGNOSING",
              "QUOTED",
              "QUOTE_ACCEPTED",
              "IN_PROGRESS",
              "PENDING_CUSTOMER_CONFIRMATION",
              "PHONE_INITIATED",
            ],
          },
        },
      });

      console.log(
        `[Retell check-user] Found existing customer: ${customer.id} (${Date.now() - startTime}ms)`
      );

      return NextResponse.json(
        {
          success: true,
          exists: true,
          is_new: false,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          email_verified: customer.emailVerified,
          has_active_jobs: activeJobs > 0,
          active_job_count: activeJobs,
          // Onboarding status
          onboarding_completed: customer.onboardingCompleted,
          password_set: customer.passwordSet,
          location_confirmed: customer.locationConfirmed,
          needs_onboarding: !customer.onboardingCompleted,
          message: `Welcome back, ${customer.name}! I can see you already have an account with us.`,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Customer doesn't exist - CREATE NEW
    console.log(
      "[Retell check-user] No existing customer found, creating new account..."
    );

    const customerName = full_name || caller_name || "Phone Customer";

    // Normalize phone to E.164 for UK
    let normalizedPhone = phone_number
      ? phone_number.replace(/[\s\-]/g, "")
      : "";
    if (normalizedPhone) {
      if (normalizedPhone.startsWith("0044")) {
        normalizedPhone = "+" + normalizedPhone.substring(2);
      } else if (
        normalizedPhone.startsWith("44") &&
        !normalizedPhone.startsWith("+")
      ) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "+44" + normalizedPhone.substring(1);
      } else if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+44" + normalizedPhone;
      }
    }
    if (!normalizedPhone) {
      normalizedPhone = "Unknown";
    }

    // Normalize email if provided
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    const createData: any = {
      name: customerName,
      phone: normalizedPhone,
      createdVia: "phone",
      // Onboarding flags start as false - customer completes after payment
      onboardingCompleted: false,
      passwordSet: false,
      locationConfirmed: false,
    };

    // Only set email if provided and valid
    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(normalizedEmail)) {
        createData.email = normalizedEmail;
      }
    }

    const newCustomer = await prisma.customer.create({
      data: createData,
    });

    // Send Telegram notification (non-blocking)
    notifyNewCustomer({
      name: customerName,
      email: normalizedEmail || "Not provided",
      phone: normalizedPhone,
    }).catch((err) =>
      console.error("Failed to send Telegram notification:", err)
    );

    console.log(
      `[Retell check-user] Created new customer via phone: ${newCustomer.id} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        exists: false,
        is_new: true,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_email: newCustomer.email,
        customer_phone: newCustomer.phone,
        // New customers need onboarding
        onboarding_completed: false,
        password_set: false,
        location_confirmed: false,
        needs_onboarding: true,
        message: `I've created your account, ${customerName}. Now let me help you with your emergency.`,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[Retell check-user] Error:", {
      message: error?.message,
      code: error?.code,
      retellCallId,
      elapsed: `${Date.now() - startTime}ms`,
    });

    // Handle specific Prisma errors
    if (error?.code === "P2002") {
      // Unique constraint violation - customer was created between check and create
      return NextResponse.json(
        {
          success: false,
          exists: false,
          error: "Account may already exist",
          message:
            "It looks like an account was just created. Let me check again.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: false,
        exists: false,
        error: "Failed to check customer account",
        message: "I had a small technical issue. Let me try again.",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
