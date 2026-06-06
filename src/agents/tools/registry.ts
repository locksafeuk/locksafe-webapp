/**
 * Agent Tool Registry
 *
 * Central registry for all tools available to agents.
 * Tools are internal platform functions exposed via OpenAI function calling.
 */

import type { AgentTool, AgentContext, ToolResult, ToolCategory } from "@/agents/core/types";

// Tool storage
const toolRegistry = new Map<string, AgentTool>();

/**
 * Register a tool in the registry
 */
export function registerTool(tool: AgentTool): void {
  if (toolRegistry.has(tool.name)) {
    console.warn(`[Registry] Tool ${tool.name} already registered, overwriting`);
  }
  toolRegistry.set(tool.name, tool);
  console.log(`[Registry] Registered tool: ${tool.name}`);
}

/**
 * Register multiple tools
 */
export function registerTools(tools: AgentTool[]): void {
  for (const tool of tools) {
    registerTool(tool);
  }
}

/**
 * Get a tool by name
 */
export function getTool(name: string): AgentTool | undefined {
  return toolRegistry.get(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): AgentTool[] {
  return Array.from(toolRegistry.values());
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): AgentTool[] {
  return getAllTools().filter(tool => tool.category === category);
}

/**
 * Get tools available to a specific agent
 */
export function getToolsForAgent(permissions: string[]): AgentTool[] {
  return getAllTools().filter(tool =>
    tool.permissions.some(p => permissions.includes(p) || permissions.includes("*"))
  );
}

/**
 * Check if an agent can use a specific tool
 */
export function canAgentUseTool(toolName: string, permissions: string[]): boolean {
  const tool = getTool(toolName);
  if (!tool) return false;

  return tool.permissions.some(p =>
    permissions.includes(p) || permissions.includes("*")
  );
}

/**
 * Execute a tool with permission and budget checks
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: AgentContext,
  opts?: { bypassApproval?: boolean }
): Promise<ToolResult> {
  const tool = getTool(toolName);

  if (!tool) {
    return {
      success: false,
      error: `Tool not found: ${toolName}`,
    };
  }

  // Check permissions
  if (!canAgentUseTool(toolName, context.permissions)) {
    return {
      success: false,
      error: `Agent ${context.agentName} does not have permission to use tool: ${toolName}`,
    };
  }

  // Check budget
  if (context.budgetRemaining <= 0) {
    return {
      success: false,
      error: `Agent ${context.agentName} has exhausted budget`,
    };
  }

  // Validate required parameters
  const missing: string[] = [];
  for (const param of tool.parameters) {
    if (param.required && !(param.name in params)) {
      missing.push(param.name);
    }
  }
  if (missing.length > 0) {
    const allRequired = tool.parameters.filter((p) => p.required).map((p) => p.name);
    const exampleObj: Record<string, unknown> = {};
    for (const p of tool.parameters.filter((x) => x.required)) {
      exampleObj[p.name] = p.type === "string" ? `<${p.name}>` : p.type === "number" ? 0 : p.type === "boolean" ? false : null;
    }
    return {
      success: false,
      error:
        `Missing required parameter(s): ${missing.join(", ")}. ` +
        `Tool "${toolName}" requires ALL of: ${allRequired.join(", ")}. ` +
        `Example call: ${JSON.stringify(exampleObj)}. ` +
        `Do NOT retry with the same empty/partial arguments — supply every required field.`,
    };
  }

  // Central governance gate: risky tools (requiresApproval) route to the
  // control-plane approval queue instead of executing, when
  // CONTROL_PLANE_APPROVAL_ENFORCE=true. The action runs later via the approval
  // resolver (which calls executeTool with bypassApproval). Default OFF.
  let approvalEnforce = false;
  if (tool.requiresApproval && !opts?.bypassApproval) {
    try {
      const { isApprovalEnforced } = await import("@/agents/control-plane/policy");
      approvalEnforce = await isApprovalEnforced();
    } catch {
      approvalEnforce = process.env.CONTROL_PLANE_APPROVAL_ENFORCE === "true";
    }
  }
  if (tool.requiresApproval && !opts?.bypassApproval && approvalEnforce) {
    try {
      const { PrismaApprovalGateway } = await import("@/agents/control-plane/adapters/prisma-approvals");
      const approvalId = await new PrismaApprovalGateway().enqueue({
        agent: context.agentName,
        actionType: `tool:${toolName}`,
        args: params,
        reason: `Tool "${toolName}" requires human approval before it can run`,
      });
      return { success: true, data: { queuedForApproval: true, approvalId, tool: toolName } };
    } catch (err) {
      // Fail SAFE: if a risky action cannot be queued, do NOT execute it.
      return {
        success: false,
        error: `Approval queue unavailable; risky tool "${toolName}" was not executed: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }
  }

  try {
    // Execute the tool
    const startTime = Date.now();
    const result = await tool.execute(params, context);
    const durationMs = Date.now() - startTime;

    console.log(`[Registry] Tool ${toolName} executed in ${durationMs}ms`);

    return result;
  } catch (error) {
    console.error(`[Registry] Tool ${toolName} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate OpenAI function definitions from registered tools
 */
export function generateFunctionDefinitions(permissions: string[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}> {
  const availableTools = getToolsForAgent(permissions);

  return availableTools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          tool.parameters.map(param => {
            const propertySchema: Record<string, unknown> = {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            };

            if (param.type === 'array') {
              propertySchema.items = { type: param.itemsType ?? 'string' };
            }

            return [param.name, propertySchema];
          })
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  }));
}

/**
 * Validate generated function definitions before sending them to model providers.
 */
export function validateFunctionDefinitions(definitions: ReturnType<typeof generateFunctionDefinitions>): string[] {
  const errors: string[] = [];

  for (const def of definitions) {
    const properties = def.function.parameters.properties;
    for (const [propertyName, schema] of Object.entries(properties)) {
      if (!schema || typeof schema !== 'object') {
        continue;
      }

      const typedSchema = schema as Record<string, unknown>;
      if (typedSchema.type === 'array') {
        const items = typedSchema.items;
        const itemsType =
          items && typeof items === 'object'
            ? (items as Record<string, unknown>).type
            : undefined;

        if (typeof itemsType !== 'string' || itemsType.length === 0) {
          errors.push(
            `Tool ${def.function.name} has invalid array schema for parameter \"${propertyName}\": missing items.type`
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Get tool documentation for agents
 */
export function getToolDocumentation(permissions: string[]): string {
  const availableTools = getToolsForAgent(permissions);

  const docs = availableTools.map(tool => {
    const params = tool.parameters
      .map(p => `  - ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
      .join("\n");

    return `## ${tool.name}
${tool.description}
Category: ${tool.category}
${tool.requiresApproval ? "⚠️ Requires human approval\n" : ""}
Parameters:
${params || "  None"}`;
  });

  return docs.join("\n\n");
}

/**
 * Get registry statistics
 */
export function getRegistryStats(): {
  totalTools: number;
  byCategory: Record<ToolCategory, number>;
  requiresApproval: number;
} {
  const tools = getAllTools();
  const byCategory: Record<string, number> = {};
  let requiresApproval = 0;

  for (const tool of tools) {
    byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    if (tool.requiresApproval) requiresApproval++;
  }

  return {
    totalTools: tools.length,
    byCategory: byCategory as Record<ToolCategory, number>,
    requiresApproval,
  };
}
