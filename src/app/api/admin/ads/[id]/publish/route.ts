/**
 * Publish Draft Campaign to Meta API
 *
 * POST /api/admin/ads/[id]/publish - Publish a draft campaign to Meta Ads Manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { createMetaClient, OBJECTIVE_MAP, OPTIMIZATION_GOALS } from '@/lib/meta-marketing';

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

// POST - Publish draft campaign to Meta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch campaign with all related data
    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        account: true,
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

    // Check if already published
    if (campaign.metaCampaignId) {
      return NextResponse.json({
        error: 'Campaign is already published to Meta',
        metaCampaignId: campaign.metaCampaignId,
      }, { status: 400 });
    }

    // Check which environment variables are missing
    const metaAccessToken = process.env.META_ACCESS_TOKEN;
    const metaAdAccountId = process.env.META_AD_ACCOUNT_ID;
    const metaPageId = process.env.META_PAGE_ID;

    const missingVars: string[] = [];
    if (!metaAccessToken) missingVars.push('META_ACCESS_TOKEN');
    if (!metaAdAccountId) missingVars.push('META_AD_ACCOUNT_ID');
    if (!metaPageId) missingVars.push('META_PAGE_ID');

    // Create Meta client
    const metaClient = createMetaClient();
    if (!metaClient) {
      return NextResponse.json({
        error: 'Meta Marketing API not configured.',
        details: missingVars.length > 0
          ? `Missing environment variables: ${missingVars.join(', ')}. Make sure your .env file has actual values (not empty strings) for these variables.`
          : 'The access token or ad account ID may be invalid. Check your .env file.',
        missingConfig: true,
        missingVariables: missingVars,
        troubleshooting: [
          'Check that your .env file has actual values (not empty strings like "")',
          'Ensure META_AD_ACCOUNT_ID starts with "act_" prefix (e.g., act_123456789)',
          'Make sure you restarted the dev server after updating .env',
          'See /docs/META_ADS_COMPLETE_SETUP.md for step-by-step instructions'
        ]
      }, { status: 400 });
    }

    // Track what gets created for response
    let metaCampaignId: string | null = null;
    let metaAdSetId: string | null = null;
    const metaAdIds: string[] = [];
    const errors: string[] = [];

    try {
      // Create campaign in Meta
      const metaCampaign = await metaClient.createCampaign({
        name: campaign.name,
        objective: campaign.objective as keyof typeof OBJECTIVE_MAP,
        status: 'PAUSED', // Always create as PAUSED first
        dailyBudget: campaign.dailyBudget || undefined,
        startTime: campaign.startDate || undefined,
        endTime: campaign.endDate || undefined,
      });
      metaCampaignId = metaCampaign.id;

      // Update campaign with Meta ID
      await prisma.adCampaign.update({
        where: { id: campaign.id },
        data: {
          metaCampaignId,
          status: 'PENDING_REVIEW',
        },
      });

      // Create ad sets in Meta
      for (const adSet of campaign.adSets) {
        try {
          const metaAdSet = await metaClient.createAdSet({
            campaignId: metaCampaignId,
            name: adSet.name,
            objective: campaign.objective as keyof typeof OPTIMIZATION_GOALS,
            targeting: (adSet.targeting as Record<string, unknown>) || {
              geo_locations: { countries: ['GB'] },
              age_min: 18,
              age_max: 65,
            },
            dailyBudget: adSet.dailyBudget || campaign.dailyBudget || undefined,
            startTime: adSet.startDate || campaign.startDate || undefined,
            endTime: adSet.endDate || campaign.endDate || undefined,
            status: 'PAUSED',
          });
          metaAdSetId = metaAdSet.id;

          // Update ad set with Meta ID
          await prisma.adSet.update({
            where: { id: adSet.id },
            data: {
              metaAdSetId,
              status: 'PENDING_REVIEW',
            },
          });

          // Create ads in Meta
          for (const ad of adSet.ads) {
            try {
              // First create creative in Meta
              const metaCreative = await metaClient.createAdCreative({
                name: `${ad.name} Creative`,
                pageId: process.env.META_PAGE_ID || '',
                imageUrl: ad.creative.imageUrl || undefined,
                link: ad.trackingUrl || ad.creative.destinationUrl,
                message: ad.creative.primaryText,
                headline: ad.creative.headline,
                description: ad.creative.description || undefined,
                callToAction: ad.creative.callToAction as "LEARN_MORE" | "SHOP_NOW" | "SIGN_UP" | "GET_QUOTE" | "CONTACT_US" | "BOOK_NOW" | "APPLY_NOW" | "DOWNLOAD" | "GET_OFFER" | "REQUEST_TIME" | "SEE_MORE" | "SUBSCRIBE",
                urlParameters: `utm_source=facebook&utm_medium=paid&utm_campaign=${ad.utmCampaign || ''}&utm_content=${ad.utmContent || ''}`,
              });

              // Update creative with Meta ID
              await prisma.adCreative.update({
                where: { id: ad.creative.id },
                data: { metaCreativeId: metaCreative.id },
              });

              // Create ad in Meta
              const metaAd = await metaClient.createAd({
                adSetId: metaAdSetId,
                creativeId: metaCreative.id,
                name: ad.name,
                status: 'PAUSED',
                trackingPixelId: campaign.account.pixelId || undefined,
              });
              metaAdIds.push(metaAd.id);

              // Update ad with Meta ID
              await prisma.ad.update({
                where: { id: ad.id },
                data: {
                  metaAdId: metaAd.id,
                  status: 'PENDING_REVIEW',
                },
              });
            } catch (adError) {
              console.error(`Error creating Meta ad for ${ad.name}:`, adError);
              errors.push(`Ad "${ad.name}": ${adError instanceof Error ? adError.message : 'Unknown error'}`);
            }
          }
        } catch (adSetError) {
          console.error(`Error creating Meta ad set for ${adSet.name}:`, adSetError);
          errors.push(`Ad Set "${adSet.name}": ${adSetError instanceof Error ? adSetError.message : 'Unknown error'}`);
        }
      }
    } catch (campaignError) {
      console.error('Error creating Meta campaign:', campaignError);

      // Parse Meta API error for better messages
      let errorDetails = campaignError instanceof Error ? campaignError.message : 'Unknown error';
      let troubleshootingTips: string[] = [];

      if (errorDetails.includes('Invalid OAuth access token')) {
        troubleshootingTips = [
          'Your access token has expired or is invalid',
          'Generate a new System User token in Business Manager',
          'Make sure you copied the entire token (they are very long)',
          'Use a System User token with "Never" expiration for production'
        ];
      } else if (errorDetails.includes('does not exist') || errorDetails.includes('not found')) {
        troubleshootingTips = [
          'Check that your META_AD_ACCOUNT_ID is correct and includes the "act_" prefix',
          'Verify your System User has access to the Ad Account in Business Settings',
          'Make sure the Ad Account is active and not disabled'
        ];
      } else if (errorDetails.includes('permission') || errorDetails.includes('access')) {
        troubleshootingTips = [
          'Your access token may be missing required permissions',
          'Required permissions: ads_management, ads_read, business_management',
          'Go to Business Settings → System Users → Generate new token with all permissions'
        ];
      } else {
        troubleshootingTips = [
          'Check the Meta API error message above for details',
          'Verify all environment variables are set correctly',
          'See /docs/META_ADS_COMPLETE_SETUP.md for setup instructions'
        ];
      }

      return NextResponse.json({
        error: 'Failed to create campaign in Meta',
        details: errorDetails,
        troubleshooting: troubleshootingTips,
      }, { status: 500 });
    }

    // Fetch updated campaign
    const updatedCampaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        account: true,
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

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      meta: {
        campaignId: metaCampaignId,
        adSetId: metaAdSetId,
        adIds: metaAdIds,
        published: true,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error publishing campaign:', error);
    return NextResponse.json({
      error: 'Failed to publish campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
