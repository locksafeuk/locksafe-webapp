import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
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

/**
 * Verify Resend webhook signature using Svix signing protocol.
 * Resend sets RESEND_WEBHOOK_SECRET in the dashboard (Settings → Webhooks → Signing Secret).
 * Returns true if valid or if no secret is configured (dev mode).
 */
async function verifyResendSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow in development, warn in production
    if (process.env.NODE_ENV === "production") {
      console.warn("RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    }
    return true;
  }

  const msgId = request.headers.get("svix-id");
  const msgTimestamp = request.headers.get("svix-timestamp");
  const msgSignature = request.headers.get("svix-signature");

  if (!msgId || !msgTimestamp || !msgSignature) {
    return false;
  }

  // Reject timestamps older than 5 minutes (replay attack protection)
  const timestampSeconds = parseInt(msgTimestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }

  // Svix signed content: "{msg-id}.{timestamp}.{body}"
  const signedContent = `${msgId}.${msgTimestamp}.${body}`;

  // The secret is prefixed with "whsec_" and base64 encoded
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const computedSig = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Svix may send multiple signatures (for rotation), e.g. "v1,sig1 v1,sig2"
  const receivedSigs = msgSignature.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  for (const sig of receivedSigs) {
    try {
      if (timingSafeEqual(Buffer.from(computedSig), Buffer.from(sig))) {
        return true;
      }
    } catch {
      // Buffers of different lengths — not a match
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify webhook signature to prevent spoofed events
    const isValid = await verifyResendSignature(request, body);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: ResendWebhookEvent = JSON.parse(body);
    const { type, data } = event;

    console.log(`Resend webhook received: ${type}`, data.email_id);

    // Find campaign recipient by Resend email ID
    const recipient = await prisma.emailRecipient.findFirst({
      where: { resendEmailId: data.email_id },
    });

    // Find app-install reminder log by Resend email ID
    const appInstallLog = await prisma.appInstallReminderLog.findFirst({
      where: { resendEmailId: data.email_id },
    });

    if (!recipient && !appInstallLog) {
      // Not one of our tracked emails, ignore
      return NextResponse.json({ received: true });
    }

    if (recipient) {
      // Handle campaign recipient events
      switch (type) {
        case "email.delivered":
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "delivered",
              deliveredAt: new Date(event.created_at),
            },
          });

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

          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: {
              totalBounced: { increment: 1 },
            },
          });

          await prisma.locksmith.update({
            where: { id: recipient.locksmithId },
            data: { emailNotifications: false },
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

            await prisma.emailCampaign.update({
              where: { id: recipient.campaignId },
              data: {
                totalOpened: { increment: 1 },
              },
            });
          } else {
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: {
                openCount: { increment: 1 },
              },
            });
          }
          break;

        case "email.clicked": {
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

            await prisma.emailCampaign.update({
              where: { id: recipient.campaignId },
              data: {
                totalClicked: { increment: 1 },
              },
            });
          } else {
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
      }
    }

    if (appInstallLog) {
      // Handle app-install reminder events
      switch (type) {
        case "email.sent":
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "sent",
            },
          });
          break;

        case "email.delivered":
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "delivered",
              deliveredAt: new Date(event.created_at),
            },
          });
          break;

        case "email.opened":
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "opened",
              openedAt: appInstallLog.openedAt || new Date(event.created_at),
              openCount: { increment: 1 },
            },
          });
          break;

        case "email.clicked": {
          const clickedLink = data.click?.link || "";
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "clicked",
              clickedAt: appInstallLog.clickedAt || new Date(event.created_at),
              clickCount: { increment: 1 },
              clickedLinks:
                clickedLink && !appInstallLog.clickedLinks.includes(clickedLink)
                  ? [...appInstallLog.clickedLinks, clickedLink]
                  : appInstallLog.clickedLinks,
            },
          });
          break;
        }

        case "email.bounced":
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "bounced",
              bouncedAt: new Date(event.created_at),
              bounceReason: data.bounce?.message || "Unknown bounce",
            },
          });
          break;

        case "email.complained":
          await prisma.appInstallReminderLog.update({
            where: { id: appInstallLog.id },
            data: {
              status: "complained",
              complainedAt: new Date(event.created_at),
            },
          });
          break;
      }
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
