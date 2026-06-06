/**
 * Communication Tools for Agents
 *
 * Tools for sending notifications via various channels.
 * Includes rate limiting to prevent spam.
 */

import { sendSMS } from "@/lib/sms";
import { sendAdminAlert } from "@/lib/telegram";
import prisma from "@/lib/db";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import type { AgentTool, ToolResult, AgentContext } from "@/agents/core/types";
import {
  delegateTask,
  pauseAgent,
  resumeAgent,
  syncAllAgentsFromDB,
} from "@/agents/core/orchestrator";

function getAgentAlertCooldownMs(priority: string, isGuardian: boolean): number {
  // All critical alerts have a minimum cooldown so a persistent condition
  // (0 conversions, campaign still learning) doesn't repeat every heartbeat.
  //   Guardian (COO, CTO) critical  : 30 min  — operational issues need fast re-alert
  //   Non-guardian (CEO, CMO) critical: 60 min — strategic/marketing issues, once/hr is enough
  // Note: the heartbeat runner fires roughly hourly, so a critical cooldown
  // SHORTER than the heartbeat interval means a persistent condition re-pages on
  // every single run. Guardian critical is therefore held for 2h by default;
  // because the dedupe key is content-aware (see below), a genuinely DIFFERENT
  // critical still pages immediately — only identical repeats are collapsed.
  const defaults = {
    low: isGuardian ? 60 : 240,
    medium: isGuardian ? 60 : 180,
    high: isGuardian ? 60 : 180,
    critical: isGuardian ? 120 : 120,
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

// Short, stable fingerprint of an alert's *meaning* (numbers/ids/timestamps
// stripped) so identical recurring alerts collapse onto one dedupe key while a
// genuinely different incident gets its own key and pages immediately.
function alertContentFingerprint(message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\b/g, "#") // numbers
    .replace(/\b[a-f0-9]{6,}\b/gi, "{id}") // ids/hashes
    .replace(/[^a-z#{} ]/g, " ") // punctuation/emoji
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

async function getZeroImpression7PlusDayCampaigns(): Promise<string[]> {
  const handle = await getDefaultGoogleAdsClient();
  if (!handle) return [];

  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };

  const rows = await handle.client.getCampaignMetrics(range);
  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      googleCampaignId: { in: rows.map((row) => row.campaignId) },
    },
    select: {
      googleCampaignId: true,
      publishedAt: true,
    },
  });

  const draftByCampaignId = new Map(
    drafts.map((draft) => [draft.googleCampaignId ?? "", draft]),
  );

  return rows
    .filter((row) => row.status === "ENABLED" && row.impressions === 0)
    .filter((row) => row.campaignName.startsWith("LockSafe | "))
    .filter((row) => {
      const draft = draftByCampaignId.get(row.campaignId);
      if (!draft?.publishedAt) return false;
      const daysSincePublished = Math.max(
        0,
        Math.floor((Date.now() - draft.publishedAt.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return daysSincePublished >= 7;
    })
    .map((row) => row.campaignName);
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

    // Guard against false-positive CMO campaign outages. A critical alert that
    // claims "7+ days with 0 impressions" is only valid when live metrics and
    // publishedAt timestamps confirm it.
    if (context.agentName.toLowerCase() === "cmo" && priority === "critical") {
      const lower = message.toLowerCase();
      const claimsZeroImpressions = lower.includes("0 impressions");
      const claimsSevenPlusDays = lower.includes("7+") || lower.includes("7 days");
      if (claimsZeroImpressions && claimsSevenPlusDays) {
        try {
          const staleZeroImpressionCampaigns = await getZeroImpression7PlusDayCampaigns();
          if (staleZeroImpressionCampaigns.length === 0) {
            console.log(
              "[Telegram][guard] Suppressed false-positive CMO critical alert: no ENABLED LockSafe zone campaigns are 7+ days old with 0 impressions.",
            );
            return {
              success: true,
              data: {
                sent: false,
                suppressed: true,
                reason: "no-verified-7plus-zero-impression-campaigns",
              },
            };
          }
        } catch (e) {
          console.warn("[Telegram][guard] Campaign outage verification failed, allowing alert:", e);
        }
      }
    }

    // Guard against the recurring false-positive CTO "platform outage" P1.
    // The CTO heartbeat keeps raising "zero completed jobs today" as CRITICAL,
    // but zero completions only means an OUTAGE when there is unmet demand —
    // i.e. jobs sitting in the pipeline that aren't progressing. If there are no
    // open jobs AND nothing came in over the last 24h, this is simply NO DEMAND
    // (idle platform), not an agent/system failure, and must not page anyone.
    if (context.agentName.toLowerCase() === "cto" && priority === "critical") {
      const lower = message.toLowerCase();
      const looksLikeNoJobsAlert =
        (lower.includes("zero") || lower.includes("0/0") || lower.includes("no jobs") ||
          lower.includes("no completed") || lower.includes("no pending")) &&
        (lower.includes("job") || lower.includes("complet"));
      if (looksLikeNoJobsAlert) {
        try {
          // Non-terminal states = work that is in-flight and therefore "demand".
          const ACTIVE_JOB_STATES = [
            "PENDING", "SCHEDULED", "ACCEPTED", "EN_ROUTE", "ARRIVED",
            "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS",
            "PENDING_CUSTOMER_CONFIRMATION",
          ];
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [openJobs, recentJobs] = await Promise.all([
            prisma.job.count({ where: { status: { in: ACTIVE_JOB_STATES as never } } }),
            prisma.job.count({ where: { createdAt: { gte: since24h } } }),
          ]);
          if (openJobs === 0 && recentJobs === 0) {
            console.log(
              "[Telegram][guard] Suppressed false-positive CTO critical: zero completions but " +
              "no open or recent jobs — no demand, not an outage.",
            );
            return {
              success: true,
              data: {
                sent: false,
                suppressed: true,
                reason: "no-demand-zero-jobs",
                openJobs,
                recentJobs,
              },
            };
          }
        } catch (e) {
          console.warn("[Telegram][guard] CTO no-demand verification failed, allowing alert:", e);
        }
      }
    }

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
    // non-guardian lane so CEO and CMO don't both page within minutes. For
    // guardian/critical alerts, key on the agent + a fingerprint of the message
    // so the SAME recurring condition is held for the cooldown, but a genuinely
    // different incident still pages immediately.
    const dedupeKey = !isGuardian && priority !== "critical"
      ? `agent-alert:non-guardian:${priority.toLowerCase()}`
      : `agent-alert:${context.agentName.toLowerCase()}:${alertContentFingerprint(message)}`;
    const cooldownMs = getAgentAlertCooldownMs(priority, isGuardian);

    // Quiet hours: hold advisory agent chatter overnight. The COO is the 24/7
    // dispatch guardian — a stuck/unassigned job at 3am is a real emergency for a
    // locksmith platform — so only COO alerts page during quiet hours.
    const bypassQuietHours = context.agentName.toLowerCase() === "coo";

    const title = `${priorityEmoji[priority as keyof typeof priorityEmoji]} Agent Alert: ${context.agentName.toUpperCase()} (${priority.toUpperCase()})`;

    try {
      const sent = await sendAdminAlert({
        title,
        message,
        severity,
        dedupeKey,
        cooldownMsOverride: cooldownMs,
        bypassPolicyGate: true,
        bypassQuietHours,
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
