import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import {
  createDatasetJob,
  runDatasetJob,
  shouldRunIncrementalDataset,
} from "@/lib/retell-dataset-jobs";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lastCompleted = await prisma.voiceDatasetExportJob.findFirst({
      where: { status: "completed", until: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { until: true },
    });

    const now = new Date();
    if (!shouldRunIncrementalDataset({ lastCompletedUntil: lastCompleted?.until ?? null, now })) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "recent_completion",
        lastCompletedUntil: lastCompleted?.until ?? null,
      });
    }

    const job = await createDatasetJob({
      requestedBy: "cron",
      mode: "incremental",
      limit: 1000,
      includeTestCalls: false,
      until: now,
    });

    const result = await runDatasetJob(job.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, jobId: job.id }, { status: result.status });
    }

    return NextResponse.json({ success: true, job: result.job });
  } catch (error: any) {
    console.error("[CRON] voice-dataset-incremental failed:", error);
    return NextResponse.json(
      { error: String(error?.message ?? "voice-dataset-incremental failed") },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
