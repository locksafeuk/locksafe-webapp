/**
 * LockSafe UK - SMS Templates for Emergency Workflow
 *
 * Templates for the new emergency workflow:
 * 1. Locksmith notification of emergency job
 * 2. Customer payment link with locksmith details
 * 3. Customer onboarding reminder
 * 4. Customer payment confirmation
 * 5. Locksmith job confirmation
 */

export interface EmergencyContext {
  jobId: string;
  jobNumber: string;
  customerName: string;
  customerPhone?: string;
  locksmithName?: string;
  locksmithPhone?: string;
  companyName?: string;
  problemType?: string;
  postcode?: string;
  address?: string;
  eta?: string;
  etaMinutes?: number;
  callOutFee?: number;
  paymentUrl?: string;
  onboardingUrl?: string;
  distance?: number;
  rating?: number;
  totalJobs?: number;
}

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

export const EMERGENCY_SMS_TEMPLATES = {
  // ==========================================
  // LOCKSMITH NOTIFICATIONS
  // ==========================================

  /**
   * Sent to nearby locksmiths when emergency job is created
   */
  LOCKSMITH_EMERGENCY_JOB: (ctx: EmergencyContext) => {
    const problem = problemLabels[ctx.problemType || ""] || ctx.problemType || "Emergency";
    return `🚨 LockSafe EMERGENCY: Job ${ctx.jobNumber}\n\n${problem} at ${ctx.postcode}${ctx.distance ? ` (${ctx.distance} mi)` : ""}\nCustomer: ${ctx.customerName}\n\nApply now: ${getBaseUrl()}/locksmith/jobs/${ctx.jobId}`;
  },

  /**
   * Sent to locksmith when their application is accepted and customer pays
   */
  LOCKSMITH_JOB_CONFIRMED: (ctx: EmergencyContext) =>
    `✅ LockSafe: Job ${ctx.jobNumber} CONFIRMED!\n\nCustomer ${ctx.customerName} has paid the call-out fee.\nAddress: ${ctx.address || ctx.postcode}\n\nHead there now: ${getBaseUrl()}/locksmith/job/${ctx.jobId}`,

  /**
   * Sent to locksmith when their application is accepted (before payment)
   */
  LOCKSMITH_APPLICATION_SELECTED: (ctx: EmergencyContext) =>
    `LockSafe: Your application for ${ctx.jobNumber} was selected! The customer is completing payment now. Stand by for confirmation.`,

  // ==========================================
  // CUSTOMER NOTIFICATIONS
  // ==========================================

  /**
   * Sent to customer when a locksmith applies - includes payment link
   * This is the KEY message in the emergency workflow
   */
  CUSTOMER_LOCKSMITH_APPLIED: (ctx: EmergencyContext) => {
    const ratingText = ctx.rating ? ` ⭐ ${ctx.rating.toFixed(1)}` : "";
    const etaText = ctx.eta || (ctx.etaMinutes ? `${ctx.etaMinutes} mins` : "ASAP");
    return `LockSafe UK: A locksmith is ready to help!\n\n👤 ${ctx.locksmithName}${ctx.companyName ? ` (${ctx.companyName})` : ""}${ratingText}\n⏱ ETA: ${etaText}\n💷 Call-out fee: £${ctx.callOutFee?.toFixed(2)}\n\nPay to confirm: ${ctx.paymentUrl}\n\nThis covers the call-out. Work is quoted separately on-site.`;
  },

  /**
   * Sent to customer after successful payment - redirect to onboarding
   */
  CUSTOMER_PAYMENT_CONFIRMED: (ctx: EmergencyContext) =>
    `✅ LockSafe UK: Payment confirmed for ${ctx.jobNumber}!\n\n${ctx.locksmithName} is on the way. ETA: ${ctx.eta || "Soon"}\n\nComplete your account: ${ctx.onboardingUrl || `${getBaseUrl()}/customer/onboard?job=${ctx.jobId}`}`,

  /**
   * Sent to customer as onboarding reminder if not completed
   */
  CUSTOMER_ONBOARDING_REMINDER: (ctx: EmergencyContext) =>
    `LockSafe UK: Almost done! Set your password to track ${ctx.locksmithName}'s arrival and manage your job.\n\n${ctx.onboardingUrl || `${getBaseUrl()}/customer/onboard?job=${ctx.jobId}`}`,

  /**
   * Sent to customer when job is first created (emergency acknowledgment)
   */
  CUSTOMER_EMERGENCY_CREATED: (ctx: EmergencyContext) =>
    `LockSafe UK: Your emergency request ${ctx.jobNumber} is live!\n\nWe're notifying nearby verified locksmiths now. You'll receive an SMS with locksmith details and payment link shortly.\n\nStay by your phone.`,

  /**
   * Sent to customer if no locksmiths available
   */
  CUSTOMER_NO_LOCKSMITHS: (ctx: EmergencyContext) =>
    `LockSafe UK: We're still looking for a locksmith near ${ctx.postcode} for your job ${ctx.jobNumber}.\n\nWe'll keep trying and notify you as soon as one is available. You can also call us: 0333 999 3127`,
};

/**
 * Format a payment URL for SMS - keep it short
 */
export function formatPaymentUrl(checkoutUrl: string): string {
  // Stripe Checkout URLs are already reasonably short
  // But we can use the site URL as a proxy if needed
  return checkoutUrl;
}
