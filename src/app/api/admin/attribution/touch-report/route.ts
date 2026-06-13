/**
 * GET /api/admin/attribution/touch-report
 *
 * Aggregate first-touch vs last-touch revenue split. Powers the
 * admin dashboard at /admin/attribution.
 *
 * Output:
 *   {
 *     bySource: [
 *       { source, firstTouchCustomers, lastTouchCustomers,
 *         firstTouchJobs, lastTouchJobs,
 *         firstTouchRevenue, lastTouchRevenue, daysBetween }
 *     ],
 *     crossChannel: [
 *       { firstSource → lastSource → count → revenue }
 *     ],
 *     totals: { customers, jobs, revenue }
 *   }
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  effectiveSource,
  isAiAssistantSource,
  aiEngineLabel,
} from "@/lib/marketing/ai-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // Pull jobs with both attribution sides + customer attribution.
  const jobs = await p.job.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      customerId: true,
      utmSource: true,           // last-touch (on Job)
      firstTouchSource: true,    // first-touch (on Job)
      firstTouchReferrer: true,  // lets us recover AI engine when no utm_source
      firstTouchAt: true,
      firstTouchToBookingHours: true,
      assessmentFee: true,
      createdAt: true,
      quote: { select: { total: true } },
    },
  });

  const customers = await p.customer.findMany({
    where:  { createdAt: { gte: since } },
    select: {
      id: true,
      firstTouchSource:   true,
      lastTouchSource:    true,
      firstTouchReferrer: true,
      lastTouchReferrer:  true,
      firstTouchAt:       true,
      lastTouchAt:        true,
    },
  });

  // AI assistants (ChatGPT, Gemini, …) rarely add utm_source — recover the
  // engine from the stored referrer so AI traffic isn't miscounted as direct.
  const custFirst = (c: { firstTouchSource: string | null; firstTouchReferrer: string | null }) =>
    effectiveSource(c.firstTouchSource, c.firstTouchReferrer);
  const custLast = (c: { lastTouchSource: string | null; lastTouchReferrer: string | null }) =>
    effectiveSource(c.lastTouchSource, c.lastTouchReferrer);
  const jobFirst = (j: { firstTouchSource: string | null; firstTouchReferrer: string | null }) =>
    effectiveSource(j.firstTouchSource, j.firstTouchReferrer);
  const jobLast = (j: { utmSource: string | null }) => effectiveSource(j.utmSource, null);

  // ── Aggregate by source ────────────────────────────────────────────
  interface Row {
    source:              string;
    firstTouchCustomers: number;
    lastTouchCustomers:  number;
    firstTouchJobs:      number;
    lastTouchJobs:       number;
    firstTouchRevenue:   number;
    lastTouchRevenue:    number;
  }
  const map = new Map<string, Row>();
  const row = (source: string): Row => {
    let r = map.get(source);
    if (!r) {
      r = {
        source,
        firstTouchCustomers: 0,
        lastTouchCustomers:  0,
        firstTouchJobs:      0,
        lastTouchJobs:       0,
        firstTouchRevenue:   0,
        lastTouchRevenue:    0,
      };
      map.set(source, r);
    }
    return r;
  };

  for (const c of customers) {
    const fs = custFirst(c);
    const ls = custLast(c);
    if (fs) row(fs).firstTouchCustomers++;
    if (ls) row(ls).lastTouchCustomers++;
  }
  for (const j of jobs) {
    const rev = (j.quote?.total as number | undefined) ?? (j.assessmentFee as number | undefined) ?? 0;
    const fs = jobFirst(j);
    const ls = jobLast(j);
    if (fs) {
      const r = row(fs);
      r.firstTouchJobs++;
      r.firstTouchRevenue += rev;
    }
    if (ls) {
      const r = row(ls);
      r.lastTouchJobs++;
      r.lastTouchRevenue += rev;
    }
  }

  const bySource = Array.from(map.values()).sort(
    (a, b) => (b.firstTouchRevenue + b.lastTouchRevenue) -
              (a.firstTouchRevenue + a.lastTouchRevenue),
  );

  // ── Cross-channel mix: firstSource → lastSource ────────────────────
  const crossMap = new Map<string, { firstSource: string; lastSource: string; count: number; revenue: number }>();
  for (const j of jobs) {
    const f = jobFirst(j) ?? "(none)";
    const l = jobLast(j) ?? "(none)";
    if (f === l) continue; // skip same-touch jobs
    const key = `${f}::${l}`;
    let e = crossMap.get(key);
    if (!e) {
      e = { firstSource: f, lastSource: l, count: 0, revenue: 0 };
      crossMap.set(key, e);
    }
    e.count++;
    e.revenue += (j.quote?.total as number | undefined) ?? (j.assessmentFee as number | undefined) ?? 0;
  }
  const crossChannel = Array.from(crossMap.values()).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = jobs.reduce((s: number, j: { assessmentFee?: number; quote?: { total?: number } }) =>
    s + ((j.quote?.total as number | undefined) ?? (j.assessmentFee as number | undefined) ?? 0), 0);

  // ── Time-to-purchase aggregation by first-touch source (Phase C) ───
  interface TimeRow {
    source: string;
    n:      number;            // sample size
    hours:  number[];          // raw values, sorted asc in finalize step
    bucketLte1h:   number;
    bucketLte24h:  number;
    bucketLte7d:   number;
    bucketLte30d:  number;
    bucketGt30d:   number;
  }
  const timeMap = new Map<string, TimeRow>();
  const timeRow = (source: string): TimeRow => {
    let r = timeMap.get(source);
    if (!r) {
      r = { source, n: 0, hours: [],
            bucketLte1h: 0, bucketLte24h: 0, bucketLte7d: 0, bucketLte30d: 0, bucketGt30d: 0 };
      timeMap.set(source, r);
    }
    return r;
  };
  for (const j of jobs) {
    const h = j.firstTouchToBookingHours as number | null | undefined;
    if (typeof h !== "number" || h < 0) continue;
    const src = jobFirst(j) ?? "(none)";
    const r = timeRow(src);
    r.n++;
    r.hours.push(h);
    if      (h <=    1) r.bucketLte1h++;
    else if (h <=   24) r.bucketLte24h++;
    else if (h <=  168) r.bucketLte7d++;   // 7d  = 168h
    else if (h <=  720) r.bucketLte30d++;  // 30d = 720h
    else                r.bucketGt30d++;
  }
  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
    return sorted[idx];
  };
  const timeToPurchase = Array.from(timeMap.values()).map((r) => {
    const sorted = [...r.hours].sort((a, b) => a - b);
    return {
      source:        r.source,
      n:             r.n,
      medianHours:   Number(percentile(sorted, 0.5).toFixed(1)),
      p75Hours:      Number(percentile(sorted, 0.75).toFixed(1)),
      p90Hours:      Number(percentile(sorted, 0.9).toFixed(1)),
      bucketLte1h:   r.bucketLte1h,
      bucketLte24h:  r.bucketLte24h,
      bucketLte7d:   r.bucketLte7d,
      bucketLte30d:  r.bucketLte30d,
      bucketGt30d:   r.bucketGt30d,
    };
  }).sort((a, b) => b.n - a.n);

  // ── AI Assistant rollup (ChatGPT / Gemini / Perplexity / …) ─────────
  // Groups every AI-engine source into one headline channel + per-engine
  // breakdown. This is the outcome metric for the "lean off Google Ads"
  // thesis: real leads + revenue that AI search drove.
  const aiRows = bySource.filter((r) => isAiAssistantSource(r.source));
  const aiAssistant = {
    byEngine: aiRows.map((r) => ({
      engine:              r.source,
      label:               aiEngineLabel(r.source),
      firstTouchCustomers: r.firstTouchCustomers,
      lastTouchCustomers:  r.lastTouchCustomers,
      firstTouchJobs:      r.firstTouchJobs,
      lastTouchJobs:       r.lastTouchJobs,
      firstTouchRevenue:   Number(r.firstTouchRevenue.toFixed(2)),
      lastTouchRevenue:    Number(r.lastTouchRevenue.toFixed(2)),
    })),
    totals: aiRows.reduce(
      (acc, r) => ({
        firstTouchCustomers: acc.firstTouchCustomers + r.firstTouchCustomers,
        lastTouchCustomers:  acc.lastTouchCustomers + r.lastTouchCustomers,
        firstTouchJobs:      acc.firstTouchJobs + r.firstTouchJobs,
        lastTouchJobs:       acc.lastTouchJobs + r.lastTouchJobs,
        firstTouchRevenue:   Number((acc.firstTouchRevenue + r.firstTouchRevenue).toFixed(2)),
        lastTouchRevenue:    Number((acc.lastTouchRevenue + r.lastTouchRevenue).toFixed(2)),
      }),
      {
        firstTouchCustomers: 0, lastTouchCustomers: 0,
        firstTouchJobs: 0, lastTouchJobs: 0,
        firstTouchRevenue: 0, lastTouchRevenue: 0,
      },
    ),
  };

  return NextResponse.json({
    windowDays: days,
    totals: {
      customers: customers.length,
      jobs: jobs.length,
      revenue: Number(totalRevenue.toFixed(2)),
    },
    aiAssistant,
    bySource: bySource.map((r) => ({
      ...r,
      firstTouchRevenue: Number(r.firstTouchRevenue.toFixed(2)),
      lastTouchRevenue:  Number(r.lastTouchRevenue.toFixed(2)),
    })),
    crossChannel: crossChannel.map((r) => ({
      ...r,
      revenue: Number(r.revenue.toFixed(2)),
    })),
    timeToPurchase,
  });
}
