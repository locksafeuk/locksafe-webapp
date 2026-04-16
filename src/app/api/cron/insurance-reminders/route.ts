import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendInsuranceExpiryReminderEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/config";

/**
 * API endpoint to check for expiring insurance and send reminder emails.
 * Should be called by a cron job daily.
 *
 * GET /api/cron/insurance-reminders
 *
 * Query params:
 * - secret: Secret key to authorize cron job (required in production)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const reminderThresholds = [30, 14, 7, 3, 1, 0, -1, -7]; // Days before/after expiry

    // Find locksmiths with insurance expiring soon or expired
    const locksmiths = await prisma.locksmith.findMany({
      where: {
        insuranceExpiryDate: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        insuranceExpiryDate: true,
        insuranceReminderSent: true,
        insuranceStatus: true,
      },
    });

    const results = {
      checked: locksmiths.length,
      emailsSent: 0,
      statusUpdates: 0,
      errors: [] as string[],
    };

    for (const locksmith of locksmiths) {
      if (!locksmith.insuranceExpiryDate) continue;

      const expiryDate = new Date(locksmith.insuranceExpiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine the current status
      let newStatus = locksmith.insuranceStatus;
      if (daysUntilExpiry < 0) {
        newStatus = "expired";
      } else if (daysUntilExpiry <= 30) {
        newStatus = "expiring_soon";
      } else if (locksmith.insuranceStatus === "pending") {
        // Keep pending status for newly uploaded documents
        newStatus = "pending";
      }

      // Update status if changed
      if (newStatus !== locksmith.insuranceStatus) {
        await prisma.locksmith.update({
          where: { id: locksmith.id },
          data: { insuranceStatus: newStatus },
        });
        results.statusUpdates++;
      }

      // Determine if we should send a reminder
      // Send reminders at specific thresholds: 30, 14, 7, 3, 1, 0 (on expiry), -1 (1 day after), -7 (7 days after)
      const shouldSendReminder = reminderThresholds.includes(daysUntilExpiry);

      // For expired insurance, send weekly reminders
      const isExpiredWeeklyReminder = daysUntilExpiry < -7 && daysUntilExpiry % 7 === 0;

      if (shouldSendReminder || isExpiredWeeklyReminder) {
        try {
          // Send email reminder
          await sendInsuranceExpiryReminderEmail(locksmith.email, {
            locksmithName: locksmith.name,
            companyName: locksmith.companyName,
            expiryDate,
            daysUntilExpiry,
            renewUrl: `${SITE_URL}/locksmith/settings`,
          });

          // Mark reminder as sent
          await prisma.locksmith.update({
            where: { id: locksmith.id },
            data: { insuranceReminderSent: true },
          });

          results.emailsSent++;
          console.log(
            `[Insurance Reminder] Sent to ${locksmith.email} (${daysUntilExpiry} days until expiry)`
          );
        } catch (error) {
          const errorMsg = `Failed to send reminder to ${locksmith.email}: ${error instanceof Error ? error.message : "Unknown error"}`;
          results.errors.push(errorMsg);
          console.error(`[Insurance Reminder] ${errorMsg}`);
        }
      }
    }

    console.log(
      `[Insurance Reminder] Checked: ${results.checked}, Emails sent: ${results.emailsSent}, Status updates: ${results.statusUpdates}`
    );

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[Insurance Reminder] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process reminders" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to manually trigger a reminder for a specific locksmith
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
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
        insuranceExpiryDate: true,
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (!locksmith.insuranceExpiryDate) {
      return NextResponse.json(
        { success: false, error: "Locksmith has no insurance expiry date set" },
        { status: 400 }
      );
    }

    const expiryDate = new Date(locksmith.insuranceExpiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Send email reminder
    await sendInsuranceExpiryReminderEmail(locksmith.email, {
      locksmithName: locksmith.name,
      companyName: locksmith.companyName,
      expiryDate,
      daysUntilExpiry,
      renewUrl: `${SITE_URL}/locksmith/settings`,
    });

    return NextResponse.json({
      success: true,
      message: `Insurance reminder sent to ${locksmith.email}`,
      daysUntilExpiry,
    });
  } catch (error) {
    console.error("[Insurance Reminder] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send reminder" },
      { status: 500 }
    );
  }
}