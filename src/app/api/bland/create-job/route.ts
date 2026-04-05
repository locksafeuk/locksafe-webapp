import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNewJob } from "@/lib/telegram";
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

// Generate unique job number
function generateJobNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `LS-${year}${month}-${random}`;
}

// Generate unique continue token
function generateContinueToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Geocode postcode to coordinates
async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)},UK&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "LockSafe-UK/1.0",
        },
      }
    );
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: Number.parseFloat(data[0].lat),
        lng: Number.parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Bland.ai Custom Tool: Create phone-initiated job
 * Creates a partial job that the customer completes via web
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
    logBlandRequest("create-job", body, authResult);

    const {
      customer_id,
      postcode,
      address,
      service_type,
      property_type,
      urgency,
      description,
      bland_call_id,
    } = body;

    if (!customer_id) {
      console.error("[Bland.ai] No customer_id provided to create-job");
      return NextResponse.json(
        {
          success: false,
          error: "Customer ID is required",
          message: "I need to create your account first before registering the job.",
        },
        { headers: blandCorsHeaders }
      );
    }

    // Validate customer_id is a valid MongoDB ObjectId (24 character hex string)
    const objectIdRegex = /^[a-fA-F0-9]{24}$/;
    if (!objectIdRegex.test(customer_id)) {
      console.error(`[Bland.ai] Invalid customer_id format: ${customer_id}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid customer ID format",
          message: "There was an issue with your account. Let me try creating it again.",
        },
        { headers: blandCorsHeaders }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customer_id },
    });

    if (!customer) {
      console.log(`[Bland.ai] Customer not found: ${customer_id}`);
      return NextResponse.json(
        {
          success: false,
          error: "Customer not found",
          message: "I couldn't find your account. Let me create one for you first.",
        },
        { headers: blandCorsHeaders }
      );
    }

    // Generate tokens
    const jobNumber = generateJobNumber();
    const continueToken = generateContinueToken();

    // Geocode postcode if provided
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
      "locked_out": "lockout",
      "lockout": "lockout",
      "lost_keys": "lost-keys",
      "broken_lock": "broken",
      "lock_change": "lock-change",
      "security_upgrade": "security-upgrade",
      "key_stuck": "key-stuck",
      "burglary": "burglary",
      "other": "other",
    };

    const problemType = problemTypeMap[service_type?.toLowerCase()] || "lockout";

    // Create the job
    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId: customer_id,
        status: "PHONE_INITIATED",
        createdVia: "phone",
        blandCallId: bland_call_id,
        continueToken,
        // Job details (partial - may be completed via web)
        problemType,
        propertyType: property_type || "house",
        postcode: postcode?.toUpperCase() || "",
        address: address || "",
        description: description || `Phone request: ${service_type || "Emergency locksmith"}`,
        assessmentFee: 29.0,
        latitude,
        longitude,
        // Store all phone-collected data
        phoneCollectedData: {
          service_type,
          property_type,
          urgency,
          postcode,
          address,
          description,
          collected_at: new Date().toISOString(),
          bland_call_id,
        },
      },
    });

    // Generate continue URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";
    const continueUrl = `${baseUrl}/continue-request/${continueToken}`;

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
      isUrgent: urgency === "immediate" || service_type?.toLowerCase().includes("lockout"),
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    console.log(`[Bland.ai] Created phone-initiated job: ${jobNumber} (Call: ${bland_call_id})`);

    return NextResponse.json(
      {
        success: true,
        job_id: job.id,
        job_number: jobNumber,
        continue_url: continueUrl,
        continue_token: continueToken,
        message: `I've registered your emergency request. Your reference number is ${jobNumber}.`,
      },
      { headers: blandCorsHeaders }
    );

  } catch (error) {
    console.error("[Bland.ai] Create job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create job",
        message: "I had a technical issue registering your request. Let me try again.",
      },
      { status: 500, headers: blandCorsHeaders }
    );
  }
}
