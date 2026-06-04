/**
 * Morning Briefing Workflow
 *
 * Pulls last 24h KPIs from the DB and sends a Telegram digest.
 * Scheduled at 08:00 UTC daily by the morning-briefing cron.
 */

import { prisma } from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { runWorkflow, WorkflowContext } from "@/agents/core/workflow-engine";
import { chat, Models } from "@/lib/llm-router";

/** Gather all KPIs for the last 24 hours */
async function gatherKPIs(ctx: WorkflowContext): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newJobs, completedJobs, pendingJobs, newPayments, newCustomers, activeLocksmiths, pendingReviews, scheduledPosts] = await Promise.all([
    prisma.job.count({ where: { createdAt: { gte: since } } }),
    prisma.job.count({ where: { status: "COMPLETED", updatedAt: { gte: since } } }),
    prisma.job.count({ where: { status: { in: ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: since }, status: "SUCCEEDED" }, _sum: { amount: true }, _count: true }),
    prisma.customer.count({ where: { createdAt: { gte: since } } }),
    prisma.locksmith.count({ where: { isActive: true } }),
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    prisma.socialPost.count({ where: { scheduledFor: { gte: since }, status: "SCHEDULED" } }),
  ]);

  ctx.data.kpis = {
    newJobs,
    completedJobs,
    pendingJobs,
    revenue24h: newPayments._sum.amount ?? 0,
    payments24h: newPayments._count,
    newCustomers,
    activeLocksmiths,
    pendingReviews,
    scheduledPosts,
  };
}

/** Use fast LLM model to generate a concise insight line */
async function generateInsight(ctx: WorkflowContext): Promise<void> {
  const k = ctx.data.kpis as Record<string, number>;
  const prompt = `You are the LockSafe AI CMO. In 1-2 sentences, give a quick operational insight for this morning based on these 24h stats:
Jobs: ${k.newJobs} new, ${k.completedJobs} completed, ${k.pendingJobs} pending.
Revenue: £${k.revenue24h.toFixed(2)} from ${k.payments24h} payments.
Customers: ${k.newCustomers} new. Locksmiths active: ${k.activeLocksmiths}.
Be direct. Focus on what needs attention today.`;

  const response = await chat(Models.FAST, [{ role: "user", content: prompt }], { maxTokens: 100 });
  ctx.data.insight = response.content;
}

/** Send the briefing to Telegram */
async function sendBriefing(ctx: WorkflowContext): Promise<void> {
  const k = ctx.data.kpis as Record<string, number>;
  const insight = (ctx.data.insight as string) || "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

  const lines = [
    `📅 **${dateStr} — Morning Briefing**`,
    ``,
    `**📦 Jobs (last 24h)**`,
    `• New: ${k.newJobs} | Completed: ${k.completedJobs} | Pending: ${k.pendingJobs}`,
    ``,
    `**💷 Revenue**`,
    `• £${k.revenue24h.toFixed(2)} from ${k.payments24h} payment${k.payments24h !== 1 ? "s" : ""}`,
    ``,
    `**👥 People**`,
    `• ${k.newCustomers} new customer${k.newCustomers !== 1 ? "s" : ""} · ${k.activeLocksmiths} locksmiths active`,
    ``,
    `**📱 Social**`,
    `• ${k.scheduledPosts} post${k.scheduledPosts !== 1 ? "s" : ""} scheduled today · ${k.pendingReviews} new review${k.pendingReviews !== 1 ? "s" : ""}`,
  ];

  if (insight) {
    lines.push(``, `**🤖 AI Insight**`, insight);
  }

  await sendAdminAlert({
    title: "Morning Briefing",
    message: lines.join("\n"),
    severity: "info",
    bypassPolicyGate: true,
    dedupeKey: `morning-briefing:${now.toISOString().slice(0, 10)}`,
  });
}

export async function runMorningBriefing(): Promise<{ success: boolean; errors: string[] }> {
  const ctx = await runWorkflow("morning-briefing", [
    { name: "gather-kpis", action: gatherKPIs, retries: 0, critical: true },
    { name: "generate-insight", action: generateInsight, retries: 1, critical: false },
    { name: "send-briefing", action: sendBriefing, retries: 1, critical: false },
  ]);

  return { success: ctx.errors.length === 0, errors: ctx.errors };
}
