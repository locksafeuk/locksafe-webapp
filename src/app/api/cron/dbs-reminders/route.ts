import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendDbsExpiryReminderEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/config";

/**
 * GET /api/cron/dbs-reminders
 *
 * Daily cron — checks for locksmiths with DBS certificates expiring soon or
 * already expired, sends email reminders at key thresholds, and updates
 * dbsStatus accordingly.
 *
 * Reminder thresholds: 30, 14, 7, 3, 1, 0, -1, -7 days.
 * For certificates expired > 7 days ago: weekly reminder (every 7 days).
 */
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const reminderThresholds = [30, 14, 7, 3, 1, 0, -1, -7];

    const locksmiths = await prisma.locksmith.findMany({
      where: {
        dbsExpiryDate: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        dbsExpiryDate: true,
        dbsReminderSent: true,
        dbsStatus: true,
      },
    });

    const results = {
      checked: locksmiths.length,
      emailsSent: 0,
      statusUpdates: 0,
      errors: [] as string[],
    };

    for (const locksmith of locksmiths) {
      if (!locksmith.dbsExpiryDate) continue;

      const expiryDate = new Date(locksmith.dbsExpiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine new status
      let newStatus = locksmith.dbsStatus;
      if (daysUntilExpiry < 0) {
        newStatus = "expired";
      } else if (daysUntilExpiry <= 30) {
        newStatus = "expiring_soon";
      } else if (locksmith.dbsStatus === "pending") {
        newStatus = "pending";
      }

      if (newStatus !== locksmith.dbsStatus) {
        await prisma.locksmith.update({
          where: { id: locksmith.id },
          data: { dbsStatus: newStatus },
        });
        results.statusUpdates++;
      }

      const shouldSendReminder = reminderThresholds.includes(daysUntilExpiry);
      const isExpiredWeeklyReminder =
        daysUntilExpiry < -7 && daysUntilExpiry % 7 === 0;

      if (shouldSendReminder || isExpiredWeeklyReminder) {
        try {
          await sendDbsExpiryReminderEmail(locksmith.email, {
            locksmithName: locksmith.name,
            companyName: locksmith.companyName ?? null,
            expiryDate,
            daysUntilExpiry,
            renewUrl: `${SITE_URL}/locksmith/settings`,
          });

          await prisma.locksmith.update({
            where: { id: locksmith.id },
            data: { dbsReminderSent: true },
          });

          results.emailsSent++;
          console.log(
            `[DBS Reminder] Sent to ${locksmith.email} (${daysUntilExpiry} days until expiry)`
          );
        } catch (error) {
          const errorMsg = `Failed to send DBS reminder to ${locksmith.email}: ${error instanceof Error ? error.message : "Unknown error"}`;
          results.errors.push(errorMsg);
          console.error(`[DBS Reminder] ${errorMsg}`);
        }
      }
    }

    console.log(
      `[DBS Reminder] Checked: ${results.checked}, Emails sent: ${results.emailsSent}, Status updates: ${results.statusUpdates}`
    );

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[DBS Reminder] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process DBS reminders",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/dbs-reminders
 * Manually trigger a DBS reminder for a specific locksmith (admin use).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "locksmithId is required" },
        { status: 400 }
      );
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        dbsExpiryDate: true,
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (!locksmith.dbsExpiryDate) {
      return NextResponse.json(
        { success: false, error: "Locksmith has no DBS expiry date set" },
        { status: 400 }
      );
    }

    const expiryDate = new Date(locksmith.dbsExpiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    await sendDbsExpiryReminderEmail(locksmith.email, {
      locksmithName: locksmith.name,
      companyName: locksmith.companyName ?? null,
      expiryDate,
      daysUntilExpiry,
      renewUrl: `${SITE_URL}/locksmith/settings`,
    });

    return NextResponse.json({
      success: true,
      message: `DBS reminder sent to ${locksmith.email}`,
      daysUntilExpiry,
    });
  } catch (error) {
    console.error("[DBS Reminder] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send DBS reminder",
      },
      { status: 500 }
    );
  }
}
