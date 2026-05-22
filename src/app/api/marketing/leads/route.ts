import { NextRequest, NextResponse } from "next/server";
import { saveLeadMagnet, updateUserSegment } from "@/lib/marketing/tracker";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { logSuspiciousActivity } from "@/lib/fraud-logger";

const LEAD_RATE_LIMIT_MAX = Number.parseInt(
  process.env.LEAD_FORM_RATE_LIMIT_MAX || "5",
  10,
);
const LEAD_RATE_LIMIT_WINDOW_SECONDS = Number.parseInt(
  process.env.LEAD_FORM_RATE_LIMIT_WINDOW_SECONDS || "60",
  10,
);
const LEAD_RECAPTCHA_MIN_SCORE = Number.parseFloat(
  process.env.LEAD_RECAPTCHA_MIN_SCORE || "0.5",
);
const LEAD_RECAPTCHA_ENFORCED = process.env.LEAD_RECAPTCHA_ENFORCED === "true";

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

// POST - Save lead magnet signup
export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIdentifier(request);
    const rateLimitResult = checkRateLimit(`lead_signup:${ip}`, {
      maxRequests: LEAD_RATE_LIMIT_MAX,
      windowSeconds: LEAD_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!rateLimitResult.success) {
      await logSuspiciousActivity({
        category: "fake_lead",
        event: "lead_rate_limited",
        severity: "warn",
        ip,
        details: {
          limit: LEAD_RATE_LIMIT_MAX,
          windowSeconds: LEAD_RATE_LIMIT_WINDOW_SECONDS,
        },
      });

      return NextResponse.json(
        { error: "Too many lead submissions. Please try again shortly." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimitResult),
        },
      );
    }

    const body = await request.json();
    const email = normalizeText(body?.email).toLowerCase();
    const name = normalizeText(body?.name);
    const phone = normalizeText(body?.phone);
    const source = normalizeText(body?.source);
    const sessionId = normalizeText(body?.sessionId);
    const recaptchaToken = normalizeText(body?.recaptchaToken);
    const honeypot = normalizeText(body?.website || body?.company);
    const segment = Array.isArray(body?.segment)
      ? body.segment.filter((entry: unknown) => typeof entry === "string").slice(0, 10)
      : [];

    if (honeypot) {
      await logSuspiciousActivity({
        category: "fake_lead",
        event: "lead_honeypot_triggered",
        severity: "warn",
        ip,
        email,
      });
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (name.length > 120 || phone.length > 30) {
      return NextResponse.json(
        { error: "Invalid lead fields" },
        { status: 400 },
      );
    }

    const recaptchaResult = await verifyRecaptchaToken({
      token: recaptchaToken,
      expectedAction: "lead_signup",
      minScore: LEAD_RECAPTCHA_MIN_SCORE,
      remoteIp: ip,
    });

    if (!recaptchaResult.success && (LEAD_RECAPTCHA_ENFORCED || Boolean(recaptchaToken))) {
      await logSuspiciousActivity({
        category: "fake_lead",
        event: "lead_recaptcha_failed",
        severity: "warn",
        ip,
        email,
        details: {
          errorCode: recaptchaResult.errorCode,
          score: recaptchaResult.score,
        },
      });

      return NextResponse.json(
        { error: "Security verification failed" },
        { status: 403 },
      );
    }

    const lead = await saveLeadMagnet({
      email,
      name: name || undefined,
      phone: phone || undefined,
      source: source || "unknown",
      segment,
    });

    // Update session segment to include "lead"
    if (sessionId) {
      await updateUserSegment(sessionId, ["lead"]);
    }

    return NextResponse.json({
      success: true,
      lead: { id: lead.id, email: lead.email },
    }, { headers: rateLimitHeaders(rateLimitResult) });
  } catch (error) {
    console.error("Error saving lead:", error);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
