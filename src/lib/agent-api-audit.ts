import type { AdminTokenPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface LogAgentApiMutationParams {
  admin: AdminTokenPayload;
  actionName: string;
  targetAgentName?: string;
  targetAgentId?: string;
  input?: unknown;
  output?: unknown;
  status?: string;
}

export async function logAgentApiMutation(params: LogAgentApiMutationParams): Promise<void> {
  const {
    admin,
    actionName,
    targetAgentName,
    targetAgentId,
    input,
    output,
    status = "success",
  } = params;

  try {
    let resolvedAgentId = targetAgentId;

    if (!resolvedAgentId && targetAgentName) {
      const agent = await prisma.agent.findUnique({ where: { name: targetAgentName } });
      resolvedAgentId = agent?.id;
    }

    if (!resolvedAgentId) return;

    await prisma.agentExecution.create({
      data: {
        agentId: resolvedAgentId,
        traceId: `api_${actionName}_${Date.now()}`,
        actionType: "api_mutation",
        actionName,
        input: JSON.stringify({
          actor: {
            id: admin.id,
            email: admin.email,
            role: admin.role,
          },
          payload: input ?? null,
        }),
        output: JSON.stringify(output ?? null),
        status,
      },
    });
  } catch (error) {
    console.error("[AgentApiAudit] Failed to log mutation", { actionName, error });
  }
}
