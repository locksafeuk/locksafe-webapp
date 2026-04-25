/**
 * Telegram Notification Service for LockSafe UK
 *
 * Sends instant notifications via Telegram when key events happen:
 * - New customer registration
 * - New locksmith registration
 * - New job listed
 * - Locksmith application submitted
 * - Quote accepted
 * - Job completed
 * - Payment received
 * - etc.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true";

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(message: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  if (!TELEGRAM_ENABLED) {
    console.log("[Telegram] Notifications disabled");
    return false;
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Missing bot token or chat ID");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data: TelegramResponse = await response.json();

    if (!data.ok) {
      console.error("[Telegram] API error:", data.description);
      return false;
    }

    console.log("[Telegram] Message sent successfully");
    return true;
  } catch (error) {
    console.error("[Telegram] Failed to send message:", error);
    return false;
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Notify when a new customer registers
 */
export async function notifyNewCustomer(data: {
  name: string;
  email: string;
  phone: string;
}): Promise<boolean> {
  const message = `
🆕 <b>New Customer Registered</b>

👤 <b>Name:</b> ${escapeHtml(data.name)}
📧 <b>Email:</b> ${escapeHtml(data.email)}
📱 <b>Phone:</b> ${escapeHtml(data.phone)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a new locksmith registers
 */
export async function notifyNewLocksmith(data: {
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  baseAddress?: string | null;
  coverageRadius?: number | null;
}): Promise<boolean> {
  const message = `
🔧 <b>New Locksmith Registered</b>

👤 <b>Name:</b> ${escapeHtml(data.name)}
🏢 <b>Company:</b> ${data.companyName ? escapeHtml(data.companyName) : "Individual"}
📧 <b>Email:</b> ${escapeHtml(data.email)}
📱 <b>Phone:</b> ${escapeHtml(data.phone)}
📍 <b>Base:</b> ${data.baseAddress ? escapeHtml(data.baseAddress) : "Not set"}
🎯 <b>Coverage:</b> ${data.coverageRadius || 10} miles

⚠️ <i>Pending verification</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a new job is listed
 */
export async function notifyNewJob(data: {
  jobNumber: string;
  jobId: string;
  customerName: string;
  customerPhone: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  description?: string | null;
  isUrgent?: boolean;
}): Promise<boolean> {
  const urgentTag = data.isUrgent ? "🚨 <b>URGENT</b> " : "";

  const message = `
${urgentTag}📋 <b>New Job Listed</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
🔐 <b>Problem:</b> ${escapeHtml(data.problemType)}
🏠 <b>Property:</b> ${escapeHtml(data.propertyType)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
📱 <b>Phone:</b> ${escapeHtml(data.customerPhone)}

📍 <b>Location:</b>
${escapeHtml(data.address)}
${escapeHtml(data.postcode)}

${data.description ? `📝 <b>Notes:</b> ${escapeHtml(data.description)}` : ""}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a locksmith applies to a job
 */
export async function notifyLocksmithApplication(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  locksmithCompany?: string | null;
  locksmithPhone: string;
  customerName: string;
  estimatedArrival: string;
  distanceMiles?: number | null;
}): Promise<boolean> {
  const message = `
✋ <b>New Job Application</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
${data.locksmithCompany ? `🏢 <b>Company:</b> ${escapeHtml(data.locksmithCompany)}` : ""}
📱 <b>Phone:</b> ${escapeHtml(data.locksmithPhone)}
${data.distanceMiles ? `📏 <b>Distance:</b> ${data.distanceMiles.toFixed(1)} miles` : ""}
⏱️ <b>ETA:</b> ${escapeHtml(data.estimatedArrival)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when an application is accepted (locksmith assigned)
 */
export async function notifyApplicationAccepted(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  locksmithPhone: string;
  customerName: string;
  customerPhone: string;
  address: string;
  postcode: string;
  estimatedArrival: string;
}): Promise<boolean> {
  const message = `
✅ <b>Application Accepted</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}

🔧 <b>Assigned Locksmith:</b> ${escapeHtml(data.locksmithName)}
📱 <b>Phone:</b> ${escapeHtml(data.locksmithPhone)}
⏱️ <b>ETA:</b> ${escapeHtml(data.estimatedArrival)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
📱 <b>Phone:</b> ${escapeHtml(data.customerPhone)}
📍 <b>Location:</b> ${escapeHtml(data.address)}, ${escapeHtml(data.postcode)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when assessment fee is paid
 */
export async function notifyAssessmentFeePaid(data: {
  jobNumber: string;
  jobId: string;
  customerName: string;
  locksmithName: string;
  amount: number;
}): Promise<boolean> {
  const message = `
💳 <b>Assessment Fee Paid</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💰 <b>Amount:</b> ${formatCurrency(data.amount)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a quote is submitted by locksmith
 */
export async function notifyQuoteSubmitted(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  labourCost: number;
  partsCost: number;
  total: number;
  description?: string | null;
}): Promise<boolean> {
  const message = `
📝 <b>Quote Submitted</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}

💰 <b>Quote Breakdown:</b>
• Labour: ${formatCurrency(data.labourCost)}
• Parts: ${formatCurrency(data.partsCost)}
• <b>Total: ${formatCurrency(data.total)}</b>

${data.description ? `📋 <b>Work:</b> ${escapeHtml(data.description)}` : ""}

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
👤 <b>Customer:</b> ${escapeHtml(data.customerName)}

⏳ <i>Awaiting customer approval</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a quote is accepted by customer
 */
export async function notifyQuoteAccepted(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  total: number;
}): Promise<boolean> {
  const message = `
✅ <b>Quote Accepted</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💰 <b>Total:</b> ${formatCurrency(data.total)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

🚀 <i>Work approved - locksmith can proceed</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a quote is declined by customer
 */
export async function notifyQuoteDeclined(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  total: number;
  reason?: string | null;
}): Promise<boolean> {
  const message = `
❌ <b>Quote Declined</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💰 <b>Quote was:</b> ${formatCurrency(data.total)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

${data.reason ? `📝 <b>Reason:</b> ${escapeHtml(data.reason)}` : ""}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when locksmith marks work as complete
 */
export async function notifyWorkCompleted(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  total: number;
}): Promise<boolean> {
  const message = `
🔨 <b>Work Completed</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💰 <b>Total:</b> ${formatCurrency(data.total)}

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
👤 <b>Customer:</b> ${escapeHtml(data.customerName)}

⏳ <i>Awaiting customer signature & payment</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when customer signs off (job fully completed)
 */
export async function notifyJobSigned(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  total: number;
  locksmithEarnings: number;
  platformFee: number;
}): Promise<boolean> {
  const message = `
✍️ <b>Job Signed Off</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}

💰 <b>Payment Summary:</b>
• Total: ${formatCurrency(data.total)}
• Locksmith Earnings: ${formatCurrency(data.locksmithEarnings)}
• Platform Fee: ${formatCurrency(data.platformFee)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

✅ <i>Job completed successfully!</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a payment is received
 */
export async function notifyPaymentReceived(data: {
  jobNumber: string;
  jobId: string;
  customerName: string;
  locksmithName: string;
  amount: number;
  paymentType: "assessment" | "final_payment" | "full_payment";
  method?: string;
}): Promise<boolean> {
  const typeLabels = {
    assessment: "Assessment Fee",
    final_payment: "Final Payment",
    full_payment: "Full Payment",
  };

  const message = `
💰 <b>Payment Received</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💳 <b>Type:</b> ${typeLabels[data.paymentType]}
💵 <b>Amount:</b> ${formatCurrency(data.amount)}
${data.method ? `📱 <b>Method:</b> ${escapeHtml(data.method)}` : ""}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a refund is requested
 */
export async function notifyRefundRequested(data: {
  jobNumber: string;
  jobId: string;
  customerName: string;
  amount: number;
  reason: string;
}): Promise<boolean> {
  const message = `
⚠️ <b>Refund Requested</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💵 <b>Amount:</b> ${formatCurrency(data.amount)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
📝 <b>Reason:</b> ${escapeHtml(data.reason)}

⏳ <i>Requires admin review</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a refund is processed
 */
export async function notifyRefundProcessed(data: {
  jobNumber: string;
  jobId: string;
  customerName: string;
  amount: number;
  approved: boolean;
  adminNotes?: string | null;
}): Promise<boolean> {
  const status = data.approved ? "✅ Approved" : "❌ Denied";

  const message = `
💸 <b>Refund ${data.approved ? "Processed" : "Denied"}</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💵 <b>Amount:</b> ${formatCurrency(data.amount)}
📊 <b>Status:</b> ${status}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}

${data.adminNotes ? `📝 <b>Notes:</b> ${escapeHtml(data.adminNotes)}` : ""}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when locksmith arrives on site
 */
export async function notifyLocksmithArrived(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  address: string;
}): Promise<boolean> {
  const message = `
📍 <b>Locksmith Arrived</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
📍 <b>Location:</b> ${escapeHtml(data.address)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a review is submitted
 */
export async function notifyReviewSubmitted(data: {
  jobNumber: string;
  locksmithName: string;
  customerName: string;
  rating: number;
  comment?: string | null;
}): Promise<boolean> {
  const stars = "⭐".repeat(Math.min(5, Math.max(1, Math.round(data.rating))));

  const message = `
📝 <b>New Review</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
${stars} <b>${data.rating}/5</b>

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
👤 <b>Customer:</b> ${escapeHtml(data.customerName)}

${data.comment ? `💬 "${escapeHtml(data.comment)}"` : ""}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when job is auto-completed (after 24h deadline)
 */
export async function notifyJobAutoCompleted(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  customerName: string;
  total: number;
  paymentProcessed: boolean;
}): Promise<boolean> {
  const paymentStatus = data.paymentProcessed
    ? "✅ Payment auto-processed"
    : "⚠️ Payment pending (no saved card)";

  const message = `
⏰ <b>Job Auto-Completed</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
💰 <b>Total:</b> ${formatCurrency(data.total)}

👤 <b>Customer:</b> ${escapeHtml(data.customerName)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}

📋 <b>Status:</b> ${paymentStatus}

<i>24-hour deadline passed without customer signature</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when locksmith completes Stripe Connect onboarding
 */
export async function notifyStripeConnectCompleted(data: {
  locksmithName: string;
  locksmithEmail: string;
}): Promise<boolean> {
  const message = `
🏦 <b>Stripe Connect Completed</b>

🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
📧 <b>Email:</b> ${escapeHtml(data.locksmithEmail)}

✅ <i>Ready to receive instant payouts</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Notify when a new lead is captured (marketing)
 */
export async function notifyNewLead(data: {
  email?: string;
  phone?: string;
  source: string;
  utmCampaign?: string | null;
}): Promise<boolean> {
  const message = `
🎯 <b>New Lead Captured</b>

${data.email ? `📧 <b>Email:</b> ${escapeHtml(data.email)}` : ""}
${data.phone ? `📱 <b>Phone:</b> ${escapeHtml(data.phone)}` : ""}
📣 <b>Source:</b> ${escapeHtml(data.source)}
${data.utmCampaign ? `🏷️ <b>Campaign:</b> ${escapeHtml(data.utmCampaign)}` : ""}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Send a custom admin alert
 */
export async function sendAdminAlert(data: {
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
}): Promise<boolean> {
  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "🚨",
  };

  const icon = icons[data.severity || "info"];

  const message = `
${icon} <b>${escapeHtml(data.title)}</b>

${escapeHtml(data.message)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}

/**
 * Daily summary notification
 */
export async function sendDailySummary(data: {
  date: string;
  newCustomers: number;
  newLocksmiths: number;
  newJobs: number;
  completedJobs: number;
  totalRevenue: number;
  platformEarnings: number;
}): Promise<boolean> {
  const message = `
📊 <b>Daily Summary - ${escapeHtml(data.date)}</b>

👥 <b>Users:</b>
• New Customers: ${data.newCustomers}
• New Locksmiths: ${data.newLocksmiths}

📋 <b>Jobs:</b>
• New Jobs: ${data.newJobs}
• Completed: ${data.completedJobs}

💰 <b>Revenue:</b>
• Total: ${formatCurrency(data.totalRevenue)}
• Platform Earnings: ${formatCurrency(data.platformEarnings)}
`;

  return sendTelegramMessage(message);
}

// Export a test function for verification
export async function testTelegramConnection(): Promise<{ success: boolean; message: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      success: false,
      message: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables",
    };
  }

  if (!TELEGRAM_ENABLED) {
    return {
      success: false,
      message: "Telegram notifications are disabled (set TELEGRAM_NOTIFICATIONS_ENABLED=true)",
    };
  }

  try {
    const result = await sendTelegramMessage(
      `✅ <b>LockSafe Telegram Integration Test</b>\n\n🔔 Notifications are working!\n\n🕐 ${formatDate(new Date())}`
    );

    if (result) {
      return { success: true, message: "Test message sent successfully!" };
    }
    return { success: false, message: "Failed to send test message" };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Notify when locksmith declines an admin-assigned job
 */
export async function notifyLocksmithDeclinedAssignment(data: {
  jobNumber: string;
  jobId: string;
  locksmithName: string;
  locksmithPhone: string;
  postcode: string;
  problemType: string;
  reason: string;
}): Promise<boolean> {
  const message = `
❌ <b>Locksmith Declined Assignment</b>

🔢 <b>Job #:</b> ${escapeHtml(data.jobNumber)}
🔧 <b>Locksmith:</b> ${escapeHtml(data.locksmithName)}
📱 <b>Phone:</b> ${escapeHtml(data.locksmithPhone)}

📍 <b>Location:</b> ${escapeHtml(data.postcode)}
🔑 <b>Problem:</b> ${escapeHtml(data.problemType)}

💬 <b>Reason:</b> ${escapeHtml(data.reason)}

⚠️ <b>Action Required:</b> Reassign this job to another locksmith

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message);
}
