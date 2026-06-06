/**
 * Approval resolution.
 *
 *   reject  -> mark approval rejected + execution blocked. Nothing runs.
 *   approve -> run the registered risky executor and record the outcome on both
 *              the AgentApproval and the AgentExecution. If no executor is wired
 *              for the action, the approval is marked approved with a clear
 *              "manual fulfilment" note (never a silent no-op).
 */

import prisma from "@/lib/db";
import { buildRiskyExecutorRegistry } from "./executors";
import type { ExecutorRegistry } from "../ports";

export interface ResolveResult {
  ok: boolean;
  status: "approved" | "rejected" | "approved-manual" | "approved-execute-failed" | "error";
  message: string;
}

export async function resolveApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  adminId: string,
  deps: { executors?: ExecutorRegistry } = {},
): Promise<ResolveResult> {
  const approval = await prisma.agentApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { ok: false, status: "error", message: "Approval not found" };
  if (approval.status !== "pending") {
    return { ok: false, status: "error", message: `Approval already ${approval.status}` };
  }

  const now = new Date();

  // ── REJECT ──
  if (decision === "rejected") {
    await prisma.agentApproval.update({
      where: { id: approvalId },
      data: { status: "rejected", resolvedBy: adminId, resolvedAt: now, resolution: "Rejected by admin" },
    });
    await prisma.agentExecution.update({
      where: { id: approval.executionId },
      data: { status: "blocked", completedAt: now },
    });
    return { ok: true, status: "rejected", message: "Action rejected" };
  }

  // ── APPROVE → execute ──

  // Tool-backed approvals (actionType "tool:<name>") re-run the original agent
  // tool, this time bypassing the approval gate. This is how every risky tool
  // gets fulfilled after you approve it.
  if (approval.actionType.startsWith("tool:")) {
    const toolName = approval.actionType.slice("tool:".length);
    let toolArgs: Record<string, unknown> = {};
    try {
      toolArgs = JSON.parse(approval.actionDetails || "{}");
    } catch {
      toolArgs = {};
    }

    let result: { ok: boolean; message: string };
    try {
      const toolsMod = await import("@/agents/tools");
      toolsMod.initializeTools(); // idempotent — ensure tools are registered in this process
      const agentRow = await prisma.agent.findUnique({ where: { id: approval.agentId } });
      const ctx = {
        agentId: approval.agentId,
        agentName: agentRow?.name ?? "system",
        permissions: agentRow?.permissions ?? [],
        budgetRemaining: Math.max(0, (agentRow?.monthlyBudgetUsd ?? 0) - (agentRow?.budgetUsedUsd ?? 0)) || 1,
        executionId: approval.executionId,
      };
      const toolResult = await toolsMod.executeTool(toolName, toolArgs, ctx, { bypassApproval: true });
      result = { ok: toolResult.success, message: toolResult.success ? `Executed ${toolName}` : (toolResult.error ?? `${toolName} failed`) };
    } catch (err) {
      result = { ok: false, message: err instanceof Error ? err.message : "tool execution error" };
    }

    await prisma.agentApproval.update({
      where: { id: approvalId },
      data: {
        status: "approved",
        resolvedBy: adminId,
        resolvedAt: now,
        resolution: result.ok ? `Approved + executed tool ${toolName}` : `Approved but tool failed: ${result.message}`,
      },
    });
    await prisma.agentExecution.update({
      where: { id: approval.executionId },
      data: { status: result.ok ? "success" : "failed", output: JSON.stringify(result), completedAt: now },
    });
    return { ok: result.ok, status: result.ok ? "approved" : "approved-execute-failed", message: result.message };
  }

  const executors = deps.executors ?? buildRiskyExecutorRegistry();
  const exec = executors.get(approval.actionType);

  if (!exec) {
    await prisma.agentApproval.update({
      where: { id: approvalId },
      data: {
        status: "approved",
        resolvedBy: adminId,
        resolvedAt: now,
        resolution: "Approved — manual fulfilment required (no executor wired)",
      },
    });
    return { ok: true, status: "approved-manual", message: "Approved (manual fulfilment required)" };
  }

  let args: unknown = {};
  try {
    args = JSON.parse(approval.actionDetails || "{}");
  } catch {
    args = {};
  }

  let result: { ok: boolean; message: string };
  try {
    result = await exec(args);
  } catch (err) {
    result = { ok: false, message: err instanceof Error ? err.message : "execution error" };
  }

  await prisma.agentApproval.update({
    where: { id: approvalId },
    data: {
      status: "approved",
      resolvedBy: adminId,
      resolvedAt: now,
      resolution: result.ok ? `Approved + executed: ${result.message}` : `Approved but execution failed: ${result.message}`,
    },
  });
  await prisma.agentExecution.update({
    where: { id: approval.executionId },
    data: { status: result.ok ? "success" : "failed", output: JSON.stringify(result), completedAt: now },
  });

  return {
    ok: result.ok,
    status: result.ok ? "approved" : "approved-execute-failed",
    message: result.message,
  };
}
