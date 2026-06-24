/**
 * Engineer Agent Implementation
 *
 * Principal-engineer TRIAGE agent. It runs the deterministic engineering-health
 * sensor (+ cross-repo platform status) each heartbeat, trends the signals over
 * time via memory, and escalates "a deep review is warranted". It deliberately
 * does NOT issue authoritative code/security reviews — that depth comes from the
 * scheduled Claude (Opus) review. Its model (local Ollama) can sharpen WHICH
 * signals matter over time, but cannot replace Claude-grade analysis, so it
 * never declares the codebase secure.
 */

import prisma from "@/lib/db";
import { executeHeartbeat } from "@/agents/core/orchestrator";
import { storePattern } from "@/agents/core/memory";
import type { AgentConfig } from "@/agents/core/types";
import { ENGINEER_HEARTBEAT_CRON } from "@/agents/heartbeat-schedules";

export const ENGINEER_AGENT_CONFIG: AgentConfig = {
  name: "engineer",
  displayName: "Engineer Agent",
  role: "Principal Engineer — code-health triage, tech-debt & security signal tracking, and review escalation (triage only; not an authoritative reviewer)",
  skillsPath: "engineer/SKILL.md",
  monthlyBudgetUsd: 20,
  heartbeatCronExpr: ENGINEER_HEARTBEAT_CRON,
  permissions: ["engineer"],
  governanceLevel: "supervised",
};

function getNextMonthStart(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function initializeEngineerAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({ where: { name: ENGINEER_AGENT_CONFIG.name } });

  if (existing) {
    await prisma.agent.update({
      where: { name: ENGINEER_AGENT_CONFIG.name },
      data: {
        displayName: ENGINEER_AGENT_CONFIG.displayName,
        role: ENGINEER_AGENT_CONFIG.role,
        skillsPath: ENGINEER_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: ENGINEER_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: ENGINEER_AGENT_CONFIG.heartbeatCronExpr,
        permissions: ENGINEER_AGENT_CONFIG.permissions,
        governanceLevel: ENGINEER_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  await prisma.agent.create({
    data: {
      name: ENGINEER_AGENT_CONFIG.name,
      displayName: ENGINEER_AGENT_CONFIG.displayName,
      role: ENGINEER_AGENT_CONFIG.role,
      skillsPath: ENGINEER_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: ENGINEER_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: ENGINEER_AGENT_CONFIG.heartbeatCronExpr,
      permissions: ENGINEER_AGENT_CONFIG.permissions,
      governanceLevel: ENGINEER_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[Engineer] Agent initialized successfully");

  const agent = await prisma.agent.findUnique({ where: { name: "engineer" } });
  if (agent) {
    await storePattern(
      agent.id,
      "I triage code-health signals and escalate; I never declare the code secure — the scheduled Claude review is the authority.",
      "Engineer agent operating principle",
      1.0,
    );
    await storePattern(
      agent.id,
      "Money/auth/webhook paths must have tests; rising `prisma as any` / `: any` counts mean DB-boundary type safety is eroding.",
      "Code-health benchmark",
      0.9,
    );
  }
}

/**
 * Run the Engineer heartbeat. Unlike the CTO wrapper it does NOT throw on
 * errors — a transient sensor/grep failure should not auto-pause a low-stakes
 * triage agent.
 */
export async function runEngineerHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { name: "engineer" } });
  if (!agent) {
    console.error("[Engineer] Agent not found, initializing...");
    await initializeEngineerAgent();
    return;
  }

  const result = await executeHeartbeat("engineer");

  if (result.errors.length > 0) {
    console.warn(`[Engineer] Heartbeat completed with non-fatal errors: ${result.errors.join("; ")}`);
  }
  console.log(
    `[Engineer] Heartbeat done — actions:${result.actionsExecuted} cost:$${result.costUsd.toFixed(4)} errors:${result.errors.length}`,
  );
}

export async function getEngineerStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  budgetUsed: number;
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "engineer" },
    select: { status: true, lastHeartbeat: true, budgetUsedUsd: true },
  });
  if (!agent) return null;
  return { status: agent.status, lastHeartbeat: agent.lastHeartbeat, budgetUsed: agent.budgetUsedUsd };
}
