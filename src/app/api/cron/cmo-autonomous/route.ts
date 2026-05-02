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
import { optimiseMetaCampaigns } from "@/lib/meta-optimiser";
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

  const url = new URL(request.url);
  const forceDryRun = url.searchParams.get("dryRun") === "true";

  // ---- Google branch ----
  const googlePolicy = await getEffectivePolicy("google");
  let googleResult: unknown = { skipped: "autonomy disabled" };
  if (googlePolicy.autonomyEnabled) {
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
      console.error("[cron:cmo-autonomous] google failed:", result.error);
    } else {
      googleResult = result.data;
      const data = result.data as {
        negatives: { added: number };
        paused: { actuallyPaused: number };
      };
      if (
        googlePolicy.notifyOnAutoAction &&
        (data.negatives.added > 0 || data.paused.actuallyPaused > 0)
      ) {
        await sendAdminAlert({
          title: "CMO auto-optimised Google Ads",
          message: `Added ${data.negatives.added} negative keywords. Paused ${data.paused.actuallyPaused} underperforming campaigns.`,
          severity: "info",
        });
      }
    }
  }

  // ---- Meta branch ----
  // Always runs in dry-run mode when autonomy is off, so we still surface
  // proposed actions via Telegram digest for human review.
  const metaPolicy = await getEffectivePolicy("meta");
  const metaResult = await optimiseMetaCampaigns({
    lookbackDays: 7,
    dryRun: forceDryRun || !metaPolicy.autonomyEnabled,
  });

  if (
    metaPolicy.notifyOnAutoAction &&
    metaResult.decisions.length > 0
  ) {
    const proposed = metaResult.decisions.length;
    const lines = metaResult.decisions
      .slice(0, 8)
      .map((d) => `• ${d.action} ${d.targetType} ${d.targetId.slice(-6)} — ${d.reason}`)
      .join("\n");
    await sendAdminAlert({
      title: metaResult.dryRun
        ? `CMO Meta digest (dry-run): ${proposed} proposed actions`
        : `CMO auto-optimised Meta Ads: ${metaResult.executed} executed, ${metaResult.blocked} blocked`,
      message: lines || "(no decisions)",
      severity: metaResult.errors > 0 ? "warning" : "info",
    });
  }

  return NextResponse.json({
    ok: true,
    google: googleResult,
    meta: {
      dryRun: metaResult.dryRun,
      proposed: metaResult.decisions.length,
      executed: metaResult.executed,
      blocked: metaResult.blocked,
      errors: metaResult.errors,
    },
  });
}
