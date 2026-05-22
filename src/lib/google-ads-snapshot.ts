/**
 * Google Ads campaign snapshot extractor.
 *
 * After a draft is published (or any time on demand) we pull back the *live*
 * state of the campaign from Google Ads via GAQL and store it on the draft as
 * `publishedSnapshot`. The snapshot becomes the source of truth that future
 * automations (CMO agent) can clone — every keyword, geo, language, ad-group
 * setting and RSA creative exactly as Google stored it.
 *
 * Read-only: only runs SELECT queries, never mutates Google-side state.
 */

import prisma from "@/lib/db";
import { getGoogleAdsClientForAccount, type GoogleAdsClient } from "@/lib/google-ads";

export interface GoogleAdsCampaignSnapshot {
  capturedAt: string; // ISO timestamp
  customerId: string;
  campaign: Record<string, unknown> | null;
  budget: Record<string, unknown> | null;
  adGroups: Record<string, unknown>[];
  ads: Record<string, unknown>[];
  positiveKeywords: Record<string, unknown>[];
  campaignCriteria: Record<string, unknown>[]; // geo, language, negative kw, etc.
}

/**
 * Pull a full snapshot of a single live Google Ads campaign.
 * `googleCampaignId` is the numeric campaign ID (NOT the resource name).
 */
export async function extractGoogleAdsCampaignSnapshot(
  accountId: string,
  googleCampaignId: string,
): Promise<GoogleAdsCampaignSnapshot> {
  const client = await getGoogleAdsClientForAccount(accountId);
  if (!client) {
    throw new Error(`No active Google Ads account for accountId ${accountId}`);
  }
  return extractWithClient(client, googleCampaignId);
}

async function extractWithClient(
  client: GoogleAdsClient,
  googleCampaignId: string,
): Promise<GoogleAdsCampaignSnapshot> {
  // 1. Campaign + budget (joined)
  const campaignRows = await client.query<Record<string, unknown>>(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.advertising_channel_sub_type,
      campaign.bidding_strategy_type,
      campaign.target_cpa.target_cpa_micros,
      campaign.maximize_conversions.target_cpa_micros,
      campaign.network_settings.target_google_search,
      campaign.network_settings.target_search_network,
      campaign.network_settings.target_content_network,
      campaign.network_settings.target_partner_search_network,
      campaign.serving_status,
      campaign_budget.id,
      campaign_budget.amount_micros,
      campaign_budget.delivery_method,
      campaign_budget.explicitly_shared
    FROM campaign
    WHERE campaign.id = ${googleCampaignId}
    LIMIT 1
  `);
  const campaignRow = campaignRows[0] ?? null;
  const campaign =
    campaignRow && typeof campaignRow === "object" && "campaign" in campaignRow
      ? (campaignRow as { campaign?: Record<string, unknown> }).campaign ?? null
      : null;
  const budget =
    campaignRow && typeof campaignRow === "object" && "campaignBudget" in campaignRow
      ? (campaignRow as { campaignBudget?: Record<string, unknown> }).campaignBudget ?? null
      : null;

  // 2. Ad groups
  const adGroupRows = await client.query<Record<string, unknown>>(`
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group.cpc_bid_micros,
      ad_group.target_cpa_micros
    FROM ad_group
    WHERE campaign.id = ${googleCampaignId}
  `);
  const adGroups = adGroupRows
    .map((r) => (r as { adGroup?: Record<string, unknown> }).adGroup)
    .filter((x): x is Record<string, unknown> => !!x);

  // 3. Ads (RSA fields)
  const adRows = await client.query<Record<string, unknown>>(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2,
      ad_group_ad.status,
      ad_group.id
    FROM ad_group_ad
    WHERE campaign.id = ${googleCampaignId}
  `);
  const ads = adRows.map((r) => r as Record<string, unknown>);

  // 4. Positive keywords (ad_group_criterion KEYWORD)
  const keywordRows = await client.query<Record<string, unknown>>(`
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.cpc_bid_micros,
      ad_group.id
    FROM keyword_view
    WHERE campaign.id = ${googleCampaignId}
  `);
  const positiveKeywords = keywordRows.map((r) => r as Record<string, unknown>);

  // 5. Campaign-level criteria: geo, language, negative kw, etc.
  const criteriaRows = await client.query<Record<string, unknown>>(`
    SELECT
      campaign_criterion.criterion_id,
      campaign_criterion.type,
      campaign_criterion.negative,
      campaign_criterion.status,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.location.geo_target_constant,
      campaign_criterion.language.language_constant
    FROM campaign_criterion
    WHERE campaign.id = ${googleCampaignId}
  `);
  const campaignCriteria = criteriaRows.map((r) => r as Record<string, unknown>);

  return {
    capturedAt: new Date().toISOString(),
    customerId: (campaign as { resourceName?: string } | null)?.resourceName?.split("/")[1] ?? "",
    campaign,
    budget,
    adGroups,
    ads,
    positiveKeywords,
    campaignCriteria,
  };
}

/**
 * Captures and persists a snapshot onto the draft record. Errors are swallowed
 * and logged — snapshot failure must never break a successful publish.
 */
export async function captureAndStoreSnapshot(
  draftId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const draft = await prisma.googleAdsCampaignDraft.findUnique({
      where: { id: draftId },
      select: { id: true, accountId: true, googleCampaignId: true },
    });
    if (!draft) return { ok: false, error: "Draft not found" };
    if (!draft.googleCampaignId) {
      return { ok: false, error: "Draft has no live campaign ID yet" };
    }
    const snapshot = await extractGoogleAdsCampaignSnapshot(
      draft.accountId,
      draft.googleCampaignId,
    );
    await prisma.googleAdsCampaignDraft.update({
      where: { id: draftId },
      data: {
        publishedSnapshot: snapshot as unknown as object,
        snapshotAt: new Date(),
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[google-ads-snapshot/${draftId}] capture failed:`, message);
    return { ok: false, error: message };
  }
}
