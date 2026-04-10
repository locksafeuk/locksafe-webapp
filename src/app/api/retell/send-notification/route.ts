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
 * Ported from Bland.ai send-notification endpoint
 *
 * Sends SMS and/or email to customer with link to complete their request.
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
        { headers: CORS_HEADERS }
      );
    }

    // Get job details if not provided
    let jobDetails = { jobNumber: job_number, continueUrl: continue_url };
    if (!job_number || !continue_url) {
      const job = await prisma.job.findUnique({
        where: { id: job_id },
        select: { jobNumber: true, continueToken: true },
      });
      if (job) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";
        jobDetails = {
          jobNumber: job.jobNumber,
          continueUrl: `${baseUrl}/continue-request/${job.continueToken}`,
        };
      }
    }

    // Get customer details if not provided
    let customerDetails = {
      name: customer_name,
      phone: customer_phone,
      email: customer_email,
    };
    if (!customer_name || (!customer_phone && !customer_email)) {
      const customer = await prisma.customer.findUnique({
        where: { id: customer_id },
        select: { name: true, phone: true, email: true },
      });
      if (customer) {
        customerDetails = {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || undefined,
        };
      }
    }

    const notifications: string[] = [];

    // Normalize phone for SMS
    let phoneForSms = customerDetails.phone;
    if (phoneForSms && phoneForSms !== "Unknown") {
      phoneForSms = phoneForSms.replace(/\s+/g, "").replace(/-/g, "");
      if (phoneForSms.startsWith("0044")) {
        phoneForSms = "+" + phoneForSms.substring(2);
      } else if (phoneForSms.startsWith("44") && !phoneForSms.startsWith("+")) {
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
          const smsMessage = `LockSafe UK: Your emergency request ${jobDetails.jobNumber} has been registered. Complete your request here: ${jobDetails.continueUrl}`;

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
                To: phoneForSms,
                From: twilioPhoneNumber,
                Body: smsMessage,
              }),
            }
          );

          if (response.ok) {
            notifications.push("sms");
            console.log(`[Retell send-notification] SMS sent to ${phoneForSms}`);
          } else {
            console.error(
              "[Retell send-notification] Failed to send SMS:",
              await response.text()
            );
          }
        }
      } catch (smsError) {
        console.error("[Retell send-notification] SMS error:", smsError);
      }
    }

    // Send email
    if (customerDetails.email) {
      try {
        await sendPhoneRequestContinuationEmail(customerDetails.email, {
          customerName: customerDetails.name,
          jobNumber: jobDetails.jobNumber,
          continueUrl: jobDetails.continueUrl,
        });
        notifications.push("email");
        console.log(
          `[Retell send-notification] Email sent to ${customerDetails.email}`
        );
      } catch (emailError) {
        console.error("[Retell send-notification] Email error:", emailError);
      }
    }

    const notificationsSent = notifications.length > 0;
    const notificationMessage = notificationsSent
      ? `I've sent you ${notifications.join(" and an ")} with a link to complete your request.`
      : "Please save your reference number and visit our website to complete your request.";

    console.log(
      `[Retell send-notification] Notifications sent: ${notifications.join(", ") || "none"}`
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
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Retell send-notification] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send notification",
        message:
          "I had a small issue sending the notification, but your request is registered. Please note your reference number.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
