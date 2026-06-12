import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, hashPassword, AUTH_COOKIE_OPTIONS, getRedirectPath } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { notifyNewCustomer, notifyNewJob } from "@/lib/telegram";
import { applyReferralOnRegistration, validateReferralCode } from "@/lib/referrals";
import { generateJobNumber } from "@/lib/job-number";
import {
  stampFirstAndLastTouchOn,
  stampJobAttribution,
} from "@/lib/attribution/touch-resolver";

/**
 * Resolve the visitor id for attribution stamping. Tries (in order):
 *   1. body.visitorId (frontend form passes ls_visitor_id from localStorage)
 *   2. ls_visitor_id cookie (set as backup by useUserTracking on init)
 * Returns null when neither is available (admin-created accounts, etc).
 */
function resolveVisitorId(
  request: NextRequest,
  bodyVisitorId: unknown,
): string | null {
  if (typeof bodyVisitorId === "string" && bodyVisitorId.length > 0) {
    return bodyVisitorId;
  }
  const cookie = request.cookies.get("ls_visitor_id")?.value;
  return cookie && cookie.length > 0 ? cookie : null;
}

// Generate a random token
function generateRandomToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, pendingRequest, referralCode } = body;
    const visitorId = resolveVisitorId(request, body.visitorId);

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
        { status: 409 }
      );
    }

    // Also check if this email exists in admin or locksmith tables
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });

    const existingLocksmith = await prisma.locksmith.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingAdmin || existingLocksmith) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = generateRandomToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Validate referral code if provided
    let validatedRefCode: string | undefined;
    let referralDiscount = 0;
    if (referralCode) {
      const refValidation = await validateReferralCode(referralCode);
      if (refValidation.valid) {
        validatedRefCode = refValidation.code;
        referralDiscount = refValidation.discount;
      }
    }

    // Create the customer with first/last touch attribution stamped from
    // their UserSession history (Phase 3, 2026-06-12).
    const customerData = await stampFirstAndLastTouchOn(
      {
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash: hashPassword(password),
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
        // Pre-load referral credits if they have a discount code
        referralCredits: referralDiscount,
      },
      visitorId,
      { fallbackSource: "direct" },
    );
    const customer = await prisma.customer.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: customerData as any,
    });

    // Phase B, 2026-06-12: link this visitor's UserSession history to the
    // newly-created customer so analytics joins work straight away.
    if (visitorId) {
      try {
        // NB: MongoDB connector treats `customerId: null` filter strictly
        // (matches literal null, not missing field). Filter on visitorId
        // only — claim every session for this visitor. Idempotent and
        // last-seen-wins on the rare shared-device case.
        await prisma.userSession.updateMany({
          where: { visitorId },
          data:  { customerId: customer.id },
        });
      } catch (err) {
        console.warn(
          "[auth/register] UserSession.customerId link failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Link referral after customer created
    if (validatedRefCode) {
      await applyReferralOnRegistration(validatedRefCode, customer.id, name, email.toLowerCase());
    }

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    // Send email (non-blocking)
    sendVerificationEmail(email.toLowerCase(), {
      customerName: name,
      verificationUrl,
    }).catch(err => console.error("Failed to send verification email:", err));

    // Send Telegram notification for new customer (non-blocking)
    notifyNewCustomer({
      name,
      email: email.toLowerCase(),
      phone,
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    // If there's a pending request, create the job.
    // Stamp marketing attribution from the pending payload so the
    // Conversions API uploader can credit the originating Google/Meta
    // click when this Job eventually completes + pays. The same fields
    // are captured by the booking form via getClientAttribution(). If
    // they're missing (e.g. direct traffic), the Job is created without
    // attribution and the upload step will mark `skipped_no_gclid`.
    let createdJob = null;
    if (pendingRequest) {
      const jobNumber = await generateJobNumber(pendingRequest.postcode);

      // Server-side attribution recovery: even when the client didn't
      // pass UTM in the pendingRequest body, the visitorId lets us
      // look up the landing session and pull the original click data.
      let attribution: Record<string, string | null> = {};
      const pr = pendingRequest as Record<string, unknown>;
      const directKeys = ["utmSource", "utmMedium", "utmCampaign", "utmContent",
                          "utmTerm", "gclid", "fbclid", "landingPage"] as const;
      for (const k of directKeys) {
        const v = pr[k];
        if (typeof v === "string" && v.trim() !== "") attribution[k] = v;
      }
      if (Object.keys(attribution).length === 0 && typeof pr.visitorId === "string") {
        try {
          const { getAttributionForVisitor } = await import("@/lib/marketing/tracker");
          const recovered = await getAttributionForVisitor(pr.visitorId);
          if (recovered) {
            attribution = Object.fromEntries(
              Object.entries(recovered).filter(([, v]) => v !== null && v !== undefined),
            ) as Record<string, string>;
          }
        } catch (err) {
          console.warn("[register] visitor attribution lookup failed:", err instanceof Error ? err.message : err);
        }
      }

      // Phase 3, 2026-06-12: stamp Job.firstTouch* from the visitor's
      // earliest UserSession. The legacy utm* fields keep the last-touch
      // values (recovered above by the explicit-attribution merge).
      const visitorIdForJob =
        typeof pr.visitorId === "string" ? pr.visitorId : visitorId;
      const jobData = await stampJobAttribution(
        {
          jobNumber,
          customerId: customer.id,
          problemType: pendingRequest.problemType,
          propertyType: pendingRequest.propertyType,
          postcode: pendingRequest.postcode,
          address: pendingRequest.address,
          description: pendingRequest.description || null,
          // explicit utm* from the pending body wins over resolver values.
          ...attribution,
        },
        visitorIdForJob,
      );
      // Phase C, 2026-06-12: compute time-to-purchase hours for dashboard.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jd = jobData as any;
      const ftAt = jd.firstTouchAt as Date | undefined;
      if (ftAt instanceof Date) {
        jd.firstTouchToBookingHours = Math.max(0, (Date.now() - ftAt.getTime()) / (1000 * 60 * 60));
      }
      createdJob = await prisma.job.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: jobData as any,
      });
    }

    // Generate token
    const token = generateToken({
      id: customer.id,
      email: customer.email || "",
      name: customer.name,
      phone: customer.phone,
      type: "customer",
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        type: "customer",
        phone: customer.phone,
      },
      job: createdJob ? {
        id: createdJob.id,
        jobNumber: createdJob.jobNumber,
      } : null,
      redirectTo: createdJob ? `/customer/job/${createdJob.id}` : getRedirectPath("customer"),
    });

    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
