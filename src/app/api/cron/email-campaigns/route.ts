import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmailCampaignById } from "@/lib/email-campaign-sender";
import { sendAdminAlert } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
      },
    });

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ success: true, processed: 0, campaigns: [] });
    }

    const outcomes: Array<{
      campaignId: string;
      name: string;
      sent: number;
      failed: number;
      eligible: number;
      ok: boolean;
      error?: string;
    }> = [];

    for (const campaign of dueCampaigns) {
      try {
        const result = await sendEmailCampaignById(campaign.id);
        outcomes.push({
          campaignId: campaign.id,
          name: campaign.name,
          sent: result.sent,
          failed: result.failed,
          eligible: result.eligible,
          ok: true,
        });
      } catch (error) {
        outcomes.push({
          campaignId: campaign.id,
          name: campaign.name,
          sent: 0,
          failed: 0,
          eligible: 0,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const failed = outcomes.filter((o) => !o.ok);
    if (failed.length > 0) {
      await sendAdminAlert({
        title: "Scheduled Email Campaign Failures",
        severity: "warning",
        message: failed
          .map((o) => `${o.name} (${o.campaignId}): ${o.error || "Unknown error"}`)
          .join("\n"),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      processed: outcomes.length,
      campaigns: outcomes,
    });
  } catch (error) {
    console.error("[cron/email-campaigns] Fatal error:", error);
    return NextResponse.json({ success: false, error: "Cron failed" }, { status: 500 });
  }
}
