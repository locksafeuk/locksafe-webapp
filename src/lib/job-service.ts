/**
 * LockSafe UK - Emergency Job Service
 *
 * Orchestrates the emergency workflow:
 * 1. Create job from AI/phone data
 * 2. Find and notify nearby locksmiths
 * 3. Handle locksmith application
 * 4. Send details-only updates to customer pre-acceptance
 * 5. Process payment and trigger onboarding
 */

import prisma from "@/lib/db";
import crypto from "crypto";
import { generateJobNumber } from "@/lib/job-number";
import { sendSMS } from "@/lib/sms";
import { createShortLink } from "@/lib/short-link";
import {
  findNearbyLocksmiths,
  findNearbyLocksmithsByPostcode,
  notifyLocksmitheEmergency,
  geocodePostcode,
  type NearbyLocksmith,
} from "@/lib/locksmith-matcher";
import { EMERGENCY_SMS_TEMPLATES } from "@/lib/sms-templates";
import { createNotification } from "@/lib/notifications";
import { evaluateEmergencyJobRisk, getEmergencyJobRiskConfig } from "@/lib/risk-controls";
import { normalizePhoneNumber } from "@/lib/phone";

// ============================================
// TYPES
// ============================================

export interface EmergencyJobInput {
  // Customer info
  customerPhone: string;
  customerName: string;
  customerEmail?: string;

  // Location
  postcode: string;
  address: string;
  exactLocation?: string; // e.g., "blue door, flat 3"

  // Emergency details
  problemType: string;
  propertyType?: string;
  emergencyDetails?: string;
  description?: string;

  // Source tracking
  createdVia?: string; // retell_ai, phone, web
  retellCallId?: string;
}

export interface EmergencyJobResult {
  success: boolean;
  job?: {
    id: string;
    jobNumber: string;
    status: string;
    continueUrl?: string;
  };
  dedup?: {
    reusedExistingJob: boolean;
    mergeReason?: string;
    updatedFields?: string[];
  };
  customer?: {
    id: string;
    name: string;
    isNew: boolean;
  };
  notifications?: {
    notifiedCount: number;
    locksmithIds: string[];
  };
  error?: string;
}

// ============================================
// FIND OR CREATE CUSTOMER
// ============================================

async function findOrCreateCustomer(params: {
  phone: string;
  name: string;
  email?: string;
  createdVia?: string;
}): Promise<{ customer: { id: string; name: string; phone: string; email: string | null }; isNew: boolean }> {
  // First try to find by phone
  const normalizedPhone = normalizePhoneNumber(params.phone);

  let customer = await prisma.customer.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true, name: true, phone: true, email: true },
  });

  if (customer) {
    return { customer, isNew: false };
  }

  // Try by email if provided
  if (params.email) {
    customer = await prisma.customer.findFirst({
      where: { email: params.email },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (customer) {
      return { customer, isNew: false };
    }
  }

  // Create new customer. Phase 3, 2026-06-12: stamp firstTouch/lastTouch
  // from createdVia (job-service is only called from internal phone paths;
  // no visitor session is available here).
  const touchSource = params.createdVia === "app" ? "app" : "phone";
  const newCustomer = await prisma.customer.create({
    data: {
      name: params.name,
      phone: normalizedPhone,
      // Only set `email` when provided. Writing `null` collides with
      // MongoDB's unique index, which treats null as a single shared value.
      ...(params.email ? { email: params.email } : {}),
      createdVia: params.createdVia || "phone",
      firstTouchAt: new Date(),
      firstTouchSource: touchSource,
      lastTouchAt: new Date(),
      lastTouchSource: touchSource,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    select: { id: true, name: true, phone: true, email: true },
  });

  return { customer: newCustomer, isNew: true };
}

const RETELL_DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000;

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://locksafe.uk"
  );
}

function createContinueToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function toContinueUrl(token: string): string {
  return `${getBaseUrl()}/continue-request/${token}`;
}

function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
}

async function findRecentMergeCandidate(params: {
  customerId: string;
  postcode: string;
}): Promise<{
  job: {
    id: string;
    jobNumber: string;
    status: string;
    continueToken: string | null;
    problemType: string;
    propertyType: string;
    description: string | null;
    postcode: string;
    address: string;
    emergencyDetails: string | null;
    exactLocation: string | null;
    retellCallId: string | null;
  };
  reason: string;
} | null> {
  const windowStart = new Date(Date.now() - RETELL_DEDUP_WINDOW_MS);
  const normalizedPostcode = params.postcode.toUpperCase();

  const jobs = await prisma.job.findMany({
    where: {
      customerId: params.customerId,
      isEmergency: true,
      status: { in: ["PHONE_INITIATED", "PENDING"] },
      createdAt: { gte: windowStart },
    },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      continueToken: true,
      problemType: true,
      propertyType: true,
      description: true,
      postcode: true,
      address: true,
      emergencyDetails: true,
      exactLocation: true,
      retellCallId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (jobs.length === 0) return null;

  const samePostcode = jobs.find(
    (job) => job.postcode.toUpperCase() === normalizedPostcode
  );
  if (samePostcode) {
    return { job: samePostcode, reason: "same_phone_recent_same_postcode" };
  }

  return { job: jobs[0], reason: "same_phone_recent_any_postcode" };
}

async function mergeEmergencyJobDetails(params: {
  existingJob: {
    id: string;
    continueToken: string | null;
    description: string | null;
    emergencyDetails: string | null;
    exactLocation: string | null;
    retellCallId: string | null;
  };
  input: EmergencyJobInput;
}): Promise<{ continueUrl: string; updatedFields: string[] }> {
  const updates: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  if (isBlank(params.existingJob.description) && !isBlank(params.input.description)) {
    updates.description = params.input.description;
    updatedFields.push("description");
  }

  if (
    isBlank(params.existingJob.emergencyDetails) &&
    !isBlank(params.input.emergencyDetails)
  ) {
    updates.emergencyDetails = params.input.emergencyDetails;
    updatedFields.push("emergencyDetails");
  }

  if (isBlank(params.existingJob.exactLocation) && !isBlank(params.input.exactLocation)) {
    updates.exactLocation = params.input.exactLocation;
    updatedFields.push("exactLocation");
  }

  if (isBlank(params.existingJob.retellCallId) && !isBlank(params.input.retellCallId)) {
    updates.retellCallId = params.input.retellCallId;
    updatedFields.push("retellCallId");
  }

  let continueToken = params.existingJob.continueToken;
  if (!continueToken) {
    continueToken = createContinueToken();
    updates.continueToken = continueToken;
    updatedFields.push("continueToken");
  }

  if (Object.keys(updates).length > 0) {
    await prisma.job.update({
      where: { id: params.existingJob.id },
      data: updates,
    });
  }

  return {
    continueUrl: toContinueUrl(continueToken!),
    updatedFields,
  };
}

// ============================================
// CREATE EMERGENCY JOB
// ============================================

/**
 * Main entry point: Create emergency job and notify locksmiths
 *
 * This handles the complete flow:
 * 1. Find or create customer
 * 2. Geocode postcode
 * 3. Create job
 * 4. Find nearby locksmiths
 * 5. Notify them
 * 6. SMS customer confirmation
 */
export async function createEmergencyJob(
  input: EmergencyJobInput
): Promise<EmergencyJobResult> {
  try {
    console.log(`[Job Service] Creating emergency job for ${input.customerName} at ${input.postcode}`);
    const isRetellSimulation =
      typeof input.retellCallId === "string" &&
      input.retellCallId.startsWith("test_job_");

    // 1. Find or create customer
    const { customer, isNew } = await findOrCreateCustomer({
      phone: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
      createdVia: input.createdVia || "retell_ai",
    });

    console.log(`[Job Service] Customer ${isNew ? "created" : "found"}: ${customer.id}`);

    const normalizedPostcode = input.postcode.toUpperCase();

    const mergeCandidate = await findRecentMergeCandidate({
      customerId: customer.id,
      postcode: normalizedPostcode,
    });

    if (mergeCandidate) {
      const { continueUrl, updatedFields } = await mergeEmergencyJobDetails({
        existingJob: mergeCandidate.job,
        input,
      });

      console.log("[Job Service] Reusing existing emergency job", {
        customerId: customer.id,
        jobId: mergeCandidate.job.id,
        jobNumber: mergeCandidate.job.jobNumber,
        mergeReason: mergeCandidate.reason,
        updatedFields,
        dedupWindowMs: RETELL_DEDUP_WINDOW_MS,
      });

      return {
        success: true,
        job: {
          id: mergeCandidate.job.id,
          jobNumber: mergeCandidate.job.jobNumber,
          status: mergeCandidate.job.status,
          continueUrl,
        },
        dedup: {
          reusedExistingJob: true,
          mergeReason: mergeCandidate.reason,
          updatedFields,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          isNew,
        },
        notifications: {
          notifiedCount: 0,
          locksmithIds: [],
        },
      };
    }

    const riskConfig = getEmergencyJobRiskConfig();
    const now = new Date();
    const duplicateWindowStart = new Date(now.getTime() - riskConfig.duplicateWindowMinutes * 60 * 1000);
    const jobs24HoursStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [recentCustomerJobs24h, recentDuplicateRequests] = await Promise.all([
      prisma.job.count({
        where: {
          customerId: customer.id,
          createdAt: { gte: jobs24HoursStart },
        },
      }),
      prisma.job.count({
        where: {
          customerId: customer.id,
          postcode: normalizedPostcode,
          isEmergency: true,
          createdAt: { gte: duplicateWindowStart },
        },
      }),
    ]);

    if (!isRetellSimulation) {
      const riskError = evaluateEmergencyJobRisk({
        recentCustomerJobs24h,
        recentDuplicateRequests,
      });

      if (riskError) {
        console.warn("[Job Service] Blocked emergency job creation:", {
          customerId: customer.id,
          postcode: normalizedPostcode,
          recentCustomerJobs24h,
          recentDuplicateRequests,
          riskError,
        });
        return {
          success: false,
          error: riskError,
        };
      }
    }

    // 2. Geocode postcode
    const coords = await geocodePostcode(normalizedPostcode);
    if (!coords) {
      console.warn(`[Job Service] Could not geocode postcode: ${normalizedPostcode}`);
    }

    // 3. Create job
    const jobNumber = await generateJobNumber(input.postcode);
    const continueToken = createContinueToken();
    const continueUrl = toContinueUrl(continueToken);

    const job = await prisma.job.create({
      data: {
        jobNumber,
        status: "PHONE_INITIATED",
        customerId: customer.id,
        problemType: input.problemType,
        propertyType: input.propertyType || "house",
        description: input.description || input.emergencyDetails,
        postcode: normalizedPostcode,
        address: input.address,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        createdVia: input.createdVia || "retell_ai",
        retellCallId: input.retellCallId || null,
        continueToken,
        isEmergency: true,
        emergencyDetails: input.emergencyDetails || null,
        exactLocation: input.exactLocation || null,
      },
    });

    console.log(`[Job Service] Job created: ${job.jobNumber} (${job.id})`);

    // ── CallIntent → Job bridge (2026-06-06 fix) ────────────────────────
    // Diag showed 0 of 33 CallIntents in last 30d matched to a Job. The
    // matcher stamps CallIntent.matched=true + retellCallId when the call
    // comes in, but until now nothing wrote CallIntent.jobId or copied
    // the CallIntent's gclid/utms onto the Job. Without that bridge the
    // Stripe-webhook conversion upload reads Job.gclid=null and skips —
    // so Google Ads never learns which clicks produced paid jobs.
    //
    // Now: when we create a PHONE_INITIATED job with a retellCallId,
    // look up the matching CallIntent, copy its attribution onto the
    // Job, and stamp the Job back onto the CallIntent for audit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;
    if (input.retellCallId) {
      try {
        const intent = await prismaAny.callIntent.findFirst({
          where: { retellCallId: input.retellCallId },
          select: {
            id: true,
            gclid: true,
            fbclid: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            landingPage: true,
            visitorId: true,
          },
          orderBy: { matchedAt: "desc" },
        });
        if (intent) {
          // Stamp the Job with attribution recovered from the CallIntent.
          // Skip individual fields if they're null on the intent.
          const attribution: Record<string, string> = {};
          if (intent.gclid)       attribution.gclid       = intent.gclid;
          if (intent.fbclid)      attribution.fbclid      = intent.fbclid;
          if (intent.utmSource)   attribution.utmSource   = intent.utmSource;
          if (intent.utmMedium)   attribution.utmMedium   = intent.utmMedium;
          if (intent.utmCampaign) attribution.utmCampaign = intent.utmCampaign;
          if (intent.utmContent)  attribution.utmContent  = intent.utmContent;
          if (intent.utmTerm)     attribution.utmTerm     = intent.utmTerm;
          if (intent.landingPage) attribution.landingPage = intent.landingPage;
          if (intent.visitorId)   attribution.visitorId   = intent.visitorId;

          if (Object.keys(attribution).length > 0) {
            await prismaAny.job.update({
              where: { id: job.id },
              data: attribution,
            });
            console.log(
              `[Job Service] CallIntent attribution copied to job ${job.jobNumber}`,
              { intentId: intent.id, hasGclid: !!intent.gclid, fields: Object.keys(attribution) },
            );
          }

          // Stamp the Job back onto the CallIntent so future lookups +
          // audit reports can join cleanly.
          await prismaAny.callIntent.update({
            where: { id: intent.id },
            data: { jobId: job.id },
          });
        } else {
          console.log(
            `[Job Service] No CallIntent matched retellCallId=${input.retellCallId} for job ${job.jobNumber}`,
          );
        }
      } catch (err) {
        // Non-fatal — never let attribution bookkeeping break job creation.
        console.warn(
          `[Job Service] CallIntent→Job bridge failed for ${job.jobNumber}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // 4. Find nearby locksmiths
    let notificationResult = { notifiedCount: 0, locksmithIds: [] as string[] };

    if (coords) {
      const nearbyLocksmiths = await findNearbyLocksmiths(
        coords.latitude,
        coords.longitude,
        { sortBy: "distance" }
      );

      console.log(`[Job Service] Found ${nearbyLocksmiths.length} nearby locksmiths`);

      // 5. Notify locksmiths
      if (nearbyLocksmiths.length > 0) {
        notificationResult = await notifyLocksmitheEmergency({
          locksmiths: nearbyLocksmiths,
          job: {
            id: job.id,
            jobNumber: job.jobNumber,
            problemType: input.problemType,
            propertyType: input.propertyType,
            postcode: input.postcode,
            address: input.address,
            customerName: customer.name,
            isEmergency: true,
          },
        });

        // Update job with notified locksmith IDs
        await prisma.job.update({
          where: { id: job.id },
          data: {
            notifiedLocksmithIds: notificationResult.locksmithIds,
            notifiedAt: new Date(),
          },
        });
      }
    }

    // 6. SMS customer confirmation. Shorten the continue link to a branded
    // short link (locksafe.uk/r/xxxxxx) so the whole message stays in one
    // GSM-7 segment instead of carrying a 48-char raw token.
    const manageUrl = await createShortLink({
      targetUrl: continueUrl,
      purpose: "continue-request",
      jobId: job.id,
    });
    const customerSms = notificationResult.notifiedCount > 0
      ? `${EMERGENCY_SMS_TEMPLATES.CUSTOMER_EMERGENCY_CREATED({
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: customer.name,
          postcode: normalizedPostcode,
        })}\n\nManage your request: ${manageUrl}`
      : `${EMERGENCY_SMS_TEMPLATES.CUSTOMER_NO_LOCKSMITHS({
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: customer.name,
          postcode: normalizedPostcode,
        })}\n\nManage your request: ${manageUrl}`;

    sendSMS(customer.phone, customerSms, {
      logContext: `Emergency job created: ${job.jobNumber}`,
    }).catch((err) =>
      console.error("[Job Service] Customer SMS error:", err)
    );

    return {
      success: true,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        continueUrl,
      },
      dedup: {
        reusedExistingJob: false,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        isNew,
      },
      notifications: notificationResult,
    };
  } catch (error) {
    console.error("[Job Service] Error creating emergency job:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// HANDLE LOCKSMITH APPLICATION
// ============================================

/**
 * When a locksmith applies for an emergency job:
 * 1. Create application record
 * 2. Notify customer with locksmith details (no payment request yet)
 */
export async function handleLocksmithApplication(params: {
  jobId: string;
  locksmithId: string;
  callOutFee: number;
  estimatedETA: number; // minutes
  message?: string;
}): Promise<{
  success: boolean;
  application?: { id: string };
  error?: string;
}> {
  try {
    const { jobId, locksmithId, callOutFee, estimatedETA, message } = params;

    // Fetch job and locksmith details
    const [job, locksmith] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        include: { customer: true },
      }),
      prisma.locksmith.findUnique({
        where: { id: locksmithId },
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          rating: true,
          totalJobs: true,
          stripeConnectId: true,
          stripeConnectVerified: true,
          insuranceStatus: true,
        },
      }),
    ]);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    if (!locksmith) {
      return { success: false, error: "Locksmith not found" };
    }

    // Validate insurance
    if (locksmith.insuranceStatus === "expired") {
      return { success: false, error: "Insurance expired - cannot apply" };
    }

    // Check for duplicate application
    const existingApp = await prisma.locksmithApplication.findUnique({
      where: {
        jobId_locksmithId: { jobId, locksmithId },
      },
    });

    if (existingApp) {
      return { success: false, error: "Already applied for this job" };
    }

    // Create the application
    const application = await prisma.locksmithApplication.create({
      data: {
        jobId,
        locksmithId,
        assessmentFee: callOutFee,
        callOutFee,
        eta: estimatedETA,
        estimatedETA: `${estimatedETA} minutes`,
        message: message || null,
        status: "pending",
      },
    });

    console.log(`[Job Service] Application created: ${application.id} for job ${job.jobNumber}`);

    // SMS customer with locksmith details only.
    const etaText = estimatedETA <= 60
      ? `${estimatedETA} mins`
      : `${Math.round(estimatedETA / 60)} hours`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";
    const detailsUrl = `${siteUrl}/customer/job/${job.id}`;

    const smsMessage = EMERGENCY_SMS_TEMPLATES.CUSTOMER_LOCKSMITH_APPLIED({
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customer.name,
      locksmithName: locksmith.name,
      companyName: locksmith.companyName || undefined,
      eta: etaText,
      etaMinutes: estimatedETA,
      callOutFee,
      rating: locksmith.rating,
      totalJobs: locksmith.totalJobs,
      detailsUrl,
    });

    sendSMS(job.customer.phone, smsMessage, {
      logContext: `Locksmith application details for job ${job.jobNumber}`,
    }).catch((err) =>
      console.error("[Job Service] Customer application SMS error:", err)
    );

    // Create in-app notification for customer
    createNotification({
      customerId: job.customer.id,
      jobId: job.id,
      type: "locksmith_applied",
      title: "Locksmith Ready to Help",
      message: `${locksmith.name} can be with you in ${etaText}. Review details and choose next steps.`,
      actionUrl: detailsUrl,
      actionLabel: "View Details",
    }).catch((err) =>
      console.error("[Job Service] Notification error:", err)
    );

    return {
      success: true,
      application: { id: application.id },
    };
  } catch (error) {
    console.error("[Job Service] Application error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// HANDLE PAYMENT COMPLETION
// ============================================

/**
 * Called when Stripe Checkout payment succeeds:
 * 1. Update payment status
 * 2. Accept the locksmith application
 * 3. Reject other applications
 * 4. Update job status
 * 5. Notify locksmith
 * 6. SMS customer with onboarding link
 */
export async function handlePaymentCompleted(params: {
  stripeCheckoutId: string;
  stripePaymentIntentId?: string;
  /**
   * The application the customer actually paid for, taken from the Checkout
   * session metadata. Preferred over the "most recent pending" heuristic so
   * the correct locksmith is assigned when a job has multiple applicants.
   */
  applicationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { stripeCheckoutId, stripePaymentIntentId, applicationId } = params;

    // Find the payment
    const payment = await prisma.payment.findFirst({
      where: { stripeCheckoutId },
      include: {
        job: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!payment) {
      console.error(`[Job Service] Payment not found for checkout: ${stripeCheckoutId}`);
      return { success: false, error: "Payment not found" };
    }

    if (payment.status === "succeeded") {
      console.log(`[Job Service] Payment ${payment.id} already processed`);
      return { success: true };
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "succeeded",
        stripePaymentIntentId: stripePaymentIntentId || null,
        paidAt: new Date(),
      },
    });

    // Find the application linked to this payment (via checkout metadata)
    // We need to look up which application was linked
    const applications = await prisma.locksmithApplication.findMany({
      where: {
        jobId: payment.jobId,
        status: "pending",
      },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Prefer the exact application the customer paid for (from Checkout session
    // metadata). Fall back to the most recent pending application for legacy
    // flows that don't pass an applicationId.
    const acceptedApp =
      (applicationId && applications.find((a) => a.id === applicationId)) ||
      applications[0];

    if (acceptedApp) {
      // Accept this application
      await prisma.locksmithApplication.update({
        where: { id: acceptedApp.id },
        data: { status: "accepted" },
      });

      // Reject other applications
      const otherAppIds = applications
        .filter((a) => a.id !== acceptedApp.id)
        .map((a) => a.id);

      if (otherAppIds.length > 0) {
        await prisma.locksmithApplication.updateMany({
          where: { id: { in: otherAppIds } },
          data: { status: "rejected" },
        });
      }

      // Update job with assigned locksmith
      await prisma.job.update({
        where: { id: payment.jobId },
        data: {
          status: "ACCEPTED",
          locksmithId: acceptedApp.locksmithId,
          acceptedAt: new Date(),
          assessmentFee: acceptedApp.assessmentFee,
          assessmentPaid: true,
          acceptedEta: acceptedApp.eta,
        },
      });

      // Notify locksmith - job confirmed
      const locksmithSms = EMERGENCY_SMS_TEMPLATES.LOCKSMITH_JOB_CONFIRMED({
        jobId: payment.job.id,
        jobNumber: payment.job.jobNumber,
        customerName: payment.job.customer.name,
        address: payment.job.address,
        postcode: payment.job.postcode,
      });

      sendSMS(acceptedApp.locksmith.phone, locksmithSms, {
        logContext: `Job confirmed for locksmith: ${payment.job.jobNumber}`,
      }).catch((err) =>
        console.error("[Job Service] Locksmith confirmation SMS error:", err)
      );

      // Create notification for locksmith
      createNotification({
        locksmithId: acceptedApp.locksmithId,
        jobId: payment.jobId,
        type: "job_confirmed",
        title: "Job Confirmed!",
        message: `Customer ${payment.job.customer.name} has paid. Head to ${payment.job.postcode} now.`,
        actionUrl: `/locksmith/job/${payment.jobId}`,
        actionLabel: "View Job",
      }).catch((err) =>
        console.error("[Job Service] Locksmith notification error:", err)
      );
    }

    // SMS customer - payment confirmed + onboarding link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
    const onboardingUrl = `${siteUrl}/customer/onboard?job=${payment.jobId}`;

    const customerSms = EMERGENCY_SMS_TEMPLATES.CUSTOMER_PAYMENT_CONFIRMED({
      jobId: payment.job.id,
      jobNumber: payment.job.jobNumber,
      customerName: payment.job.customer.name,
      locksmithName: acceptedApp?.locksmith.name || "Your locksmith",
      eta: acceptedApp ? `${acceptedApp.eta} mins` : "Soon",
      onboardingUrl,
    });

    sendSMS(payment.job.customer.phone, customerSms, {
      logContext: `Payment confirmed for job: ${payment.job.jobNumber}`,
    }).catch((err) =>
      console.error("[Job Service] Customer confirmation SMS error:", err)
    );

    console.log(`[Job Service] Payment completed for job ${payment.job.jobNumber}`);
    return { success: true };
  } catch (error) {
    console.error("[Job Service] Payment completion error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
