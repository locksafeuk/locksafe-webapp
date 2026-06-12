/**
 * GET /api/cron/vendor-audit-daily
 *
 * Daily roll-up: walk yesterday's VendorEvent rows and upsert a
 * VendorDailyStats row per (date, vendor, direction). Powers the
 * dashboard's vendor-level charts without re-aggregating millions of
 * rows on every page load.
 *
 * Also computes the "value score" per vendor — a heuristic for "are we
 * feeding the vendor more than we're getting back?":
 *
 *   score = (uniqueFieldTypes × eventsOut) / max(1, eventsIn × fieldsIn)
 *
 * Higher = more outflow than inflow. PII-heavy outflow without
 * meaningful inflow is the headline finding we want to surface.
 *
 * Schedule: nightly via vercel.json cron (00:30 UTC).
 * Auth: CRON_SECRET bearer or Vercel cron header.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function verifyCron(request: NextRequest): boolean {
  // Vercel cron sets x-vercel-cron=1; manual triggers must include CRON_SECRET.
  if (request.headers.get("x-vercel-cron")) return true;
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && auth === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) return unauthorized();

  // Default window: yesterday UTC. Override via ?date=YYYY-MM-DD for backfill.
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const day = dateParam
    ? new Date(`${dateParam}T00:00:00.000Z`)
    : (() => {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() - 1);
        return d;
      })();
  const dayEnd = new Date(day);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  const events = await p.vendorEvent.findMany({
    where:  { createdAt: { gte: day, lt: dayEnd } },
    select: {
      vendor:        true,
      direction:     true,
      endpoint:      true,
      status:        true,
      requestBytes:  true,
      responseBytes: true,
      fieldsShared:  true,
      identifiersShared: true,
      errorMessage:  true,
    },
  });

  // Bucket by (vendor, direction).
  interface Bucket {
    events:           number;
    errors:           number;
    totalBytesOut:    number;
    totalBytesIn:     number;
    endpoints:        Set<string>;
    fieldTypes:       Set<string>;
    piiFieldsShared:  number;
    identifiersShared: number;
  }
  const buckets = new Map<string, Bucket>();
  const key = (v: string, d: string) => `${v}::${d}`;
  const getB = (v: string, d: string): Bucket => {
    const k = key(v, d);
    let b = buckets.get(k);
    if (!b) {
      b = {
        events: 0, errors: 0, totalBytesOut: 0, totalBytesIn: 0,
        endpoints: new Set(), fieldTypes: new Set(),
        piiFieldsShared: 0, identifiersShared: 0,
      };
      buckets.set(k, b);
    }
    return b;
  };

  for (const e of events as Array<{
    vendor: string; direction: string; endpoint: string; status: number | null;
    requestBytes: number | null; responseBytes: number | null;
    fieldsShared: Record<string, string> | null;
    identifiersShared: Record<string, string> | null;
    errorMessage: string | null;
  }>) {
    const b = getB(e.vendor, e.direction);
    b.events++;
    if (e.errorMessage || (e.status != null && e.status >= 400)) b.errors++;
    b.totalBytesOut += e.requestBytes  ?? 0;
    b.totalBytesIn  += e.responseBytes ?? 0;
    b.endpoints.add(e.endpoint);
    if (e.fieldsShared) {
      for (const [name, cat] of Object.entries(e.fieldsShared)) {
        b.fieldTypes.add(name);
        if (cat === "PII") b.piiFieldsShared++;
      }
    }
    if (e.identifiersShared) b.identifiersShared += Object.keys(e.identifiersShared).length;
  }

  // Compute value score across direction pairs.
  // For each vendor, find inbound + outbound buckets and score outbound.
  const vendorInbound = new Map<string, Bucket>();
  for (const [k, b] of buckets) {
    const [v, d] = k.split("::");
    if (d === "inbound") vendorInbound.set(v, b);
  }

  // Upsert.
  const results: Array<{ vendor: string; direction: string; events: number; valueScore: number | null }> = [];
  for (const [k, b] of buckets) {
    const [vendor, direction] = k.split("::");
    let valueScore: number | null = null;
    if (direction === "outbound") {
      const inB = vendorInbound.get(vendor);
      const inEvents = inB?.events ?? 0;
      const inFields = inB?.fieldTypes.size ?? 0;
      const denom = Math.max(1, inEvents * Math.max(1, inFields));
      valueScore = Number(((b.fieldTypes.size * b.events) / denom).toFixed(2));
    }

    await p.vendorDailyStats.upsert({
      where: { date_vendor_direction: { date: day, vendor, direction } },
      create: {
        date: day,
        vendor,
        direction,
        events:           b.events,
        errors:           b.errors,
        totalBytesOut:    b.totalBytesOut,
        totalBytesIn:     b.totalBytesIn,
        uniqueEndpoints:  b.endpoints.size,
        uniqueFieldTypes: b.fieldTypes.size,
        piiFieldsShared:  b.piiFieldsShared,
        identifiersShared: b.identifiersShared,
        valueScore,
      },
      update: {
        events:           b.events,
        errors:           b.errors,
        totalBytesOut:    b.totalBytesOut,
        totalBytesIn:     b.totalBytesIn,
        uniqueEndpoints:  b.endpoints.size,
        uniqueFieldTypes: b.fieldTypes.size,
        piiFieldsShared:  b.piiFieldsShared,
        identifiersShared: b.identifiersShared,
        valueScore,
      },
    });
    results.push({ vendor, direction, events: b.events, valueScore });
  }

  return NextResponse.json({
    date: day.toISOString().slice(0, 10),
    eventsScanned: events.length,
    buckets:       buckets.size,
    results,
  });
}
