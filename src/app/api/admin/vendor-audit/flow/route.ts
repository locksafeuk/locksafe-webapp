/**
 * GET /api/admin/vendor-audit/flow
 *
 * Cross-vendor field-flow summary. For each (vendor, fieldCategory)
 * pair, count how many distinct field names of that category we
 * shared with the vendor in the window. Powers the Sankey-style
 * "what kind of data goes where" view on /admin/data-ownership.
 *
 * Output:
 *   {
 *     windowDays: 7,
 *     totals:     { events, bytesOut, bytesIn },
 *     flows:      [ { vendor, category, fieldCount, eventCount, bytesOut } ],
 *     vendors:    [ vendor, ... ],
 *     categories: [ "PII", "identifier", ... ],
 *     dailyValueScores: [ { date, vendor, valueScore } ],
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
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? "7")));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // Only outbound — we care about what *we* push to vendors here.
  const events = await p.vendorEvent.findMany({
    where: { createdAt: { gte: since }, direction: "outbound" },
    select: {
      vendor:       true,
      requestBytes: true,
      responseBytes: true,
      fieldsShared: true,
    },
  });

  interface Flow {
    vendor:     string;
    category:   string;
    fieldNames: Set<string>;
    eventCount: number;
    bytesOut:   number;
  }
  const flows = new Map<string, Flow>();
  const key = (v: string, c: string) => `${v}::${c}`;

  let totalBytesOut = 0;
  let totalBytesIn  = 0;
  for (const e of events as Array<{
    vendor: string; requestBytes: number | null; responseBytes: number | null;
    fieldsShared: Record<string, string> | null;
  }>) {
    totalBytesOut += e.requestBytes  ?? 0;
    totalBytesIn  += e.responseBytes ?? 0;
    if (!e.fieldsShared) continue;
    const seen = new Set<string>();
    for (const [field, cat] of Object.entries(e.fieldsShared)) {
      const k = key(e.vendor, cat);
      let f = flows.get(k);
      if (!f) {
        f = { vendor: e.vendor, category: cat, fieldNames: new Set(), eventCount: 0, bytesOut: 0 };
        flows.set(k, f);
      }
      f.fieldNames.add(field);
      if (!seen.has(k)) {
        f.eventCount++;
        f.bytesOut += e.requestBytes ?? 0;
        seen.add(k);
      }
    }
  }

  // Recent daily value scores (last `days` worth).
  const dailyValueScores = await p.vendorDailyStats.findMany({
    where:  { date: { gte: since }, direction: "outbound" },
    select: { date: true, vendor: true, valueScore: true, events: true, piiFieldsShared: true },
    orderBy: { date: "asc" },
  });

  const vendorsSet    = new Set<string>();
  const categoriesSet = new Set<string>();
  for (const f of flows.values()) {
    vendorsSet.add(f.vendor);
    categoriesSet.add(f.category);
  }

  return NextResponse.json({
    windowDays: days,
    totals: {
      events:   events.length,
      bytesOut: totalBytesOut,
      bytesIn:  totalBytesIn,
    },
    flows: Array.from(flows.values()).map((f) => ({
      vendor:     f.vendor,
      category:   f.category,
      fieldCount: f.fieldNames.size,
      fieldNames: Array.from(f.fieldNames).sort(),
      eventCount: f.eventCount,
      bytesOut:   f.bytesOut,
    })),
    vendors:    Array.from(vendorsSet).sort(),
    categories: Array.from(categoriesSet).sort(),
    dailyValueScores,
  });
}
