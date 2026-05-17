import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { notifyNewJob, sendAdminAlert } from "@/lib/telegram";
import { JobStatus } from "@prisma/client";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

/**
 * GET /api/cron/auto-redispatch
 *
 * Runs every minute via Vercel cron.
 *
 * Wave logic for PENDING jobs with zero applications:
 *   Wave 1 — job created (at job creation time, not this cron)
 *   Wave 2 — 10 min elapsed, 0 applications → re-notify with expanded radius (+50%)
 *   Wave 3 — 20 min elapsed, still 0 applications → re-notify again + admin alert
 *   Wave 4 — 30 min elapsed, still 0 applications → critical admin alert, flag for manual intervention
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const wave2Cutoff = new Date(now.getTime() - 10 * 60_000); // 10 min ago
  const wave3Cutoff = new Date(now.getTime() - 20 * 60_000); // 20 min ago
  const wave4Cutoff = new Date(now.getTime() - 30 * 60_000); // 30 min ago

  // Find PENDING jobs with 0 applications that are at least 10 min old
  const pendingJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.PENDING,
      createdAt: { lte: wave2Cutoff },
      dispatchAttempts: { lte: 3 }, // Stop after wave 4
    },
    include: {
      applications: { select: { id: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  const results: Array<{
    jobId: string;
    jobNumber: string;
    wave: number;
    action: string;
  }> = [];

  for (const job of pendingJobs) {
    // Skip jobs that already have applications — they just need to be accepted
    if (job.applications.length > 0) continue;

    const ageMs = now.getTime() - job.createdAt.getTime();
    const ageMin = ageMs / 60_000;
    const attempts = job.dispatchAttempts;

    // Determine which wave we're on
    let targetWave: number | null = null;
    if (ageMin >= 30 && attempts < 4) targetWave = 4;
    else if (ageMin >= 20 && attempts < 3) targetWave = 3;
    else if (ageMin >= 10 && attempts < 2) targetWave = 2;

    if (!targetWave) continue;

    // Build a job shape compatible with notifyNearbyLocksmiths
    const jobForNotification = {
      id: job.id,
      jobNumber: job.jobNumber,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode,
      address: job.address,
      latitude: job.latitude,
      longitude: job.longitude,
    };

    if (targetWave === 2) {
      // Expand search radius by 50% via direct DB query + notification
      await notifyWithExpandedRadius(jobForNotification, 1.5);
      await prisma.job.update({
        where: { id: job.id },
        data: { dispatchAttempts: 2, lastDispatchAt: now },
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 2, action: "expanded_radius_notify" });

    } else if (targetWave === 3) {
      // Second expanded re-dispatch + admin alert
      await notifyWithExpandedRadius(jobForNotification, 2.0);
      await sendAdminAlert({
        title: `⚠️ No locksmith for ${job.jobNumber} (20 min)`,
        message: `Job ${job.jobNumber} (${job.problemType} in ${job.postcode}) has had no applications in 20 minutes. Wave 3 dispatched at 2× radius.\n\nCustomer: ${job.customer.name} (${job.customer.email})`,
        severity: "warning",
      });
      await prisma.job.update({
        where: { id: job.id },
        data: { dispatchAttempts: 3, lastDispatchAt: now },
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 3, action: "expanded_radius_notify+alert" });

    } else if (targetWave === 4) {
      // Critical alert — needs manual intervention
      await sendAdminAlert({
        title: `🚨 CRITICAL: No locksmith for ${job.jobNumber} (30 min)`,
        message: `Job ${job.jobNumber} (${job.problemType} in ${job.postcode}) has had NO locksmith in 30 minutes.\n\nCustomer: ${job.customer.name} (${job.customer.email})\n\n⚡ Manual intervention required — consider calling nearby locksmiths directly or cancelling with full refund.`,
        severity: "error",
      });
      await prisma.job.update({
        where: { id: job.id },
        data: { dispatchAttempts: 4, lastDispatchAt: now },
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 4, action: "critical_alert" });
    }
  }

  return NextResponse.json({
    success: true,
    processed: pendingJobs.length,
    actioned: results.length,
    results,
    runAt: now.toISOString(),
  });
}

/**
 * Find locksmiths with an expanded coverage radius multiplier and notify them,
 * excluding locksmiths who were already notified (stored in job.notifiedLocksmithIds).
 */
async function notifyWithExpandedRadius(
  job: {
    id: string;
    jobNumber: string;
    problemType: string;
    propertyType?: string | null;
    postcode: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  },
  radiusMultiplier: number
): Promise<void> {
  if (!job.latitude || !job.longitude) return;

  // Fetch the job's already-notified locksmith IDs
  const jobRecord = await prisma.job.findUnique({
    where: { id: job.id },
    select: { notifiedLocksmithIds: true },
  });
  const alreadyNotified = new Set(jobRecord?.notifiedLocksmithIds ?? []);

  const { calculateDistanceMiles } = await import("@/lib/utils");
  const { sendNewJobInAreaEmail } = await import("@/lib/email");
  const { sendNativePushToMany } = await import("@/lib/native-push");

  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      isAvailable: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
      nativeDeviceToken: true,
      nativeTokenType: true,
      nativeTokenPlatform: true,
    },
  });

  const newNotifications: Array<{
    id: string;
    name: string;
    email: string;
    nativeDeviceToken: string | null;
    nativeTokenType: string | null;
    nativeTokenPlatform: string | null;
  }> = [];

  for (const ls of locksmiths) {
    if (!ls.baseLat || !ls.baseLng) continue;
    if (alreadyNotified.has(ls.id)) continue; // Skip already notified

    const dist = calculateDistanceMiles(ls.baseLat, ls.baseLng, job.latitude!, job.longitude!);
    const expandedRadius = (ls.coverageRadius || 10) * radiusMultiplier;

    if (dist <= expandedRadius) {
      newNotifications.push(ls);
    }
  }

  if (newNotifications.length === 0) return;

  // Send email notifications
  const emailPromises = newNotifications.map((ls) =>
    sendNewJobInAreaEmail(ls.email, {
      locksmithName: ls.name,
      jobNumber: job.jobNumber,
      problemType: job.problemType,
      postcode: job.postcode,
      address: job.address,
      distanceMiles: 0,
      createdAt: new Date().toISOString(),
    }).catch((e) => console.error(`[ReDispatch] Email to ${ls.name} failed:`, e))
  );
  await Promise.allSettled(emailPromises);

  // Native push (mobile)
  const nativeCandidates = newNotifications
    .filter((ls) => ls.nativeDeviceToken && ls.nativeTokenType)
    .map((ls) => ({
      id: ls.id,
      name: ls.name,
      nativeDeviceToken: ls.nativeDeviceToken!,
      nativeTokenType: ls.nativeTokenType!,
      nativeTokenPlatform: ls.nativeTokenPlatform ?? "unknown",
    }));
  if (nativeCandidates.length > 0) {
    await sendNativePushToMany(nativeCandidates, {
      title: "🔑 New job in your area (re-dispatch)",
      body: `${job.problemType} at ${job.postcode} — still unassigned. Be first to apply!`,
      data: { jobId: job.id, type: "new_job" },
    }).catch(console.error);
  }

  // Update the job's notifiedLocksmithIds list
  const newIds = newNotifications.map((ls) => ls.id);
  await prisma.job.update({
    where: { id: job.id },
    data: {
      notifiedLocksmithIds: {
        push: newIds,
      },
    },
  });
}
