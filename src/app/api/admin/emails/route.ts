import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getLocksmithRecipientsBySegment,
  type LocksmithCampaignSegment,
} from "@/lib/email-campaign-recipient-segments";

const SUPPORTED_SEGMENTS: LocksmithCampaignSegment[] = [
  "all_locksmiths",
  "active_locksmiths",
  "inactive_locksmiths",
  "stripe_not_onboarded",
  "schedule_enabled",
  "no_base_location",
];

// GET: List all email campaigns
export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { recipients: true },
          },
        },
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      campaigns: campaigns.map((c) => ({
        ...c,
        recipientCount: c._count.recipients,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST: Create a new email campaign
export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      locksmithIds,
      segment,
      maxRecipients,
      scheduledFor,
    } = body;

    // Validate required fields
    if (!name || !subject || !template || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, subject, template, body" },
        { status: 400 }
      );
    }

    if (!segment && (!Array.isArray(locksmithIds) || locksmithIds.length === 0)) {
      return NextResponse.json(
        { error: "Provide either locksmithIds or segment" },
        { status: 400 },
      );
    }

    let locksmiths: Array<{ id: string; name: string; email: string }> = [];

    if (segment) {
      if (!SUPPORTED_SEGMENTS.includes(segment as LocksmithCampaignSegment)) {
        return NextResponse.json(
          { error: `Unsupported segment: ${segment}` },
          { status: 400 },
        );
      }

      locksmiths = await getLocksmithRecipientsBySegment(
        segment as LocksmithCampaignSegment,
        typeof maxRecipients === "number" && maxRecipients > 0 ? maxRecipients : undefined,
      );
    } else {
      locksmiths = await prisma.locksmith.findMany({
        where: {
          id: { in: locksmithIds || [] },
          emailNotifications: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    // Create campaign with recipients
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
        createdBy: admin.id,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: scheduledFor ? "SCHEDULED" : "DRAFT",
        totalRecipients: locksmiths.length,
        recipients: {
          create: locksmiths.map((ls) => ({
            locksmithId: ls.id,
            email: ls.email,
            name: ls.name,
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
