import { NextRequest, NextResponse } from "next/server";
import { collectHoldingMetrics } from "@/lib/holding/metrics";
import { sendHoldingMetrics } from "@/lib/holding/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * External cron endpoint (cron-job.org) that collects aggregated
 * platform metrics and forwards them to the Holding Dashboard.
 *
 * Auth (any one of):
 *   - Query string: ?secret=CRON_SECRET
 *   - Header:       x-cron-secret: CRON_SECRET
 *   - Header:       Authorization: Bearer CRON_SECRET
 *
 * Schedule recommendation: daily at 02:00 UTC.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const querySecret = request.nextUrl.searchParams.get("secret");
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization") || "";
  const bearerSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  const candidates = [querySecret, headerSecret, bearerSecret].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  return candidates.some((c) => timingSafeEqual(c, cronSecret));
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const platformId = process.env.HOLDING_PLATFORM_ID || "locksafeuk";
  const sentAt = new Date().toISOString();

  try {
    const snapshot = await collectHoldingMetrics();
    const result = await sendHoldingMetrics(snapshot);

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        platform_id: platformId,
        sent_at: sentAt,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          platform_id: platformId,
          error: "Failed to send metrics to Holding Dashboard",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      platform_id: platformId,
      sent_at: sentAt,
    });
  } catch (err) {
    console.error(
      "[send-holding-metrics] unexpected error:",
      (err as Error)?.message,
    );
    return NextResponse.json(
      {
        success: false,
        platform_id: platformId,
        error: "Internal error while sending metrics",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
