/**
 * LockSafe UK - Twilio SMS Notification Service
 *
 * Sends SMS notifications to customers and locksmiths throughout the job lifecycle.
 *
 * Required Environment Variables:
 * - TWILIO_ACCOUNT_SID: Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Twilio Auth Token
 * - TWILIO_PHONE_NUMBER: UK phone number purchased from Twilio (+44...)
 * - NEXT_PUBLIC_BASE_URL: Base URL for links (e.g., https://locksafe.uk)
 */

// ============================================
// TYPES
// ============================================

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface JobSMSContext {
  jobId: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  locksmithName?: string;
  locksmithPhone?: string;
  problemType?: string;
  postcode?: string;
  address?: string;
  eta?: string;
  assessmentFee?: number;
  quotedAmount?: number;
  finalAmount?: number;
}

// ============================================
// SMS TEMPLATES
// ============================================

/**
 * SMS Templates for different job events
 * Keep messages under 160 characters for single SMS where possible
 */
export const SMS_TEMPLATES = {
  // ==========================================
  // CUSTOMER NOTIFICATIONS
  // ==========================================

  // When job is submitted
  CUSTOMER_JOB_SUBMITTED: (ctx: JobSMSContext) =>
    `LockSafe UK: Your request ${ctx.jobNumber} is live! Local locksmiths are now sending quotes. Track: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // When a locksmith applies/sends quote
  CUSTOMER_QUOTE_RECEIVED: (ctx: JobSMSContext) =>
    `LockSafe UK: ${ctx.locksmithName} has sent you a quote for ${ctx.jobNumber}. Assessment fee: £${ctx.assessmentFee}. View quotes: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // When customer accepts a locksmith
  CUSTOMER_LOCKSMITH_ACCEPTED: (ctx: JobSMSContext) =>
    `LockSafe UK: You've accepted ${ctx.locksmithName} for ${ctx.jobNumber}. They're on their way! ETA: ${ctx.eta || "Soon"}. Track: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // When locksmith is en route
  CUSTOMER_LOCKSMITH_EN_ROUTE: (ctx: JobSMSContext) =>
    `LockSafe UK: ${ctx.locksmithName} is on the way to ${ctx.postcode}. ETA: ${ctx.eta || "15-30 mins"}. Track live: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // When locksmith arrives
  CUSTOMER_LOCKSMITH_ARRIVED: (ctx: JobSMSContext) =>
    `LockSafe UK: ${ctx.locksmithName} has arrived at your location for ${ctx.jobNumber}. They will assess the situation now.`,

  // When locksmith sends full quote
  CUSTOMER_FULL_QUOTE: (ctx: JobSMSContext) =>
    `LockSafe UK: ${ctx.locksmithName} has quoted £${ctx.quotedAmount} for the work on ${ctx.jobNumber}. Review & approve: ${getBaseUrl()}/customer/job/${ctx.jobId}/quote`,

  // When work is in progress
  CUSTOMER_WORK_STARTED: (ctx: JobSMSContext) =>
    `LockSafe UK: ${ctx.locksmithName} has started work on ${ctx.jobNumber}. You'll be notified when complete.`,

  // When work is completed
  CUSTOMER_WORK_COMPLETED: (ctx: JobSMSContext) =>
    `LockSafe UK: Job ${ctx.jobNumber} is complete! Total: £${ctx.finalAmount}. Please confirm & sign: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // Reminder to confirm completion
  CUSTOMER_CONFIRMATION_REMINDER: (ctx: JobSMSContext) =>
    `LockSafe UK: Please confirm job ${ctx.jobNumber} is complete and sign. This releases payment to ${ctx.locksmithName}: ${getBaseUrl()}/customer/job/${ctx.jobId}`,

  // Request for review
  CUSTOMER_REVIEW_REQUEST: (ctx: JobSMSContext) =>
    `LockSafe UK: Thanks for using us! Please rate ${ctx.locksmithName}: ${getBaseUrl()}/review/${ctx.jobId}`,

  // Payment successful
  CUSTOMER_PAYMENT_SUCCESS: (ctx: JobSMSContext) =>
    `LockSafe UK: Payment of £${ctx.finalAmount} confirmed for ${ctx.jobNumber}. Thank you for choosing LockSafe UK!`,

  // Refund processed
  CUSTOMER_REFUND_PROCESSED: (ctx: JobSMSContext) =>
    `LockSafe UK: Your refund of £${ctx.finalAmount} for ${ctx.jobNumber} has been processed. It should appear in 5-10 business days.`,

  // ==========================================
  // LOCKSMITH NOTIFICATIONS
  // ==========================================

  // New job available in area
  LOCKSMITH_NEW_JOB: (ctx: JobSMSContext) =>
    `LockSafe: New ${ctx.problemType || "locksmith"} job in ${ctx.postcode}! ${ctx.address || ""}. Apply now: ${getBaseUrl()}/locksmith/jobs`,

  // Application accepted by customer
  LOCKSMITH_APPLICATION_ACCEPTED: (ctx: JobSMSContext) =>
    `LockSafe: ${ctx.customerName} has accepted your quote for ${ctx.jobNumber}! Head to ${ctx.postcode} now. Details: ${getBaseUrl()}/locksmith/job/${ctx.jobId}`,

  // Reminder to update status
  LOCKSMITH_UPDATE_STATUS: (ctx: JobSMSContext) =>
    `LockSafe: Please update your status for ${ctx.jobNumber}. Mark as arrived when on site: ${getBaseUrl()}/locksmith/job/${ctx.jobId}`,

  // Customer approved quote
  LOCKSMITH_QUOTE_APPROVED: (ctx: JobSMSContext) =>
    `LockSafe: ${ctx.customerName} approved your £${ctx.quotedAmount} quote for ${ctx.jobNumber}. You can start work now!`,

  // Customer signed/confirmed
  LOCKSMITH_JOB_SIGNED: (ctx: JobSMSContext) =>
    `LockSafe: ${ctx.customerName} has signed off on ${ctx.jobNumber}. Payment of £${ctx.finalAmount} is being processed.`,

  // Payment received
  LOCKSMITH_PAYMENT_RECEIVED: (ctx: JobSMSContext) =>
    `LockSafe: Payment of £${ctx.finalAmount} for ${ctx.jobNumber} has been sent to your account. Well done!`,

  // New review received
  LOCKSMITH_NEW_REVIEW: (ctx: JobSMSContext) =>
    `LockSafe: You received a new review from ${ctx.customerName}! Check it: ${getBaseUrl()}/locksmith/dashboard`,

  // ==========================================
  // PHONE BOOKING (BLAND.AI)
  // ==========================================

  // Continue request link (from phone call)
  CUSTOMER_PHONE_CONTINUE: (ctx: JobSMSContext & { continueUrl: string }) =>
    `LockSafe UK: Your emergency request ${ctx.jobNumber} is registered. Complete here: ${ctx.continueUrl}`,

  // ==========================================
  // AUTO-DISPATCH LOCKSMITH NOTIFICATIONS
  // ==========================================

  // When locksmith is auto-dispatched to a job (immediate alert)
  LOCKSMITH_AUTO_DISPATCHED: (ctx: JobSMSContext) =>
    `🚨 LockSafe AUTO-DISPATCH: You've been assigned ${ctx.jobNumber} at ${ctx.postcode}! ${ctx.problemType || "Emergency"}. Accept now: ${getBaseUrl()}/locksmith/job/${ctx.jobId}`,

  // Follow-up with customer details
  LOCKSMITH_AUTO_DISPATCH_DETAILS: (ctx: JobSMSContext) =>
    `Job ${ctx.jobNumber}: ${ctx.customerName} needs help at ${ctx.address || ctx.postcode}. Assessment fee: £${ctx.assessmentFee}. Call if needed: ${ctx.customerPhone?.replace('+44', '0')}`,

  // Reminder if no response to auto-dispatch
  LOCKSMITH_AUTO_DISPATCH_REMINDER: (ctx: JobSMSContext) =>
    `⏰ LockSafe: You've been auto-dispatched to ${ctx.jobNumber} but haven't responded. Accept/decline: ${getBaseUrl()}/locksmith/job/${ctx.jobId}`,

  // Confirmation of auto-dispatch acceptance
  LOCKSMITH_AUTO_DISPATCH_CONFIRMED: (ctx: JobSMSContext) =>
    `✅ LockSafe: Great! You've accepted ${ctx.jobNumber}. Head to ${ctx.postcode} now. Customer notified. Update status when en route!`,

  // When auto-dispatch is reassigned (locksmith didn't respond)
  LOCKSMITH_AUTO_DISPATCH_EXPIRED: (ctx: JobSMSContext) =>
    `LockSafe: ${ctx.jobNumber} auto-dispatch expired - job reassigned. Keep your availability updated to receive jobs.`,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";
}

function getTwilioCredentials() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    // Use SMS-specific number if available, otherwise fall back to main number
    phoneNumber: process.env.TWILIO_SMS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER,
  };
}

/**
 * Normalize phone number to E.164 format
 * Handles UK numbers (07...) and international numbers (+XX...)
 */
function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all whitespace
  let normalized = phone.replace(/\s+/g, "");

  // Remove any non-digit characters except +
  normalized = normalized.replace(/[^\d+]/g, "");

  // If already in E.164 format (starts with +), return as is
  if (normalized.startsWith("+")) {
    return normalized;
  }

  // Convert UK 07... to +447...
  if (normalized.startsWith("07") && normalized.length === 11) {
    normalized = "+44" + normalized.slice(1);
  }
  // Convert UK 447... to +447...
  else if (normalized.startsWith("447")) {
    normalized = "+" + normalized;
  }
  // Convert UK 0044... to +44...
  else if (normalized.startsWith("0044")) {
    normalized = "+" + normalized.slice(2);
  }
  // If it's a long number without +, assume it needs one
  else if (normalized.length >= 10 && !normalized.startsWith("0")) {
    normalized = "+" + normalized;
  }

  return normalized;
}

// ============================================
// CORE SMS FUNCTION
// ============================================

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  to: string,
  message: string,
  options?: { logContext?: string }
): Promise<SMSResult> {
  const { accountSid, authToken, phoneNumber } = getTwilioCredentials();

  // Check if Twilio is configured
  if (!accountSid || !authToken || !phoneNumber) {
    console.warn("[SMS] Twilio not configured - SMS not sent");
    console.warn("[SMS] Would have sent:", { to, message: message.slice(0, 50) + "..." });
    return {
      success: false,
      error: "Twilio not configured",
    };
  }

  // Normalize phone number
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo || !normalizedTo.startsWith("+")) {
    console.error("[SMS] Invalid phone number:", to);
    return {
      success: false,
      error: "Invalid phone number format",
    };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          To: normalizedTo,
          From: phoneNumber,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log(`[SMS] Sent successfully to ${normalizedTo}`, {
        context: options?.logContext,
        sid: data.sid,
      });
      return {
        success: true,
        messageId: data.sid,
      };
    }

    console.error("[SMS] Twilio error:", data);
    return {
      success: false,
      error: data.message || "Failed to send SMS",
    };
  } catch (error) {
    console.error("[SMS] Error sending SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// JOB NOTIFICATION FUNCTIONS
// ============================================

/**
 * Notify customer when job is submitted
 */
export async function notifyCustomerJobSubmitted(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_JOB_SUBMITTED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `job-submitted:${ctx.jobNumber}` });
}

/**
 * Notify customer when they receive a quote
 */
export async function notifyCustomerQuoteReceived(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_QUOTE_RECEIVED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `quote-received:${ctx.jobNumber}` });
}

/**
 * Notify customer when locksmith is accepted
 */
export async function notifyCustomerLocksmithAccepted(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_LOCKSMITH_ACCEPTED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `locksmith-accepted:${ctx.jobNumber}` });
}

/**
 * Notify customer when locksmith is en route
 */
export async function notifyCustomerLocksmithEnRoute(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_LOCKSMITH_EN_ROUTE(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `en-route:${ctx.jobNumber}` });
}

/**
 * Notify customer when locksmith arrives
 */
export async function notifyCustomerLocksmithArrived(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_LOCKSMITH_ARRIVED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `arrived:${ctx.jobNumber}` });
}

/**
 * Notify customer of full quote
 */
export async function notifyCustomerFullQuote(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_FULL_QUOTE(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `full-quote:${ctx.jobNumber}` });
}

/**
 * Notify customer work has started
 */
export async function notifyCustomerWorkStarted(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_WORK_STARTED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `work-started:${ctx.jobNumber}` });
}

/**
 * Notify customer work is completed
 */
export async function notifyCustomerWorkCompleted(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_WORK_COMPLETED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `work-completed:${ctx.jobNumber}` });
}

/**
 * Send confirmation reminder to customer
 */
export async function notifyCustomerConfirmationReminder(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_CONFIRMATION_REMINDER(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `confirm-reminder:${ctx.jobNumber}` });
}

/**
 * Request review from customer
 */
export async function notifyCustomerReviewRequest(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_REVIEW_REQUEST(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `review-request:${ctx.jobNumber}` });
}

/**
 * Notify customer of successful payment
 */
export async function notifyCustomerPaymentSuccess(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_PAYMENT_SUCCESS(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `payment-success:${ctx.jobNumber}` });
}

/**
 * Notify customer of refund
 */
export async function notifyCustomerRefund(ctx: JobSMSContext): Promise<SMSResult> {
  const message = SMS_TEMPLATES.CUSTOMER_REFUND_PROCESSED(ctx);
  return sendSMS(ctx.customerPhone, message, { logContext: `refund:${ctx.jobNumber}` });
}

// ============================================
// LOCKSMITH NOTIFICATIONS
// ============================================

/**
 * Notify locksmith of new job in area
 */
export async function notifyLocksmithNewJob(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_NEW_JOB(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `new-job:${ctx.jobNumber}` });
}

/**
 * Notify locksmith their application was accepted
 */
export async function notifyLocksmithApplicationAccepted(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_APPLICATION_ACCEPTED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `accepted:${ctx.jobNumber}` });
}

/**
 * Remind locksmith to update status
 */
export async function notifyLocksmithUpdateStatus(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_UPDATE_STATUS(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `status-reminder:${ctx.jobNumber}` });
}

/**
 * Notify locksmith quote was approved
 */
export async function notifyLocksmithQuoteApproved(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_QUOTE_APPROVED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `quote-approved:${ctx.jobNumber}` });
}

/**
 * Notify locksmith job was signed off
 */
export async function notifyLocksmithJobSigned(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_JOB_SIGNED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `signed:${ctx.jobNumber}` });
}

/**
 * Notify locksmith payment received
 */
export async function notifyLocksmithPaymentReceived(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_PAYMENT_RECEIVED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `payment:${ctx.jobNumber}` });
}

/**
 * Notify locksmith of new review
 */
export async function notifyLocksmithNewReview(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_NEW_REVIEW(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `review:${ctx.jobNumber}` });
}

// ============================================
// AUTO-DISPATCH LOCKSMITH NOTIFICATIONS
// ============================================

/**
 * Notify locksmith they've been auto-dispatched to a job
 */
export async function notifyLocksmithAutoDispatched(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_AUTO_DISPATCHED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `auto-dispatch:${ctx.jobNumber}` });
}

/**
 * Send follow-up details after auto-dispatch
 */
export async function notifyLocksmithAutoDispatchDetails(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_AUTO_DISPATCH_DETAILS(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `auto-dispatch-details:${ctx.jobNumber}` });
}

/**
 * Send reminder for auto-dispatch that hasn't been acknowledged
 */
export async function notifyLocksmithAutoDispatchReminder(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_AUTO_DISPATCH_REMINDER(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `auto-dispatch-reminder:${ctx.jobNumber}` });
}

/**
 * Notify locksmith their auto-dispatch acceptance is confirmed
 */
export async function notifyLocksmithAutoDispatchConfirmed(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_AUTO_DISPATCH_CONFIRMED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `auto-dispatch-confirmed:${ctx.jobNumber}` });
}

/**
 * Notify locksmith their auto-dispatch expired and was reassigned
 */
export async function notifyLocksmithAutoDispatchExpired(ctx: JobSMSContext): Promise<SMSResult> {
  if (!ctx.locksmithPhone) {
    return { success: false, error: "No locksmith phone" };
  }
  const message = SMS_TEMPLATES.LOCKSMITH_AUTO_DISPATCH_EXPIRED(ctx);
  return sendSMS(ctx.locksmithPhone, message, { logContext: `auto-dispatch-expired:${ctx.jobNumber}` });
}

/**
 * Send complete auto-dispatch notification sequence
 * Sends main alert followed by details after short delay
 */
export async function sendAutoDispatchNotification(ctx: JobSMSContext): Promise<{ alert: SMSResult; details: SMSResult }> {
  // Send immediate alert
  const alertResult = await notifyLocksmithAutoDispatched(ctx);

  // Wait 2 seconds then send details
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const detailsResult = await notifyLocksmithAutoDispatchDetails(ctx);

  console.log(`[SMS] Auto-dispatch notification sent to ${ctx.locksmithName} for ${ctx.jobNumber}`);

  return { alert: alertResult, details: detailsResult };
}

// ============================================
// BULK NOTIFICATIONS
// ============================================

/**
 * Notify multiple locksmiths of a new job
 */
export async function notifyLocksmiths(
  locksmiths: Array<{ phone: string; name: string }>,
  ctx: Omit<JobSMSContext, "locksmithPhone" | "locksmithName">
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const locksmith of locksmiths) {
    const result = await notifyLocksmithNewJob({
      ...ctx,
      locksmithPhone: locksmith.phone,
      locksmithName: locksmith.name,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`[SMS] Notified ${sent} locksmiths (${failed} failed) for ${ctx.jobNumber}`);
  return { sent, failed };
}

// ============================================
// COMBINED NOTIFICATION HELPER
// ============================================

export type JobEventType =
  | "job_submitted"
  | "quote_received"
  | "locksmith_accepted"
  | "en_route"
  | "arrived"
  | "full_quote"
  | "quote_approved"
  | "work_started"
  | "work_completed"
  | "job_signed"
  | "payment_success"
  | "payment_received"
  | "review_request"
  | "refund"
  | "auto_dispatched"
  | "auto_dispatch_reminder"
  | "auto_dispatch_confirmed"
  | "auto_dispatch_expired";

/**
 * Send appropriate notifications for a job event
 * Handles both customer and locksmith notifications
 */
export async function sendJobNotification(
  event: JobEventType,
  ctx: JobSMSContext
): Promise<{ customer?: SMSResult; locksmith?: SMSResult }> {
  const results: { customer?: SMSResult; locksmith?: SMSResult } = {};

  switch (event) {
    case "job_submitted":
      results.customer = await notifyCustomerJobSubmitted(ctx);
      break;

    case "quote_received":
      results.customer = await notifyCustomerQuoteReceived(ctx);
      break;

    case "locksmith_accepted":
      results.customer = await notifyCustomerLocksmithAccepted(ctx);
      results.locksmith = await notifyLocksmithApplicationAccepted(ctx);
      break;

    case "en_route":
      results.customer = await notifyCustomerLocksmithEnRoute(ctx);
      break;

    case "arrived":
      results.customer = await notifyCustomerLocksmithArrived(ctx);
      break;

    case "full_quote":
      results.customer = await notifyCustomerFullQuote(ctx);
      break;

    case "quote_approved":
      results.locksmith = await notifyLocksmithQuoteApproved(ctx);
      break;

    case "work_started":
      results.customer = await notifyCustomerWorkStarted(ctx);
      break;

    case "work_completed":
      results.customer = await notifyCustomerWorkCompleted(ctx);
      break;

    case "job_signed":
      results.locksmith = await notifyLocksmithJobSigned(ctx);
      break;

    case "payment_success":
      results.customer = await notifyCustomerPaymentSuccess(ctx);
      break;

    case "payment_received":
      results.locksmith = await notifyLocksmithPaymentReceived(ctx);
      break;

    case "review_request":
      results.customer = await notifyCustomerReviewRequest(ctx);
      break;

    case "refund":
      results.customer = await notifyCustomerRefund(ctx);
      break;

    case "auto_dispatched":
      results.locksmith = await notifyLocksmithAutoDispatched(ctx);
      break;

    case "auto_dispatch_reminder":
      results.locksmith = await notifyLocksmithAutoDispatchReminder(ctx);
      break;

    case "auto_dispatch_confirmed":
      results.locksmith = await notifyLocksmithAutoDispatchConfirmed(ctx);
      // Also notify customer that locksmith is on the way
      results.customer = await notifyCustomerLocksmithAccepted(ctx);
      break;

    case "auto_dispatch_expired":
      results.locksmith = await notifyLocksmithAutoDispatchExpired(ctx);
      break;
  }

  return results;
}
