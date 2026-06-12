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
import { getGoogleAdsClientForAccount } from "@/lib/google-ads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Tunables (env-overridable) ──────────────────────────────────────────────

const MIN_SPEND_GBP                 = Number(process.env["AUTO_PAUSE_MIN_SPEND_GBP"]                 ?? "30");
const MAX_COST_PER_COMPLETE_GBP     = Number(process.env["AUTO_PAUSE_MAX_COST_PER_COMPLETE_GBP"]     ?? "25");
const MIN_BOOKINGS_NO_COMPLETION    = Number(process.env["AUTO_PAUSE_MIN_BOOKINGS_NO_COMPLETION"]    ?? "3");
const ROLLING_DAYS                  = Number(process.env["AUTO_PAUSE_ROLLING_DAYS"]                  ?? "7");

// ── Safety guards added 2026-05-26 ──────────────────────────────────────────
// Three campaigns died this week because auto-pause fired during a routing
// outage: ads → 404 landing → vanity conversions → cron pauses → Google's
// recommendation engine then removed the paused campaigns. The fixes:
//   1. WARMUP: don't auto-pause campaigns younger than this. Give them
//      time to learn before judging them.
//   2. MIN_IMPRESSIONS: £30 spend with 5 impressions is statistical noise.
//      Require a real audience denominator before any decision.
//   3. Landing-page health check: if the campaign's finalUrl is currently
//      returning non-200, the spend/conversion ratio is the website's
//      fault, not the campaign's — don't pause, alert separately.
const WARMUP_DAYS                   = Number(process.env["AUTO_PAUSE_WARMUP_DAYS"]                   ?? "14");
const MIN_IMPRESSIONS               = Number(process.env["AUTO_PAUSE_MIN_IMPRESSIONS"]               ?? "200");
const LANDING_HEALTH_TIMEOUT_MS     = Number(process.env["AUTO_PAUSE_LANDING_HEALTH_TIMEOUT_MS"]     ?? "5000");

// ── Dead-spend guards added 2026-06-12 ──────────────────────────────────────
// The original two pause rules (cost-per-completed too high, OR ≥N bookings
// with 0 completions) BOTH require the campaign to produce *something*. A
// campaign that spends real money with real reach but generates ZERO bookings
// and ZERO completed jobs matched neither rule and could burn budget forever —
// it's the pure-waste / "drain the budget" failure mode. These two thresholds
// close that hole:
//   • HARD_DEADSPEND_GBP — pause even during warmup once dead spend crosses
//     this. No amount of "learning" justifies this much spend with zero leads;
//     that's a dead campaign, not a cold start.
//   • Post-warmup, ANY zero-lead campaign past MIN_SPEND/MIN_IMPRESSIONS with a
//     healthy landing page is paused (handled inline in the decision chain).
const HARD_DEADSPEND_GBP            = Number(process.env["AUTO_PAUSE_HARD_DEADSPEND_GBP"]            ?? "120");

// ── Per-campaign evaluation ─────────────────────────────────────────────────

interface CampaignVerdict {
  campaignId:           string;
  campaignName:         string;
  utmCampaign:          string | null;
  spend:                number;
  impressions:          number;
  bookings:             number;
  completedJobs:        number;
  actualRevenue:        number;
  costPerBooked:        number | null;
  costPerCompleted:     number | null;
  daysSincePublished:   number | null;
  landingHealth:        "ok" | "broken" | "skipped" | "unknown";
  landingStatusCode:    number | null;
  shouldPause:          boolean;
  pauseReason:          string | null;
  skipReason:           string | null;   // why we did NOT pause despite suspicious signals
}

// Health-check a campaign's finalUrl. We do a HEAD request with a short
// timeout; if the page is broken (4xx/5xx), the campaign isn't to blame
// for any "vanity conversion" pattern — the website is. Failures + DNS
// errors return "broken" so we err on the side of NOT pausing during
// site outages.
async function checkLandingHealth(finalUrl: string | null): Promise<{
  status: "ok" | "broken" | "skipped" | "unknown";
  code:   number | null;
}> {
  if (!finalUrl) return { status: "skipped", code: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LANDING_HEALTH_TIMEOUT_MS);
    const res = await fetch(finalUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      // Identify ourselves so site analytics don't count these
      headers: { "user-agent": "Locksafe-AutoPause-HealthCheck/1.0" },
    });
    clearTimeout(timer);
    if (res.ok) return { status: "ok", code: res.status };
    return { status: "broken", code: res.status };
  } catch {
    return { status: "broken", code: null };
  }
}

async function evaluateCampaign(
  campaign: {
    id:               string;
    name:             string;
    status:           string;
    googleCampaignId: string | null;
    finalUrl:         string | null;
    publishedAt:      Date | null;
  },
  since: Date,
): Promise<CampaignVerdict> {
  // 1) Spend + impressions — sum AdPerformanceSnapshot for this campaign.
  // AdPerformanceSnapshot uses platform="google" + googleCampaignId (string)
  // as the join key for Google rows (vs adCampaignId ObjectId for Meta).
  const snapshots = campaign.googleCampaignId
    ? await prisma.adPerformanceSnapshot.findMany({
        where: {
          platform:         "google",
          googleCampaignId: campaign.googleCampaignId,
          date:             { gte: since },
        },
        select: { spend: true, impressions: true },
      })
    : [];
  const spend = snapshots.reduce(
    (s: number, r: { spend: number | null }) => s + (r.spend ?? 0),
    0,
  );
  const impressions = snapshots.reduce(
    (s: number, r: { impressions: number | null }) => s + (r.impressions ?? 0),
    0,
  );

  // 2) Bookings + completed — match by utm_campaign equal to local campaign name.
  // We use a normalised lowercase match (matches the convention in google-ads-publish.ts
  // and meta-marketing.ts which both build utm_campaign from the campaign name).
  const utmKey = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const jobs = await prisma.job.findMany({
    where:  { utmCampaign: utmKey, createdAt: { gte: since } },
    // Quote doesn't have a `status` field — its state is captured by
    // `accepted` (bool) + `acceptedAt`/`declinedAt`. We only need `total`
    // here to compute campaign revenue.
    select: { id: true, status: true, assessmentPaid: true, quote: { select: { total: true } } },
  });

  const bookings = jobs.length;
  const completedJobs = jobs.filter(
    (j: { status: string; assessmentPaid: boolean }) =>
      j.status === "COMPLETED" && j.assessmentPaid,
  );
  const actualRevenue = completedJobs.reduce(
    (s: number, j: { quote: { total: number | null } | null }) =>
      s + (j.quote?.total ?? 0),
    0,
  );

  const costPerBooked     = bookings > 0           ? spend / bookings           : null;
  const costPerCompleted  = completedJobs.length > 0 ? spend / completedJobs.length : null;

  // 3) Decide — with three new safety guards (added 2026-05-26).
  let shouldPause = false;
  let pauseReason: string | null = null;
  let skipReason:  string | null = null;

  const daysSincePublished = campaign.publishedAt
    ? Math.floor((Date.now() - campaign.publishedAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  // GUARD 1 — warmup grace period. New campaigns need time to learn.
  // Without this, a campaign published yesterday with bad-luck traffic
  // gets killed before it has any real signal.
  const inWarmup = daysSincePublished !== null && daysSincePublished < WARMUP_DAYS;

  // GUARD 2 — landing-page health. If the page is broken, spend → 404
  // → vanity conversions is an APP bug, not a campaign-quality bug.
  // We check BEFORE deciding so we can record the result either way.
  let landing: { status: "ok" | "broken" | "skipped" | "unknown"; code: number | null } =
    { status: "unknown", code: null };
  if (campaign.finalUrl) {
    landing = await checkLandingHealth(campaign.finalUrl);
  }

  // "Dead spend" = real reach + healthy page, but zero leads of ANY kind.
  // Distinguished from the vanity-conversion case (bookings that don't
  // complete): this campaign produces absolutely nothing.
  const hasRealReach = impressions >= MIN_IMPRESSIONS;
  const landingOk    = landing.status === "ok" || landing.status === "skipped";
  const zeroLeads    = bookings === 0 && completedJobs.length === 0;

  // Now the rules:
  if (hasRealReach && landingOk && zeroLeads && spend >= HARD_DEADSPEND_GBP) {
    // HARD DEAD-SPEND CAP — overrides warmup. £120+ spent with real reach, a
    // healthy landing page, and 0 bookings + 0 completed jobs is a dead
    // campaign draining budget, not a cold start that needs more learning time.
    shouldPause = true;
    pauseReason =
      `DEAD SPEND: £${spend.toFixed(2)} over ${ROLLING_DAYS}d with 0 bookings & 0 completed jobs ` +
      `(${impressions} impressions, landing ok) — hard cap £${HARD_DEADSPEND_GBP} hit, ` +
      `pausing even in warmup (${daysSincePublished ?? "?"}d old) to stop the budget drain`;
  } else if (inWarmup) {
    skipReason = `in warmup (${daysSincePublished}d old, threshold ${WARMUP_DAYS}d) — not evaluating yet`;
  } else if (spend < MIN_SPEND_GBP) {
    skipReason = `spend £${spend.toFixed(2)} below MIN_SPEND_GBP £${MIN_SPEND_GBP} — not enough data`;
  } else if (impressions < MIN_IMPRESSIONS) {
    // GUARD 3 — statistical-floor. £30 spent with 5 impressions means
    // bidding misfired; not a verdict on quality. Don't pause yet.
    skipReason = `${impressions} impressions below MIN_IMPRESSIONS ${MIN_IMPRESSIONS} — signal too thin`;
  } else if (landing.status === "broken") {
    // GUARD 4 — landing page is the culprit. Surface as a different
    // alert (handled by caller) but do NOT pause the campaign.
    skipReason = `landing page ${campaign.finalUrl} returned ${landing.code ?? "network-error"} — campaign not at fault, alert separately`;
  } else if (costPerCompleted !== null && costPerCompleted > MAX_COST_PER_COMPLETE_GBP) {
    shouldPause = true;
    pauseReason =
      `cost-per-completed-job £${costPerCompleted.toFixed(2)} ` +
      `exceeds threshold £${MAX_COST_PER_COMPLETE_GBP} ` +
      `(spend £${spend.toFixed(2)} / ${completedJobs.length} completed over ${ROLLING_DAYS}d, ${impressions} impressions)`;
  } else if (completedJobs.length === 0 && bookings >= MIN_BOOKINGS_NO_COMPLETION) {
    shouldPause = true;
    pauseReason =
      `${bookings} bookings produced but 0 completed jobs ` +
      `(£${spend.toFixed(2)} spent over ${ROLLING_DAYS}d, ${impressions} impressions) — looks like ` +
      `vanity conversions, classic Google rip-off pattern`;
  } else if (zeroLeads) {
    // BLIND-SPOT FIX (2026-06-12) — past warmup, real reach, healthy page, real
    // spend (all guaranteed by the else-if chain above), yet 0 bookings AND
    // 0 completed jobs. The original rules required ≥3 bookings or a completed
    // job to fire, so a produces-nothing campaign slipped through forever.
    shouldPause = true;
    pauseReason =
      `ZERO LEADS past warmup: £${spend.toFixed(2)} over ${ROLLING_DAYS}d, ${impressions} impressions, ` +
      `0 bookings & 0 completed jobs (${daysSincePublished ?? "?"}d old) — campaign produces nothing, pausing`;
  }

  return {
    campaignId:         campaign.id,
    campaignName:       campaign.name,
    utmCampaign:        utmKey,
    spend,
    impressions,
    bookings,
    completedJobs:      completedJobs.length,
    actualRevenue,
    costPerBooked,
    costPerCompleted,
    daysSincePublished,
    landingHealth:      landing.status,
    landingStatusCode:  landing.code,
    shouldPause,
    pauseReason,
    skipReason,
  };
}

// ── Pause the remote campaign on Google Ads ─────────────────────────────────

async function pauseRemoteCampaign(
  accountId:            string,
  googleAdsCampaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getGoogleAdsClientForAccount(accountId);
    if (!client) {
      return { ok: false, error: `No active Google Ads client for account ${accountId}` };
    }
    await client.mutate(
      "campaigns",
      [{
        update: {
          resourceName: `customers/${client.customerIdPlain}/campaigns/${googleAdsCampaignId}`,
          status: "PAUSED",
        },
        updateMask: "status",
      }],
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

  try {
    return await runAutoPause(request);
  } catch (err) {
    // Surface the underlying error in the response — without this catch,
    // an unhandled throw → Vercel returns HTTP 500 with empty body, and we
    // can't see what's wrong without function logs. This makes the route
    // self-diagnosing.
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack?.split("\n").slice(0, 6).join("\n") : undefined;
    console.error("[auto-pause] unhandled error:", message, stack);
    return NextResponse.json({
      success: false,
      error:   "Auto-pause handler threw",
      message,
      stack,
    }, { status: 500 });
  }
}

async function runAutoPause(request: NextRequest): Promise<Response> {
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
      accountId:         true,
      name:              true,
      status:            true,
      googleCampaignId:  true,
      finalUrl:          true,
      publishedAt:       true,
      account:           { select: { customerId: true } },
    },
  });

  const verdicts: CampaignVerdict[] = [];
  const pauses:   Array<CampaignVerdict & { pauseResult?: { ok: boolean; error?: string } }> = [];
  const brokenLandings: CampaignVerdict[] = [];

  for (const campaign of campaigns) {
    const verdict = await evaluateCampaign(campaign, since);
    verdicts.push(verdict);

    // ── Broken landing page — alert separately, do NOT pause ──────────
    // The campaign would otherwise be killed for the website's fault.
    // We surface this as a high-priority alert so the user can fix the
    // app issue rather than discovering it via missing revenue.
    if (verdict.landingHealth === "broken" && verdict.spend >= MIN_SPEND_GBP) {
      brokenLandings.push(verdict);
      if (!dryRun) {
        await sendAdminAlert({
          title:    `🚨 BROKEN LANDING PAGE on live campaign: ${verdict.campaignName}`,
          message:
            `Campaign \`${verdict.campaignName}\` has spent £${verdict.spend.toFixed(2)} ` +
            `over the last ${ROLLING_DAYS} days, but its finalUrl is returning ` +
            `${verdict.landingStatusCode ?? "a network error"}. ` +
            `Auto-pause is HOLDING OFF because this is an app bug, not a campaign bug — ` +
            `but the spend is being wasted until the landing page is fixed.\n\n` +
            `Action: investigate the deploy / proxy / route registration for the campaign's finalUrl.`,
          severity:          "error",          // upgraded so it always reaches Telegram
          bypassPolicyGate:  true,             // even if alertSensitivity is "critical"
          dedupeKey:         `broken-landing:${verdict.campaignId}`,
        }).catch((err) =>
          console.error("[auto-pause] broken-landing alert failed:", err),
        );
      }
      continue;
    }

    if (verdict.shouldPause) {
      if (dryRun) {
        pauses.push(verdict);
        continue;
      }
      // Order matters: pause Google FIRST, only mirror to local DB if
      // Google confirmed. The previous ordering (local first, then Google)
      // caused silent drift whenever the API call failed (quota, network,
      // auth) — local said PAUSED while ads kept serving and burning budget.
      //
      // 1. Pause remote on Google Ads using the draft's own account binding
      //    so multi-account setups cannot pick the wrong active client.
      let pauseResult: { ok: boolean; error?: string } | undefined;
      if (campaign.googleCampaignId && campaign.accountId) {
        pauseResult = await pauseRemoteCampaign(
          campaign.accountId,
          campaign.googleCampaignId,
        );
      } else {
        // No remote handle to call — record an explicit failure so the
        // alert below makes clear we did NOT pause the campaign.
        pauseResult = {
          ok: false,
          error: "No googleCampaignId or accountId on draft — cannot call Google Ads API",
        };
      }

      // 2. ONLY mirror to local DB if Google confirmed the pause. Otherwise
      //    keep local as PUBLISHED so the next cron run will retry, and
      //    the Telegram alert below tells the operator we couldn't pause.
      if (pauseResult.ok) {
        await prisma.googleAdsCampaignDraft.update({
          where: { id: campaign.id },
          data:  { status: "PAUSED", pausedAt: new Date(), lastSyncAt: new Date() },
        });
      }
      pauses.push({ ...verdict, pauseResult });

      // 3. Notify ops — bypassing the policy gate because pausing a live
      // campaign is ALWAYS critical regardless of operationalPolicy
      // sensitivity setting. Severity bumped to "error" for the same
      // reason (warning was being suppressed when alertSensitivity =
      // "critical", which is exactly when we most need the alert).
      const messageBody =
        `Campaign: \`${verdict.campaignName}\`\n` +
        `Reason: ${verdict.pauseReason}\n\n` +
        `Days since launch: ${verdict.daysSincePublished ?? "?"}\n` +
        `Spend (${ROLLING_DAYS}d): £${verdict.spend.toFixed(2)}\n` +
        `Impressions: ${verdict.impressions}\n` +
        `Bookings: ${verdict.bookings}\n` +
        `Completed jobs: ${verdict.completedJobs}\n` +
        `Revenue: £${verdict.actualRevenue.toFixed(2)}\n` +
        (verdict.costPerCompleted !== null
          ? `Cost per completed job: £${verdict.costPerCompleted.toFixed(2)}\n`
          : "") +
        `Landing page health: ${verdict.landingHealth}` +
        (verdict.landingStatusCode !== null ? ` (${verdict.landingStatusCode})` : "") + `\n` +
        (pauseResult && !pauseResult.ok
          ? `\n⚠️ Google Ads API pause FAILED: ${pauseResult.error}\nManual pause needed in Google Ads UI.`
          : "");
      await sendAdminAlert({
        title:            `🚨 Auto-paused Google Ads campaign: ${verdict.campaignName}`,
        message:          messageBody,
        severity:         "error",
        bypassPolicyGate: true,
        dedupeKey:        `auto-pause:${verdict.campaignId}`,
      }).catch((err) =>
        console.error("[auto-pause] Telegram alert failed:", err),
      );
    }
  }

  return NextResponse.json({
    success:        true,
    dryRun,
    evaluated:      verdicts.length,
    paused:         pauses.length,
    brokenLandings: brokenLandings.length,
    verdicts,
    pauses,
    brokenLandingDetails: brokenLandings,
    thresholds: {
      MIN_SPEND_GBP,
      MAX_COST_PER_COMPLETE_GBP,
      MIN_BOOKINGS_NO_COMPLETION,
      ROLLING_DAYS,
      WARMUP_DAYS,
      MIN_IMPRESSIONS,
      HARD_DEADSPEND_GBP,
    },
  });
}
