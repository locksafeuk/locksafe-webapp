/**
 * Admin Single Ad Campaign API
 *
 * Endpoints:
 * GET /api/admin/ads/[id] - Get campaign details
 * PATCH /api/admin/ads/[id] - Update campaign
 * DELETE /api/admin/ads/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'admin') {
    return null;
  }

  return payload;
}

// GET - Get campaign details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            name: true,
            pixelId: true,
            accountId: true,
          },
        },
        adSets: {
          include: {
            ads: {
              include: {
                creative: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Calculate metrics
    const metrics = {
      ctr: campaign.totalImpressions > 0
        ? (campaign.totalClicks / campaign.totalImpressions) * 100
        : 0,
      cpc: campaign.totalClicks > 0
        ? campaign.totalSpend / campaign.totalClicks
        : 0,
      cpm: campaign.totalImpressions > 0
        ? (campaign.totalSpend / campaign.totalImpressions) * 1000
        : 0,
      roas: campaign.totalSpend > 0
        ? campaign.totalRevenue / campaign.totalSpend
        : 0,
      costPerConversion: campaign.totalConversions > 0
        ? campaign.totalSpend / campaign.totalConversions
        : 0,
      conversionRate: campaign.totalClicks > 0
        ? (campaign.totalConversions / campaign.totalClicks) * 100
        : 0,
    };

    // Get performance history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshots = await prisma.adPerformanceSnapshot.findMany({
      where: {
        campaignId: id,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate snapshots by date
    const dailyPerformance: Record<string, {
      date: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      revenue: number;
    }> = {};

    for (const snapshot of snapshots) {
      const dateKey = snapshot.date.toISOString().split('T')[0];
      if (!dailyPerformance[dateKey]) {
        dailyPerformance[dateKey] = {
          date: dateKey,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        };
      }
      dailyPerformance[dateKey].spend += snapshot.spend;
      dailyPerformance[dateKey].impressions += snapshot.impressions;
      dailyPerformance[dateKey].clicks += snapshot.clicks;
      dailyPerformance[dateKey].conversions += snapshot.conversions;
      dailyPerformance[dateKey].revenue += snapshot.revenue;
    }

    return NextResponse.json({
      campaign,
      metrics,
      dailyPerformance: Object.values(dailyPerformance),
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

// PATCH - Update campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const { name, status, dailyBudget, startDate, endDate } = body;

    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        ...(dailyBudget !== undefined && { dailyBudget }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        adSets: {
          include: {
            ads: true,
          },
        },
      },
    });

    // Also update ad sets and ads status if campaign status changed
    if (status) {
      await prisma.adSet.updateMany({
        where: { campaignId: id },
        data: { status },
      });

      await prisma.ad.updateMany({
        where: {
          adSet: {
            campaignId: id,
          },
        },
        data: { status },
      });
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

// DELETE - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete in order: snapshots -> ads -> creatives -> ad sets -> campaign
    await prisma.adPerformanceSnapshot.deleteMany({
      where: {
        campaignId: id,
      },
    });

    // Get all creative IDs
    const ads = await prisma.ad.findMany({
      where: {
        adSet: {
          campaignId: id,
        },
      },
      select: { creativeId: true },
    });

    const creativeIds = ads.map(a => a.creativeId);

    await prisma.ad.deleteMany({
      where: {
        adSet: {
          campaignId: id,
        },
      },
    });

    await prisma.adCreative.deleteMany({
      where: {
        id: { in: creativeIds },
      },
    });

    await prisma.adSet.deleteMany({
      where: { campaignId: id },
    });

    await prisma.adCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
