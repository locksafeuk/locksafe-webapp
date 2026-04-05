import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

// GET: List all email campaigns
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
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
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
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
    } = body;

    // Validate required fields
    if (!name || !subject || !template || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, subject, template, body" },
        { status: 400 }
      );
    }

    // Fetch selected locksmiths
    const locksmiths = await prisma.locksmith.findMany({
      where: {
        id: { in: locksmithIds || [] },
        emailNotifications: true, // Only send to those who haven't opted out
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

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
