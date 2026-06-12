/**
 * POST /api/admin/attribution/backfill
 *
 * One-off (re-runnable) backfill of first/last touch fields on existing
 * Customer, Locksmith and Job rows.
 *
 * Strategy:
 *   - For each Customer that has a `phone` we can use to identify their
 *     visitor history, OR a `customerId` linked from a UserSession row,
 *     resolve their earliest + latest UserSession and stamp the
 *     firstTouch* / lastTouch* columns.
 *   - For each Locksmith with a matching UserSession (joined by phone
 *     or by manual `visitorId` if present), stamp firstTouch*.
 *   - For each Job that has a `customerId`, stamp Job.firstTouch* from
 *     that customer's firstTouch*.
 *
 * Idempotent: every row is checked for `firstTouchAt` first; rows that
 * already have a stamp are skipped. Pass `?force=1` to overwrite.
 *
 * Batching: chunks of 100 customers per Promise.all to keep memory low.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  resolveFirstTouch,
  resolveLastTouch,
} from "@/lib/attribution/touch-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

interface BackfillResult {
  scanned:  number;
  stamped:  number;
  skipped:  number;
  failed:   number;
  examples: string[];
}

const CHUNK = 100;

/**
 * For each row in `rows`, run `processOne` with concurrency = CHUNK.
 */
async function batchProcess<T>(
  rows: T[],
  processOne: (row: T) => Promise<"stamped" | "skipped" | "failed">,
  examples: string[],
): Promise<BackfillResult> {
  let stamped = 0;
  let skipped = 0;
  let failed  = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const outcomes = await Promise.all(chunk.map(processOne));
    for (const o of outcomes) {
      if (o === "stamped") stamped++;
      else if (o === "skipped") skipped++;
      else failed++;
    }
  }
  return { scanned: rows.length, stamped, skipped, failed, examples };
}

export async function POST(request: NextRequest) {
  try {
    return await runBackfill(request);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    console.error("[attribution/backfill] top-level crash:", msg);
    return NextResponse.json(
      { success: false, error: "backfill_top_level_crash", details: msg.slice(0, 1500) },
      { status: 500 },
    );
  }
}

async function runBackfill(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const scope = url.searchParams.get("scope") ?? "all"; // all | customers | jobs | locksmiths

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const results: Record<string, BackfillResult> = {};
  const errors: Array<{ step: string; message: string }> = [];

  // ── Customers ──────────────────────────────────────────────────────
  if (scope === "all" || scope === "customers") {
    let customers: Array<{ id: string; phone: string; visitorId: string | null; firstTouchAt: Date | null }> = [];
    try {
      // Prisma's MongoDB connector treats `firstTouchAt: null` strictly
      // (matches only docs where the field is explicitly null, NOT docs
      // where the field is missing). Existing rows don't have the field
      // at all. So we fetch ALL rows and filter in the loop.
      customers = await p.customer.findMany({
        select: { id: true, phone: true, visitorId: true, firstTouchAt: true },
        take:   5000,
      });
    } catch (err) {
      errors.push({ step: "customers.findMany", message: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ success: false, errors, results }, { status: 500 });
    }
    const examples: string[] = [];
    results.customers = await batchProcess(
      customers,
      async (c: { id: string; phone: string; visitorId: string | null; firstTouchAt: Date | null }) => {
        if (!force && c.firstTouchAt) return "skipped";
        // Resolve visitor history. We try the stored visitorId first;
        // for customers created before Phase 4 (no visitorId), we look
        // up sessions by customerId (UserSession.customerId).
        try {
          let first = await resolveFirstTouch(c.visitorId);
          let last  = await resolveLastTouch(c.visitorId);
          if (!first || !last) {
            // Fallback 1: find any session linked to this customer by id.
            const linked = await p.userSession.findFirst({
              where:   { customerId: c.id },
              orderBy: { startedAt: "asc" },
            });
            const linkedLast = await p.userSession.findFirst({
              where:   { customerId: c.id },
              orderBy: { lastActiveAt: "desc" },
            });
            if (linked && !first) {
              first = {
                visitorId:   linked.visitorId,
                sessionId:   linked.id,
                at:          linked.startedAt,
                source:      linked.utmSource,
                medium:      linked.utmMedium,
                campaign:    linked.utmCampaign,
                content:     linked.utmContent,
                term:        linked.utmTerm,
                gclid:       linked.gclid,
                fbclid:      linked.fbclid,
                landingPage: linked.landingPage,
                referrer:    linked.referrer,
              };
            }
            if (linkedLast && !last) {
              last = {
                visitorId:   linkedLast.visitorId,
                sessionId:   linkedLast.id,
                at:          linkedLast.lastActiveAt,
                source:      linkedLast.utmSource,
                medium:      linkedLast.utmMedium,
                campaign:    linkedLast.utmCampaign,
                content:     linkedLast.utmContent,
                term:        linkedLast.utmTerm,
                gclid:       linkedLast.gclid,
                fbclid:      linkedLast.fbclid,
                landingPage: linkedLast.landingPage,
                referrer:    linkedLast.referrer,
              };
            }
          }
          if (!first || !last) {
            // Fallback 2 (2026-06-12): derive from the customer's Jobs.
            // Existing Jobs carry utm/gclid/landingPage in their own
            // columns (the last-touch at booking time). Oldest such Job
            // = first-touch proxy; newest = last-touch proxy. This
            // recovers attribution for the customers who registered
            // before P3 wired the touch-resolver into customer.create.
            const oldestJob = await p.job.findFirst({
              where: { customerId: c.id },
              orderBy: { createdAt: "asc" },
              select: {
                id: true, createdAt: true, utmSource: true, utmMedium: true,
                utmCampaign: true, utmContent: true, utmTerm: true,
                gclid: true, fbclid: true, landingPage: true,
              },
            });
            const newestJob = await p.job.findFirst({
              where: { customerId: c.id },
              orderBy: { createdAt: "desc" },
              select: {
                id: true, createdAt: true, utmSource: true, utmMedium: true,
                utmCampaign: true, utmContent: true, utmTerm: true,
                gclid: true, fbclid: true, landingPage: true,
              },
            });
            if (!first && oldestJob) {
              first = {
                visitorId:   "",
                sessionId:   oldestJob.id,
                at:          oldestJob.createdAt,
                source:      oldestJob.utmSource ?? "direct",
                medium:      oldestJob.utmMedium ?? null,
                campaign:    oldestJob.utmCampaign ?? null,
                content:     oldestJob.utmContent ?? null,
                term:        oldestJob.utmTerm ?? null,
                gclid:       oldestJob.gclid ?? null,
                fbclid:      oldestJob.fbclid ?? null,
                landingPage: oldestJob.landingPage ?? null,
                referrer:    null,
              };
            }
            if (!last && newestJob) {
              last = {
                visitorId:   "",
                sessionId:   newestJob.id,
                at:          newestJob.createdAt,
                source:      newestJob.utmSource ?? "direct",
                medium:      newestJob.utmMedium ?? null,
                campaign:    newestJob.utmCampaign ?? null,
                content:     newestJob.utmContent ?? null,
                term:        newestJob.utmTerm ?? null,
                gclid:       newestJob.gclid ?? null,
                fbclid:      newestJob.fbclid ?? null,
                landingPage: newestJob.landingPage ?? null,
                referrer:    null,
              };
            }
          }
          if (!first && !last) return "skipped";
          const update: Record<string, unknown> = {};
          if (first) {
            update.firstSessionId        = first.sessionId;
            update.firstTouchAt          = first.at;
            update.firstTouchSource      = first.source;
            update.firstTouchMedium      = first.medium;
            update.firstTouchCampaign    = first.campaign;
            update.firstTouchContent     = first.content;
            update.firstTouchTerm        = first.term;
            update.firstTouchGclid       = first.gclid;
            update.firstTouchFbclid      = first.fbclid;
            update.firstTouchLandingPage = first.landingPage;
            update.firstTouchReferrer    = first.referrer;
            update.visitorId             = first.visitorId;
          }
          if (last) {
            update.lastSessionId        = last.sessionId;
            update.lastTouchAt          = last.at;
            update.lastTouchSource      = last.source;
            update.lastTouchMedium      = last.medium;
            update.lastTouchCampaign    = last.campaign;
            update.lastTouchContent     = last.content;
            update.lastTouchTerm        = last.term;
            update.lastTouchGclid       = last.gclid;
            update.lastTouchFbclid      = last.fbclid;
            update.lastTouchLandingPage = last.landingPage;
            update.lastTouchReferrer    = last.referrer;
          }
          await p.customer.update({ where: { id: c.id }, data: update });
          if (examples.length < 5) examples.push(c.id);
          return "stamped";
        } catch (err) {
          console.warn("[backfill/customer]", c.id, err);
          return "failed";
        }
      },
      examples,
    );
  }

  // ── Jobs (copy customer.firstTouch* onto Job.firstTouch*) ──────────
  if (scope === "all" || scope === "jobs") {
    let jobs: Array<{ id: string; customerId: string | null; firstTouchAt: Date | null }> = [];
    try {
      // Same MongoDB-null caveat as Customer above. Fetch all + filter.
      jobs = await p.job.findMany({
        select: { id: true, customerId: true, firstTouchAt: true },
        take:   5000,
      });
    } catch (err) {
      errors.push({ step: "jobs.findMany", message: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ success: false, errors, results }, { status: 500 });
    }
    const examples: string[] = [];
    results.jobs = await batchProcess(
      jobs,
      async (j: { id: string; customerId: string | null; firstTouchAt: Date | null }) => {
        if (!j.customerId) return "skipped";
        if (!force && j.firstTouchAt) return "skipped";
        try {
          const cust = await p.customer.findUnique({
            where: { id: j.customerId },
            select: {
              firstTouchAt: true, firstTouchSource: true, firstTouchMedium: true,
              firstTouchCampaign: true, firstTouchContent: true, firstTouchTerm: true,
              firstTouchGclid: true, firstTouchFbclid: true, firstTouchLandingPage: true,
              firstTouchReferrer: true,
            },
          });
          if (!cust?.firstTouchAt) return "skipped";
          await p.job.update({
            where: { id: j.id },
            data: {
              firstTouchAt:          cust.firstTouchAt,
              firstTouchSource:      cust.firstTouchSource,
              firstTouchMedium:      cust.firstTouchMedium,
              firstTouchCampaign:    cust.firstTouchCampaign,
              firstTouchContent:     cust.firstTouchContent,
              firstTouchTerm:        cust.firstTouchTerm,
              firstTouchGclid:       cust.firstTouchGclid,
              firstTouchFbclid:      cust.firstTouchFbclid,
              firstTouchLandingPage: cust.firstTouchLandingPage,
              firstTouchReferrer:    cust.firstTouchReferrer,
            },
          });
          if (examples.length < 5) examples.push(j.id);
          return "stamped";
        } catch (err) {
          console.warn("[backfill/job]", j.id, err);
          return "failed";
        }
      },
      examples,
    );
  }

  // ── Locksmiths ─────────────────────────────────────────────────────
  if (scope === "all" || scope === "locksmiths") {
    let locks: Array<{ id: string; phone: string; visitorId: string | null; firstTouchAt: Date | null }> = [];
    try {
      locks = await p.locksmith.findMany({
        select: { id: true, phone: true, visitorId: true, firstTouchAt: true },
        take:   2000,
      });
    } catch (err) {
      errors.push({ step: "locksmiths.findMany", message: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ success: false, errors, results }, { status: 500 });
    }
    const examples: string[] = [];
    results.locksmiths = await batchProcess(
      locks,
      async (l: { id: string; visitorId: string | null; firstTouchAt: Date | null }) => {
        if (!force && l.firstTouchAt) return "skipped";
        try {
          const first = await resolveFirstTouch(l.visitorId);
          if (!first) return "skipped";
          await p.locksmith.update({
            where: { id: l.id },
            data: {
              firstSessionId:        first.sessionId,
              firstTouchAt:          first.at,
              firstTouchSource:      first.source,
              firstTouchMedium:      first.medium,
              firstTouchCampaign:    first.campaign,
              firstTouchContent:     first.content,
              firstTouchTerm:        first.term,
              firstTouchGclid:       first.gclid,
              firstTouchFbclid:      first.fbclid,
              firstTouchLandingPage: first.landingPage,
              firstTouchReferrer:    first.referrer,
              visitorId:             first.visitorId,
            },
          });
          if (examples.length < 5) examples.push(l.id);
          return "stamped";
        } catch (err) {
          console.warn("[backfill/locksmith]", l.id, err);
          return "failed";
        }
      },
      examples,
    );
  }

  return NextResponse.json({
    success: errors.length === 0,
    force,
    scope,
    results,
    errors,
  });
}
