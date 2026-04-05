/**
 * Agent API: Alerts Endpoint
 *
 * GET /api/agent/alerts - Get pending alerts and issues
 * POST /api/agent/alerts/resolve - Mark an alert as resolved
 *
 * Returns actionable alerts for admin attention.
 */

import { verifyApiKey } from "@/lib/agent-auth";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

interface Alert {
  id: string;
  type:
    | "urgent_job"
    | "insurance_expiring"
    | "stuck_job"
    | "no_coverage"
    | "pending_payout"
    | "low_availability";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  data: Record<string, unknown>;
  actions: string[];
  createdAt: string;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = verifyApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  try {
    const alerts: Alert[] = [];
    const now = new Date();

    // 1. Urgent pending jobs (> 30 minutes without locksmith)
    const urgentJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        applications: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    for (const job of urgentJobs) {
      const minutesWaiting = Math.round(
        (now.getTime() - job.createdAt.getTime()) / (1000 * 60),
      );
      alerts.push({
        id: `urgent-${job.id}`,
        type: "urgent_job",
        severity: minutesWaiting > 60 ? "critical" : "warning",
        title: `Job ${job.jobNumber} waiting ${minutesWaiting} mins`,
        message: `${job.customer?.name || "Customer"} at ${job.postcode} - ${job.problemType}. ${job.applications.length} applications received.`,
        data: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          postcode: job.postcode,
          customerPhone: job.customer?.phone,
          applicationCount: job.applications.length,
          minutesWaiting,
        },
        actions: ["view_job", "find_locksmiths", "contact_customer"],
        createdAt: job.createdAt.toISOString(),
      });
    }

    // 2. Stuck jobs (accepted but no progress for 2+ hours)
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: { in: [JobStatus.ACCEPTED, JobStatus.EN_ROUTE] },
        acceptedAt: { lte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        arrivedAt: null,
      },
      include: {
        customer: { select: { name: true, phone: true } },
        locksmith: { select: { name: true, phone: true } },
      },
      take: 5,
    });

    for (const job of stuckJobs) {
      const hoursStuck = Math.round(
        (now.getTime() - (job.acceptedAt?.getTime() || now.getTime())) /
          (1000 * 60 * 60),
      );
      alerts.push({
        id: `stuck-${job.id}`,
        type: "stuck_job",
        severity: "warning",
        title: `Job ${job.jobNumber} - No arrival after ${hoursStuck}h`,
        message: `Locksmith ${job.locksmith?.name || "Unknown"} hasn't marked arrival. Customer: ${job.customer?.name}`,
        data: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          locksmithName: job.locksmith?.name,
          locksmithPhone: job.locksmith?.phone,
          customerPhone: job.customer?.phone,
          hoursStuck,
        },
        actions: ["contact_locksmith", "contact_customer", "reassign_job"],
        createdAt: (job.acceptedAt || job.createdAt).toISOString(),
      });
    }

    // 3. Insurance expiring soon
    const expiringInsurance = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        insuranceExpiryDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        insuranceExpiryDate: true,
        insuranceReminderSent: true,
      },
      orderBy: { insuranceExpiryDate: "asc" },
    });

    for (const ls of expiringInsurance) {
      const expiryDate = ls.insuranceExpiryDate
        ? new Date(ls.insuranceExpiryDate)
        : new Date();
      const daysLeft = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      alerts.push({
        id: `insurance-${ls.id}`,
        type: "insurance_expiring",
        severity: daysLeft <= 2 ? "critical" : "warning",
        title: `${ls.name}'s insurance expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        message: `${ls.insuranceReminderSent ? "Reminder already sent" : "No reminder sent yet"}. Email: ${ls.email}`,
        data: {
          locksmithId: ls.id,
          locksmithName: ls.name,
          email: ls.email,
          phone: ls.phone,
          expiryDate: ls.insuranceExpiryDate?.toISOString(),
          daysLeft,
          reminderSent: ls.insuranceReminderSent,
        },
        actions: ["send_reminder", "view_locksmith", "suspend_locksmith"],
        createdAt: now.toISOString(),
      });
    }

    // 4. Low availability (< 3 locksmiths available)
    const availableCount = await prisma.locksmith.count({
      where: { isActive: true, isVerified: true, isAvailable: true },
    });

    if (availableCount < 3) {
      const offlineLocksmiths = await prisma.locksmith.findMany({
        where: { isActive: true, isVerified: true, isAvailable: false },
        select: {
          id: true,
          name: true,
          phone: true,
          lastAvailabilityChange: true,
        },
        orderBy: { lastAvailabilityChange: "desc" },
        take: 5,
      });

      alerts.push({
        id: "low-availability",
        type: "low_availability",
        severity: availableCount === 0 ? "critical" : "warning",
        title: `Only ${availableCount} locksmith${availableCount !== 1 ? "s" : ""} available`,
        message: `Low coverage may lead to missed jobs. Recently offline: ${offlineLocksmiths.map((l) => l.name).join(", ")}`,
        data: {
          availableCount,
          offlineLocksmiths: offlineLocksmiths.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            offlineSince: l.lastAvailabilityChange?.toISOString(),
          })),
        },
        actions: ["notify_locksmiths", "view_availability"],
        createdAt: now.toISOString(),
      });
    }

    // 5. Pending payouts
    const pendingPayouts = await prisma.payout.findMany({
      where: { status: "pending" },
      include: {
        locksmith: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingPayouts.length > 0) {
      const totalPending = pendingPayouts.reduce(
        (sum, p) => sum + p.netAmount,
        0,
      );
      alerts.push({
        id: "pending-payouts",
        type: "pending_payout",
        severity: pendingPayouts.length > 5 ? "warning" : "info",
        title: `${pendingPayouts.length} pending payout${pendingPayouts.length !== 1 ? "s" : ""} (£${totalPending.toFixed(2)})`,
        message: `Locksmiths waiting: ${pendingPayouts
          .slice(0, 3)
          .map((p) => p.locksmith.name)
          .join(
            ", ",
          )}${pendingPayouts.length > 3 ? ` and ${pendingPayouts.length - 3} more` : ""}`,
        data: {
          count: pendingPayouts.length,
          totalAmount: totalPending,
          payouts: pendingPayouts.map((p) => ({
            id: p.id,
            locksmithName: p.locksmith.name,
            amount: p.netAmount,
            createdAt: p.createdAt.toISOString(),
          })),
        },
        actions: ["process_payouts", "view_payouts"],
        createdAt:
          pendingPayouts[0]?.createdAt.toISOString() || now.toISOString(),
      });
    }

    // Sort by severity and time
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[Agent API] Error fetching alerts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 },
    );
  }
}
