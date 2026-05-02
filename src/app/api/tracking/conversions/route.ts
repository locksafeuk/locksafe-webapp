import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";

// Environment variables
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;
const META_TEST_CODE = process.env.META_PIXEL_TEST_CODE; // For testing

// Hash function for PII (required by Meta)
function hashSHA256(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

// Map our event types to Meta standard events
function mapToMetaEvent(eventType: string): string {
  const eventMap: Record<string, string> = {
    lead: "Lead",
    postcode_entered: "Lead",
    view_content: "ViewContent",
    form_started: "ViewContent",
    quote_received: "AddToCart",
    quote_accepted: "InitiateCheckout",
    assessment_paid: "InitiateCheckout",
    begin_checkout: "InitiateCheckout",
    purchase: "Purchase",
    job_completed: "Purchase",
    customer_signup: "CompleteRegistration",
    locksmith_signup: "CompleteRegistration",
    // Custom events remain as-is
    form_abandoned: "FormAbandoned",
    quote_declined: "QuoteDeclined",
    job_cancelled: "JobCancelled",
    locksmith_applied: "LocksmithApplied",
    review_submitted: "ReviewSubmitted",
    exit_intent: "ExitIntent",
    lead_magnet_download: "LeadMagnetDownload",
  };

  return eventMap[eventType] || eventType;
}

// Send event to Meta Conversions API
async function sendToMetaConversionsAPI(
  eventName: string,
  eventData: Record<string, unknown>,
  eventId: string,
  userData: {
    clientIpAddress?: string;
    clientUserAgent?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    fbp?: string; // Facebook browser ID
    fbc?: string; // Facebook click ID
  },
  sourceUrl: string
): Promise<boolean> {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.log("Meta Conversions API not configured");
    return false;
  }

  const metaEventName = mapToMetaEvent(eventName);
  const isCustomEvent = ![
    "Lead",
    "ViewContent",
    "AddToCart",
    "InitiateCheckout",
    "Purchase",
    "CompleteRegistration",
  ].includes(metaEventName);

  // Build user data with hashed PII
  const userDataPayload: Record<string, string | undefined> = {
    client_ip_address: userData.clientIpAddress,
    client_user_agent: userData.clientUserAgent,
  };

  if (userData.email) {
    userDataPayload.em = hashSHA256(userData.email);
  }
  if (userData.phone) {
    // Remove non-numeric characters and hash
    const cleanPhone = userData.phone.replace(/\D/g, "");
    userDataPayload.ph = hashSHA256(cleanPhone);
  }
  if (userData.firstName) {
    userDataPayload.fn = hashSHA256(userData.firstName);
  }
  if (userData.lastName) {
    userDataPayload.ln = hashSHA256(userData.lastName);
  }
  if (userData.fbp) {
    userDataPayload.fbp = userData.fbp;
  }
  if (userData.fbc) {
    userDataPayload.fbc = userData.fbc;
  }

  // Build event payload
  const eventPayload: Record<string, unknown> = {
    event_name: metaEventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: sourceUrl,
    action_source: "website",
    user_data: userDataPayload,
  };

  // Add custom data
  const customData: Record<string, unknown> = {};

  if (eventData.value !== undefined && eventData.value !== null) {
    customData.value = eventData.value;
    customData.currency = eventData.currency || "GBP";
  }

  // Catalog content_ids: explicit `contentIds` from caller wins; otherwise
  // fall back to `jobId` so legacy callers keep working. content_type
  // defaults to 'product' (matches Meta dynamic-ads expectation).
  const explicitContentIds = Array.isArray(eventData.contentIds)
    ? (eventData.contentIds as unknown[]).filter((v): v is string => typeof v === "string")
    : undefined;

  if (explicitContentIds && explicitContentIds.length > 0) {
    customData.content_ids = explicitContentIds;
    customData.content_type = (eventData.contentType as string) || "product";
  } else if (eventData.jobId) {
    customData.content_ids = [eventData.jobId];
    customData.content_type = (eventData.contentType as string) || "product";
  }

  if (eventData.contentName) {
    customData.content_name = eventData.contentName;
  }

  if (eventData.contentCategory) {
    customData.content_category = eventData.contentCategory;
  }

  if (eventData.jobNumber) {
    customData.order_id = eventData.jobNumber;
  }

  if (eventData.postcode) {
    customData.postcode = eventData.postcode;
  }

  if (Object.keys(customData).length > 0) {
    eventPayload.custom_data = customData;
  }

  // Send to Meta
  const url = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`;

  const body: Record<string, unknown> = {
    data: [eventPayload],
    access_token: META_ACCESS_TOKEN,
  };

  // Add test code if in test mode
  if (META_TEST_CODE) {
    body.test_event_code = META_TEST_CODE;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta Conversions API error:", result);
      return false;
    }

    console.log("Meta Conversions API success:", {
      event: metaEventName,
      eventId,
      isCustomEvent,
    });

    return true;
  } catch (error) {
    console.error("Meta Conversions API request failed:", error);
    return false;
  }
}

// Store conversion event in database for attribution
async function storeConversionEvent(
  eventName: string,
  eventData: Record<string, unknown>,
  eventId: string,
  sourceUrl: string,
  userAgent: string,
  ipAddress: string
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: `conversion_${eventName}`,
        data: {
          ...eventData,
          eventId,
          sourceUrl,
          platforms: ["meta", "google", "microsoft"],
          timestamp: new Date().toISOString(),
        },
        sessionId: eventData.sessionId as string | undefined,
        userId: (eventData.userId || eventData.customerId || eventData.locksmithId) as string | undefined,
        userType: eventData.userType as string | undefined,
      },
    });
  } catch (error) {
    console.error("Failed to store conversion event:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventName, eventData, eventId, sourceUrl, userAgent } = body;

    if (!eventName || !eventId) {
      return NextResponse.json(
        { error: "Missing required fields: eventName and eventId" },
        { status: 400 }
      );
    }

    // Get IP address from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || "unknown";

    // Get Facebook cookies if available
    const cookieStore = await cookies();
    const fbp = cookieStore.get("_fbp")?.value;
    const fbc = cookieStore.get("_fbc")?.value;

    // Build user data from event data and cookies
    const userData = {
      clientIpAddress: ipAddress,
      clientUserAgent: userAgent,
      email: eventData?.email,
      phone: eventData?.phone,
      firstName: eventData?.firstName,
      lastName: eventData?.lastName,
      fbp,
      fbc,
    };

    // Send to Meta Conversions API
    const metaSuccess = await sendToMetaConversionsAPI(
      eventName,
      eventData || {},
      eventId,
      userData,
      sourceUrl || ""
    );

    // Store in database for attribution reporting
    await storeConversionEvent(
      eventName,
      eventData || {},
      eventId,
      sourceUrl || "",
      userAgent || "",
      ipAddress
    );

    return NextResponse.json({
      success: true,
      meta: metaSuccess,
      eventId,
    });
  } catch (error) {
    console.error("Conversions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const configured = {
    meta: !!(META_PIXEL_ID && META_ACCESS_TOKEN),
    gtm: !!process.env.NEXT_PUBLIC_GTM_ID,
    google: !!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    microsoft: !!process.env.NEXT_PUBLIC_BING_UET_TAG_ID,
  };

  return NextResponse.json({
    status: "ok",
    configured,
    timestamp: new Date().toISOString(),
  });
}
