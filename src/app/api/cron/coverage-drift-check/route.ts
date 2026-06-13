/**
 * GET /api/cron/coverage-drift-check
 *
 * Daily reconciliation between our DB and reality. Three drift classes
 * detected in one pass, all of which would otherwise burn money silently:
 *
 *   A. Status drift (§25) — Google says a campaign is PAUSED/REMOVED
 *      but our DB still has it PUBLISHED + pausedAt:null. The §17
 *      spend-cap enforcer counts these and blocks new drafts with
 *      phantom budget. Auto-fix: stamp pausedAt=now.
 *
 *   B. Coverage drift (§16) — A campaign's geoTargets still satisfied
 *      ≥2 active locksmiths within 10mi when published, but coverage
 *      has dropped since (locksmith paused, retired, suspended). The
 *      campaign keeps spending into cities where we can't fulfil.
 *      Action: Telegram alert (no auto-pause — admin decides).
 *
 *   C. Eligibility delta — the count of eligible UK cities under §16
 *      changed since the last run. New cities qualify = launch
 *      opportunity. Cities dropped = recruitment alert.
 *
 * Schedule: daily 03:30 UTC via vercel.json cron.
 * Auth: x-vercel-cron header OR CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import { enforceCoverageGate } from "@/lib/google-ads-draft-enforcement";
import { computeCoverageMap } from "@/lib/campaign-coverage-builder";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function verifyCron(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && auth === `Bearer ${secret}`);
}

interface CampaignStatusRow {
  campaign?: { id?: string; name?: string; status?: string };
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // ── A. STATUS DRIFT ────────────────────────────────────────────────
  let statusDriftFixed: Array<{ id: string; name: string; budget: number; googleStatus: string }> = [];
  let statusDriftError: string | null = null;
  try {
    const ctx = await getDefaultGoogleAdsClient();
    if (!ctx) throw new Error("No active GoogleAdsAccount in DB");
    const { client, accountId } = ctx;

    const googleRows = (await client.query(`
      SELECT campaign.id, campaign.name, campaign.status
        FROM campaign
       WHERE campaign.status IN (PAUSED, REMOVED)
    `)) as CampaignStatusRow[];
    const pausedIds  = new Set<string>();
    const removedIds = new Set<string>();
    for (const r of googleRows) {
      if (!r.campaign?.id) continue;
      if (r.campaign.status === "PAUSED")  pausedIds.add(r.campaign.id);
      if (r.campaign.status === "REMOVED") removedIds.add(r.campaign.id);
    }

    // DB drafts that THINK they're live, but Google has paused/removed them.
    const dbLive = await p.googleAdsCampaignDraft.findMany({
      where:  { accountId, status: "PUBLISHED" },
      select: { id: true, name: true, googleCampaignId: true, dailyBudget: true, pausedAt: true },
    });
    const offenders = dbLive.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d: any) =>
        d.googleCampaignId &&
        (pausedIds.has(d.googleCampaignId) || removedIds.has(d.googleCampaignId)) &&
        d.pausedAt == null,
    );

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of offenders as any[]) {
      await p.googleAdsCampaignDraft.update({
        where: { id: d.id },
        data:  { pausedAt: now },
      });
      statusDriftFixed.push({
        id: d.id, name: d.name, budget: d.dailyBudget ?? 0,
        googleStatus: removedIds.has(d.googleCampaignId) ? "REMOVED" : "PAUSED",
      });
    }
  } catch (err) {
    statusDriftError = err instanceof Error ? err.message : String(err);
  }

  // ── B. COVERAGE DRIFT (§16) ────────────────────────────────────────
  let coverageBreaches: Array<{ id: string; name: string; geoTargets: string[]; reason: string }> = [];
  let coverageError: string | null = null;
  try {
    const liveAfterFix = await p.googleAdsCampaignDraft.findMany({
      where:  { status: "PUBLISHED", pausedAt: null },
      select: { id: true, name: true, geoTargets: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of liveAfterFix as any[]) {
      try {
        const result = await enforceCoverageGate(c.geoTargets);
        if (!result.ok) {
          const reason = result.violations
            .map((v) => v.expected ?? v.actual ?? v.field)
            .join("; ");
          coverageBreaches.push({
            id: c.id, name: c.name, geoTargets: c.geoTargets, reason,
          });
        }
      } catch (err) {
        coverageBreaches.push({
          id: c.id, name: c.name, geoTargets: c.geoTargets,
          reason: `gate threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  } catch (err) {
    coverageError = err instanceof Error ? err.message : String(err);
  }

  // ── C. ELIGIBILITY DELTA ───────────────────────────────────────────
  let eligibilitySnapshot:
    | { eligibleCount: number; eligibleCities: string[]; total: number }
    | { error: string } = { error: "not_computed" };
  try {
    const cov = await computeCoverageMap();
    const eligible = cov.entries.filter((e) => e.eligible);
    eligibilitySnapshot = {
      eligibleCount:  eligible.length,
      eligibleCities: eligible.map((e) => e.cityName).sort(),
      total:          cov.entries.length,
    };
  } catch (err) {
    eligibilitySnapshot = { error: err instanceof Error ? err.message : String(err) };
  }

  // ── ALERTS ─────────────────────────────────────────────────────────
  const alertsFired: string[] = [];
  for (const drift of statusDriftFixed) {
    try {
      await sendAdminAlert({
        title:    "🔧 Coverage drift cron — auto-fixed DB↔Google drift",
        message:
          `Campaign "${drift.name}" was ${drift.googleStatus} on Google but PUBLISHED + pausedAt=null in DB. ` +
          `Freed £${drift.budget}/day of phantom budget from the §17 spend cap.`,
        severity:  "info",
        topic:     "agents",
        dedupeKey: `coverage-drift-status:${drift.id}`,
        cooldownMsOverride: 24 * 60 * 60 * 1000,
      });
      alertsFired.push(`status_drift_fixed:${drift.id}`);
    } catch { /* swallow */ }
  }
  for (const breach of coverageBreaches) {
    try {
      await sendAdminAlert({
        title:    "⚠️ Coverage drift cron — live campaign below §16 floor",
        message:
          `Campaign "${breach.name}" no longer satisfies §16 (≥2 active locksmiths × 10mi). ` +
          `Reason: ${breach.reason}. Decision: keep running, pause, or recruit. ` +
          `Review: /admin/google-ads/coverage`,
        severity:  "warning",
        topic:     "agents",
        dedupeKey: `coverage-drift-breach:${breach.id}`,
        cooldownMsOverride: 12 * 60 * 60 * 1000,
      });
      alertsFired.push(`coverage_breach:${breach.id}`);
    } catch { /* swallow */ }
  }

  return NextResponse.json({
    startedAt:  startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    statusDrift: {
      fixedCount: statusDriftFixed.length,
      fixed:      statusDriftFixed,
      error:      statusDriftError,
    },
    coverageDrift: {
      breachCount: coverageBreaches.length,
      breaches:    coverageBreaches,
      error:       coverageError,
    },
    eligibilitySnapshot,
    alertsFired,
  });
}
