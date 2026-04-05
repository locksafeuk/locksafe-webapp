import { NextRequest, NextResponse } from "next/server";
import { getJobsNeedingReminders, sendSignatureReminder, autoCompleteJob } from "@/lib/notifications";

// Secret to protect the cron endpoint
const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

/**
 * GET - Process signature reminders and auto-completions
 * This should be called by a cron job every 15-30 minutes
 *
 * Usage:
 * curl -X GET "https://your-domain.com/api/cron/signature-reminders" \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token !== CRON_SECRET && process.env.NODE_ENV === "production") {
      console.warn("[Cron] Unauthorized cron request");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting signature reminder check...");

    // Get jobs needing reminders or auto-completion
    const { needsReminder, needsAutoComplete } = await getJobsNeedingReminders();

    console.log(`[Cron] Found ${needsReminder.length} jobs needing reminders, ${needsAutoComplete.length} jobs needing auto-completion`);

    const results = {
      remindersSent: 0,
      autoCompleted: 0,
      errors: [] as string[],
    };

    // Send reminders
    for (const { job, reminderNumber } of needsReminder) {
      try {
        const success = await sendSignatureReminder(job.id, reminderNumber);
        if (success) {
          results.remindersSent++;
          console.log(`[Cron] Sent reminder #${reminderNumber} for job ${job.jobNumber}`);
        }
      } catch (error) {
        const errorMsg = `Failed to send reminder for job ${job.jobNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[Cron] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Auto-complete overdue jobs
    for (const jobId of needsAutoComplete) {
      try {
        const success = await autoCompleteJob(jobId);
        if (success) {
          results.autoCompleted++;
          console.log(`[Cron] Auto-completed job ${jobId}`);
        }
      } catch (error) {
        const errorMsg = `Failed to auto-complete job ${jobId}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[Cron] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[Cron] Completed: ${results.remindersSent} reminders sent, ${results.autoCompleted} jobs auto-completed`);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error processing signature reminders:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process reminders" },
      { status: 500 }
    );
  }
}

/**
 * POST - Same as GET, for flexibility
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
