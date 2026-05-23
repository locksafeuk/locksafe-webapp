import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { notifyNewJob } from "@/lib/telegram";
import { JobStatus } from "@prisma/client";

/**
 * GET /api/cron/dispatch-scheduled-jobs
 *
 * Runs every minute. Finds SCHEDULED jobs whose `scheduledFor` time has arrived
 * (within the next 60 minutes) and transitions them to PENDING, triggering the
 * normal locksmith dispatch flow.
 *
 * The 60-minute look-ahead gives locksmiths time to accept before the appointment.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dispatchWindow = new Date(now.getTime() + 60 * 60 * 1000); // 60 min ahead

  // Find jobs that are SCHEDULED and within the dispatch window
  const jobsToDispatch = await prisma.job.findMany({
    where: {
      status: JobStatus.SCHEDULED,
      scheduledFor: {
        lte: dispatchWindow,
      },
    },
    include: {
      customer: { select: { name: true, phone: true } },
    },
    take: 50,
  });

  const results = { dispatched: 0, errors: 0 };

  for (const job of jobsToDispatch) {
    try {
      // Transition to PENDING so auction / dispatch logic picks it up
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.PENDING },
      });

      // Notify nearby locksmiths (same as at job creation time)
      notifyNearbyLocksmiths({
        id: job.id,
        jobNumber: job.jobNumber,
        problemType: job.problemType,
        propertyType: job.propertyType,
        postcode: job.postcode,
        address: job.address,
        latitude: job.latitude,
        longitude: job.longitude,
        createdAt: job.createdAt.toISOString(),
      }).catch((err) => console.error(`[DispatchCron] Notify error for job ${job.jobNumber}:`, err));

      // Telegram admin notification
      notifyNewJob({
        jobNumber: job.jobNumber,
        jobId: job.id,
        customerName: job.customer?.name ?? "Unknown",
        customerPhone: job.customer?.phone ?? "",
        problemType: job.problemType,
        propertyType: job.propertyType,
        postcode: job.postcode,
        address: job.address ?? "",
        description: job.description ?? "",
        isUrgent: false,
      }).catch(() => {});

      results.dispatched++;
      console.log(`[DispatchCron] Dispatched scheduled job ${job.jobNumber}`);
    } catch (err) {
      console.error(`[DispatchCron] Failed to dispatch job ${job.id}:`, err);
      results.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    dispatched: results.dispatched,
    errors: results.errors,
    runAt: now.toISOString(),
  });
}
