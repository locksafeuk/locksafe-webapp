/**
 * Phase 0 amnesty.
 *
 * Resumes any Google Ads campaign that the CMO agent paused in the last
 * AMNESTY_WINDOW_HOURS. This is the rollback for the over-aggressive
 * auto-pause behaviour that motivated the campaign-copilot rewrite.
 *
 * For every paused draft within the window we:
 *   1. Flip the live Google Ads campaign back to ENABLED via the API.
 *   2. Reset GoogleAdsCampaignDraft.status to PUBLISHED, clear pausedAt.
 *   3. Append an AgentDecision row with outcome="reverted-by-human-policy"
 *      so the reflection loop can grade the original pause as a LOSS.
 *
 * Idempotent: re-running the script will only touch campaigns currently
 * paused and recently paused. Anything outside the window is left alone.
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/amnesty-recent-pauses.ts
 *
 * Add --dry-run to preview without touching Google Ads or the database.
 */
import prisma from "@/lib/db";
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const AMNESTY_WINDOW_HOURS = Number(process.env.AMNESTY_WINDOW_HOURS ?? "72");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cutoff = new Date(Date.now() - AMNESTY_WINDOW_HOURS * 60 * 60 * 1000);

  console.log(
    `[amnesty] window=${AMNESTY_WINDOW_HOURS}h, cutoff=${cutoff.toISOString()}, dryRun=${dryRun}`,
  );

  const candidates = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status: "PAUSED",
      pausedAt: { gte: cutoff },
      googleCampaignId: { not: null },
    },
    select: {
      id: true,
      googleCampaignId: true,
      name: true,
      pausedAt: true,
    },
  });

  console.log(`[amnesty] found ${candidates.length} recently-paused campaign(s)`);
  for (const c of candidates) {
    console.log(
      `  - ${c.name} (gcid=${c.googleCampaignId}, pausedAt=${c.pausedAt?.toISOString()})`,
    );
  }

  if (candidates.length === 0 || dryRun) {
    console.log(dryRun ? "[amnesty] dry-run, exiting" : "[amnesty] nothing to do");
    return;
  }

  const handle = await getDefaultGoogleAdsClient();
  if (!handle) {
    console.error("[amnesty] no Google Ads client available — aborting");
    process.exit(1);
  }

  let resumed = 0;
  let failed = 0;
  for (const c of candidates) {
    if (!c.googleCampaignId) continue;
    const resourceName = buildResourceName(
      handle.customerId,
      "campaigns",
      c.googleCampaignId,
    );
    try {
      await handle.client.mutate("campaigns", [
        {
          update: { resourceName, status: "ENABLED" },
          updateMask: "status",
        },
      ]);
      await prisma.googleAdsCampaignDraft.update({
        where: { id: c.id },
        data: { status: "PUBLISHED", pausedAt: null },
      });
      await prisma.agentDecision.create({
        data: {
          agent: "cmo",
          platform: "google",
          action: "resumeCampaign",
          payload: {
            googleCampaignId: c.googleCampaignId,
            name: c.name,
            previousPausedAt: c.pausedAt?.toISOString() ?? null,
            reason: "amnesty: copilot-mode rollout reverted automated pause",
          },
          policySnapshot: { window: `${AMNESTY_WINDOW_HOURS}h` },
          dryRun: false,
          outcome: "reverted-by-human-policy",
        },
      });
      resumed += 1;
      console.log(`[amnesty] resumed ${c.name} (${c.googleCampaignId})`);
    } catch (err) {
      failed += 1;
      console.error(
        `[amnesty] FAILED to resume ${c.name} (${c.googleCampaignId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[amnesty] done — resumed=${resumed}, failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[amnesty] fatal:", err);
    process.exit(1);
  });
