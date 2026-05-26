import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendEmailCampaignById } from "@/lib/email-campaign-sender";

// POST: Send a campaign to all recipients
export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId, dryRun, maxRecipients } = body;

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const results = await sendEmailCampaignById(campaignId, {
      dryRun: Boolean(dryRun),
      maxRecipients:
        typeof maxRecipients === "number" && maxRecipients > 0 ? maxRecipients : undefined,
    });

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `Dry run complete. Eligible recipients: ${results.eligible}`
        : `Campaign processed. Sent ${results.sent}, failed ${results.failed}`,
      results,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
