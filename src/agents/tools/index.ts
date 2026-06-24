/**
 * Agent Tools Index
 *
 * Central export for all agent tools.
 * Import this file to register all tools with the registry.
 */

import { registerTools, getTool, getAllTools, getToolsByCategory, getToolsForAgent, canAgentUseTool, executeTool, generateFunctionDefinitions, validateFunctionDefinitions, getToolDocumentation, getRegistryStats, registerTool } from "@/agents/tools/registry";
import { dispatchTools } from "@/agents/tools/dispatch";
import { marketingTools } from "@/agents/tools/marketing";
import { communicationTools } from "@/agents/tools/communication";
import { analyticsTools } from "@/agents/tools/analytics";
import { crossRepoTools } from "@/agents/tools/cross-repo";

// Export individual tool sets
export { dispatchTools };
export { marketingTools };
export { communicationTools };
export { analyticsTools };
export { crossRepoTools };

// Export registry functions explicitly
export {
  registerTools,
  registerTool,
  getTool,
  getAllTools,
  getToolsByCategory,
  getToolsForAgent,
  canAgentUseTool,
  executeTool,
  generateFunctionDefinitions,
  validateFunctionDefinitions,
  getToolDocumentation,
  getRegistryStats,
};

// All tools combined
export const allTools = [
  ...dispatchTools,
  ...marketingTools,
  ...communicationTools,
  ...analyticsTools,
  ...crossRepoTools,
];

/**
 * Initialize all tools in the registry.
 *
 * Idempotent — safe to call from every entry point (cron, webhook, agent
 * heartbeat). The registerTool primitive is also idempotent, so re-runs do
 * nothing.
 */
export function initializeTools(): void {
  const existing = getRegistryStats().totalTools;
  if (existing >= allTools.length) {
    return; // already initialized — silent no-op
  }
  registerTools(allTools);
  console.log(`[Tools] Registered ${allTools.length} agent tools`);
}
