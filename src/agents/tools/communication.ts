/**
 * Communication Tools for Agents
 *
 * Tools for sending notifications via various channels.
 * Includes rate limiting to prevent spam.
 */

import { sendSMS } from "@/lib/sms";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";
import {
  canSendTelegramMessage,
  recordTelegramMessage,
  delegateTask,
  pauseAgent,
  resumeAgent,
  syncAllAgentsFromDB,
} from "@/agents/core/orchestrator";

// Telegram config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_TOPIC_AGENTS = process.env.TELEGRAM_TOPIC_AGENTS
  ? Number.parseInt(process.env.TELEGRAM_TOPIC_AGENTS, 10)
  : undefined;

/**
 * Send a message via Telegram Bot API (with rate limiting)
 */
async function sendTelegramMessage(
  message: string,
  threadId?: number,
): Promise<{ sent: boolean; reason?: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    // Graceful degradation: log locally, don't fail the agent action
    console.log("[Telegram] Message logged (no token configured):", message.slice(0, 120));
    return { sent: false, reason: "TELEGRAM_BOT_TOKEN not configured — message logged locally only" };
  }

  // Check rate limit
  if (!canSendTelegramMessage()) {
    console.warn("[Telegram] Rate limited - too many messages this hour");
    return { sent: false, reason: "rate_limited" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (threadId && Number.isFinite(threadId)) {
      body.message_thread_id = threadId;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.ok) {
      recordTelegramMessage();
    }

    return { sent: data.ok, reason: data.ok ? undefined : data.description };
  } catch (error) {
    console.error("[Telegram] Failed to send message:", error);
    return { sent: false, reason: error instanceof Error ? error.message : "network error" };
  }
}

/**
 * Send a Telegram notification to admin
 */
export const sendTelegramAlertTool: AgentTool = {
  name: "sendTelegramAlert",
  description: "Send an alert to the admin Telegram chat",
  category: "communication",
  permissions: ["ceo", "cto", "cmo", "coo", "ops-manager"],
  parameters: [
    {
      name: "message",
      type: "string",
      required: true,
      description: "The message to send",
    },
    {
      name: "priority",
      type: "string",
      required: false,
      description: "Message priority",
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const message = params.message as string;
    const priority = (params.priority as string) || "medium";

    // Sensitivity gating — non-workflow agents (CEO/CMO/copywriter/ads/social)
    // are noisy. Only let them through to Telegram if their priority meets the
    // operational policy threshold:
    //   sensitivity=all        → low/medium/high/critical
    //   sensitivity=workflow   → high/critical only      (default)
    //   sensitivity=critical   → critical only
    // Guardians (COO, CTO) and any 'high'/'critical' from anyone are never gated.
    try {
      const [{ getOperationalPolicy, isGuardianAgent }] = await Promise.all([
        import("@/agents/core/operational-policy"),
      ]);
      const policy = await getOperationalPolicy();
      const isGuardian = isGuardianAgent(context.agentName);
      const sensitivity = policy.alertSensitivity;
      const rank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      const priorityRank = rank[priority] ?? 2;
      let threshold = 1;
      if (sensitivity === "workflow") threshold = 3; // high+
      else if (sensitivity === "critical") threshold = 4; // critical only
      if (!isGuardian && priorityRank < threshold) {
        console.log(
          `[Telegram][gated] ${context.agentName} priority=${priority} suppressed (sensitivity=${sensitivity})`,
        );
        return {
          success: true,
          data: { sent: false, priority, gated: true, sensitivity },
        };
      }
    } catch (e) {
      // Fail open — if policy lookup fails, fall through to send (legacy behaviour)
      console.warn("[Telegram][gating] policy lookup failed, allowing message:", e);
    }

    const priorityEmoji = {
      low: "ℹ️",
      medium: "📢",
      high: "⚠️",
      critical: "🚨",
    };

    const formattedMessage = `${priorityEmoji[priority as keyof typeof priorityEmoji]} <b>Agent Alert</b>
From: ${context.agentName.toUpperCase()}
Priority: ${priority.toUpperCase()}

${message}

<i>Sent at ${new Date().toLocaleTimeString()}</i>`;

    try {
      const result = await sendTelegramMessage(formattedMessage, TELEGRAM_TOPIC_AGENTS);
      // Treat missing-token as a graceful success so agents don't retry in loops
      const isSuccess = result.sent || result.reason?.includes("not configured");
      return {
        success: true,
        data: { sent: result.sent, priority, timestamp: new Date(), note: result.reason },
        error: isSuccess ? undefined : result.reason,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send Telegram message",
      };
    }
  },
};

/**
 * Send an email (agent tool)
 * Note: Uses Resend API directly for agent-initiated emails
 */
export const sendEmailTool: AgentTool = {
  name: "sendEmail",
  description: "Send an email to a specified recipient",
  category: "communication",
  permissions: ["ceo", "cmo", "coo"],
  requiresApproval: true, // Emails require approval
  parameters: [
    {
      name: "to",
      type: "string",
      required: true,
      description: "Recipient email address",
    },
    {
      name: "subject",
      type: "string",
      required: true,
      description: "Email subject",
    },
    {
      name: "body",
      type: "string",
      required: true,
      description: "Email body (HTML supported)",
    },
    {
      name: "type",
      type: "string",
      required: false,
      description: "Email type",
      enum: ["transactional", "marketing", "internal"],
      default: "internal",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const to = params.to as string;
    const subject = params.subject as string;
    const body = params.body as string;
    const type = (params.type as string) || "internal";

    // For agent emails, we just log them (actual sending would need Resend setup)
    // In production, this would use the Resend API
    console.log(`[Agent Email] To: ${to}, Subject: ${subject}, Type: ${type}`);
    console.log(`[Agent Email] Body: ${body.substring(0, 100)}...`);

    // Return success - actual sending would be implemented based on approval workflow
    return {
      success: true,
      data: {
        sent: false, // Pending approval
        to,
        subject,
        type,
        sentAt: new Date(),
        note: "Email queued for approval",
      },
    };
  },
};

/**
 * Send an SMS
 */
export const sendSMSTool: AgentTool = {
  name: "sendSMS",
  description: "Send an SMS to a phone number",
  category: "communication",
  permissions: ["coo", "ops-manager"],
  requiresApproval: true, // SMS requires approval (cost)
  parameters: [
    {
      name: "to",
      type: "string",
      required: true,
      description: "Phone number (E.164 format)",
    },
    {
      name: "message",
      type: "string",
      required: true,
      description: "SMS message (max 160 chars)",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const to = params.to as string;
    let message = params.message as string;

    // Truncate if too long
    if (message.length > 160) {
      message = message.substring(0, 157) + "...";
    }

    try {
      const result = await sendSMS(to, message);

      return {
        success: result.success,
        data: { sent: result.success, to, messageLength: message.length, sentAt: new Date() },
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send SMS",
      };
    }
  },
};

/**
 * Log an internal agent communication
 */
export const logAgentCommunicationTool: AgentTool = {
  name: "logAgentCommunication",
  description: "Log a communication between agents or an agent report",
  category: "communication",
  permissions: ["*"], // All agents can log
  parameters: [
    {
      name: "type",
      type: "string",
      required: true,
      description: "Communication type",
      enum: ["report", "delegation", "escalation", "status_update"],
    },
    {
      name: "targetAgent",
      type: "string",
      required: false,
      description: "Target agent name (if applicable)",
    },
    {
      name: "content",
      type: "string",
      required: true,
      description: "Communication content",
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const type = params.type as string;
    const targetAgent = params.targetAgent as string;
    const content = params.content as string;

    // Log to console for now (could be stored in DB in future)
    console.log(`[Agent Communication]
Type: ${type}
From: ${context.agentName}
To: ${targetAgent || "system"}
Content: ${content}
Time: ${new Date().toISOString()}`);

    return {
      success: true,
      data: {
        logged: true,
        type,
        from: context.agentName,
        to: targetAgent,
        timestamp: new Date(),
      },
    };
  },
};

/**
 * Create a high-priority remediation task for another agent.
 */
export const createRepairTaskTool: AgentTool = {
  name: "createRepairTask",
  description: "Create a remediation task when heartbeat or tool execution errors are detected",
  category: "communication",
  permissions: ["repair_system", "ceo", "cto"],
  parameters: [
    {
      name: "targetAgent",
      type: "string",
      required: true,
      description: "Agent name that should own the remediation task (e.g. cto, cmo)",
    },
    {
      name: "errorSummary",
      type: "string",
      required: true,
      description: "Short summary of the failure that needs fixing",
    },
    {
      name: "recommendedAction",
      type: "string",
      required: false,
      description: "Suggested fix path for the target agent",
    },
    {
      name: "priority",
      type: "number",
      required: false,
      description: "Priority from 1 (low) to 10 (critical). Default 8.",
      default: 8,
    },
  ],
  async execute(params, context): Promise<ToolResult> {
    const targetAgent = String(params.targetAgent || "").trim().toLowerCase();
    const errorSummary = String(params.errorSummary || "").trim();
    const recommendedAction = String(params.recommendedAction || "").trim();
    const priority = Number(params.priority ?? 8);

    if (!targetAgent) {
      return { success: false, error: "targetAgent is required" };
    }
    if (!errorSummary) {
      return { success: false, error: "errorSummary is required" };
    }

    const boundedPriority = Number.isFinite(priority)
      ? Math.max(1, Math.min(10, Math.floor(priority)))
      : 8;

    const taskId = await delegateTask(context.agentId, targetAgent, {
      title: "[Repair] Investigate and resolve agent failure",
      description: [
        `Detected by: ${context.agentName}`,
        `Error: ${errorSummary}`,
        recommendedAction ? `Recommended action: ${recommendedAction}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      priority: boundedPriority,
    });

    if (!taskId) {
      return {
        success: false,
        error: `Failed to create repair task for agent ${targetAgent}`,
      };
    }

    return {
      success: true,
      data: {
        taskId,
        targetAgent,
        priority: boundedPriority,
        createdAt: new Date(),
      },
    };
  },
};

/**
 * Controlled heartbeat state action for recovery playbooks.
 */
export const controlAgentHeartbeatTool: AgentTool = {
  name: "controlAgentHeartbeat",
  description:
    "Pause or resume an agent heartbeat to contain or recover from repeated failures. " +
    "agentName MUST be one of the seeded agents (ceo, coo, cmo, cto, copywriter, ads-specialist, social-media). " +
    "If you do not know the exact name, call getDashboardStats / listAgents first instead of guessing — invented names will be rejected and will NOT auto-create agents.",
  category: "communication",
  permissions: ["repair_system", "ceo", "cto"],
  parameters: [
    {
      name: "agentName",
      type: "string",
      required: true,
      description:
        "Target agent name. Must exactly match a seeded agent in the database " +
        "(ceo, coo, cmo, cto, copywriter, ads-specialist, social-media). " +
        "Do not invent names like 'reliability-sentinel' or 'monitor' — they will be rejected.",
    },
    {
      name: "action",
      type: "string",
      required: true,
      description: "Heartbeat action to execute",
      enum: ["pause", "resume"],
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "Optional reason for auditability",
    },
  ],
  async execute(params): Promise<ToolResult> {
    const agentName = String(params.agentName || "").trim().toLowerCase();
    const action = String(params.action || "").trim().toLowerCase();
    const reason = String(params.reason || "").trim();

    if (!agentName) {
      return { success: false, error: "agentName is required" };
    }
    if (action !== "pause" && action !== "resume") {
      return { success: false, error: "action must be pause or resume" };
    }

    // Validate against the live agents table BEFORE attempting state mutation.
    // This stops the LLM looping on hallucinated names like "reliability-sentinel".
    const { prisma } = await import("@/lib/prisma");
    const knownAgents = await prisma.agent.findMany({ select: { name: true } });
    const knownNames = knownAgents.map((a) => a.name);
    if (!knownNames.includes(agentName)) {
      return {
        success: false,
        error:
          `Agent "${agentName}" does not exist. Valid agent names are: ${knownNames.join(", ")}. ` +
          `Do not retry with invented names — only use one of the listed agents or skip this action.`,
      };
    }

    // Ensure runtime state exists for DB-backed agents before state mutation.
    await syncAllAgentsFromDB();

    const ok = action === "pause" ? await pauseAgent(agentName) : await resumeAgent(agentName);
    if (!ok) {
      return {
        success: false,
        error: `Unable to ${action} agent ${agentName}. Verify the agent exists and is initialized.`,
      };
    }

    return {
      success: true,
      data: {
        agentName,
        action,
        reason: reason || undefined,
        updatedAt: new Date(),
      },
    };
  },
};

// Export all communication tools
export const communicationTools: AgentTool[] = [
  sendTelegramAlertTool,
  sendEmailTool,
  sendSMSTool,
  logAgentCommunicationTool,
  createRepairTaskTool,
  controlAgentHeartbeatTool,
];
