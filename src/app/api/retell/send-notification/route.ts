export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPhoneRequestContinuationEmail } from "@/lib/email";
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
 * Retell AI Custom Tool: Send notification with continue link
 *
 * Sends SMS and/or email to customer with link to complete their request.
 *
 * IMPORTANT: Returns 200 even on logical errors so Retell doesn't retry.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let retellCallId: string | undefined;

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
    } = args;

    console.log("[Retell send-notification] Request:", {
      retellCallId: retellCallId || "N/A",
      job_id: job_id || "[missing]",
      customer_id: customer_id || "[missing]",
    });

    if (!job_id || !customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Job ID and Customer ID are required",
          message: "I need the job details to send you the notification.",
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
    if (!job_number || !continue_url) {
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
    if (!customer_name || (!customer_phone && !customer_email)) {
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

    // Send SMS via Twilio
    const isValidPhone =
      phoneForSms &&
      phoneForSms !== "Unknown" &&
      phoneForSms.match(/^\+\d{10,15}$/);
    if (isValidPhone && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
          const smsMessage = `LockSafe UK: Your emergency request ${jobDetails.jobNumber || "has been"} registered. Complete your request here: ${jobDetails.continueUrl || baseUrl}`;

          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                  `${twilioAccountSid}:${twilioAuthToken}`
                ).toString("base64")}`,
              },
              body: new URLSearchParams({
                To: phoneForSms!,
                From: twilioPhoneNumber,
                Body: smsMessage,
              }),
            }
          );

          if (response.ok) {
            notifications.push("sms");
            console.log(
              `[Retell send-notification] SMS sent to ${phoneForSms}`
            );
          } else {
            const errBody = await response.text();
            console.error(
              `[Retell send-notification] Twilio SMS failed (${response.status}):`,
              errBody
            );
          }
        }
      } catch (smsError) {
        console.error("[Retell send-notification] SMS error:", smsError);
      }
    } else if (!isValidPhone) {
      console.log(
        `[Retell send-notification] Skipping SMS - invalid phone: ${phoneForSms || "none"}`
      );
    }

    // Send email
    if (customerDetails.email) {
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
    } else {
      console.log(
        "[Retell send-notification] Skipping email - no email address"
      );
    }

    const notificationsSent = notifications.length > 0;
    // Build a human-readable message
    let notificationMessage: string;
    if (notifications.length === 2) {
      notificationMessage =
        "I've sent you a text message and an email with a link to complete your request.";
    } else if (notifications.includes("sms")) {
      notificationMessage =
        "I've sent you a text message with a link to complete your request.";
    } else if (notifications.includes("email")) {
      notificationMessage =
        "I've sent you an email with a link to complete your request.";
    } else {
      notificationMessage =
        "Please save your reference number and visit our website to complete your request.";
    }

    console.log(
      `[Retell send-notification] Notifications sent: ${notifications.join(", ") || "none"} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        notifications_sent: notifications,
        sms_sent: notifications.includes("sms"),
        email_sent: notifications.includes("email"),
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
