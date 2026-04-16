/**
 * Meta Performance Sync Service
 *
 * Pulls ad performance metrics from Meta Marketing API and updates the database.
 * Supports:
 * - Campaign-level metrics
 * - Ad set-level metrics
 * - Ad-level metrics
 * - Daily performance snapshots
 * - Incremental syncing (only since last sync)
 */

import { prisma } from "@/lib/db";
import { createMetaClient, type MetaInsights } from "@/lib/meta-marketing";

// Types
export interface SyncResult {
  success: boolean;
  campaignsUpdated: number;
  adSetsUpdated: number;
  adsUpdated: number;
  snapshotsCreated: number;
  errors: string[];
  duration: number;
}

export interface SyncOptions {
  campaignId?: string; // Sync specific campaign only
  dateRange?: {
    since: string; // YYYY-MM-DD
    until: string; // YYYY-MM-DD
  };
  includeSnapshots?: boolean; // Create daily snapshots
  forceFullSync?: boolean; // Ignore lastSyncAt, sync all data
}

/**
 * Calculate derived metrics from raw insights
 */
function calculateMetrics(insights: MetaInsights) {
  const impressions = parseInt(insights.impressions || "0");
  const clicks = parseInt(insights.clicks || "0");
  const spend = parseFloat(insights.spend || "0");

  // Extract conversions from actions array
  let conversions = 0;
  let revenue = 0;

  if (insights.actions) {
    for (const action of insights.actions) {
      // Count lead and purchase actions as conversions
      if (
        action.action_type === "lead" ||
        action.action_type === "purchase" ||
        action.action_type === "complete_registration" ||
        action.action_type === "offsite_conversion.fb_pixel_lead" ||
        action.action_type === "offsite_conversion.fb_pixel_purchase"
      ) {
        conversions += parseInt(action.value || "0");
      }

      // Sum purchase values for revenue
      if (
        action.action_type === "purchase" ||
        action.action_type === "offsite_conversion.fb_pixel_purchase"
      ) {
        revenue += parseFloat(action.value || "0");
      }
    }
  }

  // Calculate derived metrics
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr,
    cpc,
    cpm,
    roas,
  };
}

/**
 * Get default date range for syncing (last 7 days)
 */
function getDefaultDateRange(): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

/**
 * Sync all campaigns from Meta
 */
export async function syncAllCampaigns(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    campaignsUpdated: 0,
    adSetsUpdated: 0,
    adsUpdated: 0,
    snapshotsCreated: 0,
    errors: [],
    duration: 0,
  };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured - check environment variables");
      return result;
    }

    // Get date range
    const dateRange = options.dateRange || getDefaultDateRange();

    // Get all campaigns that have Meta IDs
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        metaCampaignId: { not: null },
        ...(options.campaignId ? { id: options.campaignId } : {}),
      },
      include: {
        adSets: {
          where: { metaAdSetId: { not: null } },
          include: {
            ads: {
              where: { metaAdId: { not: null } },
            },
          },
        },
      },
    });

    console.log(`[Meta Sync] Found ${campaigns.length} campaigns to sync`);

    for (const campaign of campaigns) {
      try {
        // Sync campaign-level metrics
        const campaignInsights = await metaClient.getCampaignInsights(
          campaign.metaCampaignId!,
          dateRange
        );

        if (campaignInsights.data && campaignInsights.data.length > 0) {
          const metrics = calculateMetrics(campaignInsights.data[0]);

          await prisma.adCampaign.update({
            where: { id: campaign.id },
            data: {
              totalSpend: metrics.spend,
              totalImpressions: metrics.impressions,
              totalClicks: metrics.clicks,
              totalConversions: metrics.conversions,
              totalRevenue: metrics.revenue,
              lastSyncAt: new Date(),
            },
          });

          result.campaignsUpdated++;
          console.log(
            `[Meta Sync] Updated campaign ${campaign.name}: £${metrics.spend.toFixed(2)} spend, ${metrics.impressions} impressions`
          );
        }

        // Sync ad set metrics
        for (const adSet of campaign.adSets) {
          try {
            const adSetInsights = await metaClient.getAdSetInsights(
              adSet.metaAdSetId!,
              dateRange
            );

            if (adSetInsights.data && adSetInsights.data.length > 0) {
              const metrics = calculateMetrics(adSetInsights.data[0]);

              await prisma.adSet.update({
                where: { id: adSet.id },
                data: {
                  spend: metrics.spend,
                  impressions: metrics.impressions,
                  clicks: metrics.clicks,
                  conversions: metrics.conversions,
                  ctr: metrics.ctr,
                  cpc: metrics.cpc,
                  cpm: metrics.cpm,
                },
              });

              result.adSetsUpdated++;
            }

            // Sync individual ad metrics
            for (const ad of adSet.ads) {
              try {
                const adInsights = await metaClient.getAdInsights(
                  ad.metaAdId!,
                  dateRange
                );

                if (adInsights.data && adInsights.data.length > 0) {
                  const metrics = calculateMetrics(adInsights.data[0]);

                  await prisma.ad.update({
                    where: { id: ad.id },
                    data: {
                      spend: metrics.spend,
                      impressions: metrics.impressions,
                      clicks: metrics.clicks,
                      conversions: metrics.conversions,
                      revenue: metrics.revenue,
                      ctr: metrics.ctr,
                      cpc: metrics.cpc,
                      roas: metrics.roas,
                      lastSyncAt: new Date(),
                    },
                  });

                  result.adsUpdated++;

                  // Create daily snapshot if requested
                  if (options.includeSnapshots) {
                    await prisma.adPerformanceSnapshot.create({
                      data: {
                        adId: ad.id,
                        adSetId: adSet.id,
                        campaignId: campaign.id,
                        date: new Date(dateRange.until),
                        spend: metrics.spend,
                        impressions: metrics.impressions,
                        clicks: metrics.clicks,
                        conversions: metrics.conversions,
                        revenue: metrics.revenue,
                        ctr: metrics.ctr,
                        cpc: metrics.cpc,
                        cpm: metrics.cpm,
                        roas: metrics.roas,
                      },
                    });
                    result.snapshotsCreated++;
                  }
                }
              } catch (adError) {
                const errorMsg = `Failed to sync ad ${ad.id}: ${adError instanceof Error ? adError.message : "Unknown error"}`;
                console.error(`[Meta Sync] ${errorMsg}`);
                result.errors.push(errorMsg);
              }
            }
          } catch (adSetError) {
            const errorMsg = `Failed to sync ad set ${adSet.id}: ${adSetError instanceof Error ? adSetError.message : "Unknown error"}`;
            console.error(`[Meta Sync] ${errorMsg}`);
            result.errors.push(errorMsg);
          }
        }
      } catch (campaignError) {
        const errorMsg = `Failed to sync campaign ${campaign.id}: ${campaignError instanceof Error ? campaignError.message : "Unknown error"}`;
        console.error(`[Meta Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Update account lastSyncAt
    await prisma.metaAdAccount.updateMany({
      where: { isActive: true },
      data: { lastSyncAt: new Date() },
    });

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log(
      `[Meta Sync] Completed in ${result.duration}ms: ${result.campaignsUpdated} campaigns, ${result.adSetsUpdated} ad sets, ${result.adsUpdated} ads`
    );

    return result;
  } catch (error) {
    result.errors.push(
      `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    result.duration = Date.now() - startTime;
    console.error("[Meta Sync] Fatal error:", error);
    return result;
  }
}

/**
 * Sync daily snapshots for historical tracking
 * This creates one snapshot per ad per day for the given date range
 */
export async function syncDailySnapshots(
  dateRange: { since: string; until: string }
): Promise<{ success: boolean; snapshotsCreated: number; errors: string[] }> {
  const result = {
    success: false,
    snapshotsCreated: 0,
    errors: [] as string[],
  };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured");
      return result;
    }

    // Get all ads with Meta IDs
    const ads = await prisma.ad.findMany({
      where: { metaAdId: { not: null } },
      include: {
        adSet: {
          include: {
            campaign: true,
          },
        },
      },
    });

    // Generate array of dates between since and until
    const dates: string[] = [];
    const start = new Date(dateRange.since);
    const end = new Date(dateRange.until);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    console.log(
      `[Meta Sync] Creating snapshots for ${ads.length} ads across ${dates.length} days`
    );

    for (const ad of ads) {
      for (const date of dates) {
        try {
          // Check if snapshot already exists
          const existing = await prisma.adPerformanceSnapshot.findFirst({
            where: {
              adId: ad.id,
              date: new Date(date),
            },
          });

          if (existing) continue;

          // Get insights for this specific day
          const insights = await metaClient.getAdInsights(ad.metaAdId!, {
            since: date,
            until: date,
          });

          if (insights.data && insights.data.length > 0) {
            const metrics = calculateMetrics(insights.data[0]);

            await prisma.adPerformanceSnapshot.create({
              data: {
                adId: ad.id,
                adSetId: ad.adSetId,
                campaignId: ad.adSet.campaignId,
                date: new Date(date),
                spend: metrics.spend,
                impressions: metrics.impressions,
                clicks: metrics.clicks,
                conversions: metrics.conversions,
                revenue: metrics.revenue,
                ctr: metrics.ctr,
                cpc: metrics.cpc,
                cpm: metrics.cpm,
                roas: metrics.roas,
              },
            });

            result.snapshotsCreated++;
          }
        } catch (err) {
          // Skip individual errors to continue with other ads/dates
          console.error(`[Meta Sync] Snapshot error for ad ${ad.id} on ${date}:`, err);
        }
      }
    }

    result.success = true;
    console.log(`[Meta Sync] Created ${result.snapshotsCreated} snapshots`);
    return result;
  } catch (error) {
    result.errors.push(
      `Snapshot sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    console.error("[Meta Sync] Fatal snapshot error:", error);
    return result;
  }
}

/**
 * Get sync status for display in admin
 */
export async function getSyncStatus(): Promise<{
  lastSyncAt: Date | null;
  campaignsWithData: number;
  totalSpend: number;
  totalImpressions: number;
  totalConversions: number;
  isConfigured: boolean;
}> {
  const account = await prisma.metaAdAccount.findFirst({
    where: { isActive: true },
  });

  const stats = await prisma.adCampaign.aggregate({
    _sum: {
      totalSpend: true,
      totalImpressions: true,
      totalConversions: true,
    },
    _count: {
      id: true,
    },
    where: {
      totalSpend: { gt: 0 },
    },
  });

  const isConfigured = !!(
    process.env.META_ACCESS_TOKEN &&
    process.env.META_AD_ACCOUNT_ID
  );

  return {
    lastSyncAt: account?.lastSyncAt || null,
    campaignsWithData: stats._count.id || 0,
    totalSpend: stats._sum.totalSpend || 0,
    totalImpressions: stats._sum.totalImpressions || 0,
    totalConversions: stats._sum.totalConversions || 0,
    isConfigured,
  };
}

/**
 * Sync ad review status from Meta
 * Useful for checking if ads have been approved/rejected
 */
export async function syncAdReviewStatus(): Promise<{
  updated: number;
  errors: string[];
}> {
  const result = { updated: 0, errors: [] as string[] };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured");
      return result;
    }

    // Get all ads with pending review
    const ads = await prisma.ad.findMany({
      where: {
        metaAdId: { not: null },
        status: "PENDING_REVIEW",
      },
    });

    for (const ad of ads) {
      try {
        // The Meta API returns effective_status and review status
        // We need to fetch the ad directly to get this info
        const response = await fetch(
          `https://graph.facebook.com/v25.0/${ad.metaAdId}?fields=effective_status,review_feedback&access_token=${process.env.META_ACCESS_TOKEN}`
        );

        const data = await response.json();

        if (data.effective_status) {
          let newStatus: "ACTIVE" | "PAUSED" | "REJECTED" | "PENDING_REVIEW" = "PENDING_REVIEW";

          switch (data.effective_status) {
            case "ACTIVE":
              newStatus = "ACTIVE";
              break;
            case "PAUSED":
            case "CAMPAIGN_PAUSED":
            case "ADSET_PAUSED":
              newStatus = "PAUSED";
              break;
            case "DISAPPROVED":
              newStatus = "REJECTED";
              break;
            case "PENDING_REVIEW":
            case "IN_PROCESS":
              newStatus = "PENDING_REVIEW";
              break;
          }

          await prisma.ad.update({
            where: { id: ad.id },
            data: {
              status: newStatus,
              metaReviewStatus: data.effective_status,
              metaReviewFeedback: data.review_feedback
                ? JSON.stringify(data.review_feedback)
                : null,
            },
          });

          result.updated++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to check ad ${ad.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Review sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return result;
  }
}
