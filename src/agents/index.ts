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
import { initializeTools } from "@/agents/tools";
import { initializeCEOAgent, runCEOHeartbeat, getCEOStatus, generateWeeklySummary, CEO_AGENT_CONFIG } from "@/agents/ceo/agent";
import { initializeCOOAgent, runCOOHeartbeat, getCOOStatus, COO_AGENT_CONFIG } from "@/agents/coo/agent";
import { initializeCMOAgent, runCMOHeartbeat, getCMOStatus, CMO_AGENT_CONFIG } from "@/agents/cmo/agent";
import { initializeCTOAgent, runCTOHeartbeat, getCTOStatus, CTO_AGENT_CONFIG } from "@/agents/cto/agent";
import { initializeCopywriterAgent, runCopywriterHeartbeat, getCopywriterStatus, COPYWRITER_AGENT_CONFIG } from "@/agents/cmo/subagents/copywriter/agent";
import { initializeAdsSpecialistAgent, runAdsSpecialistHeartbeat, getAdsSpecialistStatus, ADS_SPECIALIST_AGENT_CONFIG } from "@/agents/cmo/subagents/ads-specialist/agent";
import { runAllHeartbeats, getAgentStatusSummary, executeHeartbeat, delegateTask, initializeAgentState, getAgentsDueForHeartbeat } from "@/agents/core/orchestrator";
import { parseSkillsFile, parseSkillsContent, generateSystemPrompt, validateSkills } from "@/agents/core/skill-parser";
import { storeMemory, getRelevantMemories, getMemoriesByCategory, updateMemoryImportance, promoteToLongTerm, storeDecision, storePattern, storeTaskContext, cleanupExpiredMemories, getMemoryStats, searchMemories } from "@/agents/core/memory";
import { getBudgetStatus, checkBudget, recordCost, estimateCost, resetBudget, resetAllBudgets, getAllBudgetStatus, updateBudget, getTotalCost } from "@/agents/core/budget";

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

// Re-export functions
export {
  // Agent initialization
  initializeCEOAgent,
  initializeCOOAgent,
  initializeCMOAgent,
  initializeCTOAgent,
  initializeCopywriterAgent,
  initializeAdsSpecialistAgent,
  // Agent heartbeats
  runCEOHeartbeat,
  runCOOHeartbeat,
  runCMOHeartbeat,
  runCTOHeartbeat,
  runCopywriterHeartbeat,
  runAdsSpecialistHeartbeat,
  // Agent status
  getCEOStatus,
  getCOOStatus,
  getCMOStatus,
  getCTOStatus,
  getCopywriterStatus,
  getAdsSpecialistStatus,
  // Agent configs
  CEO_AGENT_CONFIG,
  COO_AGENT_CONFIG,
  CMO_AGENT_CONFIG,
  CTO_AGENT_CONFIG,
  COPYWRITER_AGENT_CONFIG,
  ADS_SPECIALIST_AGENT_CONFIG,
  // Orchestrator
  runAllHeartbeats,
  getAgentStatusSummary,
  executeHeartbeat,
  delegateTask,
  initializeAgentState,
  getAgentsDueForHeartbeat,
  // Skill parser
  parseSkillsFile,
  parseSkillsContent,
  generateSystemPrompt,
  validateSkills,
  // Memory
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

  const results = await runAllHeartbeats();

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
 * Get system health status
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
}> {
  const summary = await getAgentStatusSummary();

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
  };
}
