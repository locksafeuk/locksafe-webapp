import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Resend webhook events
// https://resend.com/docs/dashboard/webhooks/event-types
interface ResendWebhookEvent {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.complained"
    | "email.bounced"
    | "email.opened"
    | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For bounced
    bounce?: {
      message: string;
    };
    // For clicked
    click?: {
      link: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (optional but recommended)
    // const signature = request.headers.get("resend-signature");
    // TODO: Implement signature verification

    const event: ResendWebhookEvent = await request.json();
    const { type, data } = event;

    console.log(`Resend webhook received: ${type}`, data.email_id);

    // Find the recipient by Resend email ID
    const recipient = await prisma.emailRecipient.findFirst({
      where: { resendEmailId: data.email_id },
    });

    if (!recipient) {
      // Not one of our campaign emails, ignore
      return NextResponse.json({ received: true });
    }

    // Handle different event types
    switch (type) {
      case "email.delivered":
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "delivered",
            deliveredAt: new Date(event.created_at),
          },
        });

        // Update campaign stats
        await prisma.emailCampaign.update({
          where: { id: recipient.campaignId },
          data: {
            totalDelivered: { increment: 1 },
          },
        });
        break;

      case "email.bounced":
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "bounced",
            bouncedAt: new Date(event.created_at),
            bounceReason: data.bounce?.message || "Unknown bounce",
          },
        });

        // Update campaign stats
        await prisma.emailCampaign.update({
          where: { id: recipient.campaignId },
          data: {
            totalBounced: { increment: 1 },
          },
        });
        break;

      case "email.complained":
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "complained",
            complainedAt: new Date(event.created_at),
          },
        });

        // Optionally: disable email notifications for this locksmith
        await prisma.locksmith.update({
          where: { id: recipient.locksmithId },
          data: { emailNotifications: false },
        });
        break;

      case "email.opened":
        if (!recipient.openedAt) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              openedAt: new Date(event.created_at),
              openCount: { increment: 1 },
            },
          });

          // Update campaign stats
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: {
              totalOpened: { increment: 1 },
            },
          });
        } else {
          // Just increment open count
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              openCount: { increment: 1 },
            },
          });
        }
        break;

      case "email.clicked":
        const clickedLink = data.click?.link || "";
        if (!recipient.clickedAt) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              clickedAt: new Date(event.created_at),
              clickCount: { increment: 1 },
              clickedLinks: clickedLink
                ? [...recipient.clickedLinks, clickedLink]
                : recipient.clickedLinks,
            },
          });

          // Update campaign stats
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: {
              totalClicked: { increment: 1 },
            },
          });
        } else {
          // Just increment click count and add link
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              clickCount: { increment: 1 },
              clickedLinks:
                clickedLink && !recipient.clickedLinks.includes(clickedLink)
                  ? [...recipient.clickedLinks, clickedLink]
                  : recipient.clickedLinks,
            },
          });
        }
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
