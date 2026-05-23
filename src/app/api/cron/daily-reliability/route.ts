import { NextRequest, NextResponse } from "next/server";
import { runDailyReliabilityChecks } from "@/lib/reliability/daily";
import { sendAdminAlert } from "@/lib/telegram";

import { verifyCronAuth } from "@/lib/cron-auth";

function summarizeIssues(report: Awaited<ReturnType<typeof runDailyReliabilityChecks>>): string[] {
  const failed = report.results.filter((r) => r.status === "FAIL");
  const warned = report.results.filter((r) => r.status === "WARN");
  const lines: string[] = [];

  if (failed.length === 0 && warned.length === 0) {
    lines.push("No warnings or failures.");
    return lines;
  }

  for (const check of failed.slice(0, 5)) {
    lines.push(`FAIL: ${check.name} (${check.details})`);
  }

  for (const check of warned.slice(0, 5)) {
    lines.push(`WARN: ${check.name} (${check.details})`);
  }

  return lines;
}

async function handle(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk").replace(/\/$/, "");

  try {
    const report = await runDailyReliabilityChecks({ baseUrl });
    const issueLines = summarizeIssues(report);

    await sendAdminAlert({
      title: `Daily Reliability ${report.score.overall} (${report.score.score}/100)`,
      severity: report.score.overall === "RED" ? "error" : report.score.overall === "AMBER" ? "warning" : "info",
      message: [
        `PASS=${report.score.pass} WARN=${report.score.warn} FAIL=${report.score.fail}`,
        `Base URL: ${report.baseUrl}`,
        "",
        ...issueLines,
      ].join("\n"),
    });

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - start,
      report,
    });
  } catch (error) {
    console.error("[cron/daily-reliability] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
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
