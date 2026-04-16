import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

// GET: Get a specific campaign with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        recipients: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Calculate stats
    const stats = {
      total: campaign.recipients.length,
      sent: campaign.recipients.filter((r) => r.status === "sent" || r.status === "delivered").length,
      delivered: campaign.recipients.filter((r) => r.status === "delivered").length,
      opened: campaign.recipients.filter((r) => r.openedAt !== null).length,
      clicked: campaign.recipients.filter((r) => r.clickedAt !== null).length,
      bounced: campaign.recipients.filter((r) => r.status === "bounced").length,
      openRate: 0,
      clickRate: 0,
    };

    if (stats.delivered > 0) {
      stats.openRate = Math.round((stats.opened / stats.delivered) * 100);
      stats.clickRate = Math.round((stats.clicked / stats.delivered) * 100);
    }

    return NextResponse.json({
      success: true,
      campaign,
      stats,
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH: Update a campaign (only if draft)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only edit draft campaigns" },
        { status: 400 }
      );
    }

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

    // Update campaign
    const campaign = await prisma.emailCampaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(subject && { subject }),
        ...(preheader !== undefined && { preheader }),
        ...(template && { template }),
        ...(headline !== undefined && { headline }),
        ...(emailBody && { body: emailBody }),
        ...(ctaText !== undefined && { ctaText }),
        ...(ctaUrl !== undefined && { ctaUrl }),
        ...(accentColor && { accentColor }),
      },
    });

    // Update recipients if new locksmith IDs provided
    if (locksmithIds && Array.isArray(locksmithIds)) {
      // Delete existing recipients
      await prisma.emailRecipient.deleteMany({
        where: { campaignId: id },
      });

      // Fetch new locksmiths
      const locksmiths = await prisma.locksmith.findMany({
        where: {
          id: { in: locksmithIds },
          emailNotifications: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Create new recipients
      await prisma.emailRecipient.createMany({
        data: locksmiths.map((ls) => ({
          campaignId: id,
          locksmithId: ls.id,
          email: ls.email,
          name: ls.name,
        })),
      });

      // Update recipient count
      await prisma.emailCampaign.update({
        where: { id },
        data: { totalRecipients: locksmiths.length },
      });
    }

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a campaign (only if draft)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete draft campaigns" },
        { status: 400 }
      );
    }

    // Delete recipients first
    await prisma.emailRecipient.deleteMany({
      where: { campaignId: id },
    });

    // Delete campaign
    await prisma.emailCampaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign deleted",
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
