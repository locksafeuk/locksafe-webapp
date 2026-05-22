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
import { syncAllGoogleAdsAccounts } from "@/lib/google-ads-sync";
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

  // ---- Google Ads performance sync (merged from sync-google-ads-performance) ----
  let syncResult: { accountsProcessed?: number; snapshotsWritten?: number; error?: string } = {};
  try {
    const sync = await syncAllGoogleAdsAccounts({});
    syncResult = { accountsProcessed: sync.accountsProcessed, snapshotsWritten: sync.snapshotsWritten };
    console.log(`[cmo-autonomous] Google Ads sync: ${sync.accountsProcessed} accounts, ${sync.snapshotsWritten} snapshots`);
  } catch (err) {
    syncResult = { error: err instanceof Error ? err.message : String(err) };
    console.error("[cmo-autonomous] Google Ads sync failed:", syncResult.error);
  }

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
        copilotMode?: boolean;
        mutationsAllowed?: boolean;
        negatives: { added: number; candidatesFound: number };
        paused: { actuallyPaused: number; candidatesFound: number };
        policy?: { pauseRoasThreshold?: number; pauseGraceDays?: number };
      };
      if (googlePolicy.notifyOnAutoAction) {
        const copilot = data.copilotMode === true || data.mutationsAllowed === false;
        const negAdded = data.negatives.added;
        const negCands = data.negatives.candidatesFound;
        const pausedNow = data.paused.actuallyPaused;
        const pauseCands = data.paused.candidatesFound;
        const roasRule = data.policy?.pauseRoasThreshold ?? "?";
        const graceDays = data.policy?.pauseGraceDays ?? "?";

        if (copilot && (negCands > 0 || pauseCands > 0)) {
          // Suggestion-only: no mutations fired. Tell the human what we'd do.
          await sendAdminAlert({
            title: "CMO copilot suggestions (Google Ads)",
            message:
              `Copilot mode — no automatic changes were made.\n` +
              `• ${negCands} wasteful search terms could be added as negatives\n` +
              `• ${pauseCands} campaigns matched the legacy pause rule (ROAS < ${roasRule} over ${graceDays}d)\n` +
              `Review and approve at /admin/agents/campaign-copilot (queue arrives in Phase 2).`,
            severity: "info",
          });
        } else if (!copilot && (negAdded > 0 || pausedNow > 0)) {
          // Real mutations fired — deterministic, no LLM paraphrasing.
          await sendAdminAlert({
            title: "CMO auto-optimised Google Ads",
            message:
              `Added ${negAdded} negative keyword(s). ` +
              `Paused ${pausedNow} campaign(s) under ROAS < ${roasRule} over ${graceDays}d.`,
            severity: "info",
          });
        }
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
    sync: syncResult,
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
