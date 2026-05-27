import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { notifyNewJob } from "@/lib/telegram";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { logSuspiciousActivity } from "@/lib/fraud-logger";

const CONTINUE_IP_LIMIT_MAX = Number.parseInt(
  process.env.CONTINUE_REQUEST_IP_LIMIT_MAX || "6",
  10,
);
const CONTINUE_IP_LIMIT_WINDOW_SECONDS = Number.parseInt(
  process.env.CONTINUE_REQUEST_IP_LIMIT_WINDOW_SECONDS || "300",
  10,
);
const CONTINUE_TOKEN_LIMIT_MAX = Number.parseInt(
  process.env.CONTINUE_REQUEST_TOKEN_LIMIT_MAX || "4",
  10,
);
const CONTINUE_TOKEN_LIMIT_WINDOW_SECONDS = Number.parseInt(
  process.env.CONTINUE_REQUEST_TOKEN_LIMIT_WINDOW_SECONDS || "900",
  10,
);
const CONTINUE_RECAPTCHA_MIN_SCORE = Number.parseFloat(
  process.env.CONTINUE_REQUEST_RECAPTCHA_MIN_SCORE || "0.4",
);
const CONTINUE_RECAPTCHA_ENFORCED =
  process.env.CONTINUE_REQUEST_RECAPTCHA_ENFORCED === "true";

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function canContinueJobStatus(status: string): boolean {
  return status === "PHONE_INITIATED" || status === "PENDING";
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
 * GET - Fetch job data by continue token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Find job by continue token
    const job = await prisma.job.findFirst({
      where: { continueToken: token },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Allow continuation for phone-initiated jobs and legacy pending jobs with active tokens.
    if (!canContinueJobStatus(job.status)) {
      return NextResponse.json({
        success: false,
        error: "This request has already been submitted or completed",
        job: {
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        problemType: job.problemType,
        propertyType: job.propertyType,
        postcode: job.postcode,
        address: job.address,
        description: job.description,
        phoneCollectedData: job.phoneCollectedData,
        customer: job.customer,
      },
    });

  } catch (error) {
    console.error("[Continue Request] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load request" },
      { status: 500 }
    );
  }
}

/**
 * POST - Complete the phone-initiated request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const ip = getRequestIdentifier(request);

    const ipRateLimit = checkRateLimit(`continue_request_ip:${ip}`, {
      maxRequests: CONTINUE_IP_LIMIT_MAX,
      windowSeconds: CONTINUE_IP_LIMIT_WINDOW_SECONDS,
    });

    if (!ipRateLimit.success) {
      await logSuspiciousActivity({
        category: "fake_job",
        event: "continue_request_ip_rate_limited",
        severity: "warn",
        ip,
        token,
      });
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: rateLimitHeaders(ipRateLimit) },
      );
    }

    const tokenRateLimit = checkRateLimit(`continue_request_token:${token}`, {
      maxRequests: CONTINUE_TOKEN_LIMIT_MAX,
      windowSeconds: CONTINUE_TOKEN_LIMIT_WINDOW_SECONDS,
    });

    if (!tokenRateLimit.success) {
      await logSuspiciousActivity({
        category: "fake_job",
        event: "continue_request_token_rate_limited",
        severity: "warn",
        ip,
        token,
      });
      return NextResponse.json(
        { success: false, error: "This link has reached its submission limit" },
        { status: 429, headers: rateLimitHeaders(tokenRateLimit) },
      );
    }

    const body = await request.json();
    const problemType = cleanText(body?.problemType);
    const propertyType = cleanText(body?.propertyType);
    const postcode = cleanText(body?.postcode).toUpperCase();
    const address = cleanText(body?.address);
    const description = cleanText(body?.description);
    const recaptchaToken = cleanText(body?.recaptchaToken);
    const honeypot = cleanText(body?.website || body?.company);

    if (honeypot) {
      await logSuspiciousActivity({
        category: "fake_job",
        event: "continue_request_honeypot_triggered",
        severity: "warn",
        ip,
        token,
      });
      return NextResponse.json(
        { success: false, error: "Invalid submission" },
        { status: 400 },
      );
    }

    if (!problemType || !propertyType || !postcode || !address) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    if (problemType.length > 120 || propertyType.length > 80 || address.length > 300 || description.length > 2000) {
      return NextResponse.json(
        { success: false, error: "One or more fields are too long" },
        { status: 400 },
      );
    }

    const recaptchaResult = await verifyRecaptchaToken({
      token: recaptchaToken,
      expectedAction: "continue_request",
      minScore: CONTINUE_RECAPTCHA_MIN_SCORE,
      remoteIp: ip,
    });

    if (!recaptchaResult.success && (CONTINUE_RECAPTCHA_ENFORCED || Boolean(recaptchaToken))) {
      await logSuspiciousActivity({
        category: "fake_job",
        event: "continue_request_recaptcha_failed",
        severity: "warn",
        ip,
        token,
        details: {
          errorCode: recaptchaResult.errorCode,
          score: recaptchaResult.score,
        },
      });
      return NextResponse.json(
        { success: false, error: "Security verification failed" },
        { status: 403 },
      );
    }

    // Find job by continue token
    const job = await prisma.job.findFirst({
      where: { continueToken: token },
      include: {
        customer: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Allow continuation for phone-initiated jobs and legacy pending jobs with active tokens.
    if (!canContinueJobStatus(job.status)) {
      return NextResponse.json({
        success: false,
        error: "This request has already been submitted",
        jobId: job.id,
      });
    }

    const shouldBroadcastNewJob = job.status === "PHONE_INITIATED";

    // Geocode the postcode
    let latitude: number | null = job.latitude;
    let longitude: number | null = job.longitude;

    if (postcode !== job.postcode || !latitude || !longitude) {
      const coords = await geocodePostcode(postcode);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    // Update the job with completed information
    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        problemType,
        propertyType,
        postcode: postcode.toUpperCase(),
        address,
        description: description || job.description,
        latitude,
        longitude,
        // Clear the continue token (one-time use)
        continueToken: null,
        // Update phone collected data with completion info
        phoneCollectedData: {
          ...(typeof job.phoneCollectedData === 'object' && job.phoneCollectedData !== null ? job.phoneCollectedData : {}),
          completed_via: "web",
          completed_at: new Date().toISOString(),
          final_problem_type: problemType,
          final_property_type: propertyType,
          final_postcode: postcode,
          final_address: address,
        },
      },
      include: {
        customer: true,
      },
    });

    if (shouldBroadcastNewJob) {
      // Notify nearby locksmiths about the new job (async, don't await)
      notifyNearbyLocksmiths({
        id: updatedJob.id,
        jobNumber: updatedJob.jobNumber,
        problemType: updatedJob.problemType,
        propertyType: updatedJob.propertyType,
        postcode: updatedJob.postcode,
        address: updatedJob.address,
        latitude: updatedJob.latitude,
        longitude: updatedJob.longitude,
        createdAt: updatedJob.createdAt.toISOString(),
      }).then((result) => {
        console.log(`[Continue Request] Notified ${result.notifiedCount} locksmiths about job ${updatedJob.jobNumber}`);
      }).catch((err) => {
        console.error(`[Continue Request] Failed to notify locksmiths:`, err);
      });

      // Send Telegram notification (non-blocking)
      notifyNewJob({
        jobNumber: updatedJob.jobNumber,
        jobId: updatedJob.id,
        customerName: updatedJob.customer?.name || "Unknown",
        customerPhone: updatedJob.customer?.phone || "",
        problemType: updatedJob.problemType,
        propertyType: updatedJob.propertyType,
        postcode: updatedJob.postcode,
        address: updatedJob.address,
        description: updatedJob.description,
        isUrgent: problemType.toLowerCase().includes("lockout") || problemType.toLowerCase().includes("emergency"),
      }).catch((err) => {
        console.error(`[Continue Request] Failed to send Telegram notification:`, err);
      });
    }

    console.log(`[Continue Request] Job ${updatedJob.jobNumber} completed via web (originally from phone)`);

    return NextResponse.json({
      success: true,
      jobId: updatedJob.id,
      jobNumber: updatedJob.jobNumber,
      message: "Your request has been submitted! Locksmiths will start sending you quotes.",
    }, {
      headers: rateLimitHeaders(tokenRateLimit),
    });

  } catch (error) {
    console.error("[Continue Request] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit request" },
      { status: 500 }
    );
  }
}
