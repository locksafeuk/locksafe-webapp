import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";

type IntakeTouchKickoff = {
  track: "independent" | "manager";
  sent: number;
  failed: number;
  attempted: number;
  message?: string;
};

async function triggerImmediateTouchOne(baseUrl: string, cronSecret: string): Promise<IntakeTouchKickoff[]> {
  const tracks: Array<"independent" | "manager"> = ["independent", "manager"];
  const results: IntakeTouchKickoff[] = [];

  for (const track of tracks) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/leads/send-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          mode: "sequence",
          touch: 1,
          track,
          subjectStyle: "benefit",
          variant: 1,
        }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        results.push({
          track,
          sent: 0,
          failed: 0,
          attempted: 0,
          message: data?.error || `HTTP ${response.status}`,
        });
        continue;
      }

      results.push({
        track,
        sent: Number(data?.sent || 0),
        failed: Number(data?.failed || 0),
        attempted: Number(data?.sequence?.attempted || 0),
        message: typeof data?.message === "string" ? data.message : undefined,
      });
    } catch (error) {
      results.push({
        track,
        sent: 0,
        failed: 0,
        attempted: 0,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * POST /api/admin/leads/intake
 *
 * Receive a batch of new leads from the scraper and mark them for immediate agent processing.
 * Called after scraper uploads new leads to the database.
 *
 * Triggers:
 * - Immediate email outreach for new leads (Touch 1)
 * - Telegram notification to admin
 * - Optional: enrich leads immediately if enrichment agent is available
 *
 * Auth: Admin token or CRON_SECRET
 */

export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      const cronSecret = process.env.CRON_SECRET;
      const headerSecret = request.headers.get("x-cron-secret");
      if (!cronSecret || headerSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const verified = await verifyToken(token);
      if (!verified) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    const body = await request.json();
    const { batchId, leadCount, leadIds = [], source = "scraper" } = body;

    if (!batchId || leadCount === undefined) {
      return NextResponse.json(
        { error: "batchId and leadCount are required" },
        { status: 400 }
      );
    }

    // 1. Create a batch record for tracking
    const batch = await prisma.leadBatch.create({
      data: {
        batchId,
        source,
        leadCount,
        leadIds: leadIds || [],
        status: "received",
        processedAt: new Date(),
      },
    });

    // 2. Queue depth: count uncontacted ("new") leads.
    //    NOTE: this previously also did `notes: { not: { contains: "[batch:<id>]" } }`,
    //    but on MongoDB `contains` compiles to a regex — the literal "[" and "-"
    //    in "[batch:cron-<ts>]" form an invalid character class ("range out of
    //    order"), which threw 51111. The batch tag isn't applied until step 3
    //    below, so the filter was a no-op regardless. Plain status count is correct.
    const uncontactedCount = await prisma.locksmithLead.count({
      where: { status: "new" },
    });

    // 3. Mark leads with this batch ID for tracking
    if (leadIds.length > 0) {
      // Get existing notes for leads to prepend batch ID
      const existingLeads = await prisma.locksmithLead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, notes: true },
      });

      // Update each lead with batch ID prepended to notes
      for (const lead of existingLeads) {
        const newNote = `[batch:${batchId}] ${lead.notes || ""}`.trim();
        await prisma.locksmithLead.update({
          where: { id: lead.id },
          data: { notes: newNote },
        });
      }
    }

    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const cronSecret = process.env.CRON_SECRET;
    const immediateTouchResults = cronSecret
      ? await triggerImmediateTouchOne(baseUrl, cronSecret)
      : [];

    // 4. Send Telegram alert to admin
    const immediateSummary = immediateTouchResults.length > 0
      ? immediateTouchResults
          .map((result) => `  - ${result.track}: sent ${result.sent}/${result.attempted}${result.message ? ` (${result.message})` : ""}`)
          .join("\n")
      : "  - skipped (CRON_SECRET missing)";

    const summary = `
• Batch ID: \`${batchId}\`
• New leads in batch: ${leadCount}
• Total uncontacted in queue: ${uncontactedCount}
• Source: ${source}
• Time: ${new Date().toISOString()}
• Immediate touch-1 kickoff:
${immediateSummary}

Agent will start outreach immediately for eligible leads.
    `.trim();

    await sendAdminAlert({
      title: "🔥 Lead Batch Received",
      message: summary,
      severity: "info",
    });

    // 5. Prepare response with guidance
    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchId: batch.batchId,
        leadCount: batch.leadCount,
        status: batch.status,
      },
      queue: {
        totalUncontacted: uncontactedCount,
        nextOutreachTime: "Immediately via cron (next 30-min window)",
        estimatedTouchCount: uncontactedCount, // Each gets Touch 1
      },
      immediateTouch1: immediateTouchResults,
      message: `Batch ${batchId} received and queued for autonomous outreach.`,
    });
  } catch (error) {
    console.error("[Lead Intake] Error:", error);

    // Notify admin of failure
    try {
      await sendAdminAlert({
        title: "❌ Lead Batch Intake Failed",
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    } catch (telegramErr) {
      console.error("[Lead Intake] Telegram notification failed:", telegramErr);
    }

    return NextResponse.json(
      { error: "Failed to intake lead batch" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/leads/intake
 *
 * Monitor recent batch intake status and queue depth.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin auth
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const verified = await verifyToken(token);
    if (!verified) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get recent batches (last 7 days)
    const recentBatches = await prisma.leadBatch.findMany({
      where: {
        processedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { processedAt: "desc" },
      take: 20,
    });

    // Get queue depth
    const uncontactedCount = await prisma.locksmithLead.count({
      where: { status: "new" },
    });
    const contactedCount = await prisma.locksmithLead.count({
      where: { status: "contacted" },
    });

    return NextResponse.json({
      success: true,
      recentBatches,
      queueDepth: {
        uncontacted: uncontactedCount,
        contacted: contactedCount,
        totalLeads: uncontactedCount + contactedCount,
      },
    });
  } catch (error) {
    console.error("[Lead Intake GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch intake status" },
      { status: 500 }
    );
  }
}
