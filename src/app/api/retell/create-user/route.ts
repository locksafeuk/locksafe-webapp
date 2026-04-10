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

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Retell AI Custom Tool: Create new user account (explicit creation)
 *
 * Use check-user for: "Look up this customer, create if not found"
 * Use create-user for: "Create this customer account with these details"
 *
 * Sets onboarding flags to false initially - customer completes onboarding
 * after payment via the web portal.
 *
 * IMPORTANT: Returns 200 even on logical errors so Retell doesn't retry.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let retellCallId: string | undefined;

  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    const verification = await verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid && process.env.NODE_ENV === "production") {
      console.error(`[Retell create-user] Auth failed: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Retell create-user] Invalid JSON body:", parseErr);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          message: "I had a technical issue. Let me try again.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Extract Retell call context
    retellCallId = body.call?.call_id || body.retell_call_id;
    const args = body.args || body;

    // Retell sends "phone" but legacy code used "phone_number" - accept both
    const phone_number = args.phone || args.phone_number;
    const { full_name, email, postcode } = args;

    console.log("[Retell create-user] Request:", {
      retellCallId: retellCallId || "N/A",
      name: full_name || "[missing]",
      phone: phone_number ? "[provided]" : "[missing]",
      email: email ? "[provided]" : "[missing]",
    });

    if (!full_name) {
      return NextResponse.json(
        {
          success: false,
          error: "Full name is required",
          missing_fields: {
            full_name: true,
            email: !email,
            phone: !phone_number,
          },
          message: "I need your full name to create your account.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Normalize email if provided
    let normalizedEmail: string | undefined;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = email.toLowerCase().trim();
      normalizedEmail = trimmedEmail;
      if (!emailRegex.test(trimmedEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid email address",
            message:
              "That email address doesn't look quite right. Could you spell it out for me?",
          },
          { status: 200, headers: CORS_HEADERS }
        );
      }
    }

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

    // Check if already exists by phone (primary) or email (fallback)
    let customer: any = null;

    if (normalizedPhone !== "Unknown") {
      customer = await prisma.customer.findFirst({
        where: {
          phone: {
            in: [
              normalizedPhone,
              phone_number,
              phone_number?.replace(/\s+/g, ""),
            ].filter(Boolean),
          },
        },
      });
    }

    if (!customer && normalizedEmail) {
      customer = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
      });
    }

    if (customer) {
      // Update name if it was a placeholder
      if (customer.name === "Phone Customer" && full_name) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { name: full_name },
        });
        customer.name = full_name;
      }

      console.log(
        `[Retell create-user] Found existing customer: ${customer.id} (${Date.now() - startTime}ms)`
      );
      return NextResponse.json(
        {
          success: true,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          is_new: false,
          onboarding_completed: customer.onboardingCompleted || false,
          password_set: customer.passwordSet || false,
          location_confirmed: customer.locationConfirmed || false,
          needs_onboarding: !(customer.onboardingCompleted),
          message: `I found your existing account, ${customer.name}. Let me continue with your request.`,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Create new customer with onboarding flags set to false
    customer = await prisma.customer.create({
      data: {
        name: full_name,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        createdVia: "phone",
        // Onboarding flags - all false initially
        onboardingCompleted: false,
        passwordSet: false,
        locationConfirmed: false,
      },
    });

    // Telegram notification (non-blocking)
    notifyNewCustomer({
      name: full_name,
      email: normalizedEmail || "Not provided",
      phone: normalizedPhone,
    }).catch((err) =>
      console.error("Failed to send Telegram notification:", err)
    );

    console.log(
      `[Retell create-user] Created new customer: ${customer.id} (Call: ${retellCallId}, ${Date.now() - startTime}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        is_new: true,
        onboarding_completed: false,
        password_set: false,
        location_confirmed: false,
        needs_onboarding: true,
        message: `I've created your account, ${full_name}. Now let me help you with your emergency.`,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[Retell create-user] Error:", {
      message: error?.message,
      code: error?.code,
      retellCallId,
      elapsed: `${Date.now() - startTime}ms`,
    });

    // Handle Prisma unique constraint violation
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "An account already exists with those details",
          message:
            "It looks like an account already exists. Let me look it up for you.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create account",
        message:
          "I had a small technical issue creating your account. Let me try again.",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
