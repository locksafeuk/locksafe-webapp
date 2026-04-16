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
 * Bland.ai Custom Tool: Create new user account
 * Called during phone call when customer doesn't have an account
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
    logBlandRequest("create-user", body, authResult);

    const {
      full_name,
      phone_number,
      email,
      postcode,
      bland_call_id,
    } = body;

    if (!full_name || !phone_number || !email) {
      console.log("[Bland.ai] Create user: Missing required fields");
      return NextResponse.json(
        {
          success: false,
          error: "Full name, phone number, and email are required for account creation",
          missing_fields: {
            full_name: !full_name,
            phone_number: !phone_number,
            email: !email,
          },
          message: "I need your full name, phone number, and email to create your account.",
        },
        { headers: blandCorsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid email address",
          message: "That email address doesn't look quite right. Could you spell it out for me?",
        },
        { headers: blandCorsHeaders }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone_number.replace(/\s+/g, "");
    const normalizedEmail = email.toLowerCase().trim();

    // Check if customer already exists
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: phone_number },
          { email: normalizedEmail },
        ],
      },
    });

    if (customer) {
      console.log(`[Bland.ai] Found existing customer: ${customer.id}`);
      // Customer exists, return their info
      return NextResponse.json(
        {
          success: true,
          customer_id: customer.id,
          customer_name: customer.name,
          is_new: false,
          message: `I found your existing account, ${customer.name}. Let me continue with your emergency request.`,
        },
        { headers: blandCorsHeaders }
      );
    }

    // Create new customer
    customer = await prisma.customer.create({
      data: {
        name: full_name,
        phone: normalizedPhone,
        email: normalizedEmail,
        createdVia: "phone",
        // No password - they'll set one when completing the request online
      },
    });

    // Send Telegram notification (non-blocking)
    notifyNewCustomer({
      name: full_name,
      email: normalizedEmail,
      phone: normalizedPhone,
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    console.log(`[Bland.ai] Created new customer via phone: ${customer.id} (Call: ${bland_call_id})`);

    return NextResponse.json(
      {
        success: true,
        customer_id: customer.id,
        customer_name: customer.name,
        is_new: true,
        message: `Perfect! I've created your account, ${full_name}. Now let me help you with your emergency.`,
      },
      { headers: blandCorsHeaders }
    );

  } catch (error) {
    console.error("[Bland.ai] Create user error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create user account",
        message: "I had a small technical issue creating your account. Let me try again.",
      },
      { status: 500, headers: blandCorsHeaders }
    );
  }
}
