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
 * Ported from Bland.ai check-user endpoint
 *
 * Called during phone call via Retell custom function to
 * check/create customer account in the LockSafe system.
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    // Verify Retell signature (skip in development)
    const verification = verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid && process.env.NODE_ENV === "production") {
      console.error(`[Retell check-user] Auth failed: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(rawBody);

    // Retell sends tool call args - may be nested under "args" or at top level
    const args = body.args || body;
    // Retell sends "phone" but legacy code used "phone_number" - accept both
    const phone_number = args.phone || args.phone_number;
    const { email, full_name, caller_name, postcode } = args;

    console.log("[Retell check-user] Request:", {
      email: email ? "[provided]" : "[missing]",
      phone: phone_number ? "[provided]" : "[missing]",
      name: full_name || caller_name || "[missing]",
    });

    // Email is REQUIRED - primary identifier for customer accounts
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          exists: false,
          error: "Email is required to check for existing account",
          message: "I'll need your email address to check for an existing account.",
        },
        { headers: CORS_HEADERS }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check by email first
    let customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailVerified: true,
      },
    });

    // Fallback: check by phone
    if (!customer && phone_number) {
      const normalizedPhone = phone_number.replace(/\s+/g, "").replace(/^0/, "+44");
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
        },
      });
    }

    if (customer) {
      // Check for active jobs
      const activeJobs = await prisma.job.count({
        where: {
          customerId: customer.id,
          status: {
            in: [
              "PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED",
              "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED",
              "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION",
            ],
          },
        },
      });

      console.log(`[Retell check-user] Found existing customer: ${customer.id}`);

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
          message: `Welcome back, ${customer.name}! I can see you already have an account with us.`,
        },
        { headers: CORS_HEADERS }
      );
    }

    // Customer doesn't exist - CREATE NEW
    console.log("[Retell check-user] No existing customer found, creating new account...");

    const customerName = full_name || caller_name || "Phone Customer";

    // Normalize phone to E.164 for UK
    let normalizedPhone = phone_number
      ? phone_number.replace(/\s+/g, "").replace(/-/g, "")
      : "";
    if (normalizedPhone) {
      if (normalizedPhone.startsWith("0044")) {
        normalizedPhone = "+" + normalizedPhone.substring(2);
      } else if (normalizedPhone.startsWith("44") && !normalizedPhone.startsWith("+")) {
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

    const newCustomer = await prisma.customer.create({
      data: {
        name: customerName,
        phone: normalizedPhone,
        email: normalizedEmail,
        createdVia: "phone",
      },
    });

    // Send Telegram notification (non-blocking)
    notifyNewCustomer({
      name: customerName,
      email: normalizedEmail,
      phone: normalizedPhone,
    }).catch((err) => console.error("Failed to send Telegram notification:", err));

    console.log(`[Retell check-user] Created new customer via phone: ${newCustomer.id}`);

    return NextResponse.json(
      {
        success: true,
        exists: false,
        is_new: true,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_email: newCustomer.email,
        customer_phone: newCustomer.phone,
        message: `Perfect! I've created your account, ${customerName}. Now let me help you with your emergency.`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Retell check-user] Error:", error);
    return NextResponse.json(
      {
        success: false,
        exists: false,
        error: "Failed to check/create user",
        message: "I had a small technical issue. Let me try again.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
