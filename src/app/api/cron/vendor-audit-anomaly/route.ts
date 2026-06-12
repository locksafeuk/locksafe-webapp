/**
 * GET /api/cron/vendor-audit-anomaly
 *
 * Hourly anomaly sweep over the VendorEvent log. Detects:
 *
 *   1. Volume spike — vendor.events in last 60min > 3× trailing-24h hourly mean
 *   2. Error-rate spike — vendor.errors / vendor.events > 25% in last 60min
 *      (min 10 events to avoid false positives on tiny denominators)
 *   3. New endpoint — an endpoint we've never seen before for this vendor
 *   4. New PII / identifier field — a sensitive field name we haven't shared
 *      with this vendor previously
 *
 * Each finding fires one sendAdminAlert via Telegram, deduped per
 * (vendor, anomaly type) with a 60-minute cooldown so we don't spam.
 *
 * Schedule: hourly via vercel.json cron.
 * Auth: CRON_SECRET bearer or Vercel cron header.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now      = Date.now();
  const oneHrAgo = new Date(now - HOUR_MS);
  const oneDayAgo = new Date(now - DAY_MS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // Pull the last 24 hours so we can compute the baseline AND inspect the
  // most-recent hour. Cheaper than two queries.
  const events = await p.vendorEvent.findMany({
    where:   { createdAt: { gte: oneDayAgo } },
    select:  {
      vendor: true, endpoint: true, status: true, errorMessage: true,
      createdAt: true, fieldsShared: true,
    },
  });

  // Bucket per vendor.
  interface Tally {
    vendor:       string;
    recentEvents: number;
    recentErrors: number;
    pastEvents:   number;
    recentEndpoints: Set<string>;
    pastEndpoints:   Set<string>;
    recentPiiFields: Set<string>;
    pastPiiFields:   Set<string>;
    recentIdFields:  Set<string>;
    pastIdFields:    Set<string>;
  }
  const tallies = new Map<string, Tally>();
  const get = (v: string): Tally => {
    let t = tallies.get(v);
    if (!t) {
      t = {
        vendor: v,
        recentEvents: 0, recentErrors: 0, pastEvents: 0,
        recentEndpoints: new Set(), pastEndpoints: new Set(),
        recentPiiFields: new Set(), pastPiiFields: new Set(),
        recentIdFields:  new Set(), pastIdFields:  new Set(),
      };
      tallies.set(v, t);
    }
    return t;
  };

  for (const e of events as Array<{
    vendor: string; endpoint: string; status: number | null;
    errorMessage: string | null; createdAt: Date;
    fieldsShared: Record<string, string> | null;
  }>) {
    const t = get(e.vendor);
    const isRecent = e.createdAt >= oneHrAgo;
    if (isRecent) {
      t.recentEvents++;
      if (e.errorMessage || (e.status != null && e.status >= 400)) t.recentErrors++;
      t.recentEndpoints.add(e.endpoint);
      if (e.fieldsShared) {
        for (const [name, cat] of Object.entries(e.fieldsShared)) {
          if (cat === "PII")        t.recentPiiFields.add(name);
          if (cat === "identifier") t.recentIdFields.add(name);
        }
      }
    } else {
      t.pastEvents++;
      t.pastEndpoints.add(e.endpoint);
      if (e.fieldsShared) {
        for (const [name, cat] of Object.entries(e.fieldsShared)) {
          if (cat === "PII")        t.pastPiiFields.add(name);
          if (cat === "identifier") t.pastIdFields.add(name);
        }
      }
    }
  }

  const findings: Array<{ vendor: string; kind: string; message: string }> = [];

  for (const t of tallies.values()) {
    // 1. Volume spike — recent vs trailing-23h hourly mean
    const hourlyMean = t.pastEvents / 23;
    if (t.recentEvents > 50 && hourlyMean > 0 && t.recentEvents > hourlyMean * 3) {
      findings.push({
        vendor: t.vendor,
        kind:   "volume_spike",
        message: `${t.vendor}: ${t.recentEvents} events in last hour vs ${hourlyMean.toFixed(1)} hourly avg (${(t.recentEvents / hourlyMean).toFixed(1)}×)`,
      });
    }

    // 2. Error-rate spike
    if (t.recentEvents >= 10) {
      const rate = t.recentErrors / t.recentEvents;
      if (rate > 0.25) {
        findings.push({
          vendor: t.vendor,
          kind:   "error_spike",
          message: `${t.vendor}: ${(rate * 100).toFixed(0)}% errors in last hour (${t.recentErrors}/${t.recentEvents})`,
        });
      }
    }

    // 3. New endpoint
    for (const ep of t.recentEndpoints) {
      if (!t.pastEndpoints.has(ep)) {
        findings.push({
          vendor: t.vendor,
          kind:   "new_endpoint",
          message: `${t.vendor}: first ever call to ${ep}`,
        });
      }
    }

    // 4. New PII field
    for (const f of t.recentPiiFields) {
      if (!t.pastPiiFields.has(f)) {
        findings.push({
          vendor: t.vendor,
          kind:   "new_pii_field",
          message: `${t.vendor}: first time sharing PII field "${f}"`,
        });
      }
    }

    // 5. New identifier field
    for (const f of t.recentIdFields) {
      if (!t.pastIdFields.has(f)) {
        findings.push({
          vendor: t.vendor,
          kind:   "new_identifier",
          message: `${t.vendor}: first time sharing identifier "${f}"`,
        });
      }
    }
  }

  // Fire alerts (deduped per vendor+kind, 60-min cooldown).
  const fired: typeof findings = [];
  for (const f of findings) {
    try {
      await sendAdminAlert({
        title:    `🔎 Data Ownership anomaly — ${f.kind}`,
        message:  f.message + `\n\nReview: https://www.locksafe.uk/admin/data-ownership?vendor=${encodeURIComponent(f.vendor)}`,
        severity: f.kind === "error_spike" || f.kind === "new_pii_field" ? "warning" : "info",
        topic:    "agents",
        dedupeKey: `vendor-audit:${f.vendor}:${f.kind}`,
        cooldownMsOverride: 60 * 60 * 1000,
      });
      fired.push(f);
    } catch (err) {
      console.warn("[vendor-audit-anomaly] alert failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    scannedEvents: events.length,
    tallies:       tallies.size,
    findings,
    fired:         fired.length,
  });
}
