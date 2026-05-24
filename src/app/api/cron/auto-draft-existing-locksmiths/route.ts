import { NextRequest, NextResponse } from "next/server";
import { backfillExistingLocksmithDrafts } from "@/lib/google-ads-auto-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes — LLM draft generation can be slow for many locksmiths
export const maxDuration = 300;

/**
 * Nightly cron: auto-create Google Ads campaign drafts for every active
 * locksmith who doesn't already have one (within the 90-day dedup window).
 *
 * Auth: Authorization: Bearer $CRON_SECRET  OR  ?secret=CRON_SECRET
 * Schedule: 03:00 UTC daily (see vercel.json)
 *
 * Query params:
 *   limit   Max locksmiths to process per run (default: 15, max: 50)
 *   dryRun  Set to "true" to preview without DB writes
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
  const authHeader = request.headers.get("authorization") ?? "";
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
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limitParam = parseInt(searchParams.get("limit") ?? "15", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 15 : limitParam), 50);
  const dryRun = searchParams.get("dryRun") === "true";

  console.log(`[AutoDraftCron] Starting — limit: ${limit}, dryRun: ${dryRun}`);

  try {
    const result = await backfillExistingLocksmithDrafts(limit, dryRun);

    console.log(
      `[AutoDraftCron] Done — processed: ${result.processed}, created: ${result.created}, ` +
      `skipped: ${result.skipped}, errors: ${result.errors}`,
    );

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        processed: result.processed,
        created:   result.created,
        skipped:   result.skipped,
        errors:    result.errors,
      },
      results: result.results.map((r) => ({
        locksmithId:    r.locksmithId,
        locksmithName:  r.locksmithName,
        success:        r.success,
        skipped:        r.skipped ?? false,
        skipReason:     r.skipReason,
        draftId:        r.draftId,
        draftName:      r.draftName,
        status:         r.status,
        cityLabel:      r.cityLabel,
        outwardPostcode: r.outwardPostcode,
        confidence:     r.confidence,
        error:          r.error,
      })),
    });
  } catch (err) {
    console.error("[AutoDraftCron] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export const GET  = handle;
export const POST = handle;
