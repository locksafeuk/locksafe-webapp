import { NextRequest, NextResponse } from "next/server";
import { monitorGoogleAdsClickFraud } from "@/lib/google-ads-fraud-monitor";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { since?: string; until?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine
  }

  try {
    const summary = await monitorGoogleAdsClickFraud(body);
    return NextResponse.json({
      success: summary.ok,
      durationMs: Date.now() - startTime,
      ...summary,
    });
  } catch (error) {
    console.error("[Cron] google-ads-fraud-monitor failed", error);
    return NextResponse.json(
      {
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    endpoint: "POST /api/cron/google-ads-fraud-monitor",
  });
}
