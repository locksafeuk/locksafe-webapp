/**
 * Prisma-backed ApprovalGateway (production).
 *
 * Turns a risky proposal into a real, auditable approval:
 *   1. AgentExecution row (status "pending_approval")
 *   2. AgentApproval row (status "pending") referencing it
 *   3. a Telegram notification so a human knows something is waiting
 *
 * Returns the approval id. Resolution happens via approvals/resolve.ts.
 */

import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import type { ApprovalGateway } from "../ports";

export class PrismaApprovalGateway implements ApprovalGateway {
  async enqueue(input: { agent: string; actionType: string; args: unknown; reason: string }): Promise<string> {
    const agentRow = await prisma.agent.findUnique({ where: { name: input.agent } });
    if (!agentRow) {
      throw new Error(`Approval gateway: unknown agent "${input.agent}"`);
    }

    const traceId = globalThis.crypto?.randomUUID?.() ?? `appr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const argsJson = JSON.stringify(input.args ?? {});

    const execution = await prisma.agentExecution.create({
      data: {
        agentId: agentRow.id,
        traceId,
        actionType: input.actionType,
        actionName: input.actionType,
        input: argsJson,
        status: "pending_approval",
        requiresApproval: true,
      },
    });

    const approval = await prisma.agentApproval.create({
      data: {
        agentId: agentRow.id,
        executionId: execution.id,
        actionType: input.actionType,
        actionDetails: argsJson,
        reason: input.reason,
        status: "pending",
        notifiedVia: ["telegram"],
      },
    });

    // Best-effort notify — never let a notification failure block the queue.
    try {
      await sendAdminAlert({
        title: `🔐 Approval needed: ${input.actionType}`,
        message:
          `Agent ${input.agent} requests "${input.actionType}".\n` +
          `Reason: ${input.reason}\n` +
          `Review at /admin/agents/approvals`,
        severity: "warning",
        dedupeKey: `approval:${approval.id}`,
      });
    } catch (err) {
      console.warn("[control-plane] approval notify failed (queued anyway):", err);
    }

    return approval.id;
  }
}
