/**
 * Admin Ads API
 *
 * Endpoints:
 * GET /api/admin/ads - List all campaigns/ads
 * POST /api/admin/ads - Create new ad campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { createMetaClient, OBJECTIVE_MAP, OPTIMIZATION_GOALS, PIXEL_EVENT_MAP } from '@/lib/meta-marketing';
import { generateAdCopy, suggestAudiences } from '@/lib/openai-ads';
import { generateAdTrackingUrl } from '@/lib/pixel-events';

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') {
    return null;
  }

  return payload;
}

// GET - List campaigns and ads
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch campaigns with stats
    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        include: {
          account: {
            select: {
              name: true,
              pixelId: true,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adCampaign.count({ where }),
    ]);

    // Calculate aggregate stats
    const stats = {
      totalCampaigns: total,
      totalSpend: campaigns.reduce((sum, c) => sum + c.totalSpend, 0),
      totalImpressions: campaigns.reduce((sum, c) => sum + c.totalImpressions, 0),
      totalClicks: campaigns.reduce((sum, c) => sum + c.totalClicks, 0),
      totalConversions: campaigns.reduce((sum, c) => sum + c.totalConversions, 0),
      totalRevenue: campaigns.reduce((sum, c) => sum + c.totalRevenue, 0),
      averageROAS: 0,
    };

    if (stats.totalSpend > 0) {
      stats.averageROAS = stats.totalRevenue / stats.totalSpend;
    }

    return NextResponse.json({
      campaigns,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

// POST - Create new campaign with AI assistance
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      objective,
      dailyBudget,
      startDate,
      endDate,

      // Targeting
      targeting,

      // Creative
      primaryText,
      headline,
      description,
      callToAction,
      imageUrl,
      destinationUrl,

      // AI options
      useAI,
      productDescription,
      generateAudiences,

      // Publish options
      publishToMeta,
      status = 'DRAFT',
    } = body;

    // Validate required fields
    if (!name || !objective) {
      return NextResponse.json({ error: 'Name and objective are required' }, { status: 400 });
    }

    // Get or create Meta account connection
    let metaAccount = await prisma.metaAdAccount.findFirst({
      where: { isActive: true },
    });

    if (!metaAccount && process.env.META_AD_ACCOUNT_ID) {
      // Create account from env vars
      metaAccount = await prisma.metaAdAccount.create({
        data: {
          accountId: process.env.META_AD_ACCOUNT_ID,
          businessId: process.env.META_BUSINESS_ID,
          name: 'Primary Ad Account',
          accessToken: process.env.META_ACCESS_TOKEN || '',
          pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
        },
      });
    }

    // If no Meta account and trying to publish, return error
    // But allow creating drafts without Meta configuration
    if (!metaAccount && publishToMeta) {
      return NextResponse.json({
        error: 'No Meta ad account configured. Please add META_AD_ACCOUNT_ID and META_ACCESS_TOKEN to your environment variables to publish ads.',
      }, { status: 400 });
    }

    // Create a placeholder account for draft campaigns if none exists
    if (!metaAccount) {
      metaAccount = await prisma.metaAdAccount.create({
        data: {
          accountId: 'draft_account',
          name: 'Draft Account (Configure Meta to publish)',
          accessToken: '',
          isActive: true,
        },
      });
    }

    // Generate AI content if requested
    let aiCopyVariations: Array<{
      primaryText: string;
      headline: string;
      description: string;
      callToAction: string;
      emotionalAngle: string;
      reasoning: string;
    }> = [];
    let aiAudienceSuggestions: Array<{
      name: string;
      description: string;
      demographics: { ageMin: number; ageMax: number; genders: string[] };
      interests: string[];
      behaviors: string[];
      estimatedReach: string;
      reasoning: string;
      suggestedBudget: { daily: number; currency: string };
    }> = [];

    if (useAI && productDescription) {
      // Generate copy variations
      aiCopyVariations = await generateAdCopy({
        productDescription,
        goal: objective.toLowerCase() as 'leads' | 'sales' | 'traffic' | 'awareness',
        targetAudience: targeting?.description,
      });

      // Log AI generation
      await prisma.aIGeneration.create({
        data: {
          type: 'copy',
          prompt: productDescription,
          output: JSON.parse(JSON.stringify(aiCopyVariations)),
          model: 'gpt-4',
        },
      });

      // Generate audience suggestions if requested
      if (generateAudiences) {
        aiAudienceSuggestions = await suggestAudiences({
          productDescription,
          goal: objective.toLowerCase() as 'leads' | 'sales' | 'traffic' | 'awareness',
          location: targeting?.locations || 'United Kingdom',
          budget: dailyBudget,
        });

        await prisma.aIGeneration.create({
          data: {
            type: 'audience',
            prompt: productDescription,
            output: JSON.parse(JSON.stringify(aiAudienceSuggestions)),
            model: 'gpt-4',
          },
        });
      }
    }

    // Create campaign in database
    const campaign = await prisma.adCampaign.create({
      data: {
        accountId: metaAccount.id,
        name,
        objective: objective as 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS',
        status: status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'ARCHIVED',
        dailyBudget: dailyBudget || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        aiGenerated: useAI || false,
        aiPrompt: productDescription || null,
      },
    });

    // Create ad set
    const adSet = await prisma.adSet.create({
      data: {
        campaignId: campaign.id,
        name: `${name} - Ad Set 1`,
        status: status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'ARCHIVED',
        dailyBudget: dailyBudget || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        optimizationGoal: OPTIMIZATION_GOALS[objective as keyof typeof OPTIMIZATION_GOALS] || 'LINK_CLICKS',
        targeting: targeting || {},
        placements: [],
      },
    });

    // Create creative(s)
    const creatives = [];
    const copyVariations = aiCopyVariations.length > 0
      ? aiCopyVariations
      : [{ primaryText, headline, description, callToAction, emotionalAngle: 'benefit' }];

    for (const copy of copyVariations) {
      // Generate tracking URL with UTM parameters
      const trackingUrl = destinationUrl
        ? generateAdTrackingUrl({
            destinationUrl,
            campaignName: name,
            adName: `${name}_${copy.emotionalAngle || 'v1'}`,
          })
        : null;

      const creative = await prisma.adCreative.create({
        data: {
          type: 'IMAGE',
          primaryText: copy.primaryText || primaryText || '',
          headline: copy.headline || headline || '',
          description: copy.description || description || '',
          callToAction: copy.callToAction || callToAction || 'LEARN_MORE',
          imageUrl: imageUrl || null,
          destinationUrl: destinationUrl || '',
          aiGenerated: useAI || false,
          aiPrompt: productDescription || null,
          emotionalAngle: copy.emotionalAngle || null,
        },
      });

      creatives.push(creative);

      // Create ad for each creative
      const pixelEventType = PIXEL_EVENT_MAP[objective as keyof typeof PIXEL_EVENT_MAP] || 'PageView';

      await prisma.ad.create({
        data: {
          adSetId: adSet.id,
          creativeId: creative.id,
          name: `${name} - ${copy.emotionalAngle || 'Ad'} ${creatives.length}`,
          status: status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'ARCHIVED',
          trackingUrl,
          utmSource: 'facebook',
          utmMedium: 'paid',
          utmCampaign: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          utmContent: (copy.emotionalAngle || 'ad').toLowerCase(),
          pixelEventType,
          aiGenerated: useAI || false,
          aiVariation: copy.emotionalAngle || null,
        },
      });
    }

    // Publish to Meta if requested
    let metaCampaignId = null;
    let metaAdSetId = null;
    const metaAdIds: string[] = [];

    if (publishToMeta) {
      const metaClient = createMetaClient();

      if (metaClient) {
        try {
          // Create campaign in Meta
          const metaCampaign = await metaClient.createCampaign({
            name,
            objective: objective as keyof typeof OBJECTIVE_MAP,
            status: status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
            dailyBudget,
            startTime: startDate ? new Date(startDate) : undefined,
            endTime: endDate ? new Date(endDate) : undefined,
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

          // Create ad set in Meta
          const metaAdSet = await metaClient.createAdSet({
            campaignId: metaCampaignId,
            name: `${name} - Ad Set 1`,
            objective: objective as keyof typeof OPTIMIZATION_GOALS,
            targeting: targeting || {
              geo_locations: { countries: ['GB'] },
              age_min: 18,
              age_max: 65,
            },
            dailyBudget,
            startTime: startDate ? new Date(startDate) : undefined,
            endTime: endDate ? new Date(endDate) : undefined,
            status: status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
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
          for (const creative of creatives) {
            const ads = await prisma.ad.findMany({
              where: { creativeId: creative.id },
            });

            for (const ad of ads) {
              // First create creative in Meta
              const metaCreative = await metaClient.createAdCreative({
                name: `${ad.name} Creative`,
                pageId: process.env.META_PAGE_ID || '',
                imageUrl: creative.imageUrl || undefined,
                link: ad.trackingUrl || creative.destinationUrl,
                message: creative.primaryText,
                headline: creative.headline,
                description: creative.description || undefined,
                callToAction: creative.callToAction as typeof import('@/lib/meta-marketing').CTA_TYPES[number],
                urlParameters: `utm_source=facebook&utm_medium=paid&utm_campaign=${ad.utmCampaign}&utm_content=${ad.utmContent}`,
              });

              // Update creative with Meta ID
              await prisma.adCreative.update({
                where: { id: creative.id },
                data: { metaCreativeId: metaCreative.id },
              });

              // Create ad in Meta
              const metaAd = await metaClient.createAd({
                adSetId: metaAdSetId,
                creativeId: metaCreative.id,
                name: ad.name,
                status: status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                trackingPixelId: metaAccount.pixelId || undefined,
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
            }
          }
        } catch (metaError) {
          console.error('Error publishing to Meta:', metaError);
          // Don't fail the whole request, just note the error
        }
      }
    }

    // Fetch the complete campaign
    const completeCampaign = await prisma.adCampaign.findUnique({
      where: { id: campaign.id },
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
      campaign: completeCampaign,
      aiCopyVariations: aiCopyVariations.length > 0 ? aiCopyVariations : undefined,
      aiAudienceSuggestions: aiAudienceSuggestions.length > 0 ? aiAudienceSuggestions : undefined,
      meta: {
        campaignId: metaCampaignId,
        adSetId: metaAdSetId,
        adIds: metaAdIds,
        published: publishToMeta && metaCampaignId !== null,
      },
    });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json({
      error: 'Failed to create ad',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
