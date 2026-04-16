/**
 * LockSafe UK - Emergency Job Service
 *
 * Orchestrates the emergency workflow:
 * 1. Create job from AI/phone data
 * 2. Find and notify nearby locksmiths
 * 3. Handle locksmith application
 * 4. Generate payment link and SMS to customer
 * 5. Process payment and trigger onboarding
 */

import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import {
  findNearbyLocksmiths,
  findNearbyLocksmithsByPostcode,
  notifyLocksmitheEmergency,
  geocodePostcode,
  type NearbyLocksmith,
} from "@/lib/locksmith-matcher";
import { createCheckoutSession } from "@/lib/stripe";
import { EMERGENCY_SMS_TEMPLATES } from "@/lib/sms-templates";
import { createNotification } from "@/lib/notifications";

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
  blandCallId?: string;
}

export interface EmergencyJobResult {
  success: boolean;
  job?: {
    id: string;
    jobNumber: string;
    status: string;
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
// JOB NUMBER GENERATION
// ============================================

async function generateJobNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Find latest job number for this month
  const prefix = `LRS-${year}${month}`;
  const latestJob = await prisma.job.findFirst({
    where: {
      jobNumber: { startsWith: prefix },
    },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  let sequence = 1;
  if (latestJob) {
    const lastSequence = parseInt(latestJob.jobNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`;
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
  const normalizedPhone = normalizePhone(params.phone);

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

  // Create new customer
  const newCustomer = await prisma.customer.create({
    data: {
      name: params.name,
      phone: normalizedPhone,
      email: params.email || null,
      createdVia: params.createdVia || "phone",
    },
    select: { id: true, name: true, phone: true, email: true },
  });

  return { customer: newCustomer, isNew: true };
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/[^0-9+]/g, "");

  // Handle UK formats
  if (cleaned.startsWith("0")) {
    cleaned = "+44" + cleaned.slice(1);
  } else if (cleaned.startsWith("44") && !cleaned.startsWith("+44")) {
    cleaned = "+" + cleaned;
  } else if (cleaned.startsWith("0044")) {
    cleaned = "+44" + cleaned.slice(4);
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+44" + cleaned;
  }

  return cleaned;
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

    // 1. Find or create customer
    const { customer, isNew } = await findOrCreateCustomer({
      phone: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
      createdVia: input.createdVia || "retell_ai",
    });

    console.log(`[Job Service] Customer ${isNew ? "created" : "found"}: ${customer.id}`);

    // 2. Geocode postcode
    const coords = await geocodePostcode(input.postcode);
    if (!coords) {
      console.warn(`[Job Service] Could not geocode postcode: ${input.postcode}`);
    }

    // 3. Create job
    const jobNumber = await generateJobNumber();
    const job = await prisma.job.create({
      data: {
        jobNumber,
        status: "PENDING",
        customerId: customer.id,
        problemType: input.problemType,
        propertyType: input.propertyType || "house",
        description: input.description || input.emergencyDetails,
        postcode: input.postcode.toUpperCase(),
        address: input.address,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        createdVia: input.createdVia || "retell_ai",
        retellCallId: input.retellCallId || null,
        blandCallId: input.blandCallId || null,
        isEmergency: true,
        emergencyDetails: input.emergencyDetails || null,
        exactLocation: input.exactLocation || null,
      },
    });

    console.log(`[Job Service] Job created: ${job.jobNumber} (${job.id})`);

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

    // 6. SMS customer confirmation
    const customerSms = notificationResult.notifiedCount > 0
      ? EMERGENCY_SMS_TEMPLATES.CUSTOMER_EMERGENCY_CREATED({
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: customer.name,
          postcode: input.postcode,
        })
      : EMERGENCY_SMS_TEMPLATES.CUSTOMER_NO_LOCKSMITHS({
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: customer.name,
          postcode: input.postcode,
        });

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
 * 2. Create Stripe Checkout session
 * 3. Create Payment record
 * 4. SMS customer with payment link
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
  payment?: { id: string; paymentUrl: string };
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

    // Create Stripe Checkout Session
    const checkoutSession = await createCheckoutSession({
      amount: callOutFee,
      jobId: job.id,
      customerId: job.customer.id,
      locksmithId: locksmith.id,
      applicationId: application.id,
      customerEmail: job.customer.email,
      customerName: job.customer.name,
      locksmithName: locksmith.name,
      jobNumber: job.jobNumber,
      locksmithStripeAccountId: locksmith.stripeConnectVerified
        ? locksmith.stripeConnectId
        : null,
      paymentType: "callout",
    });

    // Create Payment record
    const payment = await prisma.payment.create({
      data: {
        jobId: job.id,
        customerId: job.customer.id,
        type: "callout",
        amount: callOutFee,
        status: "pending",
        stripeCheckoutId: checkoutSession.id,
        paymentUrl: checkoutSession.url,
        paymentUrlExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });

    console.log(`[Job Service] Payment created: ${payment.id}, checkout URL: ${checkoutSession.url}`);

    // SMS customer with locksmith details + payment link
    const etaText = estimatedETA <= 60
      ? `${estimatedETA} mins`
      : `${Math.round(estimatedETA / 60)} hours`;

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
      paymentUrl: checkoutSession.url || "",
    });

    sendSMS(job.customer.phone, smsMessage, {
      logContext: `Payment link for job ${job.jobNumber}`,
    }).catch((err) =>
      console.error("[Job Service] Customer payment SMS error:", err)
    );

    // Create in-app notification for customer
    createNotification({
      customerId: job.customer.id,
      jobId: job.id,
      type: "locksmith_applied",
      title: "Locksmith Ready to Help",
      message: `${locksmith.name} can be with you in ${etaText}. Call-out fee: £${callOutFee.toFixed(2)}`,
      actionUrl: checkoutSession.url || undefined,
      actionLabel: "Pay & Confirm",
    }).catch((err) =>
      console.error("[Job Service] Notification error:", err)
    );

    return {
      success: true,
      application: { id: application.id },
      payment: {
        id: payment.id,
        paymentUrl: checkoutSession.url || "",
      },
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { stripeCheckoutId, stripePaymentIntentId } = params;

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

    // The most recent application is the one the customer paid for
    const acceptedApp = applications[0];

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
