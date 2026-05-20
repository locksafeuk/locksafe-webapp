import { prisma } from "@/lib/db";
import { exportMaskedRetellDataset } from "@/lib/retell-dataset";

export const DATASET_INCREMENTAL_DEFAULT_LOOKBACK_HOURS = 24;
export const DATASET_INCREMENTAL_MIN_GAP_MINUTES = 30;

export type IncrementalWindowInput = {
  lastCompletedUntil: Date | null;
  now: Date;
  lookbackHours?: number;
};

export type IncrementalWindow = {
  since: Date;
  until: Date;
  source: "lastCompleted" | "lookback";
};

export function resolveIncrementalDatasetWindow(input: IncrementalWindowInput): IncrementalWindow {
  const lookbackHours =
    input.lookbackHours && input.lookbackHours > 0
      ? input.lookbackHours
      : DATASET_INCREMENTAL_DEFAULT_LOOKBACK_HOURS;
  const until = input.now;
  const fallback = new Date(until.getTime() - lookbackHours * 60 * 60 * 1000);

  if (input.lastCompletedUntil && input.lastCompletedUntil < until) {
    return { since: input.lastCompletedUntil, until, source: "lastCompleted" };
  }

  return { since: fallback, until, source: "lookback" };
}

export function shouldRunIncrementalDataset(input: {
  lastCompletedUntil: Date | null;
  now: Date;
  minGapMinutes?: number;
}): boolean {
  if (!input.lastCompletedUntil) return true;
  const minGapMinutes = input.minGapMinutes ?? DATASET_INCREMENTAL_MIN_GAP_MINUTES;
  const elapsedMs = input.now.getTime() - input.lastCompletedUntil.getTime();
  return elapsedMs >= minGapMinutes * 60 * 1000;
}

export async function createDatasetJob(params: {
  requestedBy?: string;
  mode?: "incremental" | "full";
  limit?: number;
  includeTestCalls?: boolean;
  since?: Date;
  until?: Date;
}) {
  const mode = params.mode ?? "incremental";
  const limit = Math.max(50, Math.min(params.limit ?? 500, 2000));

  let since = params.since;
  if (!since && mode === "incremental") {
    const lastCompleted = await prisma.voiceDatasetExportJob.findFirst({
      where: { status: "completed", until: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { until: true },
    });
    const window = resolveIncrementalDatasetWindow({
      lastCompletedUntil: lastCompleted?.until ?? null,
      now: params.until ?? new Date(),
    });
    since = window.since;
  }

  return prisma.voiceDatasetExportJob.create({
    data: {
      requestedBy: params.requestedBy,
      mode,
      status: "pending",
      since,
      until: params.until ?? new Date(),
      limit,
      filtersJson: {
        includeTestCalls: Boolean(params.includeTestCalls),
      },
    },
  });
}

export async function runDatasetJob(jobId: string) {
  const job = await prisma.voiceDatasetExportJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return { ok: false, status: 404, error: "Dataset job not found" };
  }

  if (job.status === "running") {
    return { ok: false, status: 409, error: "Dataset job already running" };
  }

  await prisma.voiceDatasetExportJob.update({
    where: { id: job.id },
    data: { status: "running", startedAt: new Date(), error: null },
  });

  try {
    const includeTestCalls = Boolean((job.filtersJson as any)?.includeTestCalls);
    const dataset = await exportMaskedRetellDataset({
      from: job.since ?? undefined,
      to: job.until ?? undefined,
      limit: job.limit,
      includeTestCalls,
    });

    const qualityRows = dataset.rows.filter((row) => {
      const hasTranscript = row.transcript.length >= 2;
      const hasOutcome = Boolean(row.outcome);
      return hasTranscript && hasOutcome;
    });

    const completed = await prisma.voiceDatasetExportJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        rowCount: qualityRows.length,
        completedAt: new Date(),
        outputJson: {
          ...dataset,
          totals: {
            ...dataset.totals,
            qualityRows: qualityRows.length,
          },
          rows: qualityRows,
        },
      },
    });

    return { ok: true, status: 200, job: completed };
  } catch (error: any) {
    const failed = await prisma.voiceDatasetExportJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: String(error?.message ?? "Unknown dataset job error").slice(0, 1500),
      },
    });
    return { ok: false, status: 500, error: failed.error ?? "Dataset job failed" };
  }
}
