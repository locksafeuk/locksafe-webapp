/**
 * Prisma-backed adapters for the self-improvement loop.
 *
 * Targets TunableParameter / ParameterChange (run `npx prisma generate &&
 * npm run db:push` after the schema change). Typed via local delegate shapes +
 * a boundary cast so it compiles before the client is regenerated.
 */

import prisma from "@/lib/db";
import { TUNABLE_PARAMETERS, type MetricDirection } from "../parameters";
import type { MetricProvider, ParameterChangeRecord, ParameterStore, StoredParam } from "../ports";

interface Where { [k: string]: unknown }
interface TunableDelegate {
  findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  findUnique(args: { where: { key: string } }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { key: string }; data: Record<string, unknown> }): Promise<unknown>;
}
interface ChangeDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}
interface JobDelegate {
  count(args?: { where?: Where }): Promise<number>;
}
interface ProposalDelegate {
  count(args: { where: Where }): Promise<number>;
}
interface SelfImproveClient {
  tunableParameter: TunableDelegate;
  parameterChange: ChangeDelegate;
  job: JobDelegate;
  agentProposal: ProposalDelegate;
}
const db = prisma as unknown as SelfImproveClient;

export class PrismaParameterStore implements ParameterStore {
  async loadAll(): Promise<StoredParam[]> {
    // Seed any missing defaults so the registry is the source of truth.
    const existing = await db.tunableParameter.findMany();
    const existingKeys = new Set(existing.map((r) => String(r.key)));
    for (const def of Object.values(TUNABLE_PARAMETERS)) {
      if (!existingKeys.has(def.key)) {
        await db.tunableParameter.create({
          data: {
            key: def.key, value: def.value, min: def.min, max: def.max, step: def.step,
            betterWhen: def.betterWhen, metric: def.metric, lastDelta: 0, lastMetric: null,
          },
        });
      }
    }
    const rows = await db.tunableParameter.findMany();
    return rows.map((r) => ({
      key: String(r.key),
      value: Number(r.value),
      min: Number(r.min),
      max: Number(r.max),
      step: Number(r.step),
      betterWhen: String(r.betterWhen) as MetricDirection,
      metric: String(r.metric),
      lastDelta: Number(r.lastDelta ?? 0),
      lastMetric: r.lastMetric == null ? null : Number(r.lastMetric),
    }));
  }

  async apply(key: string, toValue: number, delta: number, lastMetric: number): Promise<void> {
    await db.tunableParameter.update({ where: { key }, data: { value: toValue, lastDelta: delta, lastMetric } });
  }

  async touchMetric(key: string, lastMetric: number): Promise<void> {
    await db.tunableParameter.update({ where: { key }, data: { lastMetric } });
  }

  async recordChange(rec: ParameterChangeRecord): Promise<void> {
    await db.parameterChange.create({
      data: {
        key: rec.key, fromValue: rec.fromValue, toValue: rec.toValue, action: rec.action,
        reason: rec.reason, metricBefore: rec.metricBefore, metricAfter: rec.metricAfter, shadow: rec.shadow,
      },
    });
  }
}

const ACTIVE_JOB_STATES = ["PENDING", "SCHEDULED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION"];

/** Computes real outcome metrics from the database. */
export class PrismaMetricProvider implements MetricProvider {
  constructor(private readonly windowDays = 7) {}

  async measure(metric: string): Promise<number | null> {
    const since = new Date(Date.now() - this.windowDays * 24 * 60 * 60 * 1000);

    if (metric === "job_completion_rate") {
      const [created, completed] = await Promise.all([
        db.job.count({ where: { createdAt: { gte: since } } }),
        db.job.count({ where: { createdAt: { gte: since }, status: { in: ["COMPLETED", "SIGNED"] } } }),
      ]);
      if (created === 0) return null; // no demand → don't tune blind
      return completed / created;
    }

    if (metric === "alert_noise_rate") {
      // sent = alerts the gate allowed (not rejected); dismissed = human-marked noise.
      const [sent, dismissed] = await Promise.all([
        db.agentProposal.count({ where: { actionType: "alert.raise", proposedAt: { gte: since }, decision: { not: "reject" } } }),
        db.agentProposal.count({ where: { actionType: "alert.raise", proposedAt: { gte: since }, dismissedAsNoise: true } }),
      ]);
      if (sent === 0) return null; // no alerts → don't tune blind
      return dismissed / sent;
    }

    // Other metrics not yet wired → hold.
    return null;
  }
}

/**
 * Read a self-tuned parameter value, falling back to the registry default.
 * Consumers (e.g. the dispatch validator) call this to use tuned values.
 */
export async function getTunedValue(key: string, fallback: number): Promise<number> {
  try {
    const row = await db.tunableParameter.findUnique({ where: { key } });
    return row && typeof row.value !== "undefined" ? Number(row.value) : fallback;
  } catch {
    return fallback;
  }
}
