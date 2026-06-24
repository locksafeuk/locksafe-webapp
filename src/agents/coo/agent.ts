/**
 * COO Agent Implementation
 *
 * Chief Operating Officer - manages dispatch and operations.
 */

import prisma, { nullOrUnset } from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { executeHeartbeat, delegateTask } from "@/agents/core/orchestrator";
import { parseSkillsFile } from "@/agents/core/skill-parser";
import { storeDecision, storePattern } from "@/agents/core/memory";
import { WorkflowEngine } from "@/lib/workflow-engine";
import { sendAdminAlert } from "@/lib/telegram";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import type { AgentConfig } from "@/agents/core/types";
import { COO_HEARTBEAT_CRON } from "@/agents/heartbeat-schedules";
import { planCooEscalations } from "@/agents/coo/escalation";

// Agent configuration
export const COO_AGENT_CONFIG: AgentConfig = {
  name: "coo",
  displayName: "COO Agent",
  role: "Chief Operating Officer - Manages dispatch, locksmith operations, and service quality",
  skillsPath: "coo/SKILL.md",
  monthlyBudgetUsd: 40,
  heartbeatCronExpr: COO_HEARTBEAT_CRON,
  permissions: [
    "coo",
    "ops-manager",
    "dispatch-optimizer",
  ],
  governanceLevel: "autonomous",
};

/**
 * Initialize the COO agent in the database
 */
export async function initializeCOOAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({
    where: { name: COO_AGENT_CONFIG.name },
  });

  if (existing) {
    console.log("[COO] Agent already exists, updating config...");
    await prisma.agent.update({
      where: { name: COO_AGENT_CONFIG.name },
      data: {
        displayName: COO_AGENT_CONFIG.displayName,
        role: COO_AGENT_CONFIG.role,
        skillsPath: COO_AGENT_CONFIG.skillsPath,
        monthlyBudgetUsd: COO_AGENT_CONFIG.monthlyBudgetUsd,
        heartbeatCronExpr: COO_AGENT_CONFIG.heartbeatCronExpr,
        permissions: COO_AGENT_CONFIG.permissions,
        governanceLevel: COO_AGENT_CONFIG.governanceLevel,
      },
    });
    return;
  }

  // Create new agent
  await prisma.agent.create({
    data: {
      name: COO_AGENT_CONFIG.name,
      displayName: COO_AGENT_CONFIG.displayName,
      role: COO_AGENT_CONFIG.role,
      skillsPath: COO_AGENT_CONFIG.skillsPath,
      monthlyBudgetUsd: COO_AGENT_CONFIG.monthlyBudgetUsd,
      heartbeatCronExpr: COO_AGENT_CONFIG.heartbeatCronExpr,
      permissions: COO_AGENT_CONFIG.permissions,
      governanceLevel: COO_AGENT_CONFIG.governanceLevel,
      heartbeatEnabled: true,
      status: "active",
      budgetResetAt: getNextMonthStart(),
    },
  });

  console.log("[COO] Agent initialized successfully");

  // Store initial system memories
  const agent = await prisma.agent.findUnique({ where: { name: "coo" } });
  if (agent) {
    await storePattern(
      agent.id,
      "Emergency jobs should be dispatched within 5 minutes",
      "Platform SLA requirement",
      0.9
    );
    await storePattern(
      agent.id,
      "Locksmiths with rating below 4.0 should not receive auto-dispatch",
      "Quality control policy",
      0.9
    );
  }
}

/**
 * Run COO agent heartbeat using the WorkflowEngine.
 * Performs real operational checks: stuck jobs, expiring insurance, SLA monitoring.
 */
export async function runCOOHeartbeat(): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { name: "coo" } });
  if (!agent) {
    console.error("[COO] Agent not found, initializing...");
    await initializeCOOAgent();
    return;
  }

  type COOCtx = {
    sweptCount: number;
    sweepNotified: number;
    stuckJobCount: number;
    unassignedEmergencyCount: number;
    expiringInsuranceCount: number;
    alerts: string[];
  };

  const workflow = new WorkflowEngine<COOCtx>("COO Operations Review")
    .step("sweep-unassigned", async (ctx) => {
      // Autonomous sweep: any PENDING job with no notified locksmiths yet
      // must be pushed through notifyNearbyLocksmiths so the dispatch funnel
      // doesn't stall when a job is created directly in DB or when the public
      // intake's fire-and-forget notify call lost its event loop on a cold start.
      const unnotified = await prisma.job.findMany({
        where: {
          status: JobStatus.PENDING,
          // Mongo: `locksmithId: null` misses jobs where the field is unset.
          ...nullOrUnset("locksmithId"),
          notifiedLocksmithIds: { isEmpty: true },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          jobNumber: true,
          problemType: true,
          propertyType: true,
          postcode: true,
          address: true,
          latitude: true,
          longitude: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      });

      ctx.sweptCount = unnotified.length;
      let notifiedTotal = 0;
      for (const job of unnotified) {
        try {
          const result = await notifyNearbyLocksmiths({
            id: job.id,
            jobNumber: job.jobNumber,
            problemType: job.problemType,
            propertyType: job.propertyType ?? undefined,
            postcode: job.postcode,
            address: job.address,
            latitude: job.latitude,
            longitude: job.longitude,
            createdAt: job.createdAt.toISOString(),
          });
          notifiedTotal += result.notifiedCount;
          if (result.locksmithIds.length > 0) {
            await prisma.job.update({
              where: { id: job.id },
              data: { notifiedLocksmithIds: result.locksmithIds },
            });
          }
        } catch (err) {
          console.error(`[COO sweep] notify failed for ${job.jobNumber}:`, err);
        }
      }
      ctx.sweepNotified = notifiedTotal;
      if (unnotified.length > 0) {
        ctx.alerts.push(
          `Swept ${unnotified.length} unassigned job(s); pushed to ${notifiedTotal} locksmith notification(s)`,
        );
      }
      return ctx;
    })
    .step("check-stuck-jobs", async (ctx) => {
      // Jobs PENDING >10 min with no assigned locksmith
      const stuckJobs = await prisma.job.findMany({
        where: {
          status: JobStatus.PENDING,
          createdAt: { lt: new Date(Date.now() - 10 * 60_000) },
          ...nullOrUnset("locksmithId"),
        },
        select: { id: true, problemType: true, createdAt: true },
        take: 20,
      });
      ctx.stuckJobCount = stuckJobs.length;
      if (stuckJobs.length >= 1) {
        ctx.alerts.push(`${stuckJobs.length} job(s) stuck PENDING >10 min without locksmith assignment`);
      }
      return ctx;
    })
    .step("check-unassigned-emergency", async (ctx) => {
      // Emergency jobs pending >10 min
      const emergencies = await prisma.job.count({
        where: {
          status: JobStatus.PENDING,
          isEmergency: true,
          createdAt: { lt: new Date(Date.now() - 10 * 60_000) },
          ...nullOrUnset("locksmithId"),
        },
      });
      ctx.unassignedEmergencyCount = emergencies;
      if (emergencies > 0) {
        ctx.alerts.push(`🚨 ${emergencies} emergency job(s) unassigned for >10 minutes`);
      }
      return ctx;
    })
    .step("check-expiring-insurance", async (ctx) => {
      // Locksmiths whose insurance expires within 7 days
      const expiring = await prisma.locksmith.count({
        where: {
          isActive: true,
          insuranceExpiryDate: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60_000),
            gt: new Date(),
          },
        },
      });
      ctx.expiringInsuranceCount = expiring;
      if (expiring > 0) {
        ctx.alerts.push(`${expiring} locksmith(s) have insurance expiring within 7 days`);
      }
      return ctx;
    })
    .step("dispatch-alerts", async (ctx) => {
      if (ctx.alerts.length > 0) {
        await sendAdminAlert({
          title: "⚙️ COO Operations Alert",
          message: ctx.alerts.join("\n"),
          severity: ctx.unassignedEmergencyCount > 0 ? "error" : "warning",
          dedupeKey: "coo:operations-alert",
          cooldownMsOverride: 30 * 60 * 1000, // 30-min cooldown — repeated ops alerts are noise
        });
      }
      return ctx;
    })
    .step("escalate-to-peers", async (ctx) => {
      // Peer escalation (flag-gated, default OFF). delegateTask has circular +
      // duplicate guards, so repeated heartbeats won't re-file the same task.
      if (process.env.CONTROL_PLANE_COO_DELEGATION !== "true") return ctx;

      const availableLocksmiths = await prisma.locksmith.count({
        where: { isActive: true, isAvailable: true },
      });
      const escalations = planCooEscalations({
        stuckJobCount: ctx.stuckJobCount,
        unassignedEmergencyCount: ctx.unassignedEmergencyCount,
        sweptCount: ctx.sweptCount,
        sweepNotified: ctx.sweepNotified,
        availableLocksmiths,
      });
      for (const e of escalations) {
        await delegateTask(agent.id, e.toAgent, {
          title: e.title,
          description: e.description,
          priority: e.priority,
        }).catch((err) => console.error(`[COO] escalation to ${e.toAgent} failed:`, err));
      }
      if (escalations.length > 0) {
        console.log(`[COO] Escalated to peers: ${escalations.map((e) => e.toAgent).join(", ")}`);
      }
      return ctx;
    })
    .step("update-heartbeat", async (ctx) => {
      await prisma.agent.update({
        where: { name: "coo" },
        data: { lastHeartbeat: new Date() },
      });
      // Record the run so COO participates in the org memory / BI / self-learning
      // layer (it's a deterministic workflow agent, so this is its memory trail).
      await storeDecision(
        "coo",
        `Ops sweep: swept ${ctx.sweptCount} unassigned job(s) → ${ctx.sweepNotified} notification(s)`,
        `stuck:${ctx.stuckJobCount} emergencies:${ctx.unassignedEmergencyCount} ` +
          `expiringInsurance:${ctx.expiringInsuranceCount} alerts:${ctx.alerts.length}`,
        "completed",
      ).catch((err) => console.warn("[COO] memory write failed:", err));
      return ctx;
    });

  const result = await workflow.run({
    sweptCount: 0,
    sweepNotified: 0,
    stuckJobCount: 0,
    unassignedEmergencyCount: 0,
    expiringInsuranceCount: 0,
    alerts: [],
  });

  if (!result.success) {
    const failed = result.steps.find(s => !s.success);
    console.error(`[COO] Workflow step "${failed?.name}" failed: ${failed?.error}`);
  } else {
    const ctx = result.context;
    console.log(
      `[COO] Heartbeat done in ${result.totalDurationMs}ms — ` +
      `swept:${ctx.sweptCount}→notified:${ctx.sweepNotified} ` +
      `stuck:${ctx.stuckJobCount} emergencies:${ctx.unassignedEmergencyCount} ` +
      `expiringInsurance:${ctx.expiringInsuranceCount} alerts:${ctx.alerts.length}`
    );
  }
}

/**
 * Get COO agent status
 */
export async function getCOOStatus(): Promise<{
  status: string;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
  operationalMetrics: {
    pendingJobs: number;
    availableLocksmiths: number;
    alertsCount: number;
  };
} | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: "coo" },
    include: {
      _count: {
        select: {
          tasks: {
            where: { status: { in: ["pending", "in_progress"] } },
          },
        },
      },
    },
  });

  if (!agent) return null;

  // Get operational metrics
  const pendingJobs = await prisma.job.count({
    where: { status: JobStatus.PENDING },
  });

  const availableLocksmiths = await prisma.locksmith.count({
    where: { isActive: true, isAvailable: true },
  });

  // Count alerts (stuck jobs, expiring insurance)
  const stuckJobs = await prisma.job.count({
    where: {
      status: JobStatus.PENDING,
      createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  const expiringInsurance = await prisma.locksmith.count({
    where: {
      isActive: true,
      insuranceExpiryDate: {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gt: new Date(),
      },
    },
  });

  return {
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    pendingTasks: agent._count.tasks,
    budgetUsed: agent.budgetUsedUsd,
    budgetRemaining: agent.monthlyBudgetUsd - agent.budgetUsedUsd,
    operationalMetrics: {
      pendingJobs,
      availableLocksmiths,
      alertsCount: stuckJobs + expiringInsurance,
    },
  };
}

/**
 * Helper: Get first day of next month
 */
function getNextMonthStart(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}
