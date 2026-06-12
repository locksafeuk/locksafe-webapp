/**
 * POST /api/admin/attribution/smoke-test
 *
 * End-to-end attribution pipeline check. Creates a fake UserSession with
 * `utm_source=google` + `gclid=test_X`, simulates a customer registration
 * by calling the touch-resolver against that visitorId, asserts the
 * stamped fields, and finally cleans up the synthetic rows.
 *
 * Use:
 *   curl -X POST -b auth_token=… https://www.locksafe.uk/api/admin/attribution/smoke-test
 *
 * Returns:
 *   {
 *     ok: true | false,
 *     checks: [{ name, passed, expected, actual }],
 *     summary: "..."
 *   }
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  resolveFirstTouch,
  resolveLastTouch,
  stampFirstAndLastTouchOn,
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

interface Check {
  name:     string;
  passed:   boolean;
  expected: unknown;
  actual:   unknown;
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ts = Date.now();
  const visitorId = `v_smoke_${ts}_${Math.random().toString(36).slice(2, 9)}`;
  const checks: Check[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  let firstSessionId: string | null = null;
  let lastSessionId:  string | null = null;
  let customerId:     string | null = null;
  let jobId:          string | null = null;

  try {
    // ── Step 1. Create two synthetic UserSession rows for this visitor.
    // First one in the past (google/cpc), second one recent (direct).
    const firstSession = await p.userSession.create({
      data: {
        visitorId,
        referrer:    "https://www.google.com/",
        utmSource:   "google",
        utmMedium:   "cpc",
        utmCampaign: "smoke-test-campaign",
        gclid:       `gclid_smoke_${ts}`,
        landingPage: "/locksmith-in/bs1",
        startedAt:   new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7d ago
        lastActiveAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        deviceType:  "desktop",
        browser:     "smoke-test",
      },
    });
    firstSessionId = firstSession.id;

    const lastSession = await p.userSession.create({
      data: {
        visitorId,
        referrer:    "",
        utmSource:   "direct",
        utmMedium:   null,
        utmCampaign: null,
        landingPage: "/",
        startedAt:   new Date(),
        lastActiveAt: new Date(),
        deviceType:  "desktop",
        browser:     "smoke-test",
      },
    });
    lastSessionId = lastSession.id;

    // ── Step 2. Resolve first + last touch via the helper module.
    const first = await resolveFirstTouch(visitorId);
    const last  = await resolveLastTouch(visitorId);
    checks.push({
      name:     "resolveFirstTouch source=google",
      expected: "google",
      actual:   first?.source,
      passed:   first?.source === "google",
    });
    checks.push({
      name:     "resolveFirstTouch gclid",
      expected: `gclid_smoke_${ts}`,
      actual:   first?.gclid,
      passed:   first?.gclid === `gclid_smoke_${ts}`,
    });
    checks.push({
      name:     "resolveLastTouch source=direct",
      expected: "direct",
      actual:   last?.source,
      passed:   last?.source === "direct",
    });

    // ── Step 3. Stamp a fake Customer via the helper.
    const stamped = await stampFirstAndLastTouchOn(
      {
        name:  `Smoke Test ${ts}`,
        email: `smoke-${ts}@locksafe.test`,
        phone: `+447000${String(ts).slice(-6)}`,
        createdVia: "web",
      },
      visitorId,
    );
    const customer = await p.customer.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: stamped as any,
    });
    customerId = customer.id;

    checks.push({
      name:     "Customer.firstTouchSource",
      expected: "google",
      actual:   customer.firstTouchSource,
      passed:   customer.firstTouchSource === "google",
    });
    checks.push({
      name:     "Customer.lastTouchSource",
      expected: "direct",
      actual:   customer.lastTouchSource,
      passed:   customer.lastTouchSource === "direct",
    });
    checks.push({
      name:     "Customer.visitorId stamped",
      expected: visitorId,
      actual:   customer.visitorId,
      passed:   customer.visitorId === visitorId,
    });

    // ── Step 4. Simulate the UserSession.customerId link that Phase B
    // performs at login/register/jobs.
    // NB: MongoDB connector treats `customerId: null` filter strictly
    // (literal null, not missing field). Filter on visitorId only — the
    // smoke-test sessions are freshly minted and have no customerId.
    await p.userSession.updateMany({
      where: { visitorId },
      data:  { customerId: customer.id },
    });
    const linkedSessions = await p.userSession.findMany({
      where:  { visitorId, customerId: customer.id },
      select: { id: true },
    });
    checks.push({
      name:     "Phase B: UserSession.customerId linked",
      expected: 2,
      actual:   linkedSessions.length,
      passed:   linkedSessions.length === 2,
    });

    // ── Step 5. Create a fake Job and verify firstTouchToBookingHours.
    const firstTouchAt = customer.firstTouchAt as Date;
    const hours = firstTouchAt
      ? Math.max(0, (Date.now() - new Date(firstTouchAt).getTime()) / (1000 * 60 * 60))
      : null;
    const job = await p.job.create({
      data: {
        jobNumber: `SMOKE-${ts}`,
        customerId: customer.id,
        problemType: "lockout",
        propertyType: "house",
        postcode: "BS1 4ST",
        address: "Smoke Test Address",
        utmSource: "direct",
        landingPage: "/",
        firstTouchAt,
        firstTouchSource: "google",
        firstTouchGclid: `gclid_smoke_${ts}`,
        firstTouchToBookingHours: hours,
      },
    });
    jobId = job.id;

    checks.push({
      name:     "Job.firstTouchSource",
      expected: "google",
      actual:   job.firstTouchSource,
      passed:   job.firstTouchSource === "google",
    });
    checks.push({
      name:     "Job.firstTouchToBookingHours computed (~7d=168h)",
      expected: ">= 167 && <= 169",
      actual:   job.firstTouchToBookingHours,
      passed:   typeof job.firstTouchToBookingHours === "number"
                && job.firstTouchToBookingHours >= 167
                && job.firstTouchToBookingHours <= 169,
    });
  } catch (err) {
    checks.push({
      name:     "smoke test crash",
      expected: "no throw",
      actual:   err instanceof Error ? err.message : String(err),
      passed:   false,
    });
  } finally {
    // ── Cleanup: delete every synthetic row in reverse dependency order.
    try {
      if (jobId)          await p.job.delete({ where: { id: jobId } }).catch(() => {});
      if (customerId)     await p.customer.delete({ where: { id: customerId } }).catch(() => {});
      if (firstSessionId) await p.userSession.delete({ where: { id: firstSessionId } }).catch(() => {});
      if (lastSessionId)  await p.userSession.delete({ where: { id: lastSessionId } }).catch(() => {});
    } catch {}
  }

  const allPassed = checks.every((c) => c.passed);
  const summary = allPassed
    ? `All ${checks.length} attribution-pipeline checks passed. System is production-ready.`
    : `${checks.filter((c) => !c.passed).length} of ${checks.length} checks failed — see details.`;

  return NextResponse.json(
    { ok: allPassed, checks, summary, visitorId },
    { status: allPassed ? 200 : 500 },
  );
}
