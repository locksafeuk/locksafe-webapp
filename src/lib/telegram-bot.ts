/**
 * Telegram Bot Command Handler for LockSafe UK Admin Operations
 *
 * Handles commands from admin Telegram chat:
 * - /jobs - List today's jobs
 * - /pending - Show pending jobs
 * - /locksmiths - List available locksmiths
 * - /stats - Quick dashboard stats
 * - /alerts - Show pending alerts
 * - /dispatch <job_id> - Find best locksmith for a job
 * - /assign <job_id> <locksmith_id> - Assign job to locksmith
 * - /availability <locksmith_id> <on|off> - Toggle availability
 * - /help - Show available commands
 */

import prisma from "@/lib/db";
import {
  autoDispatchJob,
  findBestLocksmiths,
} from "@/lib/intelligent-dispatch";
import { JobStatus } from "@prisma/client";
// Import directly from source files to avoid barrel export issues
import {
  getAgentStatusSummary,
  runAllHeartbeats,
  executeHeartbeat
} from "@/agents/core/orchestrator";
import { getCOOStatus } from "@/agents/coo/agent";
import { getCMOStatus } from "@/agents/cmo/agent";
import { getCEOStatus, generateWeeklySummary } from "@/agents/ceo/agent";
import { getAllBudgetStatus } from "@/agents/core/budget";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
const AGENTS_ENABLED = process.env.AGENTS_ENABLED === "true";

/**
 * Send a message to a Telegram chat
 */
async function sendMessage(
  chatId: string | number,
  text: string,
  options?: {
    parseMode?: "HTML" | "Markdown";
    replyMarkup?: TelegramInlineKeyboard;
  },
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram Bot] No bot token configured");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || "HTML",
        disable_web_page_preview: true,
        reply_markup: options?.replyMarkup,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("[Telegram Bot] Send error:", data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Telegram Bot] Send failed:", error);
    return false;
  }
}

/**
 * Answer a callback query (button press)
 */
async function answerCallback(
  callbackId: string,
  text?: string,
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text,
        }),
      },
    );
  } catch (error) {
    console.error("[Telegram Bot] Callback answer failed:", error);
  }
}

interface TelegramInlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>
  >;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
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

/**
 * Format job status for display
 */
function formatStatus(status: string): string {
  const statusIcons: Record<string, string> = {
    PENDING: "⏳",
    ACCEPTED: "✅",
    EN_ROUTE: "🚗",
    ARRIVED: "📍",
    DIAGNOSING: "🔍",
    QUOTED: "💬",
    QUOTE_ACCEPTED: "👍",
    IN_PROGRESS: "🔧",
    PENDING_CUSTOMER_CONFIRMATION: "✍️",
    COMPLETED: "✔️",
    SIGNED: "🎉",
    CANCELLED: "❌",
  };
  return `${statusIcons[status] || "•"} ${status.replace(/_/g, " ")}`;
}

// Command handlers

export async function handleHelpCommand(chatId: string): Promise<void> {
  const message = `
🔧 <b>LockSafe Admin Bot Commands</b>

<b>📋 Jobs</b>
/jobs - List today's jobs
/pending - Show pending jobs needing attention

<b>👷 Locksmiths</b>
/locksmiths - List available locksmiths
/availability &lt;id&gt; &lt;on|off&gt; - Toggle availability

<b>🎯 Dispatch</b>
/dispatch &lt;job_number&gt; - Find best match for job
/assign &lt;job_number&gt; &lt;locksmith_id&gt; - Assign job

<b>📊 Dashboard</b>
/stats - Quick statistics
/alerts - Show pending alerts

<b>💰 Financials</b>
/earnings - Platform revenue & fees
/payouts - View pending payouts

<b>👥 Customers</b>
/customers - Customer stats

<b>🤖 AI Agents</b>
/agents - View all agent statuses
/agent_ceo - CEO Agent details & strategic metrics
/agent_coo - COO Agent details & operations
/agent_cmo - CMO Agent details & marketing
/agent_budget - Agent budget overview
/agent_run - Manually trigger agent heartbeats
/weekly - Generate weekly strategic summary

<i>Need help? Contact support@locksafe.uk</i>
`;

  await sendMessage(chatId, message);
}

// ============================================
// AI AGENT COMMANDS
// ============================================

export async function handleAgentsCommand(chatId: string): Promise<void> {
  if (!AGENTS_ENABLED) {
    await sendMessage(chatId, "🤖 <b>AI Agents are DISABLED</b>\n\nAgents have been disabled to prevent unwanted API calls.\n\nTo re-enable, set AGENTS_ENABLED=true in .env");
    return;
  }

  try {
    const summary = await getAgentStatusSummary();

    let message = `🤖 <b>AI Agent Operating System</b>\n\n`;
    message += `<b>Total Agents:</b> ${summary.total}\n`;
    message += `<b>Active:</b> ${summary.active} | <b>Paused:</b> ${summary.paused}\n\n`;

    for (const agent of summary.agents) {
      const statusIcon = agent.status === "active" ? "🟢" : "⚫";
      const budgetPercent = ((agent.budgetUsed / agent.budgetTotal) * 100).toFixed(0);
      const lastHb = agent.lastHeartbeat
        ? new Date(agent.lastHeartbeat).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : "Never";

      message += `${statusIcon} <b>${escapeHtml(agent.displayName)}</b>\n`;
      message += `   Tasks: ${agent.pendingTasks} | Budget: ${budgetPercent}% used\n`;
      message += `   Last heartbeat: ${lastHb}\n\n`;
    }

    message += `\n<i>Use /agent_coo or /agent_cmo for details</i>`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agents error:", error);
    await sendMessage(chatId, "❌ Error fetching agent status. Make sure agents are initialized.");
  }
}

export async function handleAgentCOOCommand(chatId: string): Promise<void> {
  try {
    const status = await getCOOStatus();

    if (!status) {
      await sendMessage(chatId, "❌ COO Agent not found. Run /agent_run to initialize.");
      return;
    }

    const statusIcon = status.status === "active" ? "🟢" : "⚫";
    const lastHb = status.lastHeartbeat
      ? new Date(status.lastHeartbeat).toLocaleTimeString("en-GB")
      : "Never";

    let message = `${statusIcon} <b>COO Agent - Operations</b>\n\n`;
    message += `<b>Status:</b> ${status.status}\n`;
    message += `<b>Last Heartbeat:</b> ${lastHb}\n`;
    message += `<b>Pending Tasks:</b> ${status.pendingTasks}\n`;
    message += `<b>Budget:</b> ${status.budgetUsed.toFixed(2)} / ${(status.budgetUsed + status.budgetRemaining).toFixed(2)}\n\n`;

    message += `<b>📊 Operational Metrics:</b>\n`;
    message += `• Pending Jobs: ${status.operationalMetrics.pendingJobs}\n`;
    message += `• Available Locksmiths: ${status.operationalMetrics.availableLocksmiths}\n`;
    message += `• Active Alerts: ${status.operationalMetrics.alertsCount}\n\n`;

    message += `<i>COO handles: Dispatch, locksmith availability, job monitoring</i>`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agent COO error:", error);
    await sendMessage(chatId, "❌ Error fetching COO agent status.");
  }
}

export async function handleAgentCMOCommand(chatId: string): Promise<void> {
  try {
    const status = await getCMOStatus();

    if (!status) {
      await sendMessage(chatId, "❌ CMO Agent not found. Run /agent_run to initialize.");
      return;
    }

    const statusIcon = status.status === "active" ? "🟢" : "⚫";
    const lastHb = status.lastHeartbeat
      ? new Date(status.lastHeartbeat).toLocaleTimeString("en-GB")
      : "Never";

    let message = `${statusIcon} <b>CMO Agent - Marketing</b>\n\n`;
    message += `<b>Status:</b> ${status.status}\n`;
    message += `<b>Last Heartbeat:</b> ${lastHb}\n`;
    message += `<b>Pending Tasks:</b> ${status.pendingTasks}\n`;
    message += `<b>Budget:</b> ${status.budgetUsed.toFixed(2)} / ${(status.budgetUsed + status.budgetRemaining).toFixed(2)}\n\n`;

    message += `<b>📈 Marketing Metrics:</b>\n`;
    message += `• Active Campaigns: ${status.marketingMetrics.activeCampaigns}\n`;
    message += `• Scheduled Posts: ${status.marketingMetrics.scheduledPosts}\n`;
    message += `• Weekly Spend: £${status.marketingMetrics.weeklySpend.toFixed(2)}\n`;
    message += `• Weekly Conversions: ${status.marketingMetrics.weeklyConversions}\n\n`;

    message += `<i>CMO handles: Ad campaigns, content generation, performance tracking</i>`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agent CMO error:", error);
    await sendMessage(chatId, "❌ Error fetching CMO agent status.");
  }
}

export async function handleAgentCEOCommand(chatId: string): Promise<void> {
  try {
    const status = await getCEOStatus();

    if (!status) {
      await sendMessage(chatId, "❌ CEO Agent not found. Run /agent_run to initialize.");
      return;
    }

    const statusIcon = status.status === "active" ? "🟢" : "⚫";
    const lastHb = status.lastHeartbeat
      ? new Date(status.lastHeartbeat).toLocaleTimeString("en-GB")
      : "Never";

    let message = `${statusIcon} <b>CEO Agent - Strategic Oversight</b>\n\n`;
    message += `<b>Status:</b> ${status.status}\n`;
    message += `<b>Last Heartbeat:</b> ${lastHb}\n`;
    message += `<b>Pending Tasks:</b> ${status.pendingTasks}\n`;
    message += `<b>Budget:</b> ${status.budgetUsed.toFixed(2)} / ${(status.budgetUsed + status.budgetRemaining).toFixed(2)}\n\n`;

    message += `<b>📊 Strategic Metrics:</b>\n`;
    message += `• Weekly Revenue: £${status.strategicMetrics.weeklyRevenue.toFixed(2)}\n`;
    message += `• Weekly Jobs: ${status.strategicMetrics.weeklyJobs}\n`;
    message += `• Active Locksmiths: ${status.strategicMetrics.activeLocksmiths}\n`;
    message += `• Customer Satisfaction: ${status.strategicMetrics.customerSatisfaction.toFixed(0)}%\n\n`;

    message += `<b>🤖 Subagent Health:</b>\n`;
    message += `• COO: ${status.strategicMetrics.agentHealth.coo === "active" ? "🟢" : "⚫"} ${status.strategicMetrics.agentHealth.coo}\n`;
    message += `• CMO: ${status.strategicMetrics.agentHealth.cmo === "active" ? "🟢" : "⚫"} ${status.strategicMetrics.agentHealth.cmo}\n\n`;

    message += `<i>CEO handles: Strategy, resource allocation, agent coordination</i>`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agent CEO error:", error);
    await sendMessage(chatId, "❌ Error fetching CEO agent status.");
  }
}

export async function handleWeeklySummaryCommand(chatId: string): Promise<void> {
  try {
    await sendMessage(chatId, "📊 Generating weekly summary...");

    const summary = await generateWeeklySummary();

    let message = `📊 <b>Weekly Strategic Summary</b>\n`;
    message += `<i>${summary.period}</i>\n\n`;

    message += `<b>💰 Revenue:</b>\n`;
    message += `• Total: £${summary.revenue.total.toFixed(2)}\n`;
    message += `• Growth: ${summary.revenue.growth}\n\n`;

    message += `<b>📋 Jobs:</b>\n`;
    message += `• Total: ${summary.jobs.total}\n`;
    message += `• Completed: ${summary.jobs.completed}\n`;
    message += `• Completion Rate: ${summary.jobs.completionRate}\n\n`;

    message += `<b>👷 Locksmiths:</b>\n`;
    message += `• Total: ${summary.locksmiths.total}\n`;
    message += `• Available: ${summary.locksmiths.available}\n\n`;

    message += `<b>👥 Customers:</b>\n`;
    message += `• New: ${summary.customers.new}\n\n`;

    if (summary.highlights.length > 0) {
      message += `<b>✅ Highlights:</b>\n`;
      for (const h of summary.highlights) {
        message += `• ${h}\n`;
      }
      message += `\n`;
    }

    if (summary.concerns.length > 0) {
      message += `<b>⚠️ Concerns:</b>\n`;
      for (const c of summary.concerns) {
        message += `• ${c}\n`;
      }
      message += `\n`;
    }

    if (summary.recommendations.length > 0) {
      message += `<b>💡 Recommendations:</b>\n`;
      for (const r of summary.recommendations) {
        message += `• ${r}\n`;
      }
    }

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Weekly summary error:", error);
    await sendMessage(chatId, "❌ Error generating weekly summary.");
  }
}

export async function handleAgentBudgetCommand(chatId: string): Promise<void> {
  try {
    const budgets = await getAllBudgetStatus();

    let message = `💰 <b>Agent Budget Overview</b>\n\n`;

    let totalUsed = 0;
    let totalBudget = 0;

    for (const budget of budgets) {
      const statusIcon = budget.isPaused ? "🔴" : budget.isWarning ? "🟡" : "🟢";
      totalUsed += budget.budgetUsed;
      totalBudget += budget.monthlyBudget;

      message += `${statusIcon} <b>${budget.agentName.toUpperCase()}</b>\n`;
      message += `   ${budget.budgetUsed.toFixed(2)} / ${budget.monthlyBudget.toFixed(2)} (${budget.percentageUsed.toFixed(0)}%)\n`;
      message += `   Resets: ${budget.resetsAt.toLocaleDateString("en-GB")}\n\n`;
    }

    message += `<b>Total:</b> ${totalUsed.toFixed(2)} / ${totalBudget.toFixed(2)}`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agent budget error:", error);
    await sendMessage(chatId, "❌ Error fetching agent budgets.");
  }
}

export async function handleAgentRunCommand(chatId: string): Promise<void> {
  if (!AGENTS_ENABLED) {
    await sendMessage(chatId, "🤖 <b>AI Agents are DISABLED</b>\n\nAgents have been disabled to prevent unwanted API calls and Telegram spam.\n\nTo re-enable, set AGENTS_ENABLED=true in .env");
    return;
  }

  try {
    await sendMessage(chatId, "🔄 Running agent heartbeats...");

    const results = await runAllHeartbeats();

    let message = `✅ <b>Agent Heartbeats Complete</b>\n\n`;

    for (const result of results) {
      const statusIcon = result.success ? "✅" : "❌";
      message += `${statusIcon} <b>${result.agentName}</b>\n`;
      message += `   Actions: ${result.actionsExecuted} | Cost: ${result.costUsd.toFixed(4)}\n`;
      if (result.errors.length > 0) {
        message += `   Errors: ${result.errors.join(", ")}\n`;
      }
      message += `\n`;
    }

    const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
    message += `<b>Total Cost:</b> ${totalCost.toFixed(4)}`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Agent run error:", error);
    await sendMessage(chatId, "❌ Error running agent heartbeats. Check logs for details.");
  }
}

export async function handleStatsCommand(chatId: string): Promise<void> {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [
      todayJobs,
      pendingJobs,
      activeJobs,
      todayRevenue,
      availableLocksmiths,
      totalLocksmiths,
    ] = await Promise.all([
      prisma.job.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.job.count({ where: { status: JobStatus.PENDING } }),
      prisma.job.count({
        where: {
          status: {
            in: [
              JobStatus.ACCEPTED,
              JobStatus.EN_ROUTE,
              JobStatus.ARRIVED,
              JobStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "succeeded", createdAt: { gte: startOfToday } },
      }),
      prisma.locksmith.count({
        where: { isActive: true, isVerified: true, isAvailable: true },
      }),
      prisma.locksmith.count({ where: { isActive: true, isVerified: true } }),
    ]);

    const message = `
📊 <b>Dashboard Stats</b>

<b>Today's Jobs:</b> ${todayJobs}
<b>Pending:</b> ${pendingJobs}
<b>Active:</b> ${activeJobs}
<b>Revenue:</b> ${formatCurrency(todayRevenue._sum.amount || 0)}

<b>Locksmiths:</b>
🟢 ${availableLocksmiths} available
👷 ${totalLocksmiths} total verified

<i>Updated: ${now.toLocaleTimeString("en-GB")}</i>
`;

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📋 View Jobs", callback_data: "cmd_jobs" },
          { text: "🚨 Alerts", callback_data: "cmd_alerts" },
        ],
        [{ text: "🔄 Refresh", callback_data: "cmd_stats" }],
      ],
    };

    await sendMessage(chatId, message, { replyMarkup: keyboard });
  } catch (error) {
    console.error("[Telegram Bot] Stats error:", error);
    await sendMessage(chatId, "❌ Error fetching stats. Please try again.");
  }
}

export async function handleJobsCommand(
  chatId: string,
  filter?: string,
): Promise<void> {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // biome-ignore lint/suspicious/noExplicitAny: dynamic query
    const where: any = {};
    let title = "Today's Jobs";

    if (filter === "pending") {
      where.status = JobStatus.PENDING;
      title = "Pending Jobs";
    } else if (filter === "active") {
      where.status = {
        in: [
          JobStatus.ACCEPTED,
          JobStatus.EN_ROUTE,
          JobStatus.ARRIVED,
          JobStatus.IN_PROGRESS,
        ],
      };
      title = "Active Jobs";
    } else {
      where.createdAt = { gte: startOfToday };
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        locksmith: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (jobs.length === 0) {
      await sendMessage(chatId, `📋 <b>${title}</b>\n\nNo jobs found.`);
      return;
    }

    let message = `📋 <b>${title}</b> (${jobs.length})\n\n`;

    for (const job of jobs) {
      const time = job.createdAt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      message += `${formatStatus(job.status)}\n`;
      message += `<b>${job.jobNumber}</b> - ${job.postcode}\n`;
      message += `${escapeHtml(job.problemType)} • ${escapeHtml(job.customer?.name || "Customer")}\n`;
      if (job.locksmith) {
        message += `🔧 ${escapeHtml(job.locksmith.name)}\n`;
      }
      message += `<code>${time}</code>\n\n`;
    }

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          { text: "⏳ Pending", callback_data: "jobs_pending" },
          { text: "🔧 Active", callback_data: "jobs_active" },
        ],
        [{ text: "📅 All Today", callback_data: "jobs_today" }],
      ],
    };

    await sendMessage(chatId, message, { replyMarkup: keyboard });
  } catch (error) {
    console.error("[Telegram Bot] Jobs error:", error);
    await sendMessage(chatId, "❌ Error fetching jobs. Please try again.");
  }
}

export async function handlePendingCommand(chatId: string): Promise<void> {
  await handleJobsCommand(chatId, "pending");
}

export async function handleLocksmithsCommand(chatId: string): Promise<void> {
  try {
    const locksmiths = await prisma.locksmith.findMany({
      where: { isActive: true, isVerified: true },
      select: {
        id: true,
        name: true,
        companyName: true,
        isAvailable: true,
        rating: true,
        baseAddress: true,
        _count: {
          select: {
            jobs: {
              where: {
                status: {
                  in: [
                    JobStatus.ACCEPTED,
                    JobStatus.EN_ROUTE,
                    JobStatus.IN_PROGRESS,
                  ],
                },
              },
            },
          },
        },
      },
      orderBy: [{ isAvailable: "desc" }, { rating: "desc" }],
      take: 15,
    });

    const available = locksmiths.filter((l) => l.isAvailable);
    const offline = locksmiths.filter((l) => !l.isAvailable);

    let message = "👷 <b>Locksmiths</b>\n\n";

    if (available.length > 0) {
      message += `<b>🟢 Available (${available.length})</b>\n`;
      for (const ls of available) {
        message += `• ${escapeHtml(ls.name)}`;
        if (ls.companyName) message += ` (${escapeHtml(ls.companyName)})`;
        message += ` ⭐${ls.rating.toFixed(1)}`;
        if (ls._count.jobs > 0) message += ` 📋${ls._count.jobs}`;
        message += "\n";
      }
      message += "\n";
    }

    if (offline.length > 0) {
      message += `<b>⚫ Offline (${offline.length})</b>\n`;
      for (const ls of offline.slice(0, 5)) {
        message += `• ${escapeHtml(ls.name)} ⭐${ls.rating.toFixed(1)}\n`;
      }
      if (offline.length > 5) {
        message += `<i>...and ${offline.length - 5} more</i>\n`;
      }
    }

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Locksmiths error:", error);
    await sendMessage(
      chatId,
      "❌ Error fetching locksmiths. Please try again.",
    );
  }
}

export async function handleAlertsCommand(chatId: string): Promise<void> {
  try {
    const alerts: string[] = [];

    // Check urgent pending jobs
    const urgentJobs = await prisma.job.count({
      where: {
        status: JobStatus.PENDING,
        createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
      },
    });
    if (urgentJobs > 0) {
      alerts.push(`🚨 <b>${urgentJobs}</b> jobs pending 30+ mins`);
    }

    // Check expiring insurance
    const expiringInsurance = await prisma.locksmith.count({
      where: {
        isActive: true,
        insuranceExpiryDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });
    if (expiringInsurance > 0) {
      alerts.push(`⚠️ <b>${expiringInsurance}</b> insurance expiring soon`);
    }

    // Check low availability
    const available = await prisma.locksmith.count({
      where: { isActive: true, isVerified: true, isAvailable: true },
    });
    if (available < 3) {
      alerts.push(`⚠️ Only <b>${available}</b> locksmiths available`);
    }

    // Check pending payouts
    const pendingPayouts = await prisma.payout.count({
      where: { status: "pending" },
    });
    if (pendingPayouts > 0) {
      alerts.push(`💰 <b>${pendingPayouts}</b> pending payouts`);
    }

    if (alerts.length === 0) {
      await sendMessage(
        chatId,
        "✅ <b>No Alerts</b>\n\nAll systems running smoothly!",
      );
      return;
    }

    const message = `🔔 <b>Alerts (${alerts.length})</b>\n\n${alerts.join("\n\n")}`;
    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Alerts error:", error);
    await sendMessage(chatId, "❌ Error fetching alerts. Please try again.");
  }
}

export async function handleDispatchCommand(
  chatId: string,
  jobNumber: string,
): Promise<void> {
  try {
    if (!jobNumber) {
      await sendMessage(
        chatId,
        "❌ Usage: /dispatch <job_number>\n\nExample: /dispatch LS-2603-0001",
      );
      return;
    }

    // Find job by number
    const job = await prisma.job.findFirst({
      where: {
        OR: [
          {
            jobNumber: { equals: jobNumber.toUpperCase(), mode: "insensitive" },
          },
          { id: jobNumber },
        ],
      },
      include: { customer: true },
    });

    if (!job) {
      await sendMessage(chatId, `❌ Job "${jobNumber}" not found`);
      return;
    }

    if (job.status !== JobStatus.PENDING) {
      await sendMessage(
        chatId,
        `❌ Job ${job.jobNumber} is not pending (status: ${job.status})`,
      );
      return;
    }

    // Find best locksmiths
    const result = await findBestLocksmiths(job.id, 5);

    if (!result.success || result.candidates.length === 0) {
      await sendMessage(chatId, `❌ ${result.reason}`);
      return;
    }

    let message = `🎯 <b>Best Matches for ${job.jobNumber}</b>\n`;
    message += `📍 ${job.postcode} - ${job.problemType}\n\n`;

    for (let i = 0; i < result.candidates.length; i++) {
      const c = result.candidates[i];
      const emoji =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      message += `${emoji} <b>${escapeHtml(c.locksmithName)}</b>\n`;
      message += `   📏 ${c.distanceMiles}mi • ⭐${c.rating.toFixed(1)} • ⏱️ ~${c.estimatedEtaMinutes}min\n`;
      message += `   ${c.isAvailable ? "🟢 Available" : "⚫ Offline"} • Match: ${c.matchScore}%\n`;
      if (c.reasons.length > 0) {
        message += `   <i>${c.reasons.slice(0, 2).join(", ")}</i>\n`;
      }
      message += "\n";
    }

    if (result.autoDispatchRecommended && result.topCandidate) {
      message += `\n✨ <b>Auto-dispatch recommended</b> to ${escapeHtml(result.topCandidate.locksmithName)}`;
    }

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: result.candidates.slice(0, 3).map((c) => [
        {
          text: `Assign to ${c.locksmithName}`,
          callback_data: `assign_${job.id}_${c.locksmithId}`,
        },
      ]),
    };

    await sendMessage(chatId, message, { replyMarkup: keyboard });
  } catch (error) {
    console.error("[Telegram Bot] Dispatch error:", error);
    await sendMessage(chatId, "❌ Error finding locksmiths. Please try again.");
  }
}

export async function handleAssignCommand(
  chatId: string,
  jobId: string,
  locksmithId: string,
): Promise<void> {
  try {
    if (!jobId || !locksmithId) {
      await sendMessage(chatId, "❌ Usage: /assign <job_id> <locksmith_id>");
      return;
    }

    // Get job details
    const job = await prisma.job.findFirst({
      where: {
        OR: [
          { id: jobId },
          { jobNumber: { equals: jobId.toUpperCase(), mode: "insensitive" } },
        ],
      },
    });

    if (!job) {
      await sendMessage(chatId, `❌ Job "${jobId}" not found`);
      return;
    }

    // Auto-dispatch
    const result = await autoDispatchJob(
      job.id,
      locksmithId,
      job.assessmentFee,
      20,
    );

    if (!result.success) {
      await sendMessage(chatId, `❌ ${result.message}`);
      return;
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { name: true },
    });

    await sendMessage(
      chatId,
      `✅ <b>Job Assigned!</b>\n\nJob: <b>${job.jobNumber}</b>\nLocksmith: <b>${escapeHtml(locksmith?.name || locksmithId)}</b>\n\n<i>Locksmith has been notified.</i>`,
    );
  } catch (error) {
    console.error("[Telegram Bot] Assign error:", error);
    await sendMessage(chatId, "❌ Error assigning job. Please try again.");
  }
}

export async function handleAvailabilityCommand(
  chatId: string,
  locksmithId: string,
  status: string,
): Promise<void> {
  try {
    if (!locksmithId || !status) {
      await sendMessage(
        chatId,
        "❌ Usage: /availability <locksmith_id> <on|off>",
      );
      return;
    }

    const isAvailable = status.toLowerCase() === "on";

    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable,
        lastAvailabilityChange: new Date(),
      },
      select: { name: true, isAvailable: true },
    });

    await sendMessage(
      chatId,
      `✅ <b>${escapeHtml(locksmith.name)}</b> is now ${locksmith.isAvailable ? "🟢 available" : "⚫ offline"}`,
    );
  } catch (error) {
    console.error("[Telegram Bot] Availability error:", error);
    await sendMessage(
      chatId,
      "❌ Error updating availability. Check the locksmith ID.",
    );
  }
}

export async function handleEarningsCommand(chatId: string): Promise<void> {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Platform fee percentage (default 15%)
    const platformFeePercent = Number.parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || "0.15");

    const [todayPayments, weekPayments, monthPayments, totalPayments, totalPayouts] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: "succeeded", createdAt: { gte: startOfToday } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: "succeeded", createdAt: { gte: startOfWeek } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: "succeeded", createdAt: { gte: startOfMonth } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: "succeeded" },
      }),
      // Get actual platform fees from payouts
      prisma.payout.aggregate({
        _sum: { platformFee: true },
        where: { status: { in: ["paid", "processing", "pending"] } },
      }),
    ]);

    // Calculate platform fees from revenue
    const todayRevenue = todayPayments._sum.amount || 0;
    const weekRevenue = weekPayments._sum.amount || 0;
    const monthRevenue = monthPayments._sum.amount || 0;
    const totalRevenue = totalPayments._sum.amount || 0;

    const message = `
💰 <b>Platform Earnings</b>

<b>Today:</b>
• Revenue: ${formatCurrency(todayRevenue)}
• Est. Platform Fee: ${formatCurrency(todayRevenue * platformFeePercent)}
• Transactions: ${todayPayments._count}

<b>This Week:</b>
• Revenue: ${formatCurrency(weekRevenue)}
• Est. Platform Fee: ${formatCurrency(weekRevenue * platformFeePercent)}
• Transactions: ${weekPayments._count}

<b>This Month:</b>
• Revenue: ${formatCurrency(monthRevenue)}
• Est. Platform Fee: ${formatCurrency(monthRevenue * platformFeePercent)}
• Transactions: ${monthPayments._count}

<b>All Time:</b>
• Total Revenue: ${formatCurrency(totalRevenue)}
• Actual Platform Fees: ${formatCurrency(totalPayouts._sum.platformFee || 0)}
• Total Transactions: ${totalPayments._count}

<i>Updated: ${now.toLocaleTimeString("en-GB")}</i>
    `.trim();

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Earnings error:", error);
    await sendMessage(chatId, "❌ Error fetching earnings. Please try again.");
  }
}

export async function handlePayoutsCommand(chatId: string): Promise<void> {
  try {
    const [pendingPayouts, recentPayouts] = await Promise.all([
      prisma.payout.findMany({
        where: { status: "pending" },
        include: {
          locksmith: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.payout.findMany({
        where: { status: { in: ["paid", "processing"] } },
        include: {
          locksmith: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const pendingTotal = pendingPayouts.reduce((sum, p) => sum + p.netAmount, 0);

    let message = `💸 <b>Payouts</b>\n\n`;

    if (pendingPayouts.length > 0) {
      message += `<b>⏳ Pending (${pendingPayouts.length})</b>\n`;
      message += `Total: ${formatCurrency(pendingTotal)}\n\n`;

      for (const payout of pendingPayouts.slice(0, 5)) {
        message += `• ${escapeHtml(payout.locksmith.name)}: ${formatCurrency(payout.netAmount)}\n`;
      }
      if (pendingPayouts.length > 5) {
        message += `<i>...and ${pendingPayouts.length - 5} more</i>\n`;
      }
      message += "\n";
    } else {
      message += "✅ No pending payouts\n\n";
    }

    if (recentPayouts.length > 0) {
      message += `<b>✅ Recent Payouts</b>\n`;
      for (const payout of recentPayouts) {
        const status = payout.status === "paid" ? "✅" : "⏳";
        message += `${status} ${escapeHtml(payout.locksmith.name)}: ${formatCurrency(payout.netAmount)}\n`;
      }
    }

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [{ text: "📊 View All Payouts", url: `${SITE_URL}/admin/payouts` }],
      ],
    };

    await sendMessage(chatId, message, { replyMarkup: keyboard });
  } catch (error) {
    console.error("[Telegram Bot] Payouts error:", error);
    await sendMessage(chatId, "❌ Error fetching payouts. Please try again.");
  }
}

export async function handleCustomersCommand(chatId: string): Promise<void> {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [totalCustomers, todayCustomers, weekCustomers, recentCustomers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.customer.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { name: true, email: true, createdAt: true },
      }),
    ]);

    let message = `👥 <b>Customers</b>\n\n`;
    message += `<b>Total:</b> ${totalCustomers}\n`;
    message += `<b>Today:</b> +${todayCustomers}\n`;
    message += `<b>This Week:</b> +${weekCustomers}\n\n`;

    if (recentCustomers.length > 0) {
      message += `<b>Recent Signups:</b>\n`;
      for (const customer of recentCustomers) {
        const time = customer.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        message += `• ${escapeHtml(customer.name)} <code>${time}</code>\n`;
      }
    }

    await sendMessage(chatId, message);
  } catch (error) {
    console.error("[Telegram Bot] Customers error:", error);
    await sendMessage(chatId, "❌ Error fetching customers. Please try again.");
  }
}

/**
 * Handle callback queries (button presses)
 */
export async function handleCallbackQuery(
  chatId: string,
  callbackId: string,
  data: string,
): Promise<void> {
  await answerCallback(callbackId);

  if (data === "cmd_stats") {
    await handleStatsCommand(chatId);
  } else if (data === "cmd_jobs" || data === "jobs_today") {
    await handleJobsCommand(chatId);
  } else if (data === "jobs_pending") {
    await handleJobsCommand(chatId, "pending");
  } else if (data === "jobs_active") {
    await handleJobsCommand(chatId, "active");
  } else if (data === "cmd_alerts") {
    await handleAlertsCommand(chatId);
  } else if (data.startsWith("assign_")) {
    const [_, jobId, locksmithId] = data.split("_");
    await handleAssignCommand(chatId, jobId, locksmithId);
  }
}

/**
 * Main command router
 */
export async function handleCommand(
  chatId: string,
  command: string,
  args: string[],
): Promise<void> {
  switch (command) {
    case "/help":
    case "/start":
      await handleHelpCommand(chatId);
      break;
    case "/stats":
    case "/dashboard":
      await handleStatsCommand(chatId);
      break;
    case "/jobs":
    case "/today":
      await handleJobsCommand(chatId);
      break;
    case "/pending":
      await handlePendingCommand(chatId);
      break;
    case "/locksmiths":
    case "/ls":
      await handleLocksmithsCommand(chatId);
      break;
    case "/alerts":
      await handleAlertsCommand(chatId);
      break;
    case "/dispatch":
      await handleDispatchCommand(chatId, args[0] || "");
      break;
    case "/assign":
      await handleAssignCommand(chatId, args[0] || "", args[1] || "");
      break;
    case "/availability":
      await handleAvailabilityCommand(chatId, args[0] || "", args[1] || "");
      break;
    case "/earnings":
    case "/revenue":
      await handleEarningsCommand(chatId);
      break;
    case "/payouts":
      await handlePayoutsCommand(chatId);
      break;
    case "/customers":
      await handleCustomersCommand(chatId);
      break;
    // AI Agent commands
    case "/agents":
    case "/agent":
      await handleAgentsCommand(chatId);
      break;
    case "/agent_ceo":
    case "/ceo":
      await handleAgentCEOCommand(chatId);
      break;
    case "/agent_coo":
    case "/coo":
      await handleAgentCOOCommand(chatId);
      break;
    case "/agent_cmo":
    case "/cmo":
      await handleAgentCMOCommand(chatId);
      break;
    case "/agent_budget":
    case "/budget":
      await handleAgentBudgetCommand(chatId);
      break;
    case "/agent_run":
    case "/run_agents":
      await handleAgentRunCommand(chatId);
      break;
    case "/weekly":
    case "/summary":
      await handleWeeklySummaryCommand(chatId);
      break;
    default:
      await sendMessage(
        chatId,
        `❓ Unknown command: ${command}\n\nType /help for available commands.`,
      );
  }
}
