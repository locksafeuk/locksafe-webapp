export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPhoneRequestContinuationEmail } from "@/lib/email";
import { verifyRetellSignature } from "@/lib/retell-auth";
import { sendSMS } from "@/lib/sms";

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
 * Retell AI Custom Tool: Send notification with continue link or payment link
 *
 * Supports two notification types:
 * 1. "continue" (default) - Sends SMS/email with link to complete request
 * 2. "payment" - Sends SMS with payment link (handled by job-service workflow)
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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Retell send-notification] Invalid JSON body:", parseErr);
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

    const {
      job_id,
      customer_id,
      customer_phone,
      customer_email,
      customer_name,
      job_number,
      continue_url,
      notification_type, // "continue" or "payment"
      payment_url, // For payment link notifications
    } = args;

    console.log("[Retell send-notification] Request:", {
      retellCallId: retellCallId || "N/A",
      job_id: job_id || "[missing]",
      customer_id: customer_id || "[missing]",
      notification_type: notification_type || "continue",
    });

    if (!job_id && !customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Job ID or Customer ID is required",
          message: "I need some details to send you the notification.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Get job details if not provided
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://locksafe.uk";
    let jobDetails = { jobNumber: job_number, continueUrl: continue_url };
    if (job_id && (!job_number || !continue_url)) {
      try {
        const job = await prisma.job.findUnique({
          where: { id: job_id },
          select: { jobNumber: true, continueToken: true },
        });
        if (job) {
          jobDetails = {
            jobNumber: job.jobNumber,
            continueUrl: `${baseUrl}/continue-request/${job.continueToken}`,
          };
        }
      } catch (dbErr: any) {
        console.warn(
          `[Retell send-notification] Failed to fetch job: ${dbErr?.message}`
        );
      }
    }

    // Get customer details if not provided
    let customerDetails = {
      name: customer_name || "Customer",
      phone: customer_phone,
      email: customer_email,
    };
    if (customer_id && (!customer_name || (!customer_phone && !customer_email))) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customer_id },
          select: { name: true, phone: true, email: true },
        });
        if (customer) {
          customerDetails = {
            name: customer_name || customer.name,
            phone: customer_phone || customer.phone,
            email: customer_email || customer.email || undefined,
          };
        }
      } catch (dbErr: any) {
        console.warn(
          `[Retell send-notification] Failed to fetch customer: ${dbErr?.message}`
        );
      }
    }

    const notifications: string[] = [];
    const type = notification_type || "continue";

    // Normalize phone for SMS
    let phoneForSms = customerDetails.phone;
    if (phoneForSms && phoneForSms !== "Unknown") {
      phoneForSms = phoneForSms.replace(/[\s\-]/g, "");
      if (phoneForSms.startsWith("0044")) {
        phoneForSms = "+" + phoneForSms.substring(2);
      } else if (
        phoneForSms.startsWith("44") &&
        !phoneForSms.startsWith("+")
      ) {
        phoneForSms = "+" + phoneForSms;
      } else if (phoneForSms.startsWith("0")) {
        phoneForSms = "+44" + phoneForSms.substring(1);
      } else if (!phoneForSms.startsWith("+")) {
        phoneForSms = "+44" + phoneForSms;
      }
    }

    const isValidPhone =
      phoneForSms &&
      phoneForSms !== "Unknown" &&
      phoneForSms.match(/^\+\d{10,15}$/);

    // Send SMS based on notification type
    if (isValidPhone) {
      try {
        let smsMessage: string;

        if (type === "payment" && payment_url) {
          // Payment link SMS
          smsMessage = `LockSafe UK: A locksmith has applied for your job ${jobDetails.jobNumber || ""}. Pay the call-out fee to confirm: ${payment_url}`;
        } else {
          // Standard continue link SMS
          smsMessage = `LockSafe UK: Your emergency request ${jobDetails.jobNumber || "has been"} registered. ${jobDetails.continueUrl ? `Complete your request: ${jobDetails.continueUrl}` : `Visit ${baseUrl} to manage your request.`}`;
        }

        await sendSMS(phoneForSms!, smsMessage, {
          logContext: `Retell notification (${type}): ${jobDetails.jobNumber || "N/A"}`,
        });
        notifications.push("sms");
        console.log(
          `[Retell send-notification] SMS sent to ${phoneForSms} (type: ${type})`
        );
      } catch (smsError) {
        console.error("[Retell send-notification] SMS error:", smsError);
      }
    } else if (!isValidPhone) {
      console.log(
        `[Retell send-notification] Skipping SMS - invalid phone: ${phoneForSms || "none"}`
      );
    }

    // Send email (only for continue-type notifications)
    if (type === "continue" && customerDetails.email) {
      try {
        await sendPhoneRequestContinuationEmail(customerDetails.email, {
          customerName: customerDetails.name,
          jobNumber: jobDetails.jobNumber || "N/A",
          continueUrl: jobDetails.continueUrl || baseUrl,
        });
        notifications.push("email");
        console.log(
          `[Retell send-notification] Email sent to ${customerDetails.email}`
        );
      } catch (emailError) {
        console.error("[Retell send-notification] Email error:", emailError);
      }
    }

    // Build a human-readable message for Sarah
    let notificationMessage: string;
    if (notifications.length === 2) {
      notificationMessage =
        "I've sent you a text message and an email with a link to complete your request.";
    } else if (notifications.includes("sms")) {
      if (type === "payment") {
        notificationMessage =
          "I've sent you a text message with the payment link.";
      } else {
        notificationMessage =
          "I've sent you a text message with a link to complete your request.";
      }
    } else if (notifications.includes("email")) {
      notificationMessage =
        "I've sent you an email with a link to complete your request.";
    } else {
      notificationMessage =
        "Please save your reference number and visit our website to complete your request.";
    }

    console.log(
      `[Retell send-notification] Notifications sent: ${notifications.join(", ") || "none"} (type: ${type}, ${Date.now() - startTime}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        notifications_sent: notifications,
        sms_sent: notifications.includes("sms"),
        email_sent: notifications.includes("email"),
        notification_type: type,
        job_number: jobDetails.jobNumber,
        continue_url: jobDetails.continueUrl,
        message: notificationMessage,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[Retell send-notification] Error:", {
      message: error?.message,
      code: error?.code,
      retellCallId,
      elapsed: `${Date.now() - startTime}ms`,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send notification",
        message:
          "I had a small issue sending the notification, but your request is registered. Please note your reference number.",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
