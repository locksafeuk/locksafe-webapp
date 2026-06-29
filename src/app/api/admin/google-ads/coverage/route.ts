/**
 * GET  /api/admin/google-ads/coverage   — read the coverage map (admin UI)
 * POST /api/admin/google-ads/coverage   — manually trigger the drift cron
 *                                         (same logic, admin button instead
 *                                         of the daily 03:30 UTC cron)
 *
 * Replaces the earlier minimal bisect debug version (2026-06-12).
 *
 * Auth: admin JWT cookie.
 */

// NOTE: handlers are typed with the plain `Request` (not `NextRequest`) on
// purpose. This exact route previously shipped as OPTIONS:204 / GET:404 because
// the Vercel bundler failed to register handlers whose signature used the
// `NextRequest` type (see commit 7554750). Every sibling route under
// /api/admin/google-ads that works (coverage-map, coverage-near) uses plain
// `Request`. Do NOT reintroduce `NextRequest` here or the route 404s in prod.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { computeCoverageMap } from "@/lib/campaign-coverage-builder";
import { enforceCoverageGate } from "@/lib/google-ads-draft-enforcement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(_request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // 1. UK coverage map — eligible / singleton / zero buckets.
  const cov = await computeCoverageMap();
  const eligible   = cov.entries.filter((e) => e.eligible);
  const singletons = cov.entries.filter((e) => e.locksmithCount === 1);
  const empty      = cov.entries.filter((e) => e.locksmithCount === 0);

  // 2. Per-live-campaign coverage status.
  const liveCampaigns = await p.googleAdsCampaignDraft.findMany({
    where:  { status: "PUBLISHED", pausedAt: null },
    select: {
      id: true, name: true, dailyBudget: true, geoTargets: true,
      finalUrl: true, googleCampaignId: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaignStatuses: Array<any> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of liveCampaigns as any[]) {
    let ok = true;
    let reason: string | null = null;
    try {
      const gate = await enforceCoverageGate(c.geoTargets);
      if (!gate.ok) {
        ok = false;
        reason = gate.violations.map((v) => v.expected ?? v.actual ?? v.field).join("; ");
      }
    } catch (err) {
      ok = false;
      reason = err instanceof Error ? err.message : String(err);
    }
    campaignStatuses.push({
      id: c.id, name: c.name, dailyBudget: c.dailyBudget,
      geoTargets: c.geoTargets, finalUrl: c.finalUrl,
      googleCampaignId: c.googleCampaignId,
      coverageOk: ok, breachReason: reason,
    });
  }

  return NextResponse.json({
    runAt: new Date().toISOString(),
    map: {
      totalCities:    cov.entries.length,
      eligibleCount:  eligible.length,
      singletonCount: singletons.length,
      emptyCount:     empty.length,
      eligible:       eligible.map((e) => ({
        cityName: e.cityName, locksmithCount: e.locksmithCount, geoId: e.geoId,
      })),
      singletons:     singletons.map((e) => ({
        cityName: e.cityName, geoId: e.geoId,
      })),
      empty:          empty.map((e) => ({ cityName: e.cityName })),
    },
    campaigns: {
      total:       campaignStatuses.length,
      breachCount: campaignStatuses.filter((c) => !c.coverageOk).length,
      perCampaign: campaignStatuses,
    },
  });
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delegate to the cron handler for the actual drift-fix + alert logic.
  const url = new URL("/api/cron/coverage-drift-check", request.url);
  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = {};
  if (secret) headers["authorization"] = `Bearer ${secret}`;
  else headers["x-vercel-cron"] = "1";
  const res = await fetch(url.toString(), { headers });
  const body = await res.json().catch(() => ({ error: "non-json" }));
  return NextResponse.json(body, { status: res.status });
}
