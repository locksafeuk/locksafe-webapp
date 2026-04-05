/**
 * Locksmith Personal Bot - Phase 2: Locksmith Assistant
 *
 * Per-locksmith bot architecture for:
 * - Availability management via chat
 * - Job notification relay
 * - Quote assistance features
 * - Earnings and stats tracking
 *
 * Each locksmith can interact with their own bot via Telegram or WhatsApp.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import {
  sendAutoDispatchNotification,
  notifyLocksmithAutoDispatchConfirmed,
  type JobSMSContext,
} from "@/lib/sms";

// ============================================
// TYPES & INTERFACES
// ============================================

export interface LocksmithBotContext {
  locksmithId: string;
  chatId: string;
  platform: "telegram" | "whatsapp";
}

export interface LocksmithBotMessage {
  text: string;
  parseMode?: "HTML" | "Markdown";
  buttons?: BotButton[];
}

interface BotButton {
  text: string;
  callbackData?: string;
  url?: string;
}

interface QuoteAssistanceResult {
  suggestedLabour: number;
  suggestedTime: number;
  commonParts: Array<{ name: string; avgPrice: number }>;
  difficulty: string;
  tips: string[];
}

// Environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";

// ============================================
// TELEGRAM HELPER FUNCTIONS
// ============================================

async function sendTelegramMessage(
  chatId: string,
  message: LocksmithBotMessage
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[LocksmithBot] No Telegram token configured");
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: message.text,
      parse_mode: message.parseMode || "HTML",
      disable_web_page_preview: true,
    };

    if (message.buttons && message.buttons.length > 0) {
      body.reply_markup = {
        inline_keyboard: message.buttons.map((btn) => [
          btn.url
            ? { text: btn.text, url: btn.url }
            : { text: btn.text, callback_data: btn.callbackData },
        ]),
      };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("[LocksmithBot] Send error:", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

// ============================================
// LOCKSMITH REGISTRY & CHAT MAPPING
// ============================================

/**
 * Get locksmith by their Telegram chat ID
 * Each locksmith can register their chat with the bot
 */
export async function getLocksmithByChatId(
  chatId: string,
  platform: "telegram" | "whatsapp" = "telegram"
): Promise<{ id: string; name: string; isAvailable: boolean } | null> {
  try {
    const fieldMap = {
      telegram: "telegramChatId",
      whatsapp: "whatsappChatId",
    };

    const locksmith = await prisma.locksmith.findFirst({
      where: {
        [fieldMap[platform]]: chatId,
        isActive: true,
        isVerified: true,
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
      },
    });

    return locksmith;
  } catch {
    return null;
  }
}

/**
 * Register a locksmith's chat ID for bot communication
 */
export async function registerLocksmithChat(
  locksmithId: string,
  chatId: string,
  platform: "telegram" | "whatsapp" = "telegram"
): Promise<boolean> {
  try {
    const fieldMap = {
      telegram: "telegramChatId",
      whatsapp: "whatsappChatId",
    };

    await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        [fieldMap[platform]]: chatId,
      },
    });

    return true;
  } catch {
    return false;
  }
}

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

/**
 * Toggle locksmith availability via chat
 */
export async function toggleAvailability(
  locksmithId: string
): Promise<{ success: boolean; isAvailable: boolean; message: string }> {
  try {
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { isAvailable: true, name: true },
    });

    if (!locksmith) {
      return { success: false, isAvailable: false, message: "Locksmith not found" };
    }

    const newStatus = !locksmith.isAvailable;

    await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable: newStatus,
        lastAvailabilityChange: new Date(),
      },
    });

    const message = newStatus
      ? "🟢 You're now AVAILABLE and will receive job notifications!"
      : "⚫ You're now OFFLINE. You won't receive new job notifications.";

    return { success: true, isAvailable: newStatus, message };
  } catch (error) {
    console.error("[LocksmithBot] Availability toggle error:", error);
    return { success: false, isAvailable: false, message: "Failed to update availability" };
  }
}

/**
 * Set specific availability status
 */
export async function setAvailability(
  locksmithId: string,
  isAvailable: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable,
        lastAvailabilityChange: new Date(),
      },
    });

    const message = isAvailable
      ? "🟢 You're now AVAILABLE and will receive job notifications!"
      : "⚫ You're now OFFLINE. You won't receive new job notifications.";

    return { success: true, message };
  } catch (error) {
    return { success: false, message: "Failed to update availability" };
  }
}

// ============================================
// JOB MANAGEMENT
// ============================================

/**
 * Get locksmith's active jobs
 */
export async function getActiveJobs(locksmithId: string): Promise<{
  jobs: Array<{
    id: string;
    jobNumber: string;
    status: string;
    postcode: string;
    problemType: string;
    customerName: string;
    createdAt: Date;
  }>;
}> {
  const jobs = await prisma.job.findMany({
    where: {
      locksmithId,
      status: {
        in: [
          JobStatus.ACCEPTED,
          JobStatus.EN_ROUTE,
          JobStatus.ARRIVED,
          JobStatus.DIAGNOSING,
          JobStatus.QUOTED,
          JobStatus.QUOTE_ACCEPTED,
          JobStatus.IN_PROGRESS,
          JobStatus.PENDING_CUSTOMER_CONFIRMATION,
        ],
      },
    },
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      postcode: job.postcode,
      problemType: job.problemType,
      customerName: job.customer?.name || "Customer",
      createdAt: job.createdAt,
    })),
  };
}

/**
 * Get pending applications (jobs locksmith has applied to but not accepted)
 */
export async function getPendingApplications(locksmithId: string): Promise<{
  applications: Array<{
    applicationId: string;
    jobId: string;
    jobNumber: string;
    postcode: string;
    problemType: string;
    assessmentFee: number;
    eta: number;
    appliedAt: Date;
  }>;
}> {
  const applications = await prisma.locksmithApplication.findMany({
    where: {
      locksmithId,
      status: "pending",
    },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          postcode: true,
          problemType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    applications: applications.map((app) => ({
      applicationId: app.id,
      jobId: app.job.id,
      jobNumber: app.job.jobNumber,
      postcode: app.job.postcode,
      problemType: app.job.problemType,
      assessmentFee: app.assessmentFee,
      eta: app.eta,
      appliedAt: app.createdAt,
    })),
  };
}

/**
 * Accept an auto-dispatched job
 */
export async function acceptAutoDispatchedJob(
  locksmithId: string,
  jobId: string
): Promise<{ success: boolean; message: string; job?: { jobNumber: string; postcode: string } }> {
  try {
    // Find the application
    const application = await prisma.locksmithApplication.findUnique({
      where: {
        jobId_locksmithId: { jobId, locksmithId },
      },
      include: {
        job: {
          include: { customer: true },
        },
        locksmith: true,
      },
    });

    if (!application) {
      return { success: false, message: "Job application not found" };
    }

    if (application.status !== "pending") {
      return { success: false, message: `Application already ${application.status}` };
    }

    // Update application to accepted
    await prisma.locksmithApplication.update({
      where: { id: application.id },
      data: { status: "accepted" },
    });

    // Update job with locksmith assignment
    await prisma.job.update({
      where: { id: jobId },
      data: {
        locksmithId,
        status: JobStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedEta: application.eta,
      },
    });

    // Send confirmation SMS
    const smsContext: JobSMSContext = {
      jobId: application.job.id,
      jobNumber: application.job.jobNumber,
      customerName: application.job.customer?.name || "Customer",
      customerPhone: application.job.customer?.phone || "",
      locksmithName: application.locksmith.name,
      locksmithPhone: application.locksmith.phone,
      postcode: application.job.postcode,
      problemType: application.job.problemType,
      assessmentFee: application.assessmentFee,
    };

    await notifyLocksmithAutoDispatchConfirmed(smsContext);

    return {
      success: true,
      message: `✅ You've accepted ${application.job.jobNumber}. Head to ${application.job.postcode} now!`,
      job: {
        jobNumber: application.job.jobNumber,
        postcode: application.job.postcode,
      },
    };
  } catch (error) {
    console.error("[LocksmithBot] Accept job error:", error);
    return { success: false, message: "Failed to accept job" };
  }
}

/**
 * Decline an auto-dispatched job
 */
export async function declineAutoDispatchedJob(
  locksmithId: string,
  jobId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.locksmithApplication.update({
      where: {
        jobId_locksmithId: { jobId, locksmithId },
      },
      data: {
        status: "rejected",
        message: reason || "Declined via bot",
      },
    });

    return {
      success: true,
      message: "Job declined. We'll find another locksmith.",
    };
  } catch (error) {
    return { success: false, message: "Failed to decline job" };
  }
}

// ============================================
// EARNINGS & STATS
// ============================================

/**
 * Get locksmith's earnings summary
 */
export async function getEarningsSummary(locksmithId: string): Promise<{
  today: number;
  thisWeek: number;
  thisMonth: number;
  pendingPayout: number;
  totalEarnings: number;
  jobsCompleted: number;
}> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayPayments, weekPayments, monthPayments, pendingPayouts, locksmith] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          job: { locksmithId },
          status: "succeeded",
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          job: { locksmithId },
          status: "succeeded",
          createdAt: { gte: startOfWeek },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          job: { locksmithId },
          status: "succeeded",
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.payout.aggregate({
        _sum: { netAmount: true },
        where: {
          locksmithId,
          status: "pending",
        },
      }),
      prisma.locksmith.findUnique({
        where: { id: locksmithId },
        select: { totalEarnings: true, totalJobs: true },
      }),
    ]);

  return {
    today: todayPayments._sum.amount || 0,
    thisWeek: weekPayments._sum.amount || 0,
    thisMonth: monthPayments._sum.amount || 0,
    pendingPayout: pendingPayouts._sum.netAmount || 0,
    totalEarnings: locksmith?.totalEarnings || 0,
    jobsCompleted: locksmith?.totalJobs || 0,
  };
}

/**
 * Get locksmith's performance stats
 */
export async function getPerformanceStats(locksmithId: string): Promise<{
  rating: number;
  totalReviews: number;
  acceptanceRate: number;
  avgResponseTime: number;
  completionRate: number;
}> {
  const [locksmith, recentApplications, completedJobs, totalJobs] = await Promise.all([
    prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { rating: true },
    }),
    prisma.locksmithApplication.count({
      where: { locksmithId },
    }),
    prisma.job.count({
      where: {
        locksmithId,
        status: { in: [JobStatus.COMPLETED, JobStatus.SIGNED] },
      },
    }),
    prisma.job.count({
      where: { locksmithId },
    }),
    prisma.review.count({
      where: { locksmithId },
    }),
  ]);

  const acceptedApplications = await prisma.locksmithApplication.count({
    where: { locksmithId, status: "accepted" },
  });

  return {
    rating: locksmith?.rating || 5.0,
    totalReviews: await prisma.review.count({ where: { locksmithId } }),
    acceptanceRate: recentApplications > 0 ? (acceptedApplications / recentApplications) * 100 : 100,
    avgResponseTime: 15, // TODO: Calculate from actual data
    completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 100,
  };
}

// ============================================
// QUOTE ASSISTANCE
// ============================================

/**
 * Get quote assistance for a job type
 * Provides suggested pricing based on historical data and market rates
 */
export async function getQuoteAssistance(
  lockType: string,
  problemType: string,
  difficulty: string = "medium"
): Promise<QuoteAssistanceResult> {
  // UK locksmith market rates (2024/2025 averages)
  const labourRates: Record<string, Record<string, number>> = {
    easy: { cylinder: 35, mortice: 45, multipoint: 55, car: 50 },
    medium: { cylinder: 55, mortice: 75, multipoint: 95, car: 85 },
    hard: { cylinder: 85, mortice: 110, multipoint: 140, car: 130 },
    specialist: { cylinder: 120, mortice: 160, multipoint: 200, car: 180 },
  };

  const timeEstimates: Record<string, Record<string, number>> = {
    easy: { cylinder: 15, mortice: 25, multipoint: 30, car: 20 },
    medium: { cylinder: 30, mortice: 45, multipoint: 60, car: 40 },
    hard: { cylinder: 45, mortice: 75, multipoint: 90, car: 60 },
    specialist: { cylinder: 60, mortice: 90, multipoint: 120, car: 90 },
  };

  // Common parts by lock type
  const commonParts: Record<string, Array<{ name: string; avgPrice: number }>> = {
    cylinder: [
      { name: "Euro Cylinder (standard)", avgPrice: 25 },
      { name: "Euro Cylinder (anti-snap)", avgPrice: 45 },
      { name: "Euro Cylinder (high security)", avgPrice: 75 },
    ],
    mortice: [
      { name: "British Standard Mortice Lock", avgPrice: 65 },
      { name: "Mortice Sash Lock", avgPrice: 55 },
      { name: "Mortice Deadlock", avgPrice: 45 },
    ],
    multipoint: [
      { name: "Multipoint Lock Mechanism", avgPrice: 120 },
      { name: "Multipoint Gearbox", avgPrice: 85 },
      { name: "Multipoint Hooks & Rollers", avgPrice: 35 },
    ],
    car: [
      { name: "Transponder Key Programming", avgPrice: 80 },
      { name: "Remote Key Fob", avgPrice: 60 },
      { name: "Emergency Key Blade", avgPrice: 25 },
    ],
  };

  const normalizedLockType = lockType.toLowerCase().includes("cylinder")
    ? "cylinder"
    : lockType.toLowerCase().includes("mortice")
      ? "mortice"
      : lockType.toLowerCase().includes("multi")
        ? "multipoint"
        : lockType.toLowerCase().includes("car") || lockType.toLowerCase().includes("vehicle")
          ? "car"
          : "cylinder";

  const normalizedDifficulty = difficulty.toLowerCase().includes("easy")
    ? "easy"
    : difficulty.toLowerCase().includes("hard")
      ? "hard"
      : difficulty.toLowerCase().includes("specialist")
        ? "specialist"
        : "medium";

  // Tips based on problem type
  const tips: string[] = [];

  if (problemType.toLowerCase().includes("lockout")) {
    tips.push("Non-destructive entry methods preferred - better for customer satisfaction");
    tips.push("Confirm customer ID before entry");
  }
  if (problemType.toLowerCase().includes("broken") || problemType.toLowerCase().includes("damaged")) {
    tips.push("Take photos of damage BEFORE starting work");
    tips.push("May need replacement parts - check stock");
  }
  if (problemType.toLowerCase().includes("upgrade") || problemType.toLowerCase().includes("security")) {
    tips.push("Recommend British Standard locks for insurance compliance");
    tips.push("Offer multiple security tier options");
  }

  tips.push("Always provide itemised quote breakdown");
  tips.push("Include warranty information in quote");

  return {
    suggestedLabour: labourRates[normalizedDifficulty]?.[normalizedLockType] || 60,
    suggestedTime: timeEstimates[normalizedDifficulty]?.[normalizedLockType] || 30,
    commonParts: commonParts[normalizedLockType] || commonParts.cylinder,
    difficulty: normalizedDifficulty,
    tips,
  };
}

// ============================================
// JOB NOTIFICATION RELAY
// ============================================

/**
 * Send job notification to locksmith via their registered chat
 */
export async function notifyLocksmithViaBot(
  locksmithId: string,
  notification: {
    type: "new_job" | "auto_dispatch" | "quote_accepted" | "payment_received" | "reminder";
    title: string;
    message: string;
    jobId?: string;
    jobNumber?: string;
    actions?: Array<{ label: string; action: string }>;
  }
): Promise<boolean> {
  try {
    // Get locksmith's registered chat IDs
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        // Note: These fields would need to be added to schema
        name: true,
        phone: true,
      },
    });

    if (!locksmith) {
      return false;
    }

    // For now, we rely on SMS notifications
    // In future, will send to Telegram/WhatsApp if registered
    console.log(`[LocksmithBot] Would notify ${locksmith.name}: ${notification.title}`);

    return true;
  } catch (error) {
    console.error("[LocksmithBot] Notification error:", error);
    return false;
  }
}

// ============================================
// BOT COMMAND HANDLERS
// ============================================

export type LocksmithCommand =
  | "start"
  | "help"
  | "status"
  | "available"
  | "offline"
  | "toggle"
  | "jobs"
  | "pending"
  | "earnings"
  | "stats"
  | "accept"
  | "decline"
  | "quote_help";

/**
 * Handle locksmith bot commands
 */
export async function handleLocksmithCommand(
  ctx: LocksmithBotContext,
  command: LocksmithCommand,
  args: string[] = []
): Promise<LocksmithBotMessage> {
  const locksmith = await getLocksmithByChatId(ctx.chatId, ctx.platform);

  if (!locksmith && command !== "start") {
    return {
      text: "❌ Your chat isn't registered with a locksmith account.\n\nUse /start to register.",
      buttons: [{ text: "🔗 Register Account", url: `${SITE_URL}/locksmith/settings` }],
    };
  }

  switch (command) {
    case "start":
    case "help":
      return getHelpMessage(locksmith);

    case "status":
      return await getStatusMessage(ctx.locksmithId);

    case "available":
      return await handleSetAvailable(ctx.locksmithId, true);

    case "offline":
      return await handleSetAvailable(ctx.locksmithId, false);

    case "toggle":
      return await handleToggleAvailability(ctx.locksmithId);

    case "jobs":
      return await getActiveJobsMessage(ctx.locksmithId);

    case "pending":
      return await getPendingApplicationsMessage(ctx.locksmithId);

    case "earnings":
      return await getEarningsMessage(ctx.locksmithId);

    case "stats":
      return await getStatsMessage(ctx.locksmithId);

    case "accept":
      if (args.length === 0) {
        return { text: "Usage: /accept <job_number or job_id>" };
      }
      return await handleAcceptJob(ctx.locksmithId, args[0]);

    case "decline":
      if (args.length === 0) {
        return { text: "Usage: /decline <job_number or job_id> [reason]" };
      }
      return await handleDeclineJob(ctx.locksmithId, args[0], args.slice(1).join(" "));

    case "quote_help":
      return await getQuoteHelpMessage(args);

    default:
      return { text: "Unknown command. Type /help for available commands." };
  }
}

// Command handler implementations
function getHelpMessage(locksmith: { name: string } | null): LocksmithBotMessage {
  const greeting = locksmith ? `Hi ${escapeHtml(locksmith.name)}! ` : "";

  return {
    text: `
🔧 <b>LockSafe Locksmith Bot</b>

${greeting}Here's what you can do:

<b>📍 Availability</b>
/status - Check your current status
/available - Go online
/offline - Go offline
/toggle - Toggle availability

<b>📋 Jobs</b>
/jobs - View your active jobs
/pending - View pending applications
/accept &lt;job&gt; - Accept a job
/decline &lt;job&gt; - Decline a job

<b>💰 Earnings</b>
/earnings - View earnings summary
/stats - View performance stats

<b>💡 Quote Help</b>
/quote_help &lt;lock_type&gt; - Get pricing guidance

<i>Need help? Contact support@locksafe.uk</i>
    `.trim(),
    buttons: [
      { text: "📊 Dashboard", url: `${SITE_URL}/locksmith/dashboard` },
      { text: "⚙️ Settings", url: `${SITE_URL}/locksmith/settings` },
    ],
  };
}

async function getStatusMessage(locksmithId: string): Promise<LocksmithBotMessage> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: {
      name: true,
      isAvailable: true,
      lastAvailabilityChange: true,
      rating: true,
    },
  });

  if (!locksmith) {
    return { text: "❌ Account not found" };
  }

  const activeJobs = await prisma.job.count({
    where: {
      locksmithId,
      status: {
        in: [JobStatus.ACCEPTED, JobStatus.EN_ROUTE, JobStatus.IN_PROGRESS],
      },
    },
  });

  const statusIcon = locksmith.isAvailable ? "🟢" : "⚫";
  const statusText = locksmith.isAvailable ? "AVAILABLE" : "OFFLINE";

  return {
    text: `
${statusIcon} <b>Status: ${statusText}</b>

👤 ${escapeHtml(locksmith.name)}
⭐ Rating: ${locksmith.rating.toFixed(1)}
📋 Active Jobs: ${activeJobs}

<i>Last updated: ${locksmith.lastAvailabilityChange?.toLocaleString("en-GB") || "N/A"}</i>
    `.trim(),
    buttons: [
      locksmith.isAvailable
        ? { text: "⚫ Go Offline", callbackData: "cmd_offline" }
        : { text: "🟢 Go Online", callbackData: "cmd_available" },
    ],
  };
}

async function handleSetAvailable(locksmithId: string, isAvailable: boolean): Promise<LocksmithBotMessage> {
  const result = await setAvailability(locksmithId, isAvailable);
  return { text: result.message };
}

async function handleToggleAvailability(locksmithId: string): Promise<LocksmithBotMessage> {
  const result = await toggleAvailability(locksmithId);
  return {
    text: result.message,
    buttons: [
      result.isAvailable
        ? { text: "⚫ Go Offline", callbackData: "cmd_offline" }
        : { text: "🟢 Go Online", callbackData: "cmd_available" },
    ],
  };
}

async function getActiveJobsMessage(locksmithId: string): Promise<LocksmithBotMessage> {
  const { jobs } = await getActiveJobs(locksmithId);

  if (jobs.length === 0) {
    return {
      text: "📋 <b>Active Jobs</b>\n\nNo active jobs at the moment.",
      buttons: [{ text: "🔍 Find Jobs", url: `${SITE_URL}/locksmith/jobs` }],
    };
  }

  const statusIcons: Record<string, string> = {
    ACCEPTED: "✅",
    EN_ROUTE: "🚗",
    ARRIVED: "📍",
    DIAGNOSING: "🔍",
    QUOTED: "💬",
    QUOTE_ACCEPTED: "👍",
    IN_PROGRESS: "🔧",
    PENDING_CUSTOMER_CONFIRMATION: "✍️",
  };

  let text = `📋 <b>Active Jobs (${jobs.length})</b>\n\n`;

  for (const job of jobs) {
    text += `${statusIcons[job.status] || "•"} <b>${job.jobNumber}</b>\n`;
    text += `   ${job.postcode} - ${job.problemType}\n`;
    text += `   ${escapeHtml(job.customerName)}\n\n`;
  }

  return {
    text: text.trim(),
    buttons: jobs.slice(0, 3).map((job) => ({
      text: `View ${job.jobNumber}`,
      url: `${SITE_URL}/locksmith/job/${job.id}`,
    })),
  };
}

async function getPendingApplicationsMessage(locksmithId: string): Promise<LocksmithBotMessage> {
  const { applications } = await getPendingApplications(locksmithId);

  if (applications.length === 0) {
    return { text: "📋 <b>Pending Applications</b>\n\nNo pending applications." };
  }

  let text = `📋 <b>Pending Applications (${applications.length})</b>\n\n`;

  for (const app of applications) {
    text += `⏳ <b>${app.jobNumber}</b>\n`;
    text += `   ${app.postcode} - ${app.problemType}\n`;
    text += `   Fee: ${formatCurrency(app.assessmentFee)} • ETA: ${app.eta}min\n\n`;
  }

  return { text: text.trim() };
}

async function getEarningsMessage(locksmithId: string): Promise<LocksmithBotMessage> {
  const earnings = await getEarningsSummary(locksmithId);

  return {
    text: `
💰 <b>Earnings Summary</b>

<b>Today:</b> ${formatCurrency(earnings.today)}
<b>This Week:</b> ${formatCurrency(earnings.thisWeek)}
<b>This Month:</b> ${formatCurrency(earnings.thisMonth)}

<b>Pending Payout:</b> ${formatCurrency(earnings.pendingPayout)}
<b>Total Earned:</b> ${formatCurrency(earnings.totalEarnings)}
<b>Jobs Completed:</b> ${earnings.jobsCompleted}
    `.trim(),
    buttons: [
      { text: "📊 Full Breakdown", url: `${SITE_URL}/locksmith/earnings` },
    ],
  };
}

async function getStatsMessage(locksmithId: string): Promise<LocksmithBotMessage> {
  const stats = await getPerformanceStats(locksmithId);

  return {
    text: `
📊 <b>Performance Stats</b>

⭐ <b>Rating:</b> ${stats.rating.toFixed(1)} (${stats.totalReviews} reviews)
✅ <b>Acceptance Rate:</b> ${stats.acceptanceRate.toFixed(0)}%
⏱️ <b>Avg Response:</b> ${stats.avgResponseTime} mins
🎯 <b>Completion Rate:</b> ${stats.completionRate.toFixed(0)}%
    `.trim(),
    buttons: [
      { text: "📈 View Details", url: `${SITE_URL}/locksmith/dashboard` },
    ],
  };
}

async function handleAcceptJob(locksmithId: string, jobRef: string): Promise<LocksmithBotMessage> {
  // Find job by number or ID
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  if (!job) {
    return { text: `❌ Job "${jobRef}" not found` };
  }

  const result = await acceptAutoDispatchedJob(locksmithId, job.id);

  if (result.success) {
    return {
      text: result.message,
      buttons: [
        { text: "📍 View Job", url: `${SITE_URL}/locksmith/job/${job.id}` },
        { text: "🚗 Mark En Route", callbackData: `status_enroute_${job.id}` },
      ],
    };
  }

  return { text: `❌ ${result.message}` };
}

async function handleDeclineJob(locksmithId: string, jobRef: string, reason?: string): Promise<LocksmithBotMessage> {
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  if (!job) {
    return { text: `❌ Job "${jobRef}" not found` };
  }

  const result = await declineAutoDispatchedJob(locksmithId, job.id, reason);
  return { text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` };
}

async function getQuoteHelpMessage(args: string[]): Promise<LocksmithBotMessage> {
  if (args.length === 0) {
    return {
      text: `
💡 <b>Quote Assistance</b>

Get pricing guidance for your quotes:

<b>Usage:</b>
/quote_help cylinder
/quote_help mortice hard
/quote_help multipoint specialist

<b>Lock Types:</b> cylinder, mortice, multipoint, car
<b>Difficulty:</b> easy, medium, hard, specialist
      `.trim(),
    };
  }

  const lockType = args[0] || "cylinder";
  const difficulty = args[1] || "medium";

  const assistance = await getQuoteAssistance(lockType, "general", difficulty);

  let partsText = assistance.commonParts
    .map((p) => `• ${p.name}: ${formatCurrency(p.avgPrice)}`)
    .join("\n");

  return {
    text: `
💡 <b>Quote Guidance: ${lockType.toUpperCase()}</b>
<i>Difficulty: ${assistance.difficulty}</i>

<b>Suggested Labour:</b> ${formatCurrency(assistance.suggestedLabour)}
<b>Est. Time:</b> ${assistance.suggestedTime} minutes

<b>Common Parts:</b>
${partsText}

<b>💡 Tips:</b>
${assistance.tips.map((t) => `• ${t}`).join("\n")}

<i>Prices are market averages - adjust for your area.</i>
    `.trim(),
  };
}

// ============================================
// CALLBACK HANDLERS
// ============================================

export async function handleLocksmithCallback(
  ctx: LocksmithBotContext,
  callbackData: string
): Promise<LocksmithBotMessage> {
  if (callbackData === "cmd_available") {
    return handleSetAvailable(ctx.locksmithId, true);
  }
  if (callbackData === "cmd_offline") {
    return handleSetAvailable(ctx.locksmithId, false);
  }
  if (callbackData.startsWith("accept_")) {
    const jobId = callbackData.replace("accept_", "");
    return handleAcceptJob(ctx.locksmithId, jobId);
  }
  if (callbackData.startsWith("decline_")) {
    const jobId = callbackData.replace("decline_", "");
    return handleDeclineJob(ctx.locksmithId, jobId);
  }
  if (callbackData.startsWith("status_enroute_")) {
    const jobId = callbackData.replace("status_enroute_", "");
    // Update job status to EN_ROUTE
    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.EN_ROUTE, enRouteAt: new Date() },
    });
    return { text: "🚗 Status updated: EN ROUTE" };
  }

  return { text: "Unknown action" };
}
