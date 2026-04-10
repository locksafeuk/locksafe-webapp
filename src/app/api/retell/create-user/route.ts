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
 * NOTE: The check-user endpoint also auto-creates customers if they don't exist.
 * This endpoint is kept for explicit user creation when the AI agent
 * has already collected all required details and wants to create the account
 * without checking first.
 *
 * Use check-user for: "Look up this customer, create if not found"
 * Use create-user for: "Create this customer account with these details"
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    const verification = verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid && process.env.NODE_ENV === "production") {
      console.error(`[Retell create-user] Auth failed: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(rawBody);
    const args = body.args || body;

    // Retell sends "phone" but legacy code used "phone_number" - accept both
    const phone_number = args.phone || args.phone_number;
    const { full_name, email, postcode, retell_call_id } = args;

    console.log("[Retell create-user] Request:", {
      name: full_name || "[missing]",
      phone: phone_number ? "[provided]" : "[missing]",
      email: email ? "[provided]" : "[missing]",
    });

    if (!full_name || !email) {
      const missingFields: string[] = [];
      if (!full_name) missingFields.push("full name");
      if (!email) missingFields.push("email address");
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          missing_fields: {
            full_name: !full_name,
            email: !email,
            phone: !phone_number,
          },
          message: `I need your ${missingFields.join(" and ")} to create your account.`,
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

    const normalizedEmail = email.toLowerCase().trim();

    // Normalize phone to E.164 for UK
    let normalizedPhone = phone_number
      ? phone_number.replace(/[\s\-]/g, "")
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

    // Check if already exists by email (primary) or phone (fallback)
    let customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (!customer && normalizedPhone !== "Unknown") {
      customer = await prisma.customer.findFirst({
        where: {
          phone: {
            in: [normalizedPhone, phone_number, phone_number?.replace(/\s+/g, "")].filter(Boolean),
          },
        },
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

      console.log(`[Retell create-user] Found existing customer: ${customer.id}`);
      return NextResponse.json(
        {
          success: true,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          is_new: false,
          message: `I found your existing account, ${customer.name}. Let me continue with your request.`,
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
        customer_email: customer.email,
        customer_phone: customer.phone,
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
