export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyRetellSignature } from "@/lib/retell-auth";
import { createEmergencyJob, type EmergencyJobInput } from "@/lib/job-service";
import prisma from "@/lib/db";
import { notifyNewJob } from "@/lib/telegram";

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
 * Retell AI Custom Tool: Create emergency job and notify locksmiths
 *
 * NEW WORKFLOW:
 * 1. Uses createEmergencyJob from job-service
 * 2. Automatically finds and notifies nearby locksmiths
 * 3. Sends customer SMS confirmation
 * 4. Returns job reference and notification status for Sarah to relay
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
      console.error("[Retell create-job] Invalid JSON body:", parseErr);
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
    retellCallId = retellCallId || args.retell_call_id;

    const {
      customer_id,
      customer_phone,
      customer_name,
      customer_email,
      postcode,
      address,
      exact_location,
      service_type,
      property_type,
      urgency,
      description,
      emergency_details,
    } = args;

    console.log("[Retell create-job] Request:", {
      retellCallId: retellCallId || "N/A",
      customer_id: customer_id || "[missing]",
      postcode: postcode || "[missing]",
      service_type: service_type || "[missing]",
      urgency: urgency || "[missing]",
    });

    // Validate required fields
    if (!postcode) {
      return NextResponse.json(
        {
          success: false,
          error: "Postcode is required",
          message:
            "I need your postcode to find locksmiths near you. Could you please tell me your postcode?",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // If we have a customer_id, look up their details
    let customerPhone = customer_phone;
    let customerName = customer_name || "Phone Customer";
    let customerEmail = customer_email;

    if (customer_id && (!customerPhone || !customerName)) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customer_id },
          select: { name: true, phone: true, email: true },
        });
        if (customer) {
          customerPhone = customerPhone || customer.phone;
          customerName = customer_name || customer.name;
          customerEmail = customerEmail || customer.email || undefined;
        }
      } catch (err: any) {
        console.warn(
          `[Retell create-job] Could not look up customer ${customer_id}: ${err?.message}`
        );
      }
    }

    if (!customerPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer phone is required",
          message:
            "I need your phone number to register the job. Could you confirm your phone number?",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Map service type to problem type
    const problemTypeMap: Record<string, string> = {
      locked_out: "lockout",
      lockout: "lockout",
      lost_keys: "lost-keys",
      broken_lock: "broken",
      lock_change: "lock-change",
      security_upgrade: "security-upgrade",
      key_stuck: "key-stuck",
      burglary: "burglary",
      other: "other",
    };

    const problemType =
      problemTypeMap[service_type?.toLowerCase()] || service_type || "lockout";

    // Build emergency job input
    const jobInput: EmergencyJobInput = {
      customerPhone,
      customerName,
      customerEmail,
      postcode: postcode.toUpperCase(),
      address: address || postcode,
      exactLocation: exact_location,
      problemType,
      propertyType: property_type || "house",
      emergencyDetails: emergency_details || description,
      description:
        description ||
        `Phone request: ${service_type || "Emergency locksmith"}`,
      createdVia: "retell_ai",
      retellCallId: retellCallId || undefined,
    };

    // Use the new emergency job service
    const result = await createEmergencyJob(jobInput);

    if (!result.success || !result.job) {
      console.error(
        `[Retell create-job] Job creation failed: ${result.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create job",
          message:
            "I had a technical issue registering your request. Let me try again.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Link to VoiceCall record if exists
    if (retellCallId) {
      await prisma.voiceCall
        .update({
          where: { retellCallId },
          data: {
            jobId: result.job.id,
            customerId: result.customer?.id,
            outcome: "job_created",
          },
        })
        .catch((err: any) =>
          console.warn(
            `[Retell create-job] Could not link VoiceCall: ${err?.message}`
          )
        );
    }

    // Send Telegram notification (non-blocking)
    notifyNewJob({
      jobNumber: result.job.jobNumber,
      jobId: result.job.id,
      customerName: result.customer?.name || customerName,
      customerPhone,
      problemType,
      propertyType: property_type || "house",
      postcode: postcode?.toUpperCase() || "Not provided",
      address: address || "Not provided",
      description:
        description || `Phone request: ${service_type || "Emergency locksmith"}`,
      isUrgent:
        urgency === "immediate" ||
        service_type?.toLowerCase()?.includes("lockout"),
    }).catch((err) =>
      console.error("Failed to send Telegram notification:", err)
    );

    // Build response message for Sarah
    const notifiedCount = result.notifications?.notifiedCount || 0;
    let notificationStatus: string;
    if (notifiedCount > 0) {
      notificationStatus = `${notifiedCount} nearby locksmith${notifiedCount > 1 ? "s have" : " has"} been notified and will respond shortly.`;
    } else {
      notificationStatus =
        "We're working on finding available locksmiths in your area.";
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Retell create-job] Created emergency job: ${result.job.jobNumber} | Notified: ${notifiedCount} locksmiths (${elapsed}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        job_id: result.job.id,
        job_number: result.job.jobNumber,
        job_status: result.job.status,
        customer_id: result.customer?.id,
        customer_is_new: result.customer?.isNew || false,
        locksmiths_notified: notifiedCount,
        notification_status: notificationStatus,
        message: `Job created successfully. Your reference number is ${result.job.jobNumber}. ${notificationStatus} You'll receive a text message when a locksmith applies for your job.`,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[Retell create-job] Error:", {
      message: error?.message,
      code: error?.code,
      retellCallId,
      elapsed: `${Date.now() - startTime}ms`,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create job",
        message:
          "I had a technical issue registering your request. Let me try again.",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
