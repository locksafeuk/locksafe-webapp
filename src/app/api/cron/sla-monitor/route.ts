import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { JobStatus } from "@prisma/client";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

// SLA thresholds
const SLA = {
  // Minutes after job ACCEPTED with no EN_ROUTE update → alert admin
  ACCEPTED_TO_EN_ROUTE_WARN_MINUTES: 10,
  // Minutes after job ACCEPTED with no EN_ROUTE → force-escalate
  ACCEPTED_TO_EN_ROUTE_ESCALATE_MINUTES: 20,
  // Minutes after EN_ROUTE with no ARRIVED (beyond stated ETA) → alert
  ETA_OVERRUN_MINUTES: 15,
  // Minutes after QUOTED with no customer response → remind customer
  QUOTE_RESPONSE_REMIND_MINUTES: 20,
};

/**
 * GET /api/cron/sla-monitor
 * Runs every minute. Checks for SLA breaches across all active jobs.
 *
 * Actions:
 * 1. Locksmith accepted but not marked EN_ROUTE → admin alert + telegram ping
 * 2. Locksmith EN_ROUTE but ETA overrun → admin alert
 * 3. Customer has had a quote for >20 mins and not responded → SMS reminder
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { checked: 0, alerts: 0, errors: 0 };

  // ----------------------------------------------------------------
  // 1. Jobs ACCEPTED but locksmith hasn't marked EN_ROUTE
  // ----------------------------------------------------------------
  const acceptedWarnCutoff = new Date(now.getTime() - CRON_SLA_MIN("ACCEPTED_TO_EN_ROUTE_WARN") * 60 * 1000);
  const acceptedJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.ACCEPTED,
      acceptedAt: {
        not: null,
        lte: acceptedWarnCutoff,
      },
    },
    include: {
      locksmith: { select: { name: true, phone: true } },
      customer: { select: { name: true } },
    },
    take: 50,
  });

  for (const job of acceptedJobs) {
    results.checked++;
    try {
      const minsElapsed = Math.floor(
        (now.getTime() - new Date(job.acceptedAt!).getTime()) / 60000
      );

      if (minsElapsed >= CRON_SLA_MIN("ACCEPTED_TO_EN_ROUTE_ESCALATE")) {
        await sendAdminAlert({
          title: "⚠️ SLA BREACH — Locksmith not moving",
          severity: "error",
          message:
            `Job #${job.jobNumber}\n` +
            `Locksmith: ${job.locksmith?.name ?? "unknown"} (${job.locksmith?.phone ?? "no phone"})\n` +
            `Customer: ${job.customer?.name ?? "unknown"}\n` +
            `Accepted ${minsElapsed} min ago — still not EN_ROUTE.\n` +
            `Action required: https://www.locksafe.uk/admin/jobs/${job.id}`,
        });
        results.alerts++;
      } else if (minsElapsed >= CRON_SLA_MIN("ACCEPTED_TO_EN_ROUTE_WARN")) {
        await sendAdminAlert({
          title: "SLA Warning — En Route delay",
          severity: "warning",
          message:
            `Job #${job.jobNumber} — locksmith accepted ${minsElapsed} min ago but has not marked En Route.\n` +
            `Locksmith: ${job.locksmith?.name ?? "unknown"}\n` +
            `Review: https://www.locksafe.uk/admin/jobs/${job.id}`,
        });
        results.alerts++;
      }
    } catch (e) {
      console.error(`[SLA Monitor] Error on accepted job ${job.id}:`, e);
      results.errors++;
    }
  }

  // ----------------------------------------------------------------
  // 2. Jobs EN_ROUTE where locksmith has overrun their stated ETA
  // ----------------------------------------------------------------
  const enRouteJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.EN_ROUTE,
      enRouteAt: { not: null },
      acceptedEta: { not: null, gt: 0 },
    },
    include: {
      locksmith: { select: { name: true, phone: true } },
      customer: { select: { name: true } },
    },
    take: 50,
  });

  for (const job of enRouteJobs) {
    results.checked++;
    try {
      const etaMs = (job.acceptedEta! + CRON_SLA_MIN("ETA_OVERRUN")) * 60 * 1000;
      const elapsedSinceEnRoute = now.getTime() - new Date(job.enRouteAt!).getTime();

      if (elapsedSinceEnRoute > etaMs) {
        const minsOverrun = Math.floor(
          (elapsedSinceEnRoute - job.acceptedEta! * 60 * 1000) / 60000
        );
        await sendAdminAlert({
          title: "ETA Overrun — Locksmith late",
          severity: "warning",
          message:
            `Job #${job.jobNumber}\n` +
            `Promised ETA: ${job.acceptedEta} min. ${minsOverrun} min overrun.\n` +
            `Locksmith: ${job.locksmith?.name ?? "unknown"} (${job.locksmith?.phone ?? "no phone"})\n` +
            `Customer: ${job.customer?.name ?? "unknown"}\n` +
            `Review: https://www.locksafe.uk/admin/jobs/${job.id}`,
        });
        results.alerts++;
      }
    } catch (e) {
      console.error(`[SLA Monitor] Error on en_route job ${job.id}:`, e);
      results.errors++;
    }
  }

  // ----------------------------------------------------------------
  // 3. Jobs QUOTED where customer hasn't responded in >20 mins
  // ----------------------------------------------------------------
  const quotedJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.QUOTED,
      diagnosedAt: {
        lte: new Date(now.getTime() - CRON_SLA_MIN("QUOTE_RESPONSE_REMIND") * 60000),
      },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      locksmith: { select: { name: true } },
      quote: { select: { total: true } },
    },
    take: 50,
  });

  for (const job of quotedJobs) {
    results.checked++;
    try {
      // Only alert — SMS reminder is handled by the main notification system
      await sendAdminAlert({
        title: "Quote awaiting response",
        severity: "info",
        message:
          `Job #${job.jobNumber} — £${job.quote?.total?.toFixed(2) ?? "?"} quote pending.\n` +
          `Customer ${job.customer?.name ?? "unknown"} hasn't responded in >${CRON_SLA_MIN("QUOTE_RESPONSE_REMIND")} min.\n` +
          `Locksmith ${job.locksmith?.name ?? "unknown"} is on site waiting.\n` +
          `View: https://www.locksafe.uk/admin/jobs/${job.id}`,
      });
      results.alerts++;
    } catch (e) {
      console.error(`[SLA Monitor] Error on quoted job ${job.id}:`, e);
      results.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    checked: results.checked,
    alerts: results.alerts,
    errors: results.errors,
    runAt: now.toISOString(),
  });
}

// Helpers to avoid magic numbers in queries
function CRON_SLA_MIN(key: string): number {
  const map: Record<string, number> = {
    ACCEPTED_TO_EN_ROUTE_WARN: SLA.ACCEPTED_TO_EN_ROUTE_WARN_MINUTES,
    ACCEPTED_TO_EN_ROUTE_ESCALATE: SLA.ACCEPTED_TO_EN_ROUTE_ESCALATE_MINUTES,
    ETA_OVERRUN: SLA.ETA_OVERRUN_MINUTES,
    QUOTE_RESPONSE_REMIND: SLA.QUOTE_RESPONSE_REMIND_MINUTES,
  };
  return map[key] ?? 15;
}
