import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma, { nullOrUnset } from "@/lib/db";
import { sendWinBackEmail } from "@/lib/email";
import { JobStatus } from "@prisma/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";

/**
 * GET /api/cron/win-back
 *
 * Runs daily at 10:00 UTC.
 *
 * Sends re-engagement emails to customers whose last SIGNED job was exactly
 * 30 days ago (within a 24-hour window) and who haven't booked since.
 *
 * Tracks sends via Job.winBackSentAt to prevent duplicates.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Window: jobs signed 30–31 days ago
  const windowEnd = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  const windowStart = new Date(now.getTime() - 31 * 24 * 60 * 60_000);

  // Find the most-recent SIGNED job per customer that falls in window,
  // and whose winBackSentAt is null (i.e. no win-back sent yet)
  const jobs = await prisma.job.findMany({
    where: {
      status: JobStatus.SIGNED,
      signedAt: { gte: windowStart, lte: windowEnd },
      // Mongo: `winBackSentAt: null` misses jobs where the field was never set
      // (no win-back sent yet) — match null OR missing.
      ...nullOrUnset("winBackSentAt"),
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          referralCode: true,
          // Find if customer has any newer job (we'll filter below)
          jobs: {
            where: {
              status: { in: [JobStatus.SIGNED, JobStatus.COMPLETED] },
              signedAt: { gt: windowEnd },
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    take: 100, // process in batches
  });

  const results: Array<{ jobId: string; customerId: string; status: string }> = [];

  for (const job of jobs) {
    // Skip if customer has a more recent completed job (they're already active)
    if (job.customer.jobs.length > 0) {
      await prisma.job.update({
        where: { id: job.id },
        data: { winBackSentAt: now }, // Mark to avoid re-checking daily
      });
      continue;
    }

    if (!job.customer.email) continue; // Skip customers without email

    const lastJobDate = job.signedAt
      ? job.signedAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "recently";

    try {
      await sendWinBackEmail({
        customerEmail: job.customer.email,
        customerName: job.customer.name,
        lastJobDate,
        lastJobType: job.problemType,
        bookingUrl: `${SITE_URL}/book?utm_source=winback&utm_medium=email&utm_campaign=30day`,
        referralCode: job.customer.referralCode ?? undefined,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { winBackSentAt: now },
      });

      results.push({ jobId: job.id, customerId: job.customer.id, status: "sent" });
    } catch (e) {
      console.error(`[WinBack] Email failed for job ${job.jobNumber}:`, e);
      results.push({ jobId: job.id, customerId: job.customer.id, status: "failed" });
    }
  }

  return NextResponse.json({
    success: true,
    candidates: jobs.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    runAt: now.toISOString(),
  });
}
