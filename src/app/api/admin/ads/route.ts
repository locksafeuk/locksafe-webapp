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
import { getServiceBySlug } from '@/lib/services-catalog';

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
      // Optional pool of additional image URLs (one per ad set). When fewer
      // images than ad sets are provided, the list is cycled.
      imageUrls,
      // Optional pool of additional copy variations selected in the wizard
      // (each becomes its own ad set). Falls back to AI-generated or single
      // manual copy when omitted.
      selectedCopyVariations,
      destinationUrl,

      // AI options
      useAI,
      productDescription,
      generateAudiences,

      // Meta Catalog (Dynamic Product Ads) options
      useCatalog = false,
      service,
      serviceSlug,

      // Publish options
      publishToMeta,
      status = 'DRAFT',
    } = body;

    const catalogServiceSlug: string | undefined = useCatalog ? (serviceSlug || service) : undefined;

    // Validate required fields
    if (!name || !objective) {
      return NextResponse.json({ error: 'Name and objective are required' }, { status: 400 });
    }

    if (useCatalog && !catalogServiceSlug) {
      return NextResponse.json(
        { error: 'Dynamic Product Ads require a service slug. Select one in Step 1.' },
        { status: 400 },
      );
    }

    // Get or create Meta account connection. Prefer the real account row that
    // matches META_AD_ACCOUNT_ID over any "draft_account" placeholder created
    // before the env was populated.
    let metaAccount = process.env.META_AD_ACCOUNT_ID
      ? await prisma.metaAdAccount.findFirst({
          where: { accountId: process.env.META_AD_ACCOUNT_ID },
        })
      : null;
    if (!metaAccount) {
      metaAccount = await prisma.metaAdAccount.findFirst({
        where: { isActive: true },
      });
    }

    // Backfill pixelId / accessToken from env if missing on an existing row.
    // (Older rows were created before the env vars were set, so the campaign
    // detail page reports "Pixel: Not configured" even though the pixel exists.)
    if (metaAccount) {
      const patch: { pixelId?: string; accessToken?: string } = {};
      if (!metaAccount.pixelId && process.env.NEXT_PUBLIC_META_PIXEL_ID) {
        patch.pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
      }
      if (!metaAccount.accessToken && process.env.META_ACCESS_TOKEN) {
        patch.accessToken = process.env.META_ACCESS_TOKEN;
      }
      if (Object.keys(patch).length > 0) {
        metaAccount = await prisma.metaAdAccount.update({
          where: { id: metaAccount.id },
          data: patch,
        });
      }
    }

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
    // Build the full pool of copy variations + images that drive the ad sets.
    // Priority order:
    //   1. Variations explicitly chosen in the wizard (`selectedCopyVariations`)
    //   2. AI-generated variations from this request (`aiCopyVariations`)
    //   3. Single manual copy passed via top-level fields
    const wizardSelected: Array<{
      primaryText?: string;
      headline?: string;
      description?: string;
      callToAction?: string;
      emotionalAngle?: string;
    }> = Array.isArray(selectedCopyVariations) ? selectedCopyVariations : [];

    const baseVariations = wizardSelected.length > 0
      ? wizardSelected
      : aiCopyVariations.length > 0
        ? aiCopyVariations
        : [{ primaryText, headline, description, callToAction, emotionalAngle: 'benefit' }];

    // Each campaign should ship with at least 4 ad sets so the budget is split
    // across multiple creatives (per ops requirement). Cycle through whatever
    // variations we have to fill the slots.
    const MIN_AD_SETS = 4;
    const numAdSets = Math.max(MIN_AD_SETS, baseVariations.length);
    const variationsForAdSets: typeof baseVariations = Array.from({ length: numAdSets }, (_, i) =>
      baseVariations[i % baseVariations.length],
    );

    // Build the image pool. Priority:
    //   1. imageUrls[] from the wizard (admin-uploaded sets)
    //   2. single imageUrl
    //   3. ServiceCatalogItem.imageUrl override for the selected service slug
    //      (admin-managed in /admin/meta-catalog — these are the same images
    //      Meta sees in the catalog feed)
    //   4. service.image_link (auto OG)
    // This guarantees the ad image matches the catalog image when the admin
    // uploaded one, instead of always falling back to the OG card.
    const imagePool: string[] = await (async () => {
      const fromList = Array.isArray(imageUrls)
        ? (imageUrls as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        : [];
      if (fromList.length > 0) return fromList;
      if (typeof imageUrl === 'string' && imageUrl.trim() !== '') return [imageUrl];

      const slug = catalogServiceSlug || serviceSlug || service;
      if (typeof slug === 'string' && slug.length > 0) {
        try {
          const override = await prisma.serviceCatalogItem.findUnique({
            where: { slug },
            select: { imageUrl: true },
          });
          if (override?.imageUrl) return [override.imageUrl];
        } catch (err) {
          console.warn('[ads] failed to load catalog image override:', err);
        }
        const entry = getServiceBySlug(slug);
        if (entry?.image_link) return [entry.image_link];
      }
      return [];
    })();
    const imageForAdSet = (i: number): string | null =>
      imagePool.length === 0 ? null : imagePool[i % imagePool.length];

    // Split the daily budget evenly. Floor to keep total ≤ requested; force a
    // £1/day minimum (Meta's hard floor) so the call doesn't get rejected.
    const totalDailyBudget = typeof dailyBudget === 'number' ? dailyBudget : 0;
    const perAdSetBudget = totalDailyBudget > 0
      ? Math.max(1, Math.floor(totalDailyBudget / numAdSets))
      : 0;

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

    // Create N ad sets, each with its own creative + image. Local rows are
    // built first; Meta entities are created afterwards in a single attempt
    // with rollback so failures don't leave orphans.
    const pixelEventType = PIXEL_EVENT_MAP[objective as keyof typeof PIXEL_EVENT_MAP] || 'PageView';
    const utmCampaignBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    type LocalAdSetBundle = {
      adSet: Awaited<ReturnType<typeof prisma.adSet.create>>;
      creative: Awaited<ReturnType<typeof prisma.adCreative.create>>;
      ad: Awaited<ReturnType<typeof prisma.ad.create>>;
      copy: typeof variationsForAdSets[number];
      imageForThisAdSet: string | null;
    };
    const adSetBundles: LocalAdSetBundle[] = [];

    for (let i = 0; i < numAdSets; i++) {
      const copy = variationsForAdSets[i];
      const angle = copy?.emotionalAngle || `v${i + 1}`;
      const adSetName = `${name} - Ad Set ${i + 1} (${angle})`;

      const adSet = await prisma.adSet.create({
        data: {
          campaignId: campaign.id,
          name: adSetName,
          status: status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'ARCHIVED',
          dailyBudget: perAdSetBudget || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          optimizationGoal: OPTIMIZATION_GOALS[objective as keyof typeof OPTIMIZATION_GOALS] || 'LINK_CLICKS',
          targeting: targeting || {},
          placements: [],
        },
      });

      const adName = `${name} - ${angle} ${i + 1}`;
      const trackingUrl = destinationUrl
        ? generateAdTrackingUrl({
            destinationUrl,
            campaignName: name,
            adName: `${name}_${angle}_${i + 1}`,
          })
        : null;

      const imageForThisAdSet = imageForAdSet(i);
      const creative = await prisma.adCreative.create({
        data: {
          type: 'IMAGE',
          primaryText: copy?.primaryText || primaryText || '',
          headline: copy?.headline || headline || '',
          description: copy?.description || description || '',
          callToAction: copy?.callToAction || callToAction || 'LEARN_MORE',
          imageUrl: imageForThisAdSet,
          destinationUrl: destinationUrl || '',
          aiGenerated: useAI || false,
          aiPrompt: productDescription || null,
          emotionalAngle: angle,
        },
      });

      const ad = await prisma.ad.create({
        data: {
          adSetId: adSet.id,
          creativeId: creative.id,
          name: adName,
          status: status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'ARCHIVED',
          trackingUrl,
          utmSource: 'facebook',
          utmMedium: 'paid',
          utmCampaign: utmCampaignBase,
          utmContent: angle.toLowerCase(),
          pixelEventType,
          aiGenerated: useAI || false,
          aiVariation: angle,
        },
      });

      adSetBundles.push({ adSet, creative, ad, copy, imageForThisAdSet });
    }

    // Publish to Meta if requested
    let metaCampaignId: string | null = null;
    const metaAdSetIds: string[] = [];
    const metaAdIds: string[] = [];
    const metaCreativeIds: string[] = [];
    let metaPublishError: string | null = null;
    // Determines whether the local row enters the human-approval gate (PENDING_REVIEW) or
    // mirrors Meta's reality (PAUSED). AI-generated campaigns flow through approval; manual
    // ones go straight to PAUSED so the UI matches Meta Ads Manager.
    const usesApprovalGate = Boolean(useAI);
    const localStatusOnSuccess: 'PENDING_REVIEW' | 'PAUSED' = usesApprovalGate
      ? 'PENDING_REVIEW'
      : 'PAUSED';

    if (publishToMeta) {
      const metaClient = createMetaClient();

      if (!metaClient) {
        metaPublishError = 'Meta client unavailable (check META_AD_ACCOUNT_ID / META_ACCESS_TOKEN).';
      } else {
        // Resolve catalog product set up-front so we can fail fast before creating any Meta entities.
        let resolvedProductSetId: string | null = null;
        let catalogConfig: Awaited<ReturnType<typeof prisma.metaCatalogConfig.findFirst>> = null;

        if (useCatalog && catalogServiceSlug) {
          catalogConfig = await prisma.metaCatalogConfig.findFirst({ where: { isActive: true } });
          if (!catalogConfig?.catalogId) {
            return NextResponse.json(
              {
                error:
                  'No active Meta catalog connected. Configure one at /admin/marketing/meta-catalog before publishing Dynamic Product Ads.',
              },
              { status: 400 },
            );
          }

          const slugsKey = catalogServiceSlug;
          let productSetRow = await prisma.serviceCatalogProductSet.findUnique({
            where: { slugsKey },
          });

          if (!productSetRow || productSetRow.productSetId.startsWith('pending:')) {
            // Create the actual Meta product set bound to the single retailer_id (= slug).
            try {
              const created = await metaClient.createCatalogProductSet({
                catalogId: catalogConfig.catalogId,
                name: `LockSafe – ${catalogServiceSlug}`,
                retailerIds: [catalogServiceSlug],
              });
              if (productSetRow) {
                productSetRow = await prisma.serviceCatalogProductSet.update({
                  where: { id: productSetRow.id },
                  data: { productSetId: created.id },
                });
              } else {
                productSetRow = await prisma.serviceCatalogProductSet.create({
                  data: {
                    catalogId: catalogConfig.catalogId,
                    productSetId: created.id,
                    name: `LockSafe – ${catalogServiceSlug}`,
                    slugsKey,
                    slugs: [catalogServiceSlug],
                  },
                });
              }
            } catch (psErr) {
              return NextResponse.json(
                {
                  error: 'Failed to create Meta product set for the selected service.',
                  details: psErr instanceof Error ? psErr.message : 'Unknown error',
                },
                { status: 502 },
              );
            }
          }

          resolvedProductSetId = productSetRow.productSetId;
        }

        try {
          // Decide budget strategy: if campaign-level dailyBudget is provided,
          // use Campaign Budget Optimization (CBO) — Meta auto-distributes
          // across ad sets. Otherwise use per-ad-set budgets. Meta rejects
          // both at once.
          const useCBO = Boolean(dailyBudget && dailyBudget > 0);

          const metaCampaign = await metaClient.createCampaign({
            name,
            objective: objective as keyof typeof OBJECTIVE_MAP,
            status: 'PAUSED',
            ...(useCBO ? { dailyBudget } : {}),
            startTime: startDate ? new Date(startDate) : undefined,
            endTime: endDate ? new Date(endDate) : undefined,
          });
          metaCampaignId = metaCampaign.id;

          // Create one Meta ad set per local ad set bundle, each with its own
          // creative + image. Under CBO, Meta auto-distributes; otherwise we
          // pass `perAdSetBudget` so the budget is split evenly.
          for (let i = 0; i < adSetBundles.length; i++) {
            const bundle = adSetBundles[i];

            const metaAdSet = await metaClient.createAdSet({
              campaignId: metaCampaignId,
              name: bundle.adSet.name,
              objective: objective as keyof typeof OPTIMIZATION_GOALS,
              targeting: targeting || {
                geo_locations: { countries: ['GB'] },
                age_min: 18,
                age_max: 65,
              },
              dailyBudget: useCBO ? undefined : (perAdSetBudget || undefined),
              startTime: startDate ? new Date(startDate) : undefined,
              endTime: endDate ? new Date(endDate) : undefined,
              status: 'PAUSED',
              ...(resolvedProductSetId ? { productSetId: resolvedProductSetId } : {}),
            });
            metaAdSetIds.push(metaAdSet.id);

            const adCreative = useCatalog && resolvedProductSetId && catalogConfig
              ? await metaClient.createDynamicCatalogAdCreative({
                  name: `${bundle.ad.name} Creative (DPA)`,
                  pageId: process.env.META_PAGE_ID || '',
                  productSetId: resolvedProductSetId,
                  messageTemplate: bundle.creative.primaryText,
                  headlineTemplate: bundle.creative.headline,
                  descriptionTemplate: bundle.creative.description || undefined,
                  linkTemplate: bundle.ad.trackingUrl || bundle.creative.destinationUrl,
                  callToAction: bundle.creative.callToAction as typeof import('@/lib/meta-marketing').CTA_TYPES[number],
                  urlParameters: `utm_source=facebook&utm_medium=paid&utm_campaign=${bundle.ad.utmCampaign}&utm_content=${bundle.ad.utmContent}`,
                })
              : await metaClient.createAdCreative({
                  name: `${bundle.ad.name} Creative`,
                  pageId: process.env.META_PAGE_ID || '',
                  imageUrl: bundle.creative.imageUrl || undefined,
                  link: bundle.ad.trackingUrl || bundle.creative.destinationUrl,
                  message: bundle.creative.primaryText,
                  headline: bundle.creative.headline,
                  description: bundle.creative.description || undefined,
                  callToAction: bundle.creative.callToAction as typeof import('@/lib/meta-marketing').CTA_TYPES[number],
                  urlParameters: `utm_source=facebook&utm_medium=paid&utm_campaign=${bundle.ad.utmCampaign}&utm_content=${bundle.ad.utmContent}`,
                });

            metaCreativeIds.push(adCreative.id);

            await prisma.adCreative.update({
              where: { id: bundle.creative.id },
              data: { metaCreativeId: adCreative.id },
            });

            const metaAd = await metaClient.createAd({
              adSetId: metaAdSet.id,
              creativeId: adCreative.id,
              name: bundle.ad.name,
              status: 'PAUSED',
              trackingPixelId: metaAccount.pixelId || undefined,
            });
            metaAdIds.push(metaAd.id);

            await prisma.adSet.update({
              where: { id: bundle.adSet.id },
              data: {
                metaAdSetId: metaAdSet.id,
                status: localStatusOnSuccess,
                ...(useCatalog && resolvedProductSetId
                  ? {
                      productSetId: resolvedProductSetId,
                      serviceSlugs: [catalogServiceSlug as string],
                      isCatalogAdset: true,
                      catalogMode: 'prospecting',
                    }
                  : {}),
              },
            });
            await prisma.ad.update({
              where: { id: bundle.ad.id },
              data: {
                metaAdId: metaAd.id,
                status: localStatusOnSuccess,
              },
            });
          }

          // Persist the Meta IDs and final local status only after the entire stack succeeds.
          await prisma.adCampaign.update({
            where: { id: campaign.id },
            data: {
              metaCampaignId,
              status: localStatusOnSuccess,
            },
          });
        } catch (metaError) {
          console.error('Error publishing to Meta:', metaError);

          // Best-effort rollback so we don't leave orphan Meta entities (the symptom the
          // user saw: a campaign visible in Ads Manager with zero ad sets).
          for (const id of [...metaAdIds, ...metaCreativeIds]) {
            await metaClient.deleteEntity(id);
          }
          for (const id of metaAdSetIds) {
            await metaClient.deleteEntity(id);
          }
          if (metaCampaignId) await metaClient.deleteEntity(metaCampaignId);

          // Reset Meta IDs since they no longer exist.
          metaCampaignId = null;
          metaAdSetIds.length = 0;
          metaAdIds.length = 0;
          metaCreativeIds.length = 0;

          // Keep the local row as DRAFT — the user can retry without duplicates.
          await prisma.adCampaign.update({
            where: { id: campaign.id },
            data: { status: 'DRAFT', metaCampaignId: null },
          });

          metaPublishError = metaError instanceof Error ? metaError.message : 'Unknown Meta API error';
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
        adSetIds: metaAdSetIds,
        adIds: metaAdIds,
        published: publishToMeta && metaCampaignId !== null,
        error: metaPublishError,
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
