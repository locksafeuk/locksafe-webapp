/**
 * POST /api/admin/ads/[id]/activate
 *
 * One-click activation: flips the corresponding Meta campaign from PAUSED to ACTIVE
 * and mirrors the new status on the local AdCampaign row. Used by the "Activate in
 * Meta" button on the AI Ad Manager dashboard.
 *
 * Prerequisites:
 *  - Local campaign has metaCampaignId set (i.e. previously published successfully)
 *  - Meta env vars (META_ACCESS_TOKEN) configured
 *  - Caller is an authenticated admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { createMetaClient } from '@/lib/meta-marketing';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  return payload;
}

export async function POST(
  _request: NextRequest,
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
      include: { adSets: { include: { ads: true } } },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (!campaign.metaCampaignId) {
      return NextResponse.json(
        { error: 'Campaign has not been published to Meta yet.' },
        { status: 400 }
      );
    }

    const metaClient = createMetaClient();
    if (!metaClient) {
      return NextResponse.json(
        { error: 'Meta client not configured.' },
        { status: 500 }
      );
    }

    // Flip campaign + every published ad set + ad to ACTIVE on Meta. Best-effort on
    // child entities — the campaign-level flip is the one that matters for delivery.
    await metaClient.updateCampaign(campaign.metaCampaignId, { status: 'ACTIVE' });

    for (const adSet of campaign.adSets) {
      if (adSet.metaAdSetId) {
        try {
          await metaClient.updateAdSet(adSet.metaAdSetId, { status: 'ACTIVE' });
        } catch (err) {
          console.warn(`[Activate] Failed to activate ad set ${adSet.metaAdSetId}:`, err);
        }
      }
      for (const ad of adSet.ads) {
        if (ad.metaAdId) {
          try {
            await metaClient.updateAd(ad.metaAdId, { status: 'ACTIVE' });
          } catch (err) {
            console.warn(`[Activate] Failed to activate ad ${ad.metaAdId}:`, err);
          }
        }
      }
    }

    // Mirror status locally.
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.adSet.updateMany({
      where: { campaignId: campaign.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.ad.updateMany({
      where: { adSet: { campaignId: campaign.id } },
      data: { status: 'ACTIVE' },
    });

    return NextResponse.json({ success: true, campaignId: campaign.id, status: 'ACTIVE' });
  } catch (error) {
    console.error('Error activating campaign:', error);
    return NextResponse.json(
      {
        error: 'Failed to activate campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
