// Agent Budget System - DB-persisted per-agent monthly budgets

import { prisma } from '@/lib/prisma';
import { sendAdminAlert } from '@/lib/telegram';
import type { BudgetStatus } from './types';

export async function getBudgetStatus(agentId: string): Promise<{
  agentName: string;
  budgetUsed: number;
  monthlyBudget: number;
  percentageUsed: number;
  isPaused: boolean;
  isWarning: boolean;
  resetsAt: Date;
}> {
  const agent = await prisma.agent.findUnique({ where: { name: agentId } });
  const budgetUsed = agent?.budgetUsedUsd ?? 0;
  const monthlyBudget = agent?.monthlyBudgetUsd ?? 50;
  const percentageUsed = monthlyBudget > 0 ? (budgetUsed / monthlyBudget) * 100 : 0;
  const now = new Date();
  const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    agentName: agent?.displayName ?? agentId,
    budgetUsed,
    monthlyBudget,
    percentageUsed,
    isPaused: percentageUsed >= 100,
    isWarning: percentageUsed >= 80,
    resetsAt,
  };
}

export async function checkBudget(agentId: string, estimatedCost: number): Promise<boolean> {
  const agent = await prisma.agent.findUnique({ where: { name: agentId } });
  if (!agent) return true; // allow if agent not yet seeded
  return agent.budgetUsedUsd + estimatedCost <= agent.monthlyBudgetUsd;
}

export async function recordCost(
  agentId: string,
  cost: number,
  description: string
): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { name: agentId } });
  if (!agent) return;

  const newUsed = agent.budgetUsedUsd + cost;
  await prisma.agent.update({
    where: { name: agentId },
    data: { budgetUsedUsd: { increment: cost } },
  });

  // Fire Telegram alert when crossing 80% threshold
  const prevPct = agent.monthlyBudgetUsd > 0 ? (agent.budgetUsedUsd / agent.monthlyBudgetUsd) * 100 : 0;
  const newPct = agent.monthlyBudgetUsd > 0 ? (newUsed / agent.monthlyBudgetUsd) * 100 : 0;
  if (prevPct < 80 && newPct >= 80) {
    sendAdminAlert({
      title: `⚠️ Agent Budget Warning: ${agent.displayName}`,
      message: `${agent.displayName} has used $${newUsed.toFixed(2)} of $${agent.monthlyBudgetUsd.toFixed(2)} monthly budget (${newPct.toFixed(0)}%).\n\nLast charge: ${description} ($${cost.toFixed(4)})`,
      severity: 'warning',
    }).catch(() => {});
  }
  if (prevPct < 100 && newPct >= 100) {
    sendAdminAlert({
      title: `🚨 Agent Budget Exhausted: ${agent.displayName}`,
      message: `${agent.displayName} has exceeded its $${agent.monthlyBudgetUsd.toFixed(2)} monthly budget and is now PAUSED.\n\nTotal used: $${newUsed.toFixed(2)}`,
      severity: 'error',
    }).catch(() => {});
  }
}

export function estimateCost(operation: string, params: Record<string, unknown>): number {
  const baseCosts: Record<string, number> = {
    'openai-gpt4': 0.03,
    'openai-gpt3.5': 0.002,
    'ollama-agent': 0.0001,    // hermes3:70b — local, near-zero marginal cost
    'ollama-content': 0.0001,  // llama3.1:70b — local
    'ollama-fast': 0.00001,    // llama3.2:3b — local, very cheap
    'analytics': 0.001,
    'email': 0.0001,
    'sms': 0.01,
  };
  const base = baseCosts[operation] || 0.01;
  const multiplier = typeof params.tokens === 'number' ? params.tokens / 1000 : 1;
  return base * multiplier;
}

export async function resetBudget(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { name: agentId },
    data: { budgetUsedUsd: 0 },
  });
}

export async function resetAllBudgets(): Promise<void> {
  await prisma.agent.updateMany({
    data: { budgetUsedUsd: 0 },
  });
}

export async function getAllBudgetStatus(): Promise<BudgetStatus[]> {
  const agents = await prisma.agent.findMany();
  return agents.map((agent) => {
    const percentageUsed = agent.monthlyBudgetUsd > 0
      ? (agent.budgetUsedUsd / agent.monthlyBudgetUsd) * 100
      : 0;
    const now = new Date();
    return {
      agentName: agent.displayName,
      budgetUsed: agent.budgetUsedUsd,
      monthlyBudget: agent.monthlyBudgetUsd,
      percentageUsed,
      isPaused: percentageUsed >= 100,
      isWarning: percentageUsed >= 80,
      resetsAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  });
}

export async function updateBudget(agentId: string, newMonthlyBudget: number): Promise<void> {
  await prisma.agent.update({
    where: { name: agentId },
    data: { monthlyBudgetUsd: newMonthlyBudget },
  });
}

export async function getTotalCost(): Promise<number> {
  const result = await prisma.agent.aggregate({ _sum: { budgetUsedUsd: true } });
  return result._sum.budgetUsedUsd ?? 0;
}

