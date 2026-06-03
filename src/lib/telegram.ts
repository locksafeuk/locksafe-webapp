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

import { LOCKSMITH_ADMIN_PHONE } from "@/lib/config";
import { formatBaseLocationLabel } from "@/lib/location-display";
import { prisma } from "@/lib/prisma";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true";
const TELEGRAM_SEND_RETRY_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.TELEGRAM_SEND_RETRY_ATTEMPTS || "3", 10) || 3,
);
const TELEGRAM_SEND_RETRY_BASE_MS = Math.max(
  100,
  Number.parseInt(process.env.TELEGRAM_SEND_RETRY_BASE_MS || "350", 10) || 350,
);
const ADMIN_SMS_FALLBACK_ENABLED = process.env.ADMIN_SMS_FALLBACK_ENABLED === "true";
const ADMIN_ALERT_FALLBACK_PHONES = (process.env.ADMIN_ALERT_FALLBACK_PHONES || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const TELEGRAM_NEW_JOB_DEDUPE_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.TELEGRAM_NEW_JOB_DEDUPE_MINUTES || "1440", 10) || 1440,
);

// Best-effort in-process dedupe to reduce noisy repeated admin alerts.
// Repeats are keyed by severity+title unless a caller provides dedupeKey.
const adminAlertCooldownCache = new Map<string, number>();
const newJobNotificationCache = new Map<string, number>();

function normalizeAlertTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b\d+\b/g, "#")
    .replace(/\b[a-f0-9]{6,}\b/gi, "{id}")
    .replace(/\s+/g, " ")
    .trim();
}

async function wasAdminAlertSentRecently(dedupeKey: string, cooldownMs: number): Promise<boolean> {
  if (cooldownMs <= 0) return false;

  const now = Date.now();
  const nextAllowedAt = adminAlertCooldownCache.get(dedupeKey) ?? 0;
  if (now < nextAllowedAt) {
    return true;
  }

  try {
    const threshold = new Date(now - cooldownMs);
    const recentlySent = await prisma.agentDecision.findFirst({
      where: {
        agent: "system-alerts",
        platform: "global",
        action: `telegram_admin_alert:${dedupeKey}`,
        createdAt: { gte: threshold },
      },
      select: { id: true },
    });

    if (recentlySent) {
      adminAlertCooldownCache.set(dedupeKey, now + cooldownMs);
      return true;
    }
  } catch (error) {
    // Fail open on dedupe storage errors to avoid suppressing true incidents.
    console.warn("[Telegram][dedupe] DB check failed, proceeding:", error);
  }

  return false;
}

async function recordAdminAlertSent(dedupeKey: string, data: {
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  cooldownMs: number;
}): Promise<void> {
  const now = Date.now();
  const cooldownMs = data.cooldownMs;
  if (cooldownMs > 0) {
    adminAlertCooldownCache.set(dedupeKey, now + cooldownMs);
  }

  try {
    await prisma.agentDecision.create({
      data: {
        agent: "system-alerts",
        platform: "global",
        action: `telegram_admin_alert:${dedupeKey}`,
        payload: {
          title: data.title,
          message: data.message,
          severity: data.severity,
        },
        policySnapshot: { source: "sendAdminAlert" },
        dryRun: false,
        outcome: "ok",
        outcomeMessage: "telegram_sent",
        executedAt: new Date(),
      },
    });
  } catch (error) {
    // Fail open: notification delivery should not be blocked by audit write errors.
    console.warn("[Telegram][dedupe] Failed to persist sent alert marker:", error);
  }
}

async function wasNewJobNotificationSentRecently(jobId: string, cooldownMs: number): Promise<boolean> {
  if (!jobId || cooldownMs <= 0) return false;

  const now = Date.now();
  const nextAllowedAt = newJobNotificationCache.get(jobId) ?? 0;
  if (now < nextAllowedAt) {
    return true;
  }

  try {
    const threshold = new Date(now - cooldownMs);
    const recentlySent = await prisma.agentDecision.findFirst({
      where: {
        agent: "system-alerts",
        platform: "global",
        action: `telegram_new_job:${jobId}`,
        createdAt: { gte: threshold },
      },
      select: { id: true },
    });

    if (recentlySent) {
      newJobNotificationCache.set(jobId, now + cooldownMs);
      return true;
    }
  } catch (error) {
    // Fail open so notifications continue if dedupe storage is unavailable.
    console.warn("[Telegram][new-job dedupe] DB check failed, proceeding:", error);
  }

  return false;
}

async function recordNewJobNotificationSent(jobId: string, cooldownMs: number): Promise<void> {
  if (!jobId) return;

  const now = Date.now();
  if (cooldownMs > 0) {
    newJobNotificationCache.set(jobId, now + cooldownMs);
  }

  try {
    await prisma.agentDecision.create({
      data: {
        agent: "system-alerts",
        platform: "global",
        action: `telegram_new_job:${jobId}`,
        payload: { jobId, event: "new_job" },
        policySnapshot: { source: "notifyNewJob" },
        dryRun: false,
        outcome: "ok",
        outcomeMessage: "telegram_sent",
        executedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn("[Telegram][new-job dedupe] Failed to persist sent marker:", error);
  }
}

function getAdminAlertCooldownMs(severity: "info" | "warning" | "error"): number {
  const infoMinutes = Number(process.env.TELEGRAM_ALERT_INFO_COOLDOWN_MINUTES ?? "60");
  const warningMinutes = Number(process.env.TELEGRAM_ALERT_WARNING_COOLDOWN_MINUTES ?? "15");

  if (severity === "error") return 0;
  if (severity === "warning") return Math.max(0, warningMinutes) * 60 * 1000;
  return Math.max(0, infoMinutes) * 60 * 1000;
}

// Forum topic thread IDs — set these env vars after creating topics in your Telegram supergroup.
// Leave unset (or set to 0) to send all messages to the General topic.
const TOPIC_NEW_JOBS = process.env.TELEGRAM_TOPIC_NEW_JOBS ? parseInt(process.env.TELEGRAM_TOPIC_NEW_JOBS) : undefined;
const TOPIC_LOCKSMITHS = process.env.TELEGRAM_TOPIC_LOCKSMITHS ? parseInt(process.env.TELEGRAM_TOPIC_LOCKSMITHS) : undefined;
const TOPIC_CUSTOMERS = process.env.TELEGRAM_TOPIC_CUSTOMERS ? parseInt(process.env.TELEGRAM_TOPIC_CUSTOMERS) : undefined;
const TOPIC_JOB_UPDATES = process.env.TELEGRAM_TOPIC_JOB_UPDATES ? parseInt(process.env.TELEGRAM_TOPIC_JOB_UPDATES) : undefined;
const TOPIC_PAYMENTS = process.env.TELEGRAM_TOPIC_PAYMENTS ? parseInt(process.env.TELEGRAM_TOPIC_PAYMENTS) : undefined;
const TOPIC_AGENTS = process.env.TELEGRAM_TOPIC_AGENTS ? parseInt(process.env.TELEGRAM_TOPIC_AGENTS) : undefined;
const TOPIC_SOCIAL = process.env.TELEGRAM_TOPIC_SOCIAL ? parseInt(process.env.TELEGRAM_TOPIC_SOCIAL) : undefined;
const TOPIC_APPLICATIONS = process.env.TELEGRAM_TOPIC_APPLICATIONS ? parseInt(process.env.TELEGRAM_TOPIC_APPLICATIONS) : undefined;
const TOPIC_QUOTES = process.env.TELEGRAM_TOPIC_QUOTES ? parseInt(process.env.TELEGRAM_TOPIC_QUOTES) : undefined;
const TOPIC_REVIEWS = process.env.TELEGRAM_TOPIC_REVIEWS ? parseInt(process.env.TELEGRAM_TOPIC_REVIEWS) : undefined;

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function getAdminFallbackPhones(): string[] {
  return uniqueNonEmpty([...ADMIN_ALERT_FALLBACK_PHONES, LOCKSMITH_ADMIN_PHONE]);
}

/**
 * Send a message via Telegram Bot API
 * @param threadId  Optional forum topic thread ID (message_thread_id). When set the message
 *                  is posted into that topic instead of the General topic.
 */
async function sendTelegramMessage(
  message: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  threadId?: number
): Promise<boolean> {
  if (!TELEGRAM_ENABLED) {
    console.log("[Telegram] Notifications disabled");
    return false;
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Missing bot token or chat ID");
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };

  if (threadId) {
    body.message_thread_id = threadId;
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= TELEGRAM_SEND_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: TelegramResponse | null = null;
      try {
        data = (await response.json()) as TelegramResponse;
      } catch {
        data = null;
      }

      if (response.ok && data?.ok) {
        console.log(`[Telegram] Message sent${threadId ? ` to topic ${threadId}` : ""}`);
        return true;
      }

      const description = data?.description || `HTTP ${response.status}`;
      lastError = new Error(description);

      console.warn(
        `[Telegram] Send failed (attempt ${attempt}/${TELEGRAM_SEND_RETRY_ATTEMPTS}, threadId=${threadId}): ${description}`,
      );

      if (attempt < TELEGRAM_SEND_RETRY_ATTEMPTS) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10) * 1000
          : 0;
        const backoffMs = TELEGRAM_SEND_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await wait(Math.max(backoffMs, retryAfterMs));
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `[Telegram] Send errored (attempt ${attempt}/${TELEGRAM_SEND_RETRY_ATTEMPTS}, threadId=${threadId})`,
        error,
      );

      if (attempt < TELEGRAM_SEND_RETRY_ATTEMPTS) {
        const backoffMs = TELEGRAM_SEND_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await wait(backoffMs);
      }
    }
  }

  console.error("[Telegram] Failed to send message after retries:", lastError);
  return false;
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
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
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

  return sendTelegramMessage(message, "HTML", TOPIC_CUSTOMERS);
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
  basePostcode?: string | null;
  coverageRadius?: number | null;
}): Promise<boolean> {
  const baseLabel = formatBaseLocationLabel(data.baseAddress, data.basePostcode);

  const message = `
🔧 <b>New Locksmith Registered</b>

👤 <b>Name:</b> ${escapeHtml(data.name)}
🏢 <b>Company:</b> ${data.companyName ? escapeHtml(data.companyName) : "Individual"}
📧 <b>Email:</b> ${escapeHtml(data.email)}
📱 <b>Phone:</b> ${escapeHtml(data.phone)}
📍 <b>Base Postcode:</b> ${escapeHtml(baseLabel)}
🎯 <b>Coverage:</b> ${data.coverageRadius || 10} miles

⚠️ <i>Pending verification</i>

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  return sendTelegramMessage(message, "HTML", TOPIC_LOCKSMITHS);
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
  const dedupeCooldownMs = TELEGRAM_NEW_JOB_DEDUPE_MINUTES * 60 * 1000;
  if (await wasNewJobNotificationSentRecently(data.jobId, dedupeCooldownMs)) {
    console.log(`[Telegram] Skipping duplicate new job notification for ${data.jobId}`);
    return false;
  }

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

  const sent = await sendTelegramMessage(message, "HTML", TOPIC_NEW_JOBS);
  if (sent) {
    await recordNewJobNotificationSent(data.jobId, dedupeCooldownMs);
  }
  return sent;
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

  return sendTelegramMessage(message, "HTML", TOPIC_APPLICATIONS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_APPLICATIONS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_PAYMENTS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_QUOTES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_QUOTES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_QUOTES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_JOB_UPDATES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_JOB_UPDATES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_PAYMENTS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_PAYMENTS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_PAYMENTS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_JOB_UPDATES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_REVIEWS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_JOB_UPDATES);
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

  return sendTelegramMessage(message, "HTML", TOPIC_LOCKSMITHS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_CUSTOMERS);
}

/**
 * Send a custom admin alert
 */
export async function sendAdminAlert(data: {
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
  bypassPolicyGate?: boolean;
  dedupeKey?: string;
  cooldownMsOverride?: number;
  topic?: "agents" | "social";
  topicThreadId?: number;
}): Promise<boolean> {
  // Runtime alert-sensitivity gate for admin/agent topic noise control.
  // Defaults are handled by operational policy module if DB fields are null.
  if (!data.bypassPolicyGate) {
    try {
      const { getOperationalPolicy } = await import("@/agents/core/operational-policy");
      const policy = await getOperationalPolicy();
      const severityRank: Record<"info" | "warning" | "error", number> = {
        info: 1,
        warning: 3,
        error: 4,
      };
      const threshold =
        policy.alertSensitivity === "critical"
          ? 4
          : policy.alertSensitivity === "workflow"
            ? 3
            : 1;
      const severity = data.severity || "info";

      if (severityRank[severity] < threshold) {
        console.log(
          `[Telegram][gated] sendAdminAlert suppressed severity=${severity} sensitivity=${policy.alertSensitivity} title=${data.title}`,
        );
        return true;
      }
    } catch (error) {
      // Fail open on policy read errors to avoid hiding critical incidents.
      console.warn("[Telegram][gating] policy lookup failed, sending alert:", error);
    }
  }

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "🚨",
  };

  const severity = data.severity || "info";
  const icon = icons[severity];

  // Spam guard: repeated alerts with the same dedupe key are suppressed.
  // Default key normalizes dynamic numeric/id fragments in titles.
  const dedupeKey = data.dedupeKey || `${severity}:${normalizeAlertTitleForDedupe(data.title)}`;
  const cooldownMs = data.cooldownMsOverride ?? getAdminAlertCooldownMs(severity);
  if (await wasAdminAlertSentRecently(dedupeKey, cooldownMs)) {
    console.log(
      `[Telegram][dedupe] suppressed alert key=${dedupeKey} severity=${severity} title=${data.title}`,
    );
    return true;
  }

  const message = `
${icon} <b>${escapeHtml(data.title)}</b>

${escapeHtml(data.message)}

🕐 <b>Time:</b> ${formatDate(new Date())}
`;

  const resolvedThreadId = data.topicThreadId
    ?? (data.topic === "social" ? TOPIC_SOCIAL : TOPIC_AGENTS);
  const sentToTelegram = await sendTelegramMessage(message, "HTML", resolvedThreadId);
  if (sentToTelegram) {
    await recordAdminAlertSent(dedupeKey, {
      title: data.title,
      message: data.message,
      severity,
      cooldownMs,
    });
    return true;
  }

  // P1 fallback path: critical alerts should still page humans when Telegram is down.
  if (severity !== "error" || !ADMIN_SMS_FALLBACK_ENABLED) {
    return false;
  }

  const fallbackPhones = getAdminFallbackPhones();
  if (fallbackPhones.length === 0) {
    console.warn("[Telegram][fallback] No fallback phone numbers configured for critical alert");
    return false;
  }

  try {
    const { sendSMS } = await import("@/lib/sms");
    const smsText =
      `LOCKSAFE P1 ALERT\n` +
      `${data.title}\n` +
      `${data.message}\n` +
      `Time: ${formatDate(new Date())}`;

    const results = await Promise.all(
      fallbackPhones.map((phone) =>
        sendSMS(phone, smsText, {
          logContext: `admin_alert_fallback:${data.title}`,
        }),
      ),
    );

    const successful = results.filter((r) => r.success).length;
    if (successful > 0) {
      await recordAdminAlertSent(dedupeKey, {
        title: data.title,
        message: data.message,
        severity,
        cooldownMs,
      });
      console.warn(
        `[Telegram][fallback] Telegram failed; sent critical alert via SMS to ${successful}/${fallbackPhones.length} recipients`,
      );
      return true;
    }

    console.error("[Telegram][fallback] Telegram failed and SMS fallback also failed", {
      title: data.title,
      phones: fallbackPhones,
    });
    return false;
  } catch (error) {
    console.error("[Telegram][fallback] SMS fallback threw an error:", error);
    return false;
  }
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

  return sendTelegramMessage(message, "HTML", TOPIC_AGENTS);
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

  return sendTelegramMessage(message, "HTML", TOPIC_AGENTS);
}
