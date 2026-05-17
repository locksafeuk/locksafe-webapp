import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

/**
 * GET /api/cron/performance-scores
 *
 * Runs daily at 03:00 UTC.
 * Recalculates performance scores for all active locksmiths based on the
 * last 90 days of activity. Scores are used as a tiebreaker in dispatch.
 *
 * Composite score (0–100):
 *   30% — Average star rating (out of 5)
 *   25% — Job completion rate (SIGNED / ACCEPTED)
 *   20% — Acceptance rate (accepted offers / total offers notified)
 *   15% — On-time rate (arrived within ETA + 15 min buffer)
 *   10% — Average response time (inverse: faster = higher score)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60_000); // 90 days

  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      rating: true,           // Pre-computed average from all reviews
      totalJobs: true,
    },
  });

  let updated = 0;

  for (const ls of locksmiths) {
    try {
      // ── Jobs in window ──────────────────────────────────────────────
      const windowJobs = await prisma.job.findMany({
        where: {
          locksmithId: ls.id,
          acceptedAt: { gte: windowStart },
        },
        select: {
          status: true,
          acceptedAt: true,
          enRouteAt: true,
          arrivedAt: true,
          signedAt: true,
          acceptedEta: true,
        },
      });

      const ACTIVE_STATUSES = new Set<JobStatus>([
        JobStatus.ACCEPTED,
        JobStatus.EN_ROUTE,
        JobStatus.ARRIVED,
        JobStatus.DIAGNOSING,
        JobStatus.QUOTED,
        JobStatus.QUOTE_ACCEPTED,
        JobStatus.IN_PROGRESS,
        JobStatus.PENDING_CUSTOMER_CONFIRMATION,
        JobStatus.COMPLETED,
        JobStatus.SIGNED,
      ]);
      const acceptedJobs = windowJobs.filter((j) => ACTIVE_STATUSES.has(j.status));
      const signedJobs = windowJobs.filter((j) => j.status === JobStatus.SIGNED);

      // ── Completion rate ─────────────────────────────────────────────
      const completionRate =
        acceptedJobs.length > 0 ? signedJobs.length / acceptedJobs.length : 1.0;

      // ── On-time rate (arrived within acceptedEta + 15 min) ──────────
      const jobsWithEta = acceptedJobs.filter(
        (j) => j.acceptedAt && j.arrivedAt && j.acceptedEta
      );
      let onTimeCount = 0;
      for (const j of jobsWithEta) {
        const etaMs = (j.acceptedEta! + 15) * 60_000;
        const actualMs = j.arrivedAt!.getTime() - j.acceptedAt!.getTime();
        if (actualMs <= etaMs) onTimeCount++;
      }
      const onTimeRate = jobsWithEta.length > 0 ? onTimeCount / jobsWithEta.length : 1.0;

      // ── Average response time (minutes from notifiedAt → acceptedAt on job) ──
      // Since we store notifiedAt at job level (not per-locksmith), use applications
      const applications = await prisma.locksmithApplication.findMany({
        where: {
          locksmithId: ls.id,
          createdAt: { gte: windowStart },
        },
        include: {
          job: { select: { notifiedAt: true, status: true } },
        },
      });

      const acceptedApps = applications.filter((a) => a.status === "accepted");
      const totalApps = applications.length;
      const acceptanceRate = totalApps > 0 ? acceptedApps.length / totalApps : 1.0;

      // Response time: time from job notification to application
      const responseTimes = applications
        .filter((a) => a.job.notifiedAt)
        .map((a) => (a.createdAt.getTime() - a.job.notifiedAt!.getTime()) / 60_000);

      const avgResponseMinutes =
        responseTimes.length > 0
          ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
          : 5.0;

      // ── Composite score ─────────────────────────────────────────────
      // Rating: 0–5 → 0–100 (normalise)
      const ratingScore = ((ls.rating ?? 5.0) / 5.0) * 100;
      // Completion rate: 0–1 → 0–100
      const completionScore = completionRate * 100;
      // Acceptance rate: 0–1 → 0–100
      const acceptanceScore = acceptanceRate * 100;
      // On-time rate: 0–1 → 0–100
      const onTimeScore = onTimeRate * 100;
      // Response time: cap at 60 min, invert so faster = higher
      const responseScore = Math.max(0, 100 - (Math.min(avgResponseMinutes, 60) / 60) * 100);

      const performanceScore =
        ratingScore * 0.30 +
        completionScore * 0.25 +
        acceptanceScore * 0.20 +
        onTimeScore * 0.15 +
        responseScore * 0.10;

      await prisma.locksmith.update({
        where: { id: ls.id },
        data: {
          acceptanceRate: Math.round(acceptanceRate * 1000) / 1000,
          avgResponseMinutes: Math.round(avgResponseMinutes * 10) / 10,
          onTimeRate: Math.round(onTimeRate * 1000) / 1000,
          performanceScore: Math.round(performanceScore * 10) / 10,
          performanceScoredAt: now,
        },
      });

      updated++;
    } catch (e) {
      console.error(`[PerfScores] Failed for ${ls.id} (${ls.name}):`, e);
    }
  }

  return NextResponse.json({
    success: true,
    locksmiths: locksmiths.length,
    updated,
    runAt: now.toISOString(),
  });
}
