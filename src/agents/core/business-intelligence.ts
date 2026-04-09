/**
 * Business Intelligence Aggregation
 * 
 * Aggregates insights from all agents into unified BI reports,
 * calculates cross-functional KPIs, and provides real-time
 * business health dashboard data.
 */

import { getAllMessages, getMessageBusStats } from './message-bus';
import { getAllDecisions, getDecisionStats } from './decision-engine';
import { getAgentStatusSummary } from './orchestrator';
import { getAllBudgetStatus, getTotalCost } from './budget';
import { getMemoryStats } from './memory';

// ─── BI Types ────────────────────────────────────────────────────────────────

export interface BusinessHealthScore {
  overall: number;        // 0-100
  operations: number;     // 0-100
  marketing: number;      // 0-100
  technology: number;     // 0-100
  finance: number;        // 0-100
  agentEfficiency: number; // 0-100
}

export interface CrossFunctionalKPI {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  source: string;
  category: 'revenue' | 'efficiency' | 'satisfaction' | 'growth' | 'cost';
}

export interface AgentPerformanceReport {
  agentId: string;
  displayName: string;
  tasksCompleted: number;
  decisionsParticipated: number;
  messagesSent: number;
  messagesReceived: number;
  budgetUsed: number;
  budgetRemaining: number;
  memoryEntries: number;
  healthScore: number;
}

export interface BusinessIntelligenceReport {
  generatedAt: Date;
  healthScore: BusinessHealthScore;
  kpis: CrossFunctionalKPI[];
  agentPerformance: AgentPerformanceReport[];
  recentDecisions: Array<{
    id: string;
    title: string;
    status: string;
    proposedBy: string;
    resolvedAt?: Date;
  }>;
  recentInsights: Array<{
    from: string;
    to: string;
    subject: string;
    createdAt: Date;
  }>;
  communicationStats: {
    totalMessages: number;
    interAgentFlows: Record<string, number>;
  };
  recommendations: string[];
}

// ─── Core BI Functions ───────────────────────────────────────────────────────

/**
 * Generate comprehensive business intelligence report
 */
export async function generateBIReport(): Promise<BusinessIntelligenceReport> {
  const [agentSummary, messageStats, decisionStats, budgets] = await Promise.all([
    getAgentStatusSummary(),
    getMessageBusStats(),
    getDecisionStats(),
    getAllBudgetStatus(),
  ]);

  const [messages, decisions] = await Promise.all([
    getAllMessages({ limit: 100 }),
    getAllDecisions({ limit: 20 }),
  ]);

  // Calculate health scores
  const healthScore = calculateHealthScore(agentSummary, messageStats, decisionStats, budgets);

  // Build KPIs
  const kpis = buildCrossFunctionalKPIs(agentSummary, messageStats, decisionStats, budgets);

  // Agent performance
  const agentPerformance = await buildAgentPerformance(agentSummary, messageStats, budgets);

  // Communication flows
  const interAgentFlows: Record<string, number> = {};
  for (const m of messages) {
    const flowKey = `${m.fromAgentId}→${m.toAgentId}`;
    interAgentFlows[flowKey] = (interAgentFlows[flowKey] || 0) + 1;
  }

  // Recent insights
  const recentInsights = messages
    .filter((m) => m.type === 'INSIGHT_SHARE')
    .slice(0, 10)
    .map((m) => ({
      from: m.fromAgentId,
      to: m.toAgentId,
      subject: m.subject,
      createdAt: m.createdAt,
    }));

  // Recent decisions
  const recentDecisions = decisions.slice(0, 10).map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    proposedBy: d.proposedBy,
    resolvedAt: d.resolvedAt,
  }));

  // Generate recommendations
  const recommendations = generateRecommendations(healthScore, agentSummary, messageStats, decisionStats);

  return {
    generatedAt: new Date(),
    healthScore,
    kpis,
    agentPerformance,
    recentDecisions,
    recentInsights,
    communicationStats: {
      totalMessages: messageStats.totalMessages,
      interAgentFlows,
    },
    recommendations,
  };
}

/**
 * Calculate business health scores
 */
function calculateHealthScore(
  agentSummary: Awaited<ReturnType<typeof getAgentStatusSummary>>,
  messageStats: Awaited<ReturnType<typeof getMessageBusStats>>,
  decisionStats: Awaited<ReturnType<typeof getDecisionStats>>,
  budgets: Array<{ percentageUsed: number }>
): BusinessHealthScore {
  // Operations score: based on agent activity and heartbeat health
  const activeRate = agentSummary.total > 0 ? (agentSummary.active / agentSummary.total) * 100 : 0;
  const operations = Math.min(100, activeRate);

  // Marketing score: based on message volume and insight sharing
  const insightCount = messageStats.byType['INSIGHT_SHARE'] || 0;
  const marketing = Math.min(100, 50 + insightCount * 10);

  // Technology score: based on agent system health
  const technology = agentSummary.active > 0 ? 80 : 40;

  // Finance score: based on budget utilization (not too high, not too low)
  const avgBudgetUsage = budgets.length > 0
    ? budgets.reduce((s, b) => s + b.percentageUsed, 0) / budgets.length
    : 0;
  const finance = avgBudgetUsage <= 80 ? 90 : avgBudgetUsage <= 100 ? 70 : 40;

  // Agent efficiency: decisions made, messages flowing
  const decisionEfficiency = decisionStats.approvalRate * 100;
  const commEfficiency = messageStats.totalMessages > 0 ? Math.min(100, 60 + messageStats.acknowledged * 5) : 50;
  const agentEfficiency = (decisionEfficiency + commEfficiency) / 2;

  const overall = Math.round(
    operations * 0.25 + marketing * 0.2 + technology * 0.2 + finance * 0.15 + agentEfficiency * 0.2
  );

  return { overall, operations, marketing, technology, finance, agentEfficiency };
}

/**
 * Build cross-functional KPIs from all agent data
 */
function buildCrossFunctionalKPIs(
  agentSummary: Awaited<ReturnType<typeof getAgentStatusSummary>>,
  messageStats: Awaited<ReturnType<typeof getMessageBusStats>>,
  decisionStats: Awaited<ReturnType<typeof getDecisionStats>>,
  budgets: Array<{ percentageUsed: number; budgetUsed: number }>
): CrossFunctionalKPI[] {
  const totalBudgetUsed = budgets.reduce((s, b) => s + b.budgetUsed, 0);

  return [
    {
      name: 'Active Agents',
      value: agentSummary.active,
      unit: 'agents',
      trend: agentSummary.active >= agentSummary.total ? 'stable' : 'down',
      source: 'orchestrator',
      category: 'efficiency',
    },
    {
      name: 'Inter-Agent Messages',
      value: messageStats.totalMessages,
      unit: 'messages',
      trend: messageStats.totalMessages > 10 ? 'up' : 'stable',
      source: 'message-bus',
      category: 'efficiency',
    },
    {
      name: 'Decision Approval Rate',
      value: Math.round(decisionStats.approvalRate * 100),
      unit: '%',
      trend: decisionStats.approvalRate >= 0.7 ? 'up' : 'down',
      source: 'decision-engine',
      category: 'efficiency',
    },
    {
      name: 'Decisions Made',
      value: decisionStats.total,
      unit: 'decisions',
      trend: 'stable',
      source: 'decision-engine',
      category: 'efficiency',
    },
    {
      name: 'Total Agent Budget Used',
      value: Math.round(totalBudgetUsed * 100) / 100,
      unit: 'USD',
      trend: totalBudgetUsed > 200 ? 'up' : 'stable',
      source: 'budget',
      category: 'cost',
    },
    {
      name: 'Avg Budget Utilization',
      value: budgets.length > 0
        ? Math.round(budgets.reduce((s, b) => s + b.percentageUsed, 0) / budgets.length)
        : 0,
      unit: '%',
      trend: 'stable',
      source: 'budget',
      category: 'cost',
    },
    {
      name: 'Pending Messages',
      value: messageStats.pending,
      unit: 'messages',
      trend: messageStats.pending > 5 ? 'up' : 'stable',
      source: 'message-bus',
      category: 'efficiency',
    },
    {
      name: 'Insights Shared',
      value: messageStats.byType['INSIGHT_SHARE'] || 0,
      unit: 'insights',
      trend: (messageStats.byType['INSIGHT_SHARE'] || 0) > 5 ? 'up' : 'stable',
      source: 'message-bus',
      category: 'growth',
    },
  ];
}

/**
 * Build per-agent performance reports
 */
async function buildAgentPerformance(
  agentSummary: Awaited<ReturnType<typeof getAgentStatusSummary>>,
  messageStats: Awaited<ReturnType<typeof getMessageBusStats>>,
  budgets: Array<{ agentName: string; budgetUsed: number; monthlyBudget: number; percentageUsed: number }>
): Promise<AgentPerformanceReport[]> {
  const reports: AgentPerformanceReport[] = [];

  for (const agent of agentSummary.agents) {
    const agentMsgStats = messageStats.byAgent[agent.name] || { sent: 0, received: 0 };
    const budget = budgets.find((b) => b.agentName === agent.name);

    let memEntries = 0;
    try {
      const stats = await getMemoryStats(agent.name);
      memEntries = stats.total;
    } catch { /* memory may not be initialized */ }

    // Calculate health score for individual agent
    const isActive = agent.status === 'active' ? 30 : 0;
    const hasCommunication = (agentMsgStats.sent + agentMsgStats.received > 0) ? 25 : 0;
    const budgetHealthy = budget ? (budget.percentageUsed <= 80 ? 25 : budget.percentageUsed <= 100 ? 15 : 5) : 25;
    const hasMemory = memEntries > 0 ? 20 : 0;

    reports.push({
      agentId: agent.name,
      displayName: agent.displayName,
      tasksCompleted: agent.pendingTasks, // From summary (approximate)
      decisionsParticipated: 0, // Will be enriched if needed
      messagesSent: agentMsgStats.sent,
      messagesReceived: agentMsgStats.received,
      budgetUsed: budget?.budgetUsed || 0,
      budgetRemaining: budget ? budget.monthlyBudget - budget.budgetUsed : 0,
      memoryEntries: memEntries,
      healthScore: isActive + hasCommunication + budgetHealthy + hasMemory,
    });
  }

  return reports;
}

/**
 * Generate AI-driven recommendations based on system state
 */
function generateRecommendations(
  health: BusinessHealthScore,
  agentSummary: Awaited<ReturnType<typeof getAgentStatusSummary>>,
  messageStats: Awaited<ReturnType<typeof getMessageBusStats>>,
  decisionStats: Awaited<ReturnType<typeof getDecisionStats>>
): string[] {
  const recommendations: string[] = [];

  if (health.overall < 60) {
    recommendations.push('Overall business health is below 60%. Consider reviewing agent configurations and ensuring all agents are active.');
  }

  if (agentSummary.paused > 0) {
    recommendations.push(`${agentSummary.paused} agent(s) are paused. Check budget limits and error logs to restore them.`);
  }

  if (messageStats.totalMessages === 0) {
    recommendations.push('No inter-agent communication detected. Enable agent heartbeats to trigger collaborative workflows.');
  }

  if (messageStats.pending > 10) {
    recommendations.push(`${messageStats.pending} messages are pending delivery. Check agent availability and message processing.`);
  }

  if (decisionStats.total === 0) {
    recommendations.push('No collaborative decisions have been made. Agents should use the decision engine for strategic choices.');
  }

  if (decisionStats.approvalRate < 0.5 && decisionStats.total > 3) {
    recommendations.push('Decision approval rate is below 50%. Review decision proposals for better alignment between agents.');
  }

  if (health.agentEfficiency < 50) {
    recommendations.push('Agent efficiency is low. Ensure agents are sharing insights and acknowledging messages.');
  }

  if (health.finance < 60) {
    recommendations.push('Budget utilization is concerning. Review agent spending patterns and adjust monthly budgets if needed.');
  }

  if (recommendations.length === 0) {
    recommendations.push('System is operating well. Continue monitoring for optimization opportunities.');
  }

  return recommendations;
}

/**
 * Get a quick business health snapshot (lightweight)
 */
export async function getBusinessHealthSnapshot(): Promise<{
  overall: number;
  activeAgents: number;
  totalAgents: number;
  totalMessages: number;
  totalDecisions: number;
  totalBudgetUsed: number;
}> {
  const [agentSummary, messageStats, decisionStats] = await Promise.all([
    getAgentStatusSummary(),
    getMessageBusStats(),
    getDecisionStats(),
  ]);

  const totalBudgetUsed = await getTotalCost();

  return {
    overall: agentSummary.active > 0 ? 75 : 40,
    activeAgents: agentSummary.active,
    totalAgents: agentSummary.total,
    totalMessages: messageStats.totalMessages,
    totalDecisions: decisionStats.total,
    totalBudgetUsed,
  };
}
