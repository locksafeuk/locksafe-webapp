import prisma from "@/lib/db";
import { sendCampaignEmail, type EmailTemplate } from "@/lib/campaign-email";

export interface SendCampaignOptions {
  dryRun?: boolean;
  maxRecipients?: number;
}

export interface SendCampaignResult {
  success: boolean;
  campaignId: string;
  totalPending: number;
  eligible: number;
  skippedOptOut: number;
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendEmailCampaignById(
  campaignId: string,
  options: SendCampaignOptions = {},
): Promise<SendCampaignResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        where: { status: "pending" },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!["DRAFT", "PAUSED", "SCHEDULED", "SENDING"].includes(campaign.status)) {
    throw new Error(`Campaign cannot be sent in status: ${campaign.status}`);
  }

  const totalPending = campaign.recipients.length;
  if (totalPending === 0) {
    return {
      success: true,
      campaignId,
      totalPending,
      eligible: 0,
      skippedOptOut: 0,
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  const locksmithIds = campaign.recipients.map((recipient) => recipient.locksmithId);
  const allowedLocksmiths = await prisma.locksmith.findMany({
    where: {
      id: { in: locksmithIds },
      emailNotifications: true,
    },
    select: { id: true },
  });

  const allowedIds = new Set(allowedLocksmiths.map((locksmith) => locksmith.id));
  const eligibleRecipients = campaign.recipients.filter((recipient) => allowedIds.has(recipient.locksmithId));
  const skippedOptOut = campaign.recipients.length - eligibleRecipients.length;

  if (options.dryRun) {
    return {
      success: true,
      campaignId,
      totalPending,
      eligible: eligibleRecipients.length,
      skippedOptOut,
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  const queue = options.maxRecipients
    ? eligibleRecipients.slice(0, options.maxRecipients)
    : eligibleRecipients;

  if (queue.length === 0) {
    return {
      success: true,
      campaignId,
      totalPending,
      eligible: eligibleRecipients.length,
      skippedOptOut,
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  if (campaign.status !== "SENDING") {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });
  }

  const result: SendCampaignResult = {
    success: true,
    campaignId,
    totalPending,
    eligible: eligibleRecipients.length,
    skippedOptOut,
    processed: queue.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const recipient of queue) {
    try {
      const sendResult = await sendCampaignEmail({
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

      if (sendResult.success) {
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "sent",
            resendEmailId: sendResult.resendId,
          },
        });
        result.sent++;
      } else {
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "bounced",
            bounceReason: "Failed to send",
          },
        });
        result.failed++;
        result.errors.push(`${recipient.email}: ${String(sendResult.error ?? "Unknown error")}`);
      }
    } catch (error) {
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "bounced",
          bounceReason: error instanceof Error ? error.message : "Unknown error",
        },
      });
      result.failed++;
      result.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Small delay to reduce provider rate-limit pressure.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const pendingAfterSend = await prisma.emailRecipient.count({
    where: {
      campaignId,
      status: "pending",
    },
  });

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: pendingAfterSend === 0 ? "SENT" : "PAUSED",
      ...(pendingAfterSend === 0 ? { sentAt: new Date() } : {}),
      totalRecipients: eligibleRecipients.length,
      totalDelivered: result.sent,
      totalBounced: result.failed,
    },
  });

  return result;
}
