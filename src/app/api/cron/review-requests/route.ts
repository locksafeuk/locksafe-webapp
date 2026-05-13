import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyCustomerReviewRequest } from "@/lib/sms";
import { sendReviewRequestEmail } from "@/lib/email";
import { JobStatus } from "@prisma/client";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";

/**
 * GET /api/cron/review-requests
 *
 * Runs every 15 minutes via Vercel cron.
 *
 * Sends review requests to customers after their job is SIGNED:
 *   - Wave 1: 30 min after signedAt → SMS + Email
 *   - Wave 2: 24 hours after signedAt (if no review yet) → Email reminder
 *
 * Tracks sends via Job.reviewRequestedAt (set on wave 1).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const wave1After = new Date(now.getTime() - 30 * 60_000);      // 30 min ago
  const wave2After = new Date(now.getTime() - 24 * 60 * 60_000); // 24 hours ago
  const wave2Before = new Date(now.getTime() - 25 * 60 * 60_000); // cap at 25h to avoid repeats

  const results: Array<{ jobId: string; jobNumber: string; wave: number; channel: string }> = [];

  // === WAVE 1: SIGNED 30+ min ago with no review request sent yet ===
  const wave1Jobs = await prisma.job.findMany({
    where: {
      status: JobStatus.SIGNED,
      signedAt: { lte: wave1After },
      reviewRequestedAt: null,   // not yet sent
      review: null,              // no review yet
    },
    include: {
      customer: { select: { name: true, email: true, phone: true, referralCode: true } },
      locksmith: { select: { name: true } },
    },
    take: 50, // process in batches
  });

  for (const job of wave1Jobs) {
    if (!job.locksmith) continue;
    if (!job.customer.email) continue; // Skip customers without email

    const reviewUrl = `${SITE_URL}/review/${job.id}`;

    // SMS
    try {
      await notifyCustomerReviewRequest({
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        locksmithName: job.locksmith.name,
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 1, channel: "sms" });
    } catch (e) {
      console.error(`[ReviewCron] SMS failed for ${job.jobNumber}:`, e);
    }

    // Email
    try {
      await sendReviewRequestEmail({
        customerEmail: job.customer.email,
        customerName: job.customer.name,
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith.name,
        reviewUrl,
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 1, channel: "email" });
    } catch (e) {
      console.error(`[ReviewCron] Email failed for ${job.jobNumber}:`, e);
    }

    // Mark as sent
    await prisma.job.update({
      where: { id: job.id },
      data: { reviewRequestedAt: now },
    });
  }

  // === WAVE 2: SIGNED 24-25h ago, review request sent, still no review ===
  const wave2Jobs = await prisma.job.findMany({
    where: {
      status: JobStatus.SIGNED,
      reviewRequestedAt: { gte: wave2Before, lte: wave2After },
      review: null,
    },
    include: {
      customer: { select: { name: true, email: true, referralCode: true } },
      locksmith: { select: { name: true } },
    },
    take: 50,
  });

  for (const job of wave2Jobs) {
    if (!job.locksmith) continue;
    if (!job.customer.email) continue;

    const reviewUrl = `${SITE_URL}/review/${job.id}`;

    try {
      await sendReviewRequestEmail({
        customerEmail: job.customer.email,
        customerName: job.customer.name,
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith.name,
        reviewUrl,
        isReminder: true,
      });
      results.push({ jobId: job.id, jobNumber: job.jobNumber, wave: 2, channel: "email" });
    } catch (e) {
      console.error(`[ReviewCron] Wave 2 email failed for ${job.jobNumber}:`, e);
    }
  }

  return NextResponse.json({
    success: true,
    wave1: wave1Jobs.length,
    wave2: wave2Jobs.length,
    actions: results.length,
    results,
    runAt: now.toISOString(),
  });
}
