/**
 * Alert gate (control plane).
 *
 * Runs every admin alert through the deterministic pipeline and returns whether
 * it should be allowed. Two modes:
 *
 *   SHADOW  (default)  — evaluate + record the would-be decision, but the caller
 *                        ignores `allow` and sends as normal. Used to prove the
 *                        gate against real traffic before enforcing.
 *   ENFORCE (flagged)  — caller suppresses the send when `allow === false`.
 *
 * Enforcement is gated by CONTROL_PLANE_ALERT_ENFORCE=true (default OFF), so
 * turning it on is a single flag flip with no code change.
 *
 * Hard guarantee: this never throws and never sends anything itself — the actual
 * Telegram send stays in the legacy path. It only decides allow/suppress.
 */

import prisma from "@/lib/db";
import { handleProposal } from "../executor";
import { PrismaProposalStore } from "../adapters/prisma";
import {
  InMemoryApprovalGateway,
  InMemoryExecutorRegistry,
  InMemoryIdempotencyStore,
} from "../adapters/memory";
import type { AlertFacts, AlertKind, AlertRaiseArgs } from "../validators/alert";
import type { FactProvider } from "../ports";
import type { AlertSeverity, Proposal } from "../types";

const ACTIVE_JOB_STATES = [
  "PENDING", "SCHEDULED", "ACCEPTED", "EN_ROUTE", "ARRIVED",
  "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS",
  "PENDING_CUSTOMER_CONFIRMATION",
];

const INFRA_HINTS = /\b(error rate|db |database|latency|uptime|deploy|deployment|outage|engine|memory|circuit breaker|timeout|5\d\d)\b/i;
const ZERO_JOBS_HINTS = /\b(zero|0\/0|no (completed|pending|jobs)|no jobs)\b/i;
const JOB_HINTS = /\b(job|jobs|complet|dispatch|utilization|utilisation)\b/i;

/** Enforcement flag — default OFF (shadow only). */
export function isAlertEnforcementEnabled(): boolean {
  return process.env.CONTROL_PLANE_ALERT_ENFORCE === "true";
}

function inferKind(text: string): AlertKind {
  if (INFRA_HINTS.test(text)) return "infra";
  if (JOB_HINTS.test(text)) return "business";
  return "ops";
}

function inferAgent(title: string): string {
  const m = title.match(/Agent Alert:\s*([A-Za-z-]+)/i);
  return m ? m[1].toLowerCase() : "system";
}

function isWithinUkQuietHours(now: Date, startHour = 22, endHour = 7): boolean {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  let hour = Number.parseInt(hourStr, 10);
  if (hour === 24) hour = 0;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

async function buildAlertFacts(bypassQuietHours: boolean, now: Date): Promise<AlertFacts> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [openJobCount, recentJobCount24h] = await Promise.all([
    prisma.job.count({ where: { status: { in: ACTIVE_JOB_STATES as never } } }),
    prisma.job.count({ where: { createdAt: { gte: since24h } } }),
  ]);
  return {
    openJobCount,
    recentJobCount24h,
    withinQuietHours: isWithinUkQuietHours(now),
    // In shadow/enforce we leave dedupe to the legacy cooldown path for now.
    recentlySentSameAlert: false,
    bypassQuietHours,
  };
}

export interface AlertGateInput {
  title: string;
  message: string;
  severity: AlertSeverity;
  bypassQuietHours?: boolean;
}

export interface AlertGateResult {
  allow: boolean;
  outcome: string;
  code?: string;
  reason?: string;
}

/**
 * Evaluate an alert through the pipeline, record it, and return allow/suppress.
 * `shadow` controls whether the proposal is flagged as a dry-run record.
 */
export async function evaluateAlert(
  input: AlertGateInput,
  opts: { shadow: boolean },
): Promise<AlertGateResult> {
  try {
    const now = new Date();
    const text = `${input.title}\n${input.message}`;
    const kind = inferKind(text);
    const bypassQuietHours = input.bypassQuietHours ?? (kind === "infra" && input.severity === "error");

    const args: AlertRaiseArgs = {
      severity: input.severity,
      kind,
      title: input.title,
      message: input.message,
      claimsZeroJobs: kind === "business" && ZERO_JOBS_HINTS.test(text),
    };

    const proposal: Proposal = {
      id: globalThis.crypto?.randomUUID?.() ?? `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agent: inferAgent(input.title),
      actionType: "alert.raise",
      args: args as unknown as Record<string, unknown>,
      rationale: opts.shadow ? "shadow evaluation of live admin alert" : "control-plane alert gate",
      proposedAt: now.toISOString(),
    };

    const facts = await buildAlertFacts(bypassQuietHours, now);
    const factProvider: FactProvider = { factsFor: async () => facts as unknown as Record<string, unknown> };

    // A no-op executor for the allowed branch — the real Telegram send stays in
    // the legacy path; the pipeline only decides allow vs suppress.
    const executors = new InMemoryExecutorRegistry().register("alert.raise", async () => ({
      ok: true,
      message: "allowed (sent via telegram path)",
    }));

    const result = await handleProposal(
      proposal,
      {
        store: new PrismaProposalStore(),
        idempotency: new InMemoryIdempotencyStore(),
        approvals: new InMemoryApprovalGateway(),
        executors,
        facts: factProvider,
      },
      { shadow: opts.shadow, now },
    );

    const allow = result.outcome !== "rejected" && result.outcome !== "shadow-reject";
    console.log(
      `[control-plane:${opts.shadow ? "shadow" : "enforce"}] alert.raise agent=${proposal.agent} ` +
      `kind=${kind} ${opts.shadow ? "would=" : "decision="}${result.outcome}` +
      `${result.code ? ` code=${result.code}` : ""} openJobs=${facts.openJobCount} ` +
      `recent24h=${facts.recentJobCount24h} title="${input.title}"`,
    );

    return { allow, outcome: result.outcome, code: result.code, reason: result.detail };
  } catch (err) {
    // Fail OPEN: control-plane errors must never silence a real alert.
    console.warn("[control-plane] alert gate error (failing open, alert will send):", err);
    return { allow: true, outcome: "gate-error" };
  }
}
