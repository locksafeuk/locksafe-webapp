/**
 * Communication Tools for Agents
 *
 * Tools for sending notifications via various channels.
 * Includes rate limiting to prevent spam.
 */

import { sendSMS } from "@/lib/sms";
import { sendAdminAlert } from "@/lib/telegram";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";
import {
  delegateTask,
  pauseAgent,
  resumeAgent,
  syncAllAgentsFromDB,
} from "@/agents/core/orchestrator";

function getAgentAlertCooldownMs(priority: string, isGuardian: boolean): number {
  const defaults = {
    low: isGuardian ? 30 : 240,
    medium: isGuardian ? 20 : 180,
    high: isGuardian ? 10 : 180,
    critical: 0,
  };

  const fromEnv = {
    low: Number(process.env.AGENT_ALERT_LOW_COOLDOWN_MINUTES ?? defaults.low),
    medium: Number(process.env.AGENT_ALERT_MEDIUM_COOLDOWN_MINUTES ?? defaults.medium),
    high: Number(process.env.AGENT_ALERT_HIGH_COOLDOWN_MINUTES ?? defaults.high),
    critical: Number(process.env.AGENT_ALERT_CRITICAL_COOLDOWN_MINUTES ?? defaults.critical),
  };

  const minutes = Math.max(0, fromEnv[priority as keyof typeof fromEnv] ?? defaults.medium);
  return minutes * 60 * 1000;
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
    let isGuardian = false;

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
      isGuardian = isGuardianAgent(context.agentName);
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
    const severityByPriority: Record<string, "info" | "warning" | "error"> = {
      low: "info",
      medium: "info",
      high: "warning",
      critical: "error",
    };
    const severity = severityByPriority[priority] ?? "info";

    // Collapse noisy executive/marketing heartbeat summaries into one shared
    // non-guardian lane so CEO and CMO don't both page within minutes.
    const dedupeKey = !isGuardian && priority !== "critical"
      ? `agent-alert:non-guardian:${priority.toLowerCase()}`
      : `agent-alert:${context.agentName.toLowerCase()}`;
    const cooldownMs = getAgentAlertCooldownMs(priority, isGuardian);

    const title = `${priorityEmoji[priority as keyof typeof priorityEmoji]} Agent Alert: ${context.agentName.toUpperCase()} (${priority.toUpperCase()})`;

    try {
      const sent = await sendAdminAlert({
        title,
        message,
        severity,
        dedupeKey,
        cooldownMsOverride: cooldownMs,
        bypassPolicyGate: true,
      });

      return {
        success: true,
        data: {
          sent,
          priority,
          dedupeKey,
          cooldownMs,
          timestamp: new Date(),
        },
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
  description:
    "Create a remediation task for ANOTHER agent only when you have evidence of a concrete failure " +
    "(specific error message, failed AgentExecution row, or observed symptom). " +
    "Valid targetAgent values are EXACTLY: ceo, coo, cmo, cto, copywriter, ads-specialist, social-media. " +
    "errorSummary MUST be at least 20 characters and cite the actual error. " +
    "Do NOT file repair tasks against generic names like 'agent1', 'agent2', 'site', 'monitor' — they will be rejected.",
  category: "communication",
  permissions: ["repair_system", "ceo"],
  parameters: [
    {
      name: "targetAgent",
      type: "string",
      required: true,
      description:
        "Target agent name. MUST be one of: ceo, coo, cmo, cto, copywriter, ads-specialist, social-media.",
    },
    {
      name: "errorSummary",
      type: "string",
      required: true,
      description:
        "Concrete failure description (>=20 chars). Must cite a specific error, failed run id, or observed symptom — not 'agent failure' or other placeholders.",
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

    // Validate against live agents to block hallucinated names (agent1, agent2, site, monitor, ...).
    const { prisma } = await import("@/lib/prisma");
    const knownNames = (await prisma.agent.findMany({ select: { name: true } })).map((a) => a.name);
    if (!knownNames.includes(targetAgent)) {
      return {
        success: false,
        error:
          `Repair task rejected: targetAgent "${targetAgent}" does not exist. ` +
          `Valid agent names are: ${knownNames.join(", ")}. ` +
          `Do NOT retry with invented names. If unsure which agent owns the failure, do nothing this cycle.`,
      };
    }

    // Reject placeholder/templated summaries that have been driving the loop.
    const placeholderSummaries = new Set([
      "agent failure",
      "investigate and resolve agent failure",
      "unknown failure",
      "error detected",
    ]);
    if (errorSummary.length < 20 || placeholderSummaries.has(errorSummary.toLowerCase())) {
      return {
        success: false,
        error:
          `Repair task rejected: errorSummary must be >=20 chars and cite a concrete failure ` +
          `(specific error message, failed run id, or observed symptom). ` +
          `Generic phrases like "agent failure" are not accepted. ` +
          `If you have no concrete evidence, do NOT file a repair task.`,
      };
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
    "Valid agentName values are EXACTLY: ceo, coo, cmo, cto, copywriter, ads-specialist, social-media. " +
    "Any other value will be rejected. Do NOT invoke this tool unless you have observed >=3 failed AgentExecution rows for the target agent in the last hour; otherwise the tool will refuse the action.",
  category: "communication",
  permissions: ["repair_system", "ceo"],
  parameters: [
    {
      name: "agentName",
      type: "string",
      required: true,
      description:
        "Target agent name. MUST be one of: ceo, coo, cmo, cto, copywriter, ads-specialist, social-media. Anything else is rejected.",
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
      description:
        "Justification for the action. REQUIRED when action='pause' and must be at least 30 characters " +
        "AND cite the specific failure (e.g. error message, failed run id, or symptom). " +
        "Pausing a healthy agent will be rejected — use the agent's recent AgentExecution failures as evidence.",
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
    const knownAgents = await prisma.agent.findMany({ select: { name: true, id: true } });
    const knownNames = knownAgents.map((a) => a.name);
    if (!knownNames.includes(agentName)) {
      return {
        success: false,
        error:
          `Agent "${agentName}" does not exist. Valid agent names are: ${knownNames.join(", ")}. ` +
          `Do not retry with invented names — only use one of the listed agents or skip this action.`,
      };
    }

    // PAUSE guardrails — protect healthy agents from over-eager repair playbooks.
    if (action === "pause") {
      if (reason.length < 30) {
        return {
          success: false,
          error:
            `Pause rejected: 'reason' must be at least 30 characters and cite the specific failure ` +
            `(error message, failed run id, or observed symptom). Got ${reason.length} chars. ` +
            `If you cannot cite a recent failure, do NOT pause the agent.`,
        };
      }

      // Require evidence: at least one failed execution OR no successful heartbeat in last 2h.
      const target = knownAgents.find((a) => a.name === agentName)!;
      const since = new Date(Date.now() - 60 * 60_000); // last hour
      const [recentFailures, recentSuccess] = await Promise.all([
        prisma.agentExecution.count({
          where: { agentId: target.id, status: "failed", startedAt: { gte: since } },
        }),
        prisma.agentExecution.count({
          where: { agentId: target.id, status: "completed", startedAt: { gte: since } },
        }),
      ]);
      const healthy = recentFailures < 3 && recentSuccess > 0;
      if (healthy) {
        return {
          success: false,
          error:
            `Pause rejected: agent "${agentName}" looks healthy ` +
            `(${recentSuccess} successful runs, ${recentFailures} failures in the last hour). ` +
            `Only pause agents with >=3 recent failures or zero successful runs. ` +
            `If you believe this agent is genuinely broken, file a createRepairTask with evidence instead.`,
        };
      }
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
