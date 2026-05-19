export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDatasetJob, runDatasetJob } from "@/lib/retell-dataset-jobs";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await prisma.voiceDatasetExportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        mode: true,
        since: true,
        until: true,
        rowCount: true,
        error: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    console.error("[API] Error listing dataset jobs:", error);
    return NextResponse.json({ error: "Failed to list dataset jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const mode = body?.mode === "full" ? "full" : "incremental";
    const limit = typeof body?.limit === "number" ? body.limit : 500;
    const runNow = body?.runNow !== false;

    const job = await createDatasetJob({
      requestedBy: admin.email || "admin",
      mode,
      limit,
      includeTestCalls: Boolean(body?.includeTestCalls),
      since: body?.since ? new Date(body.since) : undefined,
      until: body?.until ? new Date(body.until) : undefined,
    });

    if (!runNow) {
      return NextResponse.json({ success: true, job });
    }

    const result = await runDatasetJob(job.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, job: result.job });
  } catch (error: any) {
    console.error("[API] Error creating/running dataset job:", error);
    return NextResponse.json({ error: "Failed to create dataset job" }, { status: 500 });
  }
}
