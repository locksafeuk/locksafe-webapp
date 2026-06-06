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
 * WORKFLOW (no customerId required):
 * 1. Extract customer info from args OR Retell call context (caller_phone_number)
 * 2. createEmergencyJob handles find-or-create customer by phone
 * 3. Automatically finds and notifies nearby locksmiths
 * 4. Sends customer SMS confirmation
 * 5. Returns job reference and notification status for Sarah to relay
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

    // ─── Extract Retell call context ───
    retellCallId = body.call?.call_id || body.retell_call_id;
    const args = body.args || body;
    retellCallId = retellCallId || args.retell_call_id;

    // Retell provides caller_phone_number in the call object
    const callerPhoneFromRetell =
      body.call?.from_number ||
      body.call?.caller_phone_number ||
      args.caller_phone_number;

    const customer_id = args.customer_id || args.customerId;
    const customer_phone = args.customer_phone || args.customerPhone;
    const customer_name = args.customer_name || args.customerName;
    const customer_email = args.customer_email || args.customerEmail;
    const postcode = args.postcode;
    const address = args.address;
    const exact_location = args.exact_location || args.exactLocation;
    const service_type = args.service_type || args.serviceType;
    const property_type = args.property_type || args.propertyType;
    const urgency = args.urgency;
    const description = args.description;
    const emergency_details = args.emergency_details || args.emergencyDetails;

    console.log("[Retell create-job] Request:", {
      retellCallId: retellCallId || "N/A",
      customer_id: customer_id || "[none]",
      customer_phone: customer_phone || "[none]",
      callerPhoneFromRetell: callerPhoneFromRetell || "[none]",
      customer_name: customer_name || "[none]",
      postcode: postcode || "[missing]",
      service_type: service_type || "[missing]",
      urgency: urgency || "[missing]",
    });

    // ─── Validate required fields ───
    if (!postcode) {
      return NextResponse.json(
        {
          success: false,
          error: "Postcode is required",
          missing_fields: ["postcode"],
          fallback_action: "ask_caller",
          message:
            "I need your postcode to find locksmiths near you. Could you please tell me your postcode?",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ─── Resolve customer details ───
    // Priority: explicit args > Retell call context > customer_id lookup
    let customerPhone = customer_phone || callerPhoneFromRetell;
    let customerName = customer_name?.trim() || "";
    let customerEmail = customer_email;

    // If we have a customer_id, try to enrich missing fields from DB
    if (customer_id) {
      try {
        const existingCustomer = await prisma.customer.findUnique({
          where: { id: customer_id },
          select: { name: true, phone: true, email: true },
        });
        if (existingCustomer) {
          customerPhone = customerPhone || existingCustomer.phone;
          customerName =
            customer_name?.trim() || existingCustomer.name || customerName;
          customerEmail = customerEmail || existingCustomer.email || undefined;
          console.log(
            `[Retell create-job] Enriched from customer_id ${customer_id}: phone=${customerPhone}`
          );
        }
      } catch (err: any) {
        console.warn(
          `[Retell create-job] Could not look up customer ${customer_id}: ${err?.message}`
        );
        // Non-fatal — continue with what we have
      }
    }

    // If still no phone, try to find from VoiceCall record
    if (!customerPhone && retellCallId) {
      try {
        const voiceCall = await prisma.voiceCall.findUnique({
          where: { retellCallId },
          select: { callerPhone: true, customerId: true },
        });
        if (voiceCall?.callerPhone) {
          customerPhone = voiceCall.callerPhone;
          console.log(
            `[Retell create-job] Got phone from VoiceCall: ${customerPhone}`
          );
        }
      } catch (err: any) {
        console.warn(
          `[Retell create-job] Could not look up VoiceCall: ${err?.message}`
        );
      }
    }

    if (!customerPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer phone is required",
          missing_fields: ["customer_phone"],
          fallback_action: "ask_caller",
          message:
            "I need your phone number to register the job. Could you confirm your phone number?",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (!customerName || customerName === "Phone Customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customer name is required",
          missing_fields: ["customer_name"],
          fallback_action: "ask_caller",
          message:
            "Could you please tell me your full name before I register this job?",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ─── Map service type to problem type ───
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

    // ─── Build emergency job input ───
    // createEmergencyJob handles find-or-create customer internally
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

    // ─── Create the job ───
    const result = await createEmergencyJob(jobInput);

    if (!result.success || !result.job) {
      console.error(
        `[Retell create-job] Job creation failed: ${result.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create job",
          retryable: false,
          fallback_action: "handoff_human",
          message:
            "A specialist will call you straight back on the number we have. Thank you.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ─── Link to VoiceCall record (non-blocking) ───
    if (retellCallId) {
      prisma.voiceCall
        .update({
          where: { retellCallId },
          data: {
            jobId: result.job.id,
            customerId: result.customer?.id,
            outcome: result.dedup?.reusedExistingJob ? "job_reused" : "job_created",
          },
        })
        .catch((err: any) =>
          console.warn(
            `[Retell create-job] Could not link VoiceCall: ${err?.message}`
          )
        );
    }

    // ─── Send Telegram notification (non-blocking) ───
    if (!result.dedup?.reusedExistingJob) {
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
          description ||
          `Phone request: ${service_type || "Emergency locksmith"}`,
        isUrgent:
          urgency === "immediate" ||
          service_type?.toLowerCase()?.includes("lockout"),
      }).catch((err) =>
        console.error("Failed to send Telegram notification:", err)
      );
    }

    // ─── Build response for Sarah ───
    const notifiedCount = result.notifications?.notifiedCount || 0;
    let notificationStatus: string;
    if (result.dedup?.reusedExistingJob) {
      notificationStatus =
        "Your existing request has been updated with the latest details.";
    } else if (notifiedCount > 0) {
      notificationStatus = `${notifiedCount} nearby locksmith${notifiedCount > 1 ? "s have" : " has"} been notified and will respond shortly.`;
    } else {
      notificationStatus =
        "We're working on finding available locksmiths in your area.";
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Retell create-job] ✅ ${result.dedup?.reusedExistingJob ? "Reused" : "Created"} emergency job: ${result.job.jobNumber} | Customer: ${result.customer?.name} (${result.customer?.isNew ? "NEW" : "existing"}) | Notified: ${notifiedCount} locksmiths (${elapsed}ms)`
    );

    if (result.dedup?.reusedExistingJob) {
      console.log("[Retell create-job] Dedup merge details", {
        jobId: result.job.id,
        jobNumber: result.job.jobNumber,
        mergeReason: result.dedup.mergeReason,
        updatedFields: result.dedup.updatedFields || [],
      });
    }

    // SMS is queued (fire-and-forget) inside createEmergencyJob whenever a
    // customer phone is present. We treat that as "queued" for the prompt.
    const smsSent = Boolean(result.customer?.id && customerPhone);

    return NextResponse.json(
      {
        success: true,
        job_id: result.job.id,
        job_number: result.job.jobNumber,
        continue_url: result.job.continueUrl,
        job_status: result.job.status,
        customer_id: result.customer?.id,
        customer_name: result.customer?.name,
        customer_is_new: result.customer?.isNew || false,
        job_reused: result.dedup?.reusedExistingJob || false,
        dedup_reason: result.dedup?.mergeReason,
        dedup_updated_fields: result.dedup?.updatedFields || [],
        locksmiths_notified: notifiedCount,
        notification_status: notificationStatus,
        sms_sent: smsSent,
        message: `Job created successfully. Your reference number is ${result.job.jobNumber}. ${notificationStatus}${smsSent ? " You'll receive a text message when a locksmith applies for your job." : ""}`,
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
        retryable: false,
        fallback_action: "handoff_human",
        message:
          "I had a technical issue registering this automatically. Please keep the details already captured, avoid re-asking the same callback number, and hand this to a human agent now.",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
