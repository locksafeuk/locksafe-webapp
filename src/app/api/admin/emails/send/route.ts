import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { sendCampaignEmail, type EmailTemplate } from "@/lib/campaign-email";

// POST: Send a campaign to all recipients
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Get campaign with recipients
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          where: { status: "pending" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Campaign has already been sent or is currently sending" },
        { status: 400 }
      );
    }

    if (campaign.recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients to send to" },
        { status: 400 }
      );
    }

    // Update campaign status to sending
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });

    // Send emails to all recipients
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const recipient of campaign.recipients) {
      try {
        const result = await sendCampaignEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: campaign.subject,
          preheader: campaign.preheader || undefined,
          template: campaign.template as EmailTemplate,
          headline: campaign.headline || undefined,
          body: campaign.body,
          ctaText: campaign.ctaText || undefined,
          ctaUrl: campaign.ctaUrl || undefined,
          accentColor: campaign.accentColor,
          recipientId: recipient.id,
        });

        if (result.success) {
          // Update recipient status
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "sent",
              resendEmailId: result.resendId,
            },
          });
          results.sent++;
        } else {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "bounced",
              bounceReason: "Failed to send",
            },
          });
          results.failed++;
          results.errors.push(`${recipient.email}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error sending to ${recipient.email}:`, error);
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "bounced",
            bounceReason: error instanceof Error ? error.message : "Unknown error",
          },
        });
        results.failed++;
        results.errors.push(`${recipient.email}: ${error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update campaign status
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        totalDelivered: results.sent,
        totalBounced: results.failed,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${results.sent} recipients`,
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
