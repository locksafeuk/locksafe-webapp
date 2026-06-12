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
      assessmentFee: true,
      createdAt: true,
      quote: { select: { total: true } },
    },
  });

  const customers = await p.customer.findMany({
    where:  { createdAt: { gte: since } },
    select: {
      id: true,
      firstTouchSource: true,
      lastTouchSource:  true,
      firstTouchAt:     true,
      lastTouchAt:      true,
    },
  });

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
    if (c.firstTouchSource) row(c.firstTouchSource).firstTouchCustomers++;
    if (c.lastTouchSource)  row(c.lastTouchSource).lastTouchCustomers++;
  }
  for (const j of jobs) {
    const rev = (j.quote?.total as number | undefined) ?? (j.assessmentFee as number | undefined) ?? 0;
    if (j.firstTouchSource) {
      const r = row(j.firstTouchSource);
      r.firstTouchJobs++;
      r.firstTouchRevenue += rev;
    }
    if (j.utmSource) {
      const r = row(j.utmSource);
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
    const f = j.firstTouchSource ?? "(none)";
    const l = j.utmSource ?? "(none)";
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

  return NextResponse.json({
    windowDays: days,
    totals: {
      customers: customers.length,
      jobs: jobs.length,
      revenue: Number(totalRevenue.toFixed(2)),
    },
    bySource: bySource.map((r) => ({
      ...r,
      firstTouchRevenue: Number(r.firstTouchRevenue.toFixed(2)),
      lastTouchRevenue:  Number(r.lastTouchRevenue.toFixed(2)),
    })),
    crossChannel: crossChannel.map((r) => ({
      ...r,
      revenue: Number(r.revenue.toFixed(2)),
    })),
  });
}
