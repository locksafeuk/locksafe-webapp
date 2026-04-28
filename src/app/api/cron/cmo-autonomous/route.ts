/**
 * CMO autonomous optimisation cron.
 *
 * Schedule: every 6 hours.
 *
 * Calls the optimiseGoogleCampaigns tool to scan for waste (negative-keyword
 * candidates) and pause persistently-underperforming campaigns. The tool
 * itself short-circuits if MarketingPolicy.autonomyEnabled is false, so this
 * cron is safe to leave running while autonomy is off — it will simply no-op.
 *
 * Auth:
 *   - x-vercel-cron header, OR
 *   - Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { optimiseGoogleCampaignsTool } from "@/agents/tools/marketing";
import { sendAdminAlert } from "@/lib/telegram";
import { getEffectivePolicy } from "@/lib/spend-guard";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

export async function POST(request: NextRequest) {
  return handle(request);
}
export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");
  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await getEffectivePolicy("google");
  if (!policy.autonomyEnabled) {
    return NextResponse.json({ ok: true, skipped: "autonomy disabled" });
  }

  const result = await optimiseGoogleCampaignsTool.execute(
    { lookbackDays: 14, dryRun: false },
    {
      agentName: "cmo",
      agentId: "cron:cmo-autonomous",
      permissions: ["cmo", "ads-specialist"],
      budgetRemaining: 0,
    },
  );

  if (!result.success) {
    console.error("[cron:cmo-autonomous] failed:", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const data = result.data as {
    negatives: { added: number };
    paused: { actuallyPaused: number };
  };

  if (policy.notifyOnAutoAction && (data.negatives.added > 0 || data.paused.actuallyPaused > 0)) {
    await sendAdminAlert({
      title: "CMO auto-optimised Google Ads",
      message: `Added ${data.negatives.added} negative keywords. Paused ${data.paused.actuallyPaused} underperforming campaigns.`,
      severity: "info",
    });
  }

  return NextResponse.json({ ok: true, result: result.data });
}
