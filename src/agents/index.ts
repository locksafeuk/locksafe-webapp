/**
 * LockSafe AI Agent Operating System
 *
 * Main entry point for the agent system.
 * Inspired by Paperclip philosophy - agent-driven execution with full control.
 *
 * DISABLED: Set AGENTS_ENABLED=true in .env to enable agents.
 */

const AGENTS_ENABLED = process.env.AGENTS_ENABLED === "true";

// Direct imports instead of barrel exports to avoid webpack issues
import { sendAdminAlert } from "@/lib/telegram";
import { initializeTools } from "@/agents/tools";
import { initializeCEOAgent, runCEOHeartbeat, getCEOStatus, generateWeeklySummary, CEO_AGENT_CONFIG } from "@/agents/ceo/agent";
import { initializeCOOAgent, runCOOHeartbeat, getCOOStatus, COO_AGENT_CONFIG } from "@/agents/coo/agent";
import { initializeCMOAgent, runCMOHeartbeat, getCMOStatus, CMO_AGENT_CONFIG } from "@/agents/cmo/agent";
import { initializeCTOAgent, runCTOHeartbeat, getCTOStatus, CTO_AGENT_CONFIG } from "@/agents/cto/agent";
import { initializeCopywriterAgent, runCopywriterHeartbeat, getCopywriterStatus, COPYWRITER_AGENT_CONFIG } from "@/agents/cmo/subagents/copywriter/agent";
import { initializeAdsSpecialistAgent, runAdsSpecialistHeartbeat, getAdsSpecialistStatus, ADS_SPECIALIST_AGENT_CONFIG } from "@/agents/cmo/subagents/ads-specialist/agent";
import { initializeSocialMediaAgent, runSocialMediaHeartbeat, getSocialMediaStatus, SOCIAL_MEDIA_AGENT_CONFIG } from "@/agents/cmo/subagents/social-media/agent";

// Core orchestrator
import {
  runAllHeartbeats, getAgentStatusSummary, executeHeartbeat, delegateTask,
  initializeAgentState, getAgentsDueForHeartbeat,
  syncAgentStateWithDB, syncAllAgentsFromDB,
  setAgentDependencies, setAgentPriority,
  pauseAgent, resumeAgent, coordinateTask, completeTask,
  getAgentStates,
} from "@/agents/core/orchestrator";

// Heartbeat scheduling: quiet hours + minimum-interval throttling
import { isHeartbeatSuppressed } from "@/agents/heartbeat-schedules";

// Skill parser
import { parseSkillsFile, parseSkillsContent, generateSystemPrompt, validateSkills } from "@/agents/core/skill-parser";

// Enhanced memory system
import {
  storeMemory, getRelevantMemories, getMemoriesByCategory, updateMemoryImportance,
  promoteToLongTerm, storeDecision, storePattern, storeTaskContext,
  cleanupExpiredMemories, getMemoryStats, searchMemories,
  shareInsightAcrossAgents, queryAccessibleMemories, getCrossAgentInsights,
  getGlobalMemoryStats,
} from "@/agents/core/memory";

// Budget
import { getBudgetStatus, checkBudget, recordCost, estimateCost, resetBudget, resetAllBudgets, getAllBudgetStatus, updateBudget, getTotalCost } from "@/agents/core/budget";

// Inter-Agent Message Bus
import {
  sendMessage, getMessages, getSentMessages, acknowledgeMessage,
  subscribeToMessages, shareInsight, requestDecision as requestDecisionMsg,
  respondToDecision, sendStatusUpdate, broadcastMessage,
  getAllMessages, getConversationThread, getMessageBusStats,
  cleanupExpiredMessages,
} from "@/agents/core/message-bus";

// Business Intelligence
import {
  generateBIReport, getBusinessHealthSnapshot,
} from "@/agents/core/business-intelligence";

// Re-export types separately (types don't cause bundling issues)
export type {
  AgentStatus,
  GovernanceLevel,
  TaskStatus,
  ExecutionStatus,
  MemoryType,
  AgentConfig,
  ParsedSkills,
  ToolCategory,
  ToolParameter,
  ToolResult,
  AgentContext,
  AgentTool,
  HeartbeatResult,
  TaskDelegation,
  AgentDecision,
  ExecutionLog,
  MemoryCategory,
  MemoryEntry,
  RelevantMemory,
  OrchestratorConfig,
  AgentRuntimeState,
  ApprovalRequest,
  ApprovalResolution,
  AgentTelegramCommand,
  AgentStatusMessage,
  AgentListResponse,
  AgentDetailResponse,
  TaskCreateRequest,
} from "@/agents/core/types";

// Re-export message bus types
export type {
  MessageType,
  MessagePriority,
  MessageStatus,
  AgentMessage,
  MessageFilter,
  MessageBusStats,
} from "@/agents/core/message-bus";

// Re-export memory types
export type {
  MemoryScope,
  StrategicCategory,
  SharedMemoryEntry,
  MemoryQuery,
  CrossAgentInsight,
} from "@/agents/core/memory";

// Re-export BI types
export type {
  BusinessHealthScore,
  CrossFunctionalKPI,
  AgentPerformanceReport,
  BusinessIntelligenceReport,
} from "@/agents/core/business-intelligence";

// Re-export functions
export {
  // Agent initialization
  initializeCEOAgent,
  initializeCOOAgent,
  initializeCMOAgent,
  initializeCTOAgent,
  initializeCopywriterAgent,
  initializeAdsSpecialistAgent,
  initializeSocialMediaAgent,
  // Agent heartbeats
  runCEOHeartbeat,
  runCOOHeartbeat,
  runCMOHeartbeat,
  runCTOHeartbeat,
  runCopywriterHeartbeat,
  runAdsSpecialistHeartbeat,
  runSocialMediaHeartbeat,
  // Agent status
  getCEOStatus,
  getCOOStatus,
  getCMOStatus,
  getCTOStatus,
  getCopywriterStatus,
  getAdsSpecialistStatus,
  getSocialMediaStatus,
  // Agent configs
  CEO_AGENT_CONFIG,
  COO_AGENT_CONFIG,
  CMO_AGENT_CONFIG,
  CTO_AGENT_CONFIG,
  COPYWRITER_AGENT_CONFIG,
  ADS_SPECIALIST_AGENT_CONFIG,
  SOCIAL_MEDIA_AGENT_CONFIG,
  // Orchestrator (enhanced)
  runAllHeartbeats,
  getAgentStatusSummary,
  executeHeartbeat,
  delegateTask,
  initializeAgentState,
  getAgentsDueForHeartbeat,
  syncAgentStateWithDB,
  syncAllAgentsFromDB,
  setAgentDependencies,
  setAgentPriority,
  pauseAgent,
  resumeAgent,
  coordinateTask,
  completeTask,
  getAgentStates,
  // Skill parser
  parseSkillsFile,
  parseSkillsContent,
  generateSystemPrompt,
  validateSkills,
  // Memory (enhanced)
  storeMemory,
  getRelevantMemories,
  getMemoriesByCategory,
  updateMemoryImportance,
  promoteToLongTerm,
  storeDecision,
  storePattern,
  storeTaskContext,
  cleanupExpiredMemories,
  getMemoryStats,
  searchMemories,
  shareInsightAcrossAgents,
  queryAccessibleMemories,
  getCrossAgentInsights,
  getGlobalMemoryStats,
  // Budget
  getBudgetStatus,
  checkBudget,
  recordCost,
  estimateCost,
  resetBudget,
  resetAllBudgets,
  getAllBudgetStatus,
  updateBudget,
  getTotalCost,
  // Message Bus
  sendMessage,
  getMessages,
  getSentMessages,
  acknowledgeMessage,
  subscribeToMessages,
  shareInsight,
  requestDecisionMsg,
  respondToDecision,
  sendStatusUpdate,
  broadcastMessage,
  getAllMessages,
  getConversationThread,
  getMessageBusStats,
  cleanupExpiredMessages,
  // Business Intelligence
  generateBIReport,
  getBusinessHealthSnapshot,
  // Tools
  initializeTools,
};

/**
 * Initialize the entire agent system
 * Call this at application startup
 */
export async function initializeAgentSystem(): Promise<void> {
  console.log("========================================");
  console.log("  LockSafe AI Agent Operating System");
  console.log("  v2.0 - Enhanced Orchestration");
  console.log("========================================");

  // Check if agents are enabled
  if (!AGENTS_ENABLED) {
    console.log("\n[Init] AGENTS ARE DISABLED");
    console.log("[Init] Set AGENTS_ENABLED=true in .env to enable agents.");
    console.log("\n========================================\n");
    return;
  }

  // Initialize tools registry
  console.log("\n[Init] Registering agent tools...");
  initializeTools();

  // Sync agents from database
  console.log("\n[Init] Syncing agents from database...");
  await syncAllAgentsFromDB();

  // Initialize agents (CEO first, then executives, then subagents)
  console.log("\n[Init] Initializing agents...");
  await initializeCEOAgent();
  await initializeCTOAgent();
  await initializeCOOAgent();
  await initializeCMOAgent();

  // Initialize subagents (after parent agents)
  console.log("\n[Init] Initializing subagents...");
  await initializeCopywriterAgent();
  await initializeAdsSpecialistAgent();
  await initializeSocialMediaAgent();

  // Set agent dependencies and priorities
  console.log("\n[Init] Configuring agent dependencies...");
  setAgentPriority('ceo', 10);
  setAgentPriority('cto', 8);
  setAgentPriority('coo', 7);
  setAgentPriority('cmo', 6);
  setAgentPriority('copywriter', 3);
  setAgentPriority('ads-specialist', 3);
  setAgentPriority('social-media', 4);

  setAgentDependencies('cmo', ['ceo']);
  setAgentDependencies('coo', ['ceo']);
  setAgentDependencies('copywriter', ['cmo']);
  setAgentDependencies('ads-specialist', ['cmo']);
  setAgentDependencies('social-media', ['cmo']);

  // Subscribe CEO to all executive status updates
  subscribeToMessages('ceo', (msg) => {
    if (msg.type === 'STATUS_UPDATE' || msg.type === 'INSIGHT_SHARE') {
      console.log(`[CEO Inbox] ${msg.fromAgentId}: ${msg.subject}`);
    }
  });

  // Get status
  const status = await getAgentStatusSummary();
  console.log(`\n[Init] Agent system ready!`);
  console.log(`  Total agents: ${status.total}`);
  console.log(`  Active: ${status.active}`);
  console.log(`  Paused: ${status.paused}`);

  for (const agent of status.agents) {
    console.log(`  - ${agent.displayName}: ${agent.status} (${agent.pendingTasks} tasks)`);
  }

  console.log("\n========================================\n");
}

/**
 * Run all agent heartbeats (for cron job)
 */
export async function runAgentHeartbeats(): Promise<{
  success: boolean;
  agentsRun: number;
  totalActions: number;
  totalCost: number;
  errors: string[];
  results: Array<{
    agentName: string;
    success: boolean;
    actionsExecuted: number;
    costUsd: number;
    errors: string[];
  }>;
}> {
  // Check if agents are enabled
  if (!AGENTS_ENABLED) {
    console.log("[Heartbeats] Agents are DISABLED. Set AGENTS_ENABLED=true to enable.");
    return {
      success: false,
      agentsRun: 0,
      totalActions: 0,
      totalCost: 0,
      errors: ["Agents are disabled. Set AGENTS_ENABLED=true in .env to enable."],
      results: [],
    };
  }

  // Cleanup expired messages
  await cleanupExpiredMessages();

  // ─── Self-healing: auto-resume agents that have been paused too long ────
  // Indefinite pauses are never desired — the system must run 24/7. Any agent
  // that's been `paused` for more than AGENT_AUTO_RESUME_MINUTES (default 60)
  // is automatically promoted back to `active`. Short, deliberate pauses
  // (e.g. an admin pausing for 10 min to debug) still work.
  try {
    const { default: prismaForHeal } = await import("@/lib/db");
    const autoResumeMinutes = Math.max(
      5,
      Number(process.env.AGENT_AUTO_RESUME_MINUTES ?? "60"),
    );
    const cutoff = new Date(Date.now() - autoResumeMinutes * 60_000);
    const resumed = await prismaForHeal.agent.updateMany({
      where: { status: "paused", updatedAt: { lt: cutoff } },
      data: { status: "active", nextHeartbeat: null },
    });
    if (resumed.count > 0) {
      console.log(
        `[Heartbeats] Self-heal: auto-resumed ${resumed.count} agent(s) ` +
          `paused for > ${autoResumeMinutes}m`,
      );
      sendAdminAlert({
        title: "⚠️ Agents Auto-Resumed",
        message: `${resumed.count} agent(s) were paused for >${autoResumeMinutes}m and have been automatically set back to active.`,
        severity: "warning",
      }).catch(() => {});
    }
  } catch (e) {
    console.warn("[Heartbeats] Self-heal step failed:", e);
  }

  // Operational policy — guardian mode and concurrency knobs.
  const { getOperationalPolicy } = await import("@/agents/core/operational-policy");
  const policy = await getOperationalPolicy();
  const guardianOnly = policy.guardianModeEnabled;

  // Load active agent set from DB — paused agents are skipped entirely so they
  // don't throw "Agent X is paused" inside their heartbeat (which was spamming
  // Telegram on every cycle).
  const { default: prismaForActiveSet } = await import("@/lib/db");
  let activeAgentNames = new Set<string>([
    "ceo", "cto", "cmo", "coo", "copywriter", "ads-specialist", "social-media",
  ]);
  const lastHeartbeatByName = new Map<string, Date | null>();
  try {
    const rows = await prismaForActiveSet.agent.findMany({
      where: { status: "active" },
      select: { name: true, lastHeartbeat: true },
    });
    if (rows.length > 0) {
      activeAgentNames = new Set(rows.map(r => r.name.toLowerCase()));
      for (const r of rows) lastHeartbeatByName.set(r.name.toLowerCase(), r.lastHeartbeat);
    }
  } catch (e) {
    console.warn("[Heartbeats] Failed to load active agent set, defaulting to all:", e);
  }
  const isActive = (name: string) => activeAgentNames.has(name.toLowerCase());

  // ─── Quiet-hours + minimum-interval gate ──────────────────────────────────
  // Suppresses overnight (23:00–06:00 UK) heartbeats for all agents except the
  // COO dispatch guardian, and throttles chatty guardians (CTO ~6h, CMO ~12h)
  // against their persisted lastHeartbeat. Job-related notifications (COO) are
  // never gated. See heartbeat-schedules.ts for the policy.
  const heartbeatNow = new Date();
  const shouldRun = (name: string): boolean => {
    const { suppressed, reason } = isHeartbeatSuppressed(
      name,
      lastHeartbeatByName.get(name.toLowerCase()) ?? null,
      heartbeatNow,
    );
    if (suppressed) {
      console.log(`[Heartbeats] Skipping ${name} this cycle (${reason}).`);
    }
    return !suppressed;
  };

  // Wrap each agent heartbeat fn to capture success/errors uniformly
  async function runWithResult(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      return { success: true, agentName: name, actionsExecuted: 1, costUsd: 0, errors: [], nextHeartbeat: new Date(Date.now() + 3_600_000) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Heartbeat] ${name} failed:`, msg);
      return { success: false, agentName: name, actionsExecuted: 0, costUsd: 0, errors: [msg], nextHeartbeat: new Date(Date.now() + 3_600_000) };
    }
  }

  // Bounded-concurrency runner — caps simultaneous heartbeats to avoid
  // overloading Ollama/Hermes and to keep token noise predictable.
  const CONCURRENCY_CAP = Math.max(
    1,
    Number(process.env.AGENT_HEARTBEAT_CONCURRENCY ?? "3"),
  );
  async function runLimited(
    jobs: Array<{ name: string; fn: () => Promise<void> }>,
    limit: number,
  ) {
    const out: Awaited<ReturnType<typeof runWithResult>>[] = new Array(jobs.length);
    let cursor = 0;
    async function worker() {
      while (cursor < jobs.length) {
        const idx = cursor++;
        out[idx] = await runWithResult(jobs[idx].name, jobs[idx].fn);
      }
    }
    const workers = Array.from({ length: Math.min(limit, jobs.length) }, worker);
    await Promise.all(workers);
    return out;
  }

  // Guardians always run (COO + CTO) — they protect dispatch/SLA/system health
  // and must never be throttled by guardian mode, sensitivity controls, or paused status.
  // COO is the real-time dispatch engine: a 10-min stuck job window means it MUST run
  // every cycle regardless of what the DB says. Auto-resume guardian status on every tick.
  try {
    const { default: prismaGuardian } = await import("@/lib/db");
    // COO + CTO = operational guardians (dispatch + infra)
    // CMO = marketing guardian — 429s and API hiccups must not silence it
    await prismaGuardian.agent.updateMany({
      where: { name: { in: ["coo", "cto", "cmo"] }, status: "paused" },
      data: { status: "active", nextHeartbeat: null },
    });
  } catch (e) {
    console.warn("[Heartbeats] Guardian auto-resume step failed:", e);
  }
  // COO (exempt) always runs; CTO is gated by quiet hours + 6h min-interval.
  const guardianJobs = [
    { name: "cto", fn: runCTOHeartbeat },
    { name: "coo", fn: runCOOHeartbeat },
  ].filter(j => shouldRun(j.name));

  if (guardianOnly) {
    console.log("[Heartbeats] Guardian Mode ON — running guardians only (CTO, COO)");
    const guardianResults = await runLimited(guardianJobs, CONCURRENCY_CAP);
    return {
      success: guardianResults.every(r => r.success),
      agentsRun: guardianResults.length,
      totalActions: guardianResults.reduce((sum, r) => sum + r.actionsExecuted, 0),
      totalCost: guardianResults.reduce((sum, r) => sum + r.costUsd, 0),
      errors: guardianResults.flatMap(r => r.errors),
      results: guardianResults.map(r => ({
        agentName: r.agentName,
        success: r.success,
        actionsExecuted: r.actionsExecuted,
        costUsd: r.costUsd,
        errors: r.errors,
      })),
    };
  }

  // Non-workflow heartbeat multiplier — when >1, skip CEO/CMO/subagents on
  // (cycle % multiplier !== 0). Guardians are always exempt.
  const multiplier = Math.max(1, policy.nonWorkflowHeartbeatMultiplier);
  const cycleIndex = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-min cron cadence
  const skipNonWorkflow = multiplier > 1 && cycleIndex % multiplier !== 0;

  // Independent executives — guardians + CEO when non-workflow active.
  const independentJobs = skipNonWorkflow
    ? guardianJobs
    : [
        ...guardianJobs,
        ...(isActive("ceo") && shouldRun("ceo") ? [{ name: "ceo", fn: runCEOHeartbeat }] : []),
      ];

  const independentResults = await runLimited(independentJobs, CONCURRENCY_CAP);

  if (skipNonWorkflow) {
    console.log(
      `[Heartbeats] Non-workflow tier skipped this cycle (multiplier=${multiplier}, cycle=${cycleIndex})`,
    );
    return {
      success: independentResults.every(r => r.success),
      agentsRun: independentResults.length,
      totalActions: independentResults.reduce((sum, r) => sum + r.actionsExecuted, 0),
      totalCost: independentResults.reduce((sum, r) => sum + r.costUsd, 0),
      errors: independentResults.flatMap(r => r.errors),
      results: independentResults.map(r => ({
        agentName: r.agentName,
        success: r.success,
        actionsExecuted: r.actionsExecuted,
        costUsd: r.costUsd,
        errors: r.errors,
      })),
    };
  }

  // CMO depends on CEO results — run after independent agents (skip if paused)
  const cmoResult = isActive("cmo") && shouldRun("cmo")
    ? await runWithResult("cmo", runCMOHeartbeat)
    : null;

  // CMO subagents run after CMO, bounded by concurrency cap (skip paused)
  const subagentJobs = [
    { name: "copywriter", fn: runCopywriterHeartbeat },
    { name: "ads-specialist", fn: runAdsSpecialistHeartbeat },
    { name: "social-media", fn: runSocialMediaHeartbeat },
  ].filter(j => isActive(j.name) && shouldRun(j.name));
  const subagentResults = await runLimited(subagentJobs, CONCURRENCY_CAP);

  const results = [
    ...independentResults,
    ...(cmoResult ? [cmoResult] : []),
    ...subagentResults,
  ];

  return {
    success: results.every(r => r.success),
    agentsRun: results.length,
    totalActions: results.reduce((sum, r) => sum + r.actionsExecuted, 0),
    totalCost: results.reduce((sum, r) => sum + r.costUsd, 0),
    errors: results.flatMap(r => r.errors),
    results: results.map(r => ({
      agentName: r.agentName,
      success: r.success,
      actionsExecuted: r.actionsExecuted,
      costUsd: r.costUsd,
      errors: r.errors,
    })),
  };
}

/**
 * Get system health status (enhanced with BI)
 */
export async function getAgentSystemHealth(): Promise<{
  healthy: boolean;
  agents: Array<{
    name: string;
    status: string;
    lastHeartbeat: Date | null;
    healthy: boolean;
  }>;
  totalBudgetUsed: number;
  totalBudgetRemaining: number;
  businessHealth: Awaited<ReturnType<typeof getBusinessHealthSnapshot>>;
}> {
  const summary = await getAgentStatusSummary();
  const businessHealth = await getBusinessHealthSnapshot();

  const totalBudgetUsed = summary.agents.reduce((sum, a) => sum + a.budgetUsed, 0);
  const totalBudgetTotal = summary.agents.reduce((sum, a) => sum + a.budgetTotal, 0);

  const now = Date.now();
  const maxHeartbeatAge = 60 * 60 * 1000; // 1 hour

  const agentHealth = summary.agents.map(a => {
    const heartbeatAge = a.lastHeartbeat
      ? now - a.lastHeartbeat.getTime()
      : Infinity;

    return {
      name: a.name,
      status: a.status,
      lastHeartbeat: a.lastHeartbeat,
      healthy: a.status === "active" && heartbeatAge < maxHeartbeatAge,
    };
  });

  return {
    healthy: agentHealth.every(a => a.healthy || a.status === "paused"),
    agents: agentHealth,
    totalBudgetUsed,
    totalBudgetRemaining: totalBudgetTotal - totalBudgetUsed,
    businessHealth,
  };
}
