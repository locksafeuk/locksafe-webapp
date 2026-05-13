import { NextRequest, NextResponse } from "next/server";
import { syncAllLocksmithTiers } from "@/lib/commission-tiers";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

/**
 * Sync Commission Tiers Cron — runs daily at 2AM UTC.
 *
 * Evaluates all active+onboarded locksmiths against the 3 tier triggers
 * and updates their commissionTier / commissionRate in the DB if needed.
 * Locksmiths with commissionOverride=true are skipped.
 *
 * Schedule: "0 2 * * *"  (2AM UTC daily)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[sync-commission-tiers] Starting daily tier sync...");
    const { checked, updated } = await syncAllLocksmithTiers();
    console.log(`[sync-commission-tiers] Done. Checked: ${checked}, Updated: ${updated}`);

    return NextResponse.json({
      success: true,
      checked,
      updated,
    });
  } catch (err) {
    console.error("[sync-commission-tiers] Cron error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
