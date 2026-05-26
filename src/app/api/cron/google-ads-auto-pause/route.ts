/**
 * Google Ads Auto-Pause Cron — the anti-rip-off circuit breaker.
 *
 * Runs daily at 06:00 UTC. For every active Google Ads campaign linked to
 * a LockSafe AdCampaign row, compute over the rolling last 7 days:
 *
 *   spend           = sum of AdPerformanceSnapshot.spend
 *   bookings        = count of Job rows with matching utm_campaign
 *   completedJobs   = count of those Jobs with status=COMPLETED + paid
 *   actualRevenue   = sum of quote totals on completed jobs
 *   costPerBooked   = spend / bookings
 *   costPerComplete = spend / completedJobs
 *
 * Auto-pause rule (tunable via env):
 *
 *   • spend >= MIN_SPEND_GBP (default £30) AND
 *   • either (costPerComplete > MAX_COST_PER_COMPLETE GBP)        [default £25]
 *           or (completedJobs == 0 AND bookings >= MIN_BOOKINGS_NO_COMPLETION)  [default 3]
 *
 * The thresholds catch two failure modes:
 *   1. Campaign is producing jobs but they cost too much → known bad ROI
 *   2. Campaign is producing form-fills / leads that never close → vanity
 *      conversions, the classic Google rip-off pattern
 *
 * Below MIN_SPEND we don't pause (not enough signal yet — let it warm up).
 *
 * On pause:
 *   • Update local AdCampaign.status = "PAUSED"
 *   • Call Google Ads API to actually pause the remote campaign (so spend stops)
 *   • Post a Telegram alert to ops with the kill reason and numbers
 *
 * Schedule:
 *   Cron: 0 6 * * *
 *   Authorisation: `Authorization: Bearer $CRON_SECRET`
 *
 * Dry-run mode: pass `?dryRun=1` to evaluate without pausing or alerting.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma as _prisma } from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Tunables (env-overridable) ──────────────────────────────────────────────

const MIN_SPEND_GBP                 = Number(process.env.AUTO_PAUSE_MIN_SPEND_GBP                 ?? "30");
const MAX_COST_PER_COMPLETE_GBP     = Number(process.env.AUTO_PAUSE_MAX_COST_PER_COMPLETE_GBP     ?? "25");
const MIN_BOOKINGS_NO_COMPLETION    = Number(process.env.AUTO_PAUSE_MIN_BOOKINGS_NO_COMPLETION    ?? "3");
const ROLLING_DAYS                  = Number(process.env.AUTO_PAUSE_ROLLING_DAYS                  ?? "7");

// ── Per-campaign evaluation ─────────────────────────────────────────────────

interface CampaignVerdict {
  campaignId:        string;
  campaignName:      string;
  utmCampaign:       string | null;
  spend:             number;
  bookings:          number;
  completedJobs:     number;
  actualRevenue:     number;
  costPerBooked:     number | null;
  costPerCompleted:  number | null;
  shouldPause:       boolean;
  pauseReason:       string | null;
}

async function evaluateCampaign(
  campaign: {
    id:               string;
    name:             string;
    status:           string;
    googleCampaignId: string | null;
  },
  since: Date,
): Promise<CampaignVerdict> {
  // 1) Spend — sum AdPerformanceSnapshot for this Google Ads campaign.
  // AdPerformanceSnapshot uses platform="google" + googleCampaignId (string)
  // as the join key for Google rows (vs adCampaignId ObjectId for Meta).
  const snapshots = campaign.googleCampaignId
    ? await prisma.adPerformanceSnapshot.findMany({
        where: {
          platform:         "google",
          googleCampaignId: campaign.googleCampaignId,
          date:             { gte: since },
        },
        select: { spend: true },
      })
    : [];
  const spend = snapshots.reduce(
    (s: number, r: { spend: number | null }) => s + (r.spend ?? 0),
    0,
  );

  // 2) Bookings + completed — match by utm_campaign equal to local campaign name.
  // We use a normalised lowercase match (matches the convention in google-ads-publish.ts
  // and meta-marketing.ts which both build utm_campaign from the campaign name).
  const utmKey = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const jobs = await prisma.job.findMany({
    where:  { utmCampaign: utmKey, createdAt: { gte: since } },
    select: { id: true, status: true, assessmentPaid: true, quote: { select: { totalAmount: true, status: true } } },
  });

  const bookings = jobs.length;
  const completedJobs = jobs.filter(
    (j: { status: string; assessmentPaid: boolean }) =>
      j.status === "COMPLETED" && j.assessmentPaid,
  );
  const actualRevenue = completedJobs.reduce(
    (s: number, j: { quote: { totalAmount: number | null } | null }) =>
      s + (j.quote?.totalAmount ?? 0),
    0,
  );

  const costPerBooked     = bookings > 0           ? spend / bookings           : null;
  const costPerCompleted  = completedJobs.length > 0 ? spend / completedJobs.length : null;

  // 3) Decide
  let shouldPause = false;
  let pauseReason: string | null = null;

  if (spend < MIN_SPEND_GBP) {
    // not enough data — let it warm up
  } else if (costPerCompleted !== null && costPerCompleted > MAX_COST_PER_COMPLETE_GBP) {
    shouldPause = true;
    pauseReason =
      `cost-per-completed-job £${costPerCompleted.toFixed(2)} ` +
      `exceeds threshold £${MAX_COST_PER_COMPLETE_GBP} ` +
      `(spend £${spend.toFixed(2)} / ${completedJobs.length} completed over ${ROLLING_DAYS}d)`;
  } else if (completedJobs.length === 0 && bookings >= MIN_BOOKINGS_NO_COMPLETION) {
    shouldPause = true;
    pauseReason =
      `${bookings} bookings produced but 0 completed jobs ` +
      `(£${spend.toFixed(2)} spent over ${ROLLING_DAYS}d) — looks like ` +
      `vanity conversions, classic Google rip-off pattern`;
  }

  return {
    campaignId:       campaign.id,
    campaignName:     campaign.name,
    utmCampaign:      utmKey,
    spend,
    bookings,
    completedJobs:    completedJobs.length,
    actualRevenue,
    costPerBooked,
    costPerCompleted,
    shouldPause,
    pauseReason,
  };
}

// ── Pause the remote campaign on Google Ads ─────────────────────────────────

async function pauseRemoteCampaign(
  googleAdsCampaignId: string,
  customerId:          string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const c = await getDefaultGoogleAdsClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = c as any;
    await client.mutate(
      `customers/${customerId}/campaigns:mutate`,
      "POST",
      {
        operations: [{
          update: {
            resourceName: `customers/${customerId}/campaigns/${googleAdsCampaignId}`,
            status: "PAUSED",
          },
          updateMask: "status",
        }],
      },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Cron entrypoint ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const since = new Date(Date.now() - ROLLING_DAYS * 24 * 60 * 60 * 1000);

  // Active Google Ads campaigns we have a remote handle on.
  // GoogleAdsCampaignDraft is the canonical model for Google Ads
  // (AdCampaign only carries Meta-side fields). status="PUBLISHED" is
  // the equivalent of "active in production" for that table.
  const campaigns = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      status:           "PUBLISHED",
      googleCampaignId: { not: null },
    },
    select: {
      id:                true,
      name:              true,
      status:            true,
      googleCampaignId:  true,
      account:           { select: { customerId: true } },
    },
  });

  const verdicts: CampaignVerdict[] = [];
  const pauses:   Array<CampaignVerdict & { pauseResult?: { ok: boolean; error?: string } }> = [];

  for (const campaign of campaigns) {
    const verdict = await evaluateCampaign(campaign, since);
    verdicts.push(verdict);

    if (verdict.shouldPause) {
      if (dryRun) {
        pauses.push(verdict);
        continue;
      }
      // 1. Update local row (GoogleAdsCampaignDraft uses "PAUSED" as a valid
      //    status in its lifecycle: DRAFT|PENDING_APPROVAL|APPROVED|...|PUBLISHED|PAUSED|FAILED).
      await prisma.googleAdsCampaignDraft.update({
        where: { id: campaign.id },
        data:  { status: "PAUSED" },
      });
      // 2. Pause remote on Google Ads (if account info present).
      // customerId is the dash-stripped Google Ads account ID (e.g. "1234567890"),
      // which is what the Ads API requires in the resource path.
      let pauseResult: { ok: boolean; error?: string } | undefined;
      if (campaign.googleCampaignId && campaign.account?.customerId) {
        pauseResult = await pauseRemoteCampaign(
          campaign.googleCampaignId,
          campaign.account.customerId,
        );
      }
      pauses.push({ ...verdict, pauseResult });

      // 3. Notify ops
      const messageBody =
        `Campaign: \`${verdict.campaignName}\`\n` +
        `Reason: ${verdict.pauseReason}\n\n` +
        `Spend (${ROLLING_DAYS}d): £${verdict.spend.toFixed(2)}\n` +
        `Bookings: ${verdict.bookings}\n` +
        `Completed jobs: ${verdict.completedJobs}\n` +
        `Revenue: £${verdict.actualRevenue.toFixed(2)}\n` +
        (verdict.costPerCompleted !== null
          ? `Cost per completed job: £${verdict.costPerCompleted.toFixed(2)}\n`
          : "") +
        (pauseResult && !pauseResult.ok
          ? `\n⚠️ Google Ads API pause FAILED: ${pauseResult.error}\nManual pause needed in Google Ads UI.`
          : "");
      await sendAdminAlert({
        title:    `🚨 Auto-paused Google Ads campaign: ${verdict.campaignName}`,
        message:  messageBody,
        severity: "warning",
        dedupeKey: `auto-pause:${verdict.campaignId}`,
      }).catch((err) =>
        console.error("[auto-pause] Telegram alert failed:", err),
      );
    }
  }

  return NextResponse.json({
    success:   true,
    dryRun,
    evaluated: verdicts.length,
    paused:    pauses.length,
    verdicts,
    pauses,
    thresholds: {
      MIN_SPEND_GBP,
      MAX_COST_PER_COMPLETE_GBP,
      MIN_BOOKINGS_NO_COMPLETION,
      ROLLING_DAYS,
    },
  });
}
