/**
 * Admin: manually trigger Google Ads campaign-draft backfill for existing locksmiths.
 *
 * POST /api/admin/google-ads/auto-draft-backfill
 *   body: { limit?: number; dryRun?: boolean }
 *
 * Requires admin cookie auth (same as all /api/admin/* routes).
 *
 * Use this to:
 *   - Preview what would be created (dryRun: true)
 *   - One-click backfill for all locksmiths onboarded before auto-draft existed
 *   - Re-run after changing the draft generation logic
 *
 * The nightly cron at /api/cron/auto-draft-existing-locksmiths handles ongoing
 * backfill automatically; this endpoint is for ad-hoc admin control.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { backfillExistingLocksmithDrafts } from "@/lib/google-ads-auto-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function adminAuth(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token");
  if (!token) return false;
  const payload = await verifyToken(token.value);
  return payload?.type === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await adminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { limit?: number; dryRun?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const limit  = Math.min(Math.max(1, Number(body.limit ?? 20)), 100);
  const dryRun = body.dryRun === true;

  console.log(`[AdminAutoDraftBackfill] Starting — limit: ${limit}, dryRun: ${dryRun}`);

  try {
    const result = await backfillExistingLocksmithDrafts(limit, dryRun);

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        processed: result.processed,
        created:   result.created,
        skipped:   result.skipped,
        errors:    result.errors,
      },
      results: result.results,
    });
  } catch (err) {
    console.error("[AdminAutoDraftBackfill] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** GET: preview (dry-run) with default limit */
export async function GET(request: NextRequest) {
  if (!(await adminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit  = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
  const dryRun = searchParams.get("dryRun") !== "false"; // default: dry-run for safety

  console.log(`[AdminAutoDraftBackfill] Preview — limit: ${limit}, dryRun: ${dryRun}`);

  try {
    const result = await backfillExistingLocksmithDrafts(limit, dryRun);

    return NextResponse.json({
      success: true,
      dryRun,
      note: dryRun
        ? "This is a dry-run preview. POST with { dryRun: false } to create drafts."
        : "Live run completed.",
      summary: {
        processed: result.processed,
        created:   result.created,
        skipped:   result.skipped,
        errors:    result.errors,
      },
      results: result.results,
    });
  } catch (err) {
    console.error("[AdminAutoDraftBackfill] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
