import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getLocksmithRecipientsBySegment,
  type LocksmithCampaignSegment,
} from "@/lib/email-campaign-recipient-segments";
import { sendEmailCampaignById } from "@/lib/email-campaign-sender";

const SUPPORTED_SEGMENTS: LocksmithCampaignSegment[] = [
  "all_locksmiths",
  "active_locksmiths",
  "inactive_locksmiths",
  "stripe_not_onboarded",
  "schedule_enabled",
  "no_base_location",
];

export async function POST(request: NextRequest) {
  const admin = await isAdminAuthenticated();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      subject,
      preheader,
      template,
      headline,
      body: emailBody,
      ctaText,
      ctaUrl,
      accentColor,
      segment,
      maxRecipients,
      dryRun,
      scheduledFor,
    } = body as {
      name?: string;
      subject?: string;
      preheader?: string;
      template?: string;
      headline?: string;
      body?: string;
      ctaText?: string;
      ctaUrl?: string;
      accentColor?: string;
      segment?: LocksmithCampaignSegment;
      maxRecipients?: number;
      dryRun?: boolean;
      scheduledFor?: string;
    };

    if (!name || !subject || !template || !emailBody || !segment) {
      return NextResponse.json(
        { error: "Missing required fields: name, subject, template, body, segment" },
        { status: 400 },
      );
    }

    if (!SUPPORTED_SEGMENTS.includes(segment)) {
      return NextResponse.json({ error: `Unsupported segment: ${segment}` }, { status: 400 });
    }

    const recipients = await getLocksmithRecipientsBySegment(
      segment,
      typeof maxRecipients === "number" && maxRecipients > 0 ? maxRecipients : undefined,
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No eligible recipients in selected segment" },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        eligibleRecipients: recipients.length,
        segment,
      });
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        subject,
        preheader: preheader || null,
        template,
        headline: headline || null,
        body: emailBody,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        accentColor: accentColor || "#f97316",
        totalRecipients: recipients.length,
        createdBy: admin.id,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: scheduledFor ? "SCHEDULED" : "DRAFT",
        recipients: {
          create: recipients.map((recipient) => ({
            locksmithId: recipient.id,
            email: recipient.email,
            name: recipient.name,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalRecipients: true,
        scheduledFor: true,
      },
    });

    if (scheduledFor) {
      return NextResponse.json({
        success: true,
        scheduled: true,
        campaign,
      });
    }

    const sendResult = await sendEmailCampaignById(campaign.id, {
      maxRecipients: typeof maxRecipients === "number" && maxRecipients > 0 ? maxRecipients : undefined,
    });

    return NextResponse.json({
      success: true,
      scheduled: false,
      campaign,
      result: sendResult,
    });
  } catch (error) {
    console.error("[admin/emails/send-segmented] Failed:", error);
    return NextResponse.json({ error: "Failed to process segmented send" }, { status: 500 });
  }
}
