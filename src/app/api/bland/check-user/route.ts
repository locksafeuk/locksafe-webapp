import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNewCustomer } from "@/lib/telegram";
import {
  verifyBlandWebhook,
  unauthorizedResponse,
  blandCorsHeaders,
  logBlandRequest,
  checkRateLimit,
  getClientIp,
} from "@/lib/bland-auth";

// Handle OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: blandCorsHeaders });
}

/**
 * Bland.ai Custom Tool: Check if user exists, create if not
 * This combines check-user and create-user into a single endpoint
 * Called during phone call to check/create customer account
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again in a moment.",
        },
        { status: 429, headers: blandCorsHeaders }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify authentication
    const authResult = await verifyBlandWebhook(request, rawBody);
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error);
    }

    // Log request
    logBlandRequest("check-user", body, authResult);

    const { phone_number, email, full_name, caller_name, postcode } = body;

    // Email is REQUIRED - it's the primary identifier for customer accounts
    if (!email) {
      console.log("[Bland.ai] Check user: No email provided");
      return NextResponse.json(
        {
          success: false,
          exists: false,
          error: "Email is required to check for existing account",
          message: "I'll need your email address to check for an existing account.",
        },
        { headers: blandCorsHeaders }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Email is the primary identifier - check by email first
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

    // If not found by email and phone_number is provided, check by phone as fallback
    if (!customer && phone_number) {
      const normalizedPhone = phone_number.replace(/\s+/g, "").replace(/^0/, "+44");

      customer = await prisma.customer.findFirst({
        where: {
          phone: {
            in: [
              normalizedPhone,
              phone_number,
              phone_number.replace(/\s+/g, ""),
            ]
          }
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
      // Check for any active jobs
      const activeJobs = await prisma.job.count({
        where: {
          customerId: customer.id,
          status: {
            in: ["PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION"],
          },
        },
      });

      console.log(`[Bland.ai] Found existing customer: ${customer.id}`);

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
        { headers: blandCorsHeaders }
      );
    }

    // Customer doesn't exist - CREATE NEW CUSTOMER
    console.log("[Bland.ai] No existing customer found, creating new account...");

    // Get the name from either full_name or caller_name
    const customerName = full_name || caller_name || "Phone Customer";

    // Normalize phone number to E.164 format for UK (+447xxxxxxxxx)
    let normalizedPhone = phone_number ? phone_number.replace(/\s+/g, "").replace(/-/g, "") : "";
    if (normalizedPhone) {
      // Remove leading zeros and add +44 prefix for UK numbers
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

    console.log(`[Bland.ai] Phone normalization: "${phone_number}" -> "${normalizedPhone}"`);

    // Note: We no longer return early for missing name - we create with a default
    // This ensures the pathway always gets a customer_id back

    // Create new customer
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
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    console.log(`[Bland.ai] Created new customer via phone: ${newCustomer.id}`);

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
      { headers: blandCorsHeaders }
    );

  } catch (error) {
    console.error("[Bland.ai] Check user error:", error);
    return NextResponse.json(
      {
        success: false,
        exists: false,
        error: "Failed to check/create user",
        message: "I had a small technical issue. Let me try again.",
      },
      { status: 500, headers: blandCorsHeaders }
    );
  }
}
