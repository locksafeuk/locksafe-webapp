/**
 * Customer Service - Shared business logic for customer operations
 *
 * Used by:
 * - Bland AI voice calls
 * - WhatsApp conversations
 * - Website registration
 * - API endpoints
 */

import prisma from "@/lib/db";
import crypto from "node:crypto";

// ============================================
// TYPES
// ============================================

export interface CheckOrCreateCustomerInput {
  email: string;
  phone: string;
  name: string;
  source?: "website" | "bland_ai" | "whatsapp" | "api";
}

export interface CheckOrCreateCustomerResult {
  customerId: string;
  isNew: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  passwordResetToken?: string;
}

export interface CreateJobInput {
  customerId: string;
  postcode: string;
  address: string;
  serviceType: string;
  propertyType: string;
  description?: string;
  isUrgent?: boolean;
  source?: "website" | "bland_ai" | "whatsapp" | "api";
  sourceCallId?: string; // Bland call ID or WhatsApp message ID
}

export interface CreateJobResult {
  jobId: string;
  jobNumber: string;
  continueUrl: string;
  job: {
    id: string;
    jobNumber: string;
    status: string;
    postcode: string;
    address: string;
    problemType: string;
    propertyType: string;
  };
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

/**
 * Check if customer exists, create if not
 * Returns customer ID and whether it's a new account
 */
export async function checkOrCreateCustomer(
  input: CheckOrCreateCustomerInput
): Promise<CheckOrCreateCustomerResult> {
  const { email, phone, name, source = "api" } = input;

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  // Check if customer exists by email
  let customer = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
  });

  let isNew = false;
  let passwordResetToken: string | undefined;

  if (!customer) {
    // Check by phone as fallback
    customer = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: phone.replace(/\D/g, "").slice(-10),
        },
      },
    });
  }

  if (!customer) {
    // Create new customer
    isNew = true;

    // Generate password reset token for new accounts
    passwordResetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    customer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        phone: normalizePhoneNumber(phone),
        name: name.trim(),
        // No password - they'll set it via reset link
        resetToken: passwordResetToken,
        resetTokenExpiry: tokenExpiry,
        // Track source
        createdVia: source === "whatsapp" ? "app" : source === "bland_ai" ? "phone" : "web",
      },
    });

    console.log(`[CustomerService] Created new customer: ${customer.id} via ${source}`);
  } else {
    // Update phone if different
    if (phone && customer.phone !== normalizePhoneNumber(phone)) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { phone: normalizePhoneNumber(phone) },
      });
    }

    console.log(`[CustomerService] Found existing customer: ${customer.id}`);
  }

  return {
    customerId: customer.id,
    isNew,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone,
    },
    passwordResetToken,
  };
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string) {
  return prisma.customer.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });
}

/**
 * Get customer by phone
 */
export async function getCustomerByPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "").slice(-10);

  return prisma.customer.findFirst({
    where: {
      phone: { contains: normalized },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });
}

// ============================================
// JOB OPERATIONS
// ============================================

/**
 * Create a new job request
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  const {
    customerId,
    postcode,
    address,
    serviceType,
    propertyType,
    description,
    isUrgent = false,
    source = "api",
    sourceCallId,
  } = input;

  // Generate job number
  const jobNumber = await generateJobNumber();

  // Default assessment fee
  const assessmentFee = 29;

  // Map service type to problem type
  const problemTypeMap: Record<string, string> = {
    locked_out: "Locked Out",
    broken_lock: "Broken Lock",
    key_stuck: "Key Stuck/Broken",
    lost_keys: "Lost Keys",
    lock_change: "Lock Change",
    burglary: "Burglary/Break-in",
    other: "Other",
  };

  const problemType = problemTypeMap[serviceType] || serviceType;

  // Map property type
  const propertyTypeMap: Record<string, string> = {
    house: "House",
    flat: "Flat/Apartment",
    commercial: "Commercial",
    car: "Vehicle",
  };

  const mappedPropertyType = propertyTypeMap[propertyType] || propertyType;

  // Generate continue token for passwordless access
  const continueToken = crypto.randomBytes(32).toString("hex");

  // Generate continue URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
  const continueUrl = `${siteUrl}/continue-request/${continueToken}`;

  // Determine source for tracking
  const createdVia = source === "whatsapp" ? "app" : source === "bland_ai" ? "phone" : "web";

  // Create the job with continue token
  const job = await prisma.job.create({
    data: {
      jobNumber,
      customerId,
      postcode: postcode.toUpperCase(),
      address,
      problemType,
      propertyType: mappedPropertyType,
      description: description || problemType,
      assessmentFee,
      status: "PENDING",
      createdVia,
      continueToken,
      // Track source call ID if provided
      ...(sourceCallId && { blandCallId: sourceCallId }),
    },
  });

  console.log(`[CustomerService] Created job: ${jobNumber} via ${source}`);

  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    continueUrl,
    job: {
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      postcode: job.postcode,
      address: job.address,
      problemType: job.problemType,
      propertyType: job.propertyType,
    },
  };
}

/**
 * Generate unique job number: LS-DDMM-XXXX
 */
async function generateJobNumber(): Promise<string> {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `LS-${day}${month}`;

  // Find highest job number for today
  const latestJob = await prisma.job.findFirst({
    where: {
      jobNumber: { startsWith: prefix },
    },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  let sequence = 1;
  if (latestJob) {
    const lastSequence = parseInt(latestJob.jobNumber.split("-")[2], 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, "0")}`;
}

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

/**
 * Send job notifications (SMS + Email)
 */
export async function sendJobNotifications(params: {
  jobId: string;
  customerId: string;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  jobNumber: string;
  continueUrl: string;
}): Promise<{ smsSuccess: boolean; emailSuccess: boolean }> {
  const { jobId, customerId, customerPhone, customerEmail, customerName, jobNumber, continueUrl } = params;

  let smsSuccess = false;
  let emailSuccess = false;

  // Send SMS
  try {
    const { sendSMS } = await import("@/lib/sms");

    const smsMessage =
      `LockSafe UK: Your job ${jobNumber} has been created.\n\n` +
      `View quotes from locksmiths and manage your request:\n${continueUrl}\n\n` +
      `Questions? Reply to this message.`;

    await sendSMS(customerPhone, smsMessage);
    smsSuccess = true;
    console.log(`[Notifications] SMS sent to ${customerPhone}`);
  } catch (error) {
    console.error("[Notifications] SMS error:", error);
  }

  // Send Email using Resend
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@locksafe.uk";

    if (RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: customerEmail,
          subject: `Your LockSafe Job Request: ${jobNumber}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Hi ${customerName},</h2>

              <p>Your locksmith request has been created successfully!</p>

              <p><strong>Reference:</strong> ${jobNumber}</p>

              <h3>What happens next?</h3>
              <ol>
                <li>Local locksmiths will see your request and send quotes</li>
                <li>Review quotes on your dashboard (price + arrival time)</li>
                <li>Accept a quote and pay the assessment fee</li>
                <li>Your locksmith will head to you!</li>
              </ol>

              <p>
                <a href="${continueUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  View Your Dashboard
                </a>
              </p>

              <p><em>Important: No locksmith is dispatched until you accept a quote on your dashboard.</em></p>

              <hr style="margin: 20px 0;">
              <p style="color: #666;">LockSafe UK - 24/7 Emergency Locksmith Service</p>
              <p><a href="https://www.locksafe.uk">www.locksafe.uk</a></p>
            </div>
          `,
        }),
      });

      if (response.ok) {
        emailSuccess = true;
        console.log(`[Notifications] Email sent to ${customerEmail}`);
      }
    }
  } catch (error) {
    console.error("[Notifications] Email error:", error);
  }

  return { smsSuccess, emailSuccess };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  // Convert UK 07 to +447
  if (normalized.startsWith("07") && normalized.length === 11) {
    normalized = "+44" + normalized.slice(1);
  }

  // Add + if starts with country code but no +
  if (normalized.startsWith("44") && !normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }

  return normalized;
}
