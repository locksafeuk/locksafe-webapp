/**
 * Agent Tools Index
 *
 * Central export for all agent tools.
 * Import this file to register all tools with the registry.
 */

import { registerTools, getTool, getAllTools, getToolsByCategory, getToolsForAgent, canAgentUseTool, executeTool, generateFunctionDefinitions, getToolDocumentation, getRegistryStats, registerTool } from "@/agents/tools/registry";
import { dispatchTools } from "@/agents/tools/dispatch";
import { marketingTools } from "@/agents/tools/marketing";
import { communicationTools } from "@/agents/tools/communication";
import { analyticsTools } from "@/agents/tools/analytics";

// Export individual tool sets
export { dispatchTools };
export { marketingTools };
export { communicationTools };
export { analyticsTools };

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
  getToolDocumentation,
  getRegistryStats,
};

// All tools combined
export const allTools = [
  ...dispatchTools,
  ...marketingTools,
  ...communicationTools,
  ...analyticsTools,
];

/**
 * Initialize all tools in the registry
 * Call this once at application startup
 */
export function initializeTools(): void {
  console.log("[Tools] Initializing agent tool registry...");
  registerTools(allTools);
  console.log(`[Tools] Registered ${allTools.length} tools`);
}
