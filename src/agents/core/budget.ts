// Agent Budget System - tracks per-agent monthly budgets with cost recording

import type { BudgetStatus } from './types';

interface BudgetEntry {
  agentId: string;
  agentName: string;
  monthlyBudget: number;
  budgetUsed: number;
  resetsAt: Date;
  costs: { amount: number; description: string; timestamp: Date }[];
}

// In-memory budget store
const budgetStore = new Map<string, BudgetEntry>();

function getOrCreateBudget(agentId: string): BudgetEntry {
  if (!budgetStore.has(agentId)) {
    const now = new Date();
    const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    budgetStore.set(agentId, {
      agentId,
      agentName: agentId,
      monthlyBudget: 50,
      budgetUsed: 0,
      resetsAt,
      costs: [],
    });
  }
  return budgetStore.get(agentId)!;
}

export async function getBudgetStatus(agentId: string): Promise<{
  agentName: string;
  budgetUsed: number;
  monthlyBudget: number;
  percentageUsed: number;
  isPaused: boolean;
  isWarning: boolean;
  resetsAt: Date;
}> {
  const budget = getOrCreateBudget(agentId);
  const percentageUsed = (budget.budgetUsed / budget.monthlyBudget) * 100;
  return {
    agentName: budget.agentName,
    budgetUsed: budget.budgetUsed,
    monthlyBudget: budget.monthlyBudget,
    percentageUsed,
    isPaused: percentageUsed >= 100,
    isWarning: percentageUsed >= 80,
    resetsAt: budget.resetsAt,
  };
}

export async function checkBudget(agentId: string, estimatedCost: number): Promise<boolean> {
  const budget = getOrCreateBudget(agentId);
  return budget.budgetUsed + estimatedCost <= budget.monthlyBudget;
}

export async function recordCost(
  agentId: string,
  cost: number,
  description: string
): Promise<void> {
  const budget = getOrCreateBudget(agentId);
  budget.budgetUsed += cost;
  budget.costs.push({ amount: cost, description, timestamp: new Date() });
}

export function estimateCost(operation: string, params: Record<string, unknown>): number {
  // Simple cost estimation based on operation type
  const baseCosts: Record<string, number> = {
    'openai-gpt4': 0.03,
    'openai-gpt3.5': 0.002,
    'analytics': 0.001,
    'email': 0.0001,
    'sms': 0.01,
  };
  const base = baseCosts[operation] || 0.01;
  const multiplier = typeof params.tokens === 'number' ? params.tokens / 1000 : 1;
  return base * multiplier;
}

export async function resetBudget(agentId: string): Promise<void> {
  const budget = getOrCreateBudget(agentId);
  budget.budgetUsed = 0;
  budget.costs = [];
  const now = new Date();
  budget.resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export async function resetAllBudgets(): Promise<void> {
  for (const [agentId] of budgetStore) {
    await resetBudget(agentId);
  }
}

export async function getAllBudgetStatus(): Promise<BudgetStatus[]> {
  const statuses: BudgetStatus[] = [];
  for (const [agentId] of budgetStore) {
    const status = await getBudgetStatus(agentId);
    statuses.push(status);
  }
  return statuses;
}

export async function updateBudget(agentId: string, newMonthlyBudget: number): Promise<void> {
  const budget = getOrCreateBudget(agentId);
  budget.monthlyBudget = newMonthlyBudget;
}

export async function getTotalCost(): Promise<number> {
  let total = 0;
  for (const [, budget] of budgetStore) {
    total += budget.budgetUsed;
  }
  return total;
}
