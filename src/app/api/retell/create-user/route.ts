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
 * Retell AI Custom Tool: Create new user account
 * Ported from Bland.ai create-user endpoint
 *
 * Called during phone call when customer doesn't have an account.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    const verification = verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(rawBody);
    const args = body.args || body;

    const { full_name, phone_number, email, postcode, retell_call_id } = args;

    console.log("[Retell create-user] Request:", {
      name: full_name || "[missing]",
      phone: phone_number ? "[provided]" : "[missing]",
      email: email ? "[provided]" : "[missing]",
    });

    if (!full_name || !phone_number || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Full name, phone number, and email are required",
          missing_fields: {
            full_name: !full_name,
            phone_number: !phone_number,
            email: !email,
          },
          message: "I need your full name, phone number, and email to create your account.",
        },
        { headers: CORS_HEADERS }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid email address",
          message: "That email address doesn't look quite right. Could you spell it out for me?",
        },
        { headers: CORS_HEADERS }
      );
    }

    const normalizedPhone = phone_number.replace(/\s+/g, "");
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already exists
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
      console.log(`[Retell create-user] Found existing customer: ${customer.id}`);
      return NextResponse.json(
        {
          success: true,
          customer_id: customer.id,
          customer_name: customer.name,
          is_new: false,
          message: `I found your existing account, ${customer.name}. Let me continue with your emergency request.`,
        },
        { headers: CORS_HEADERS }
      );
    }

    // Create new customer
    customer = await prisma.customer.create({
      data: {
        name: full_name,
        phone: normalizedPhone,
        email: normalizedEmail,
        createdVia: "phone",
      },
    });

    // Telegram notification (non-blocking)
    notifyNewCustomer({
      name: full_name,
      email: normalizedEmail,
      phone: normalizedPhone,
    }).catch((err) => console.error("Failed to send Telegram notification:", err));

    console.log(`[Retell create-user] Created new customer: ${customer.id} (Call: ${retell_call_id})`);

    return NextResponse.json(
      {
        success: true,
        customer_id: customer.id,
        customer_name: customer.name,
        is_new: true,
        message: `Perfect! I've created your account, ${full_name}. Now let me help you with your emergency.`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Retell create-user] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create user account",
        message: "I had a small technical issue creating your account. Let me try again.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
