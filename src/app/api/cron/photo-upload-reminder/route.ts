import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { sendAdminAlert } from "@/lib/telegram";

const WINDOW_MIN_MS = 30 * 60 * 1000;   // 30 minutes — don't fire too early
const WINDOW_MAX_MS = 3 * 60 * 60 * 1000; // 3 hours — stop chasing old jobs

/**
 * GET /api/cron/photo-upload-reminder
 *
 * Runs hourly. Finds jobs that are ARRIVED or IN_PROGRESS and have been in
 * that state between 30 min and 3 hours without any photos uploaded.
 * Sends the assigned locksmith an SMS + email reminder.
 *
 * The 30-min to 3-hr window means each active job episode is caught at most
 * once per hourly run — no log table or schema migration required.
 *
 * curl -X GET "https://locksafe.uk/api/cron/photo-upload-reminder" \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MAX_MS);
  const windowEnd   = new Date(now - WINDOW_MIN_MS);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://locksafe.uk";

  const results = {
    checked: 0,
    reminded: 0,
    errors: [] as string[],
  };

  try {
    // Find jobs that are actively in progress with no photos
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["ARRIVED", "IN_PROGRESS"] },
        locksmithId: { not: null },
        updatedAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        photos: { none: {} },
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        address: true,
        postcode: true,
        problemType: true,
        updatedAt: true,
        locksmith: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    results.checked = jobs.length;

    for (const job of jobs) {
      const locksmith = job.locksmith;
      if (!locksmith) continue;

      const jobUrl = `${baseUrl}/locksmith/jobs/${job.id}`;
      const minutesActive = Math.round((now - job.updatedAt.getTime()) / 60_000);

      try {
        // SMS
        const smsMessage =
          `LockSafe: Hi ${locksmith.name}, please upload photos for job #${job.jobNumber} at ${job.postcode}. ` +
          `Photos are required for payment release. Upload here: ${jobUrl}`;

        await sendSMS(locksmith.phone, smsMessage);

        // Email
        await sendEmail({
          to: locksmith.email,
          subject: `Action required: upload photos for job #${job.jobNumber}`,
          html: `
            <html>
            <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;">
              <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
                <h2 style="margin-top:0;color:#0f172a;">📸 Photos Required: Job #${job.jobNumber}</h2>
                <p>Hi <strong>${locksmith.name}</strong>,</p>
                <p>You have an active job at <strong>${job.address}, ${job.postcode}</strong> but no photos have been uploaded yet.</p>
                <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;color:#9a3412;">
                  <strong>Photos are required before payment can be released.</strong> Please upload at least a before and after photo to document your work.
                </p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                  <tr><td style="padding:6px 0;color:#64748b;">Job number</td><td style="padding:6px 0;font-weight:600;">#${job.jobNumber}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;">Address</td><td style="padding:6px 0;">${job.address}, ${job.postcode}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;">Status</td><td style="padding:6px 0;">${job.status.replace(/_/g, " ")}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;">Active for</td><td style="padding:6px 0;">${minutesActive} minutes</td></tr>
                </table>
                <a href="${jobUrl}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                  Upload Photos Now
                </a>
                <p style="margin-top:20px;font-size:13px;color:#94a3b8;">
                  This is an automated reminder from LockSafe. If you have already uploaded photos please ignore this message.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        results.reminded++;
        console.log(`[photo-upload-reminder] Reminded locksmith ${locksmith.name} for job #${job.jobNumber}`);
      } catch (error) {
        const msg = `Job #${job.jobNumber} (${locksmith.email}): ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[photo-upload-reminder] ${msg}`);
        results.errors.push(msg);
      }
    }

    if (results.reminded > 0 || results.errors.length > 0) {
      await sendAdminAlert(
        `📸 Photo Upload Reminders\n` +
        `Checked: ${results.checked} | Reminded: ${results.reminded} | Errors: ${results.errors.length}` +
        (results.errors.length > 0 ? `\n\nErrors:\n${results.errors.slice(0, 5).join("\n")}` : ""),
      );
    }

    return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[photo-upload-reminder] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
