/**
 * GET /api/admin/google-ads/attribution-chain-diag
 *
 * End-to-end diagnostic of the Google Ads attribution chain. Reports
 * the count of records at each stage so we can see EXACTLY where it
 * breaks. Last 30 days, read-only.
 *
 * Chain:
 *   landing page (?gclid=...)
 *     → useUserTracking hook fires
 *     → POST /api/marketing/session creates UserSession with gclid
 *   booking form
 *     → reads visitorId from localStorage
 *     → POSTs to /api/jobs with visitorId
 *   /api/jobs
 *     → if visitorId, calls getAttributionForVisitor → reads gclid from UserSession
 *     → stamps gclid on Job row
 *   Stripe webhook on payment_intent.succeeded (type quote|final)
 *     → calls uploadJobConversionIfEligible(jobId)
 *     → reads Job.gclid, sends to Google Ads Conversions API
 *     → stamps conversionUploadedAt on Job
 *
 * Failure modes we look for:
 *   - 0 sessions with gclid → capture is broken (hook not firing or POST failing)
 *   - sessions have gclid but jobs don't → visitorId not passed at booking,
 *     OR getAttributionForVisitor lookup failing
 *   - jobs have gclid but no upload → Stripe webhook for full payment not firing,
 *     OR uploadJobConversionIfEligible erroring silently
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // STAGE 1: UserSession with gclid in last 30d — is the landing-page capture working?
  const sessionsTotal = await prisma.userSession.count({
    where: { createdAt: { gte: since } },
  });
  const sessionsWithGclid = await prisma.userSession.count({
    where: { createdAt: { gte: since }, gclid: { not: null } },
  });
  const sessionsWithUtmSource = await prisma.userSession.count({
    where: { createdAt: { gte: since }, utmSource: { not: null } },
  });

  // STAGE 2: Jobs with gclid in last 30d — did capture propagate?
  const jobsTotal = await prisma.job.count({
    where: { createdAt: { gte: since } },
  });
  const jobsWithGclid = await prisma.job.count({
    where: { createdAt: { gte: since }, gclid: { not: null } },
  });
  const jobsWithUtmSource = await prisma.job.count({
    where: { createdAt: { gte: since }, utmSource: { not: null } },
  });

  // STAGE 2b: Jobs in COMPLETED state — the ones that SHOULD have triggered upload.
  const completedJobs = await prisma.job.findMany({
    where: { createdAt: { gte: since }, status: "COMPLETED" },
    select: {
      id: true,
      jobNumber: true,
      gclid: true,
      utmSource: true,
      utmCampaign: true,
      conversionUploadStatus: true,
      conversionUploadedAt: true,
      conversionUploadError: true,
      paymentReceived: true,
    },
  });

  // STAGE 3: Conversion upload attempts in last 30d — did the webhook fire?
  const uploadStatusCounts: Record<string, number> = {};
  const allJobsLast30d = await prisma.job.findMany({
    where: { createdAt: { gte: since } },
    select: { conversionUploadStatus: true },
  });
  for (const j of allJobsLast30d) {
    const k = j.conversionUploadStatus || "(never_attempted)";
    uploadStatusCounts[k] = (uploadStatusCounts[k] || 0) + 1;
  }

  // STAGE 4: CallIntent path — phone-call attribution.
  let callIntents: { total: number; withGclid: number; matched: number } | null = null;
  try {
    const totalIntents = await prisma.callIntent.count({
      where: { createdAt: { gte: since } },
    });
    const withGclid = await prisma.callIntent.count({
      where: { createdAt: { gte: since }, gclid: { not: null } },
    });
    const matched = await prisma.callIntent.count({
      where: { createdAt: { gte: since }, matchedJobId: { not: null } },
    });
    callIntents = { total: totalIntents, withGclid, matched };
  } catch {
    callIntents = null;
  }

  // Build a clear verdict.
  const verdict: string[] = [];
  if (sessionsTotal === 0) {
    verdict.push("CRITICAL: zero UserSessions in last 30d — useUserTracking hook NOT firing on landing pages");
  } else if (sessionsWithGclid === 0) {
    verdict.push(
      `CHAIN BREAK at STAGE 1: ${sessionsTotal} sessions but 0 have gclid → either (a) zero Google Ads traffic in last 30d, or (b) gclid param is being stripped before useUserTracking reads it (check landing-page redirects)`,
    );
  } else if (jobsWithGclid === 0 && sessionsWithGclid > 0) {
    verdict.push(
      `CHAIN BREAK at STAGE 2: ${sessionsWithGclid} sessions have gclid but 0 jobs do → either (a) the booking form doesn't pass visitorId to /api/jobs, or (b) getAttributionForVisitor is failing to find the session`,
    );
  } else if (jobsWithGclid > 0 && completedJobs.filter((j: { conversionUploadStatus: string | null }) => j.conversionUploadStatus === "uploaded").length === 0) {
    verdict.push(
      `CHAIN BREAK at STAGE 3: jobs have gclid but 0 uploads succeeded → check Stripe webhook payment type metadata + uploadJobConversionIfEligible error path`,
    );
  } else {
    verdict.push("Chain looks healthy in last 30d.");
  }

  return NextResponse.json({
    windowDays: 30,
    since: since.toISOString(),
    stage1_landing_capture: {
      sessions_total: sessionsTotal,
      sessions_with_gclid: sessionsWithGclid,
      sessions_with_utmSource: sessionsWithUtmSource,
    },
    stage2_job_attribution: {
      jobs_total: jobsTotal,
      jobs_with_gclid: jobsWithGclid,
      jobs_with_utmSource: jobsWithUtmSource,
    },
    stage2b_completed_jobs: {
      count: completedJobs.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      breakdown: completedJobs.map((j: any) => ({
        jobNumber: j.jobNumber,
        hasGclid: !!j.gclid,
        gclid_prefix: j.gclid ? j.gclid.slice(0, 8) : null,
        utmSource: j.utmSource,
        utmCampaign: j.utmCampaign,
        paymentReceived: j.paymentReceived,
        conversionUploadStatus: j.conversionUploadStatus,
        conversionUploadError: j.conversionUploadError,
      })),
    },
    stage3_upload_status: {
      breakdown: uploadStatusCounts,
    },
    stage4_callIntent_path: callIntents,
    verdict,
    next_step_hint:
      "Once the chain break is identified, fix is targeted at the breaking layer. Backfill cron can retroactively upload conversions for past Jobs with gclid that never fired.",
  });
}
