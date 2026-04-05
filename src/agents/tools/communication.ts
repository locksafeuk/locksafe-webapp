/**
 * Communication Tools for Agents
 *
 * Tools for sending notifications via various channels.
 * Includes rate limiting to prevent spam.
 */

import { sendSMS } from "@/lib/sms";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";
import { canSendTelegramMessage, recordTelegramMessage } from "@/agents/core/orchestrator";

// Telegram config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send a message via Telegram Bot API (with rate limiting)
 */
async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Missing bot token or chat ID");
    return false;
  }

  // Check rate limit
  if (!canSendTelegramMessage()) {
    console.warn("[Telegram] Rate limited - too many messages this hour");
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
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      recordTelegramMessage();
    }

    return data.ok;
  } catch (error) {
    console.error("[Telegram] Failed to send message:", error);
    return false;
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
      const sent = await sendTelegramMessage(formattedMessage);
      return {
        success: sent,
        data: { sent, priority, timestamp: new Date() },
        error: sent ? undefined : "Failed to send Telegram message",
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

// Export all communication tools
export const communicationTools: AgentTool[] = [
  sendTelegramAlertTool,
  sendEmailTool,
  sendSMSTool,
  logAgentCommunicationTool,
];
