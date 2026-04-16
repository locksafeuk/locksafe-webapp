/**
 * Meta Ads Import Service
 *
 * Imports all campaigns, ad sets, and ads from Meta Ads Manager
 * into the local database for management and tracking.
 */

import { prisma } from "@/lib/db";
import { createMetaClient, type MetaCampaign, type MetaAdSet, type MetaAd } from "@/lib/meta-marketing";

// Types
export interface ImportResult {
  success: boolean;
  campaignsImported: number;
  adSetsImported: number;
  adsImported: number;
  campaignsSkipped: number;
  adSetsSkipped: number;
  adsSkipped: number;
  errors: string[];
  duration: number;
}

export interface ImportOptions {
  status?: "ACTIVE" | "PAUSED" | "ALL";
  includePaused?: boolean;
  updateExisting?: boolean;
}

/**
 * Map Meta campaign objective to our AdObjective enum
 */
function mapObjective(metaObjective: string): "AWARENESS" | "TRAFFIC" | "ENGAGEMENT" | "LEADS" | "SALES" | "APP_INSTALLS" {
  const mapping: Record<string, "AWARENESS" | "TRAFFIC" | "ENGAGEMENT" | "LEADS" | "SALES" | "APP_INSTALLS"> = {
    "OUTCOME_AWARENESS": "AWARENESS",
    "OUTCOME_TRAFFIC": "TRAFFIC",
    "OUTCOME_ENGAGEMENT": "ENGAGEMENT",
    "OUTCOME_LEADS": "LEADS",
    "OUTCOME_SALES": "SALES",
    "OUTCOME_APP_PROMOTION": "APP_INSTALLS",
    // Legacy objectives
    "BRAND_AWARENESS": "AWARENESS",
    "REACH": "AWARENESS",
    "LINK_CLICKS": "TRAFFIC",
    "POST_ENGAGEMENT": "ENGAGEMENT",
    "PAGE_LIKES": "ENGAGEMENT",
    "LEAD_GENERATION": "LEADS",
    "CONVERSIONS": "SALES",
    "CATALOG_SALES": "SALES",
    "STORE_VISITS": "SALES",
    "APP_INSTALLS": "APP_INSTALLS",
  };

  return mapping[metaObjective] || "TRAFFIC";
}

/**
 * Map Meta status to our AdStatus enum
 */
function mapStatus(metaStatus: string): "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "COMPLETED" | "ARCHIVED" {
  const mapping: Record<string, "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "COMPLETED" | "ARCHIVED"> = {
    "ACTIVE": "ACTIVE",
    "PAUSED": "PAUSED",
    "DELETED": "ARCHIVED",
    "ARCHIVED": "ARCHIVED",
    "PENDING_REVIEW": "PENDING_REVIEW",
    "DISAPPROVED": "REJECTED",
    "PREAPPROVED": "PENDING_REVIEW",
    "PENDING_BILLING_INFO": "PAUSED",
    "CAMPAIGN_PAUSED": "PAUSED",
    "ADSET_PAUSED": "PAUSED",
    "IN_PROCESS": "PENDING_REVIEW",
    "WITH_ISSUES": "PAUSED",
  };

  return mapping[metaStatus] || "PAUSED";
}

/**
 * Get or create the Meta Ad Account in database
 */
async function getOrCreateAdAccount(accountId: string): Promise<string> {
  const existing = await prisma.metaAdAccount.findFirst({
    where: { accountId },
  });

  if (existing) {
    return existing.id;
  }

  // Create new account record
  const metaClient = createMetaClient();
  let accountName = accountId;

  try {
    if (metaClient) {
      const accountInfo = await metaClient.getAdAccount();
      accountName = accountInfo.name || accountId;
    }
  } catch {
    console.warn("[Meta Import] Could not fetch account info, using ID as name");
  }

  const newAccount = await prisma.metaAdAccount.create({
    data: {
      accountId,
      name: accountName,
      accessToken: "stored_in_env", // Don't store actual token
      isActive: true,
    },
  });

  return newAccount.id;
}

/**
 * Import all campaigns from Meta
 */
export async function importFromMeta(options: ImportOptions = {}): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    campaignsImported: 0,
    adSetsImported: 0,
    adsImported: 0,
    campaignsSkipped: 0,
    adSetsSkipped: 0,
    adsSkipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured - check META_ACCESS_TOKEN and META_AD_ACCOUNT_ID");
      return result;
    }

    const adAccountId = process.env.META_AD_ACCOUNT_ID;
    if (!adAccountId) {
      result.errors.push("META_AD_ACCOUNT_ID not configured");
      return result;
    }

    // Get or create account in database
    const dbAccountId = await getOrCreateAdAccount(adAccountId);
    console.log(`[Meta Import] Using database account ID: ${dbAccountId}`);

    // Fetch all campaigns from Meta
    console.log("[Meta Import] Fetching campaigns from Meta...");
    const campaignsResponse = await metaClient.getCampaigns(
      options.status === "ACTIVE" ? "ACTIVE" : undefined
    );

    const campaigns = campaignsResponse.data || [];
    console.log(`[Meta Import] Found ${campaigns.length} campaigns`);

    // Process each campaign
    for (const metaCampaign of campaigns) {
      try {
        // Check if campaign already exists
        const existingCampaign = await prisma.adCampaign.findFirst({
          where: { metaCampaignId: metaCampaign.id },
        });

        if (existingCampaign && !options.updateExisting) {
          result.campaignsSkipped++;
          console.log(`[Meta Import] Skipping existing campaign: ${metaCampaign.name}`);
          continue;
        }

        // Create or update campaign
        const campaignData = {
          metaCampaignId: metaCampaign.id,
          accountId: dbAccountId,
          name: metaCampaign.name,
          objective: mapObjective(metaCampaign.objective),
          status: mapStatus(metaCampaign.status),
          dailyBudget: metaCampaign.daily_budget ? metaCampaign.daily_budget / 100 : null,
          lifetimeBudget: metaCampaign.lifetime_budget ? metaCampaign.lifetime_budget / 100 : null,
          startDate: metaCampaign.start_time ? new Date(metaCampaign.start_time) : null,
          endDate: metaCampaign.stop_time ? new Date(metaCampaign.stop_time) : null,
          aiGenerated: false,
        };

        let dbCampaign;
        if (existingCampaign) {
          dbCampaign = await prisma.adCampaign.update({
            where: { id: existingCampaign.id },
            data: campaignData,
          });
        } else {
          dbCampaign = await prisma.adCampaign.create({
            data: campaignData,
          });
          result.campaignsImported++;
        }

        console.log(`[Meta Import] ${existingCampaign ? "Updated" : "Imported"} campaign: ${metaCampaign.name}`);

        // Fetch ad sets for this campaign
        const adSetsResponse = await metaClient.getAdSets(metaCampaign.id);
        const adSets = adSetsResponse.data || [];

        for (const metaAdSet of adSets) {
          try {
            // Check if ad set exists
            const existingAdSet = await prisma.adSet.findFirst({
              where: { metaAdSetId: metaAdSet.id },
            });

            if (existingAdSet && !options.updateExisting) {
              result.adSetsSkipped++;
              continue;
            }

            // Create or update ad set
            // Convert targeting to JSON-compatible format for Prisma
            const targetingJson = JSON.parse(JSON.stringify(metaAdSet.targeting || {}));
            const adSetData = {
              metaAdSetId: metaAdSet.id,
              campaignId: dbCampaign.id,
              name: metaAdSet.name,
              status: mapStatus(metaAdSet.status),
              dailyBudget: metaAdSet.daily_budget ? metaAdSet.daily_budget / 100 : null,
              optimizationGoal: metaAdSet.optimization_goal || "LEAD",
              billingEvent: metaAdSet.billing_event || "IMPRESSIONS",
              targeting: targetingJson,
            };

            let dbAdSet;
            if (existingAdSet) {
              dbAdSet = await prisma.adSet.update({
                where: { id: existingAdSet.id },
                data: adSetData,
              });
            } else {
              dbAdSet = await prisma.adSet.create({
                data: adSetData,
              });
              result.adSetsImported++;
            }

            // Fetch ads for this ad set
            const adsResponse = await metaClient.getAds(metaAdSet.id);
            const ads = adsResponse.data || [];

            for (const metaAd of ads) {
              try {
                // Check if ad exists
                const existingAd = await prisma.ad.findFirst({
                  where: { metaAdId: metaAd.id },
                });

                if (existingAd && !options.updateExisting) {
                  result.adsSkipped++;
                  continue;
                }

                // Get or create a default creative
                let creativeId: string;
                const existingCreative = await prisma.adCreative.findFirst({
                  where: { metaCreativeId: metaAd.creative?.id },
                });

                if (existingCreative) {
                  creativeId = existingCreative.id;
                } else {
                  // Create a placeholder creative
                  const newCreative = await prisma.adCreative.create({
                    data: {
                      metaCreativeId: metaAd.creative?.id || null,
                      type: "IMAGE",
                      primaryText: `Ad creative for: ${metaAd.name}`,
                      headline: metaAd.name,
                      callToAction: "LEARN_MORE",
                      destinationUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://example.com",
                      aiGenerated: false,
                    },
                  });
                  creativeId = newCreative.id;
                }

                // Create or update ad
                const adData = {
                  metaAdId: metaAd.id,
                  adSetId: dbAdSet.id,
                  creativeId,
                  name: metaAd.name,
                  status: mapStatus(metaAd.status),
                  aiGenerated: false,
                };

                if (existingAd) {
                  await prisma.ad.update({
                    where: { id: existingAd.id },
                    data: adData,
                  });
                } else {
                  await prisma.ad.create({
                    data: adData,
                  });
                  result.adsImported++;
                }
              } catch (adError) {
                const msg = `Failed to import ad ${metaAd.name}: ${adError instanceof Error ? adError.message : "Unknown error"}`;
                console.error(`[Meta Import] ${msg}`);
                result.errors.push(msg);
              }
            }
          } catch (adSetError) {
            const msg = `Failed to import ad set ${metaAdSet.name}: ${adSetError instanceof Error ? adSetError.message : "Unknown error"}`;
            console.error(`[Meta Import] ${msg}`);
            result.errors.push(msg);
          }
        }
      } catch (campaignError) {
        const msg = `Failed to import campaign ${metaCampaign.name}: ${campaignError instanceof Error ? campaignError.message : "Unknown error"}`;
        console.error(`[Meta Import] ${msg}`);
        result.errors.push(msg);
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log(
      `[Meta Import] Completed in ${result.duration}ms: ` +
      `${result.campaignsImported} campaigns, ${result.adSetsImported} ad sets, ${result.adsImported} ads imported ` +
      `(${result.campaignsSkipped} campaigns, ${result.adSetsSkipped} ad sets, ${result.adsSkipped} ads skipped)`
    );

    return result;
  } catch (error) {
    result.errors.push(
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    result.duration = Date.now() - startTime;
    console.error("[Meta Import] Fatal error:", error);
    return result;
  }
}

/**
 * Test the Meta API connection
 */
export async function testMetaConnection(): Promise<{
  success: boolean;
  accountInfo?: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
  pixelInfo?: {
    id: string;
    name: string;
  };
  pageInfo?: {
    id: string;
    name: string;
  };
  campaignCount?: number;
  errors: string[];
}> {
  const result: {
    success: boolean;
    accountInfo?: {
      id: string;
      name: string;
      currency: string;
      timezone: string;
    };
    pixelInfo?: {
      id: string;
      name: string;
    };
    pageInfo?: {
      id: string;
      name: string;
    };
    campaignCount?: number;
    errors: string[];
  } = {
    success: false,
    errors: [],
  };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured - check environment variables");
      return result;
    }

    // Test 1: Get Ad Account Info
    try {
      const accountInfo = await metaClient.getAdAccount();
      result.accountInfo = {
        id: accountInfo.id,
        name: accountInfo.name,
        currency: accountInfo.currency,
        timezone: accountInfo.timezone_name,
      };
    } catch (e) {
      result.errors.push(`Failed to fetch ad account: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Test 2: Get Pixels
    try {
      const pixels = await metaClient.getPixels();
      if (pixels.data && pixels.data.length > 0) {
        result.pixelInfo = {
          id: pixels.data[0].id,
          name: pixels.data[0].name,
        };
      }
    } catch (e) {
      result.errors.push(`Failed to fetch pixels: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Test 3: Get Pages
    try {
      const pages = await metaClient.getPages();
      if (pages.data && pages.data.length > 0) {
        result.pageInfo = {
          id: pages.data[0].id,
          name: pages.data[0].name,
        };
      }
    } catch (e) {
      // Pages might not be accessible with all tokens
      console.log("[Meta Test] Could not fetch pages (this is optional)");
    }

    // Test 4: Count Campaigns
    try {
      const campaigns = await metaClient.getCampaigns();
      result.campaignCount = campaigns.data?.length || 0;
    } catch (e) {
      result.errors.push(`Failed to fetch campaigns: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return result;
  }
}

/**
 * Get a summary of what would be imported (dry run)
 */
export async function previewImport(): Promise<{
  success: boolean;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    adSetCount: number;
    exists: boolean;
  }>;
  totalAdSets: number;
  totalAds: number;
  errors: string[];
}> {
  const result: {
    success: boolean;
    campaigns: Array<{
      id: string;
      name: string;
      status: string;
      objective: string;
      adSetCount: number;
      exists: boolean;
    }>;
    totalAdSets: number;
    totalAds: number;
    errors: string[];
  } = {
    success: false,
    campaigns: [],
    totalAdSets: 0,
    totalAds: 0,
    errors: [],
  };

  try {
    const metaClient = createMetaClient();
    if (!metaClient) {
      result.errors.push("Meta client not configured");
      return result;
    }

    // Fetch all campaigns
    const campaignsResponse = await metaClient.getCampaigns();
    const campaigns = campaignsResponse.data || [];

    for (const campaign of campaigns) {
      // Check if exists in database
      const exists = !!(await prisma.adCampaign.findFirst({
        where: { metaCampaignId: campaign.id },
      }));

      // Count ad sets
      const adSetsResponse = await metaClient.getAdSets(campaign.id);
      const adSetCount = adSetsResponse.data?.length || 0;
      result.totalAdSets += adSetCount;

      // Count ads per ad set
      for (const adSet of adSetsResponse.data || []) {
        const adsResponse = await metaClient.getAds(adSet.id);
        result.totalAds += adsResponse.data?.length || 0;
      }

      result.campaigns.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        adSetCount,
        exists,
      });
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Preview failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return result;
  }
}
