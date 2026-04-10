export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNewJob } from "@/lib/telegram";
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

// Generate unique job number
function generateJobNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `LS-${year}${month}-${random}`;
}

// Generate unique continue token
function generateContinueToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Geocode postcode to coordinates
async function geocodePostcode(
  postcode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        postcode
      )},UK&format=json&limit=1`,
      {
        headers: { "User-Agent": "LockSafe-UK/1.0" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: Number.parseFloat(data[0].lat),
        lng: Number.parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error("[Retell create-job] Geocoding error:", error);
    return null;
  }
}

/**
 * Retell AI Custom Tool: Create phone-initiated job
 *
 * Creates a partial job that the customer completes via web.
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

    const {
      customer_id,
      postcode,
      address,
      service_type,
      property_type,
      urgency,
      description,
    } = args;
    // Accept retell_call_id from args too (for backward compat)
    retellCallId = retellCallId || args.retell_call_id;

    console.log("[Retell create-job] Request:", {
      retellCallId: retellCallId || "N/A",
      customer_id: customer_id || "[missing]",
      postcode: postcode || "[missing]",
      service_type: service_type || "[missing]",
      urgency: urgency || "[missing]",
    });

    if (!customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer ID is required",
          message:
            "I need to create your account first before registering the job.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Verify customer exists (catch invalid ID format gracefully)
    let customer;
    try {
      customer = await prisma.customer.findUnique({
        where: { id: customer_id },
      });
    } catch (findErr: any) {
      console.error(
        `[Retell create-job] Invalid customer_id "${customer_id}":`,
        findErr?.message
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid customer ID format",
          message:
            "There was an issue with your account. Let me try creating it again.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer not found",
          message:
            "I couldn't find your account. Let me create one for you first.",
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Generate tokens
    const jobNumber = generateJobNumber();
    const continueToken = generateContinueToken();

    // Geocode postcode (non-blocking-ish, with timeout)
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (postcode) {
      const coords = await geocodePostcode(postcode);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
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
      problemTypeMap[service_type?.toLowerCase()] || "lockout";

    // Determine pricing based on urgency
    const isEmergency =
      urgency === "immediate" ||
      urgency === "emergency" ||
      service_type?.toLowerCase().includes("lockout") ||
      service_type?.toLowerCase().includes("burglary");
    const assessmentFee = isEmergency ? 89.0 : 65.0;

    // Create the job
    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId: customer_id,
        status: "PHONE_INITIATED",
        createdVia: "phone",
        blandCallId: retellCallId || null, // Re-using blandCallId field for Retell call ID
        continueToken,
        problemType,
        propertyType: property_type || "house",
        postcode: postcode?.toUpperCase() || "",
        address: address || "",
        description:
          description ||
          `Phone request: ${service_type || "Emergency locksmith"}`,
        assessmentFee,
        latitude,
        longitude,
        phoneCollectedData: {
          service_type: service_type || null,
          property_type: property_type || null,
          urgency: urgency || null,
          postcode: postcode || null,
          address: address || null,
          description: description || null,
          collected_at: new Date().toISOString(),
          retell_call_id: retellCallId || null,
          source: "retell_ai",
        },
      },
    });

    // Generate continue URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://locksafe.uk";
    const continueUrl = `${baseUrl}/continue-request/${continueToken}`;

    // Link to VoiceCall record if exists
    if (retellCallId) {
      await prisma.voiceCall
        .update({
          where: { retellCallId },
          data: {
            jobId: job.id,
            customerId: customer.id,
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
      jobNumber: job.jobNumber,
      jobId: job.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode || "Not provided",
      address: job.address || "Not provided",
      description: job.description,
      isUrgent:
        urgency === "immediate" ||
        service_type?.toLowerCase().includes("lockout"),
    }).catch((err) =>
      console.error("Failed to send Telegram notification:", err)
    );

    console.log(
      `[Retell create-job] Created phone-initiated job: ${jobNumber} (Call: ${retellCallId}, ${Date.now() - startTime}ms)`
    );

    return NextResponse.json(
      {
        success: true,
        job_id: job.id,
        job_number: jobNumber,
        continue_url: continueUrl,
        continue_token: continueToken,
        assessment_fee: assessmentFee,
        is_emergency: isEmergency,
        message: `I've registered your ${isEmergency ? "emergency" : "scheduled"} request. Your reference number is ${jobNumber}. The assessment fee will be £${assessmentFee}.`,
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
