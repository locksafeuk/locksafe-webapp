/**
 * Meta Marketing API Client
 *
 * Full integration with:
 * - Campaign/Ad Set/Ad creation
 * - Creative upload
 * - Audience management
 * - Pixel tracking configuration
 * - Performance sync
 */

import { createHash, createHmac } from "node:crypto";

const META_API_VERSION = 'v25.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Types
export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  business?: {
    id: string;
    name: string;
  };
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: number;
  targeting: MetaTargeting;
  optimization_goal: string;
  billing_event: string;
}

export interface MetaTargeting {
  geo_locations?: {
    countries?: string[];
    regions?: { key: string }[];
    cities?: { key: string; radius?: number; distance_unit?: string }[];
    zips?: { key: string }[];
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 = male, 2 = female
  interests?: { id: string; name: string }[];
  behaviors?: { id: string; name: string }[];
  custom_audiences?: { id: string }[];
  excluded_custom_audiences?: { id: string }[];
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
}

export interface MetaAdCreative {
  id: string;
  name: string;
  object_story_spec?: {
    page_id: string;
    link_data?: {
      image_hash?: string;
      link: string;
      message: string;
      name: string;
      description?: string;
      call_to_action?: {
        type: string;
        value?: { link?: string };
      };
    };
  };
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative: { id: string };
  tracking_specs?: Array<{
    'action.type': string[];
    fb_pixel?: string[];
  }>;
}

export interface MetaInsights {
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  conversions?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

// Campaign Objectives mapping
export const OBJECTIVE_MAP = {
  AWARENESS: 'OUTCOME_AWARENESS',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
  LEADS: 'OUTCOME_LEADS',
  SALES: 'OUTCOME_SALES',
  APP_INSTALLS: 'OUTCOME_APP_PROMOTION',
} as const;

// Optimization goals based on objective
export const OPTIMIZATION_GOALS = {
  LEADS: 'LEAD_GENERATION',
  SALES: 'OFFSITE_CONVERSIONS',
  TRAFFIC: 'LINK_CLICKS',
  AWARENESS: 'REACH',
  ENGAGEMENT: 'POST_ENGAGEMENT',
  APP_INSTALLS: 'APP_INSTALLS',
} as const;

// Pixel event mapping based on objective
export const PIXEL_EVENT_MAP = {
  LEADS: 'Lead',
  SALES: 'Purchase',
  TRAFFIC: 'PageView',
  AWARENESS: 'PageView',
  ENGAGEMENT: 'ViewContent',
  APP_INSTALLS: 'PageView',
} as const;

// Call to action types
export const CTA_TYPES = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'GET_QUOTE',
  'CONTACT_US',
  'BOOK_NOW',
  'APPLY_NOW',
  'DOWNLOAD',
  'GET_OFFER',
  'REQUEST_TIME',
  'SEE_MORE',
  'SUBSCRIBE',
] as const;

// Main API Client Class
export class MetaMarketingClient {
  private accessToken: string;
  private adAccountId: string;
  private appSecret?: string;
  private pixelId?: string;
  private pageId?: string;

  constructor(config: {
    accessToken: string;
    adAccountId: string;
    appSecret?: string;
    pixelId?: string;
    pageId?: string;
  }) {
    this.accessToken = config.accessToken;
    this.adAccountId = config.adAccountId.startsWith('act_')
      ? config.adAccountId
      : `act_${config.adAccountId}`;
    this.appSecret = config.appSecret;
    this.pixelId = config.pixelId;
    this.pageId = config.pageId;
  }

  /**
   * Generate appsecret_proof for API requests
   * Required when "Require App Secret Proof" is enabled in Meta App settings
   */
  private generateAppSecretProof(): string | null {
    if (!this.appSecret) {
      return null;
    }
    // HMAC-SHA256(access_token, app_secret)
    const proof = createHmac('sha256', this.appSecret)
      .update(this.accessToken)
      .digest('hex');
    return proof;
  }

  // ===================
  // PRIVATE HELPERS
  // ===================

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`${META_BASE_URL}${endpoint}`);

    if (method === 'GET' && body) {
      Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    url.searchParams.set('access_token', this.accessToken);

    // Add appsecret_proof if app secret is configured
    const appSecretProof = this.generateAppSecretProof();
    if (appSecretProof) {
      url.searchParams.set('appsecret_proof', appSecretProof);
      console.log('[Meta API] appsecret_proof added to request');
    } else {
      console.warn('[Meta API] WARNING: No appsecret_proof - this.appSecret is:', this.appSecret ? 'SET' : 'NOT SET');
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (!response.ok) {
      const err = data.error || {};
      // Meta nests the actually-useful explanation under error_user_msg /
      // error_user_title / error_subcode. Surface them so callers don't have
      // to guess what "Invalid parameter" actually means.
      const detailParts = [
        err.message,
        err.error_user_title,
        err.error_user_msg,
        err.error_subcode ? `subcode=${err.error_subcode}` : null,
      ].filter(Boolean);
      const message = detailParts.join(' | ') || 'Unknown error';
      console.error('[Meta API] Request failed', {
        endpoint,
        method,
        body,
        error: err,
      });
      throw new MetaAPIError(message, err);
    }

    return data;
  }

  // ===================
  // ACCOUNT MANAGEMENT
  // ===================

  async getAdAccount(): Promise<MetaAdAccount> {
    return this.request<MetaAdAccount>(`/${this.adAccountId}`, 'GET', {
      fields: 'id,name,currency,timezone_name,business{id,name}',
    });
  }

  async getAdAccounts(): Promise<{ data: MetaAdAccount[] }> {
    return this.request('/me/adaccounts', 'GET', {
      fields: 'id,name,currency,timezone_name,account_status',
    });
  }

  async getPixels(): Promise<{ data: Array<{ id: string; name: string }> }> {
    return this.request(`/${this.adAccountId}/adspixels`, 'GET', {
      fields: 'id,name',
    });
  }

  async getPages(): Promise<{ data: Array<{ id: string; name: string; access_token: string }> }> {
    return this.request('/me/accounts', 'GET', {
      fields: 'id,name,access_token',
    });
  }

  // ===================
  // CAMPAIGNS
  // ===================

  async createCampaign(params: {
    name: string;
    objective: keyof typeof OBJECTIVE_MAP;
    status?: 'ACTIVE' | 'PAUSED';
    dailyBudget?: number;
    lifetimeBudget?: number;
    startTime?: Date;
    endTime?: Date;
    specialAdCategories?: string[];
  }): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      name: params.name,
      objective: OBJECTIVE_MAP[params.objective],
      status: params.status || 'PAUSED',
      special_ad_categories: params.specialAdCategories || [],
    };

    if (params.dailyBudget) {
      body.daily_budget = Math.round(params.dailyBudget * 100); // Convert to cents
    }
    if (params.lifetimeBudget) {
      body.lifetime_budget = Math.round(params.lifetimeBudget * 100);
    }
    if (params.startTime) {
      body.start_time = params.startTime.toISOString();
    }
    if (params.endTime) {
      body.stop_time = params.endTime.toISOString();
    }

    return this.request(`/${this.adAccountId}/campaigns`, 'POST', body);
  }

  /**
   * Delete any Meta entity by its node id (campaign, adset, ad, creative, product set).
   * Used to roll back partially-created campaign trees when one of the publish steps fails.
   * Errors are swallowed — best-effort cleanup must not mask the original failure.
   */
  async deleteEntity(id: string): Promise<void> {
    try {
      await this.request(`/${id}`, 'DELETE');
    } catch (err) {
      console.warn(`[Meta API] Failed to delete entity ${id} during rollback:`, err);
    }
  }

  async getCampaigns(status?: string): Promise<{ data: MetaCampaign[] }> {
    const params: Record<string, unknown> = {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    };
    if (status) {
      params.filtering = JSON.stringify([{ field: 'status', operator: 'IN', value: [status] }]);
    }
    return this.request(`/${this.adAccountId}/campaigns`, 'GET', params);
  }

  async updateCampaign(
    campaignId: string,
    params: Partial<{
      name: string;
      status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      dailyBudget: number;
    }>
  ): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.status) body.status = params.status;
    if (params.dailyBudget) body.daily_budget = Math.round(params.dailyBudget * 100);

    return this.request(`/${campaignId}`, 'POST', body);
  }

  // ===================
  // AD SETS
  // ===================

  async createAdSet(params: {
    campaignId: string;
    name: string;
    objective: keyof typeof OPTIMIZATION_GOALS;
    targeting: MetaTargeting;
    dailyBudget?: number;
    lifetimeBudget?: number;
    startTime?: Date;
    endTime?: Date;
    status?: 'ACTIVE' | 'PAUSED';
    bidAmount?: number;
    /** Catalog ad mode — binds the adset to a Product Set for dynamic ads. */
    productSetId?: string;
    /** For retargeting catalog adsets: the pixel event to retarget on. */
    catalogRetargetEvent?: 'ViewContent' | 'AddToCart' | 'InitiateCheckout';
  }): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      campaign_id: params.campaignId,
      name: params.name,
      status: params.status || 'PAUSED',
      targeting: params.targeting,
      optimization_goal: OPTIMIZATION_GOALS[params.objective],
      billing_event: 'IMPRESSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    };

    // Add promoted object for conversion tracking
    if (params.productSetId) {
      // Catalog mode: bind the adset to a product set so Meta can render
      // dynamic creatives. For retargeting flows, custom_event_type drives
      // the audience (e.g. ViewContent in last 180d).
      body.promoted_object = {
        product_set_id: params.productSetId,
        ...(params.catalogRetargetEvent
          ? { custom_event_type: params.catalogRetargetEvent }
          : {}),
        ...(this.pixelId ? { pixel_id: this.pixelId } : {}),
      };
    } else if (params.objective === 'LEADS' || params.objective === 'SALES') {
      body.promoted_object = {
        pixel_id: this.pixelId,
        custom_event_type: PIXEL_EVENT_MAP[params.objective],
      };
    }

    if (params.dailyBudget) {
      body.daily_budget = Math.round(params.dailyBudget * 100);
    }
    if (params.lifetimeBudget) {
      body.lifetime_budget = Math.round(params.lifetimeBudget * 100);
    }
    if (params.startTime) {
      body.start_time = params.startTime.toISOString();
    }
    if (params.endTime) {
      body.end_time = params.endTime.toISOString();
    }
    if (params.bidAmount) {
      body.bid_amount = Math.round(params.bidAmount * 100);
    }

    return this.request(`/${this.adAccountId}/adsets`, 'POST', body);
  }

  async getAdSets(campaignId?: string): Promise<{ data: MetaAdSet[] }> {
    const params: Record<string, unknown> = {
      fields: 'id,name,status,campaign_id,daily_budget,targeting,optimization_goal,billing_event',
    };
    if (campaignId) {
      params.filtering = JSON.stringify([{ field: 'campaign_id', operator: 'EQUAL', value: campaignId }]);
    }
    return this.request(`/${this.adAccountId}/adsets`, 'GET', params);
  }

  async updateAdSet(
    adSetId: string,
    params: Partial<{
      name: string;
      status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      dailyBudget: number;
      targeting: MetaTargeting;
    }>
  ): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.status) body.status = params.status;
    if (params.dailyBudget) body.daily_budget = Math.round(params.dailyBudget * 100);
    if (params.targeting) body.targeting = params.targeting;

    return this.request(`/${adSetId}`, 'POST', body);
  }

  // ===================
  // AD CREATIVES
  // ===================

  async uploadImage(imageUrl: string): Promise<{ hash: string; url: string }> {
    // For URL-based upload
    const body = {
      url: imageUrl,
    };

    const result = await this.request<{ images: Record<string, { hash: string; url: string }> }>(
      `/${this.adAccountId}/adimages`,
      'POST',
      body
    );

    const imageData = Object.values(result.images)[0];
    return { hash: imageData.hash, url: imageData.url };
  }

  async createAdCreative(params: {
    name: string;
    pageId: string;
    imageHash?: string;
    imageUrl?: string;
    videoId?: string;
    link: string;
    message: string;
    headline: string;
    description?: string;
    callToAction?: typeof CTA_TYPES[number];
    urlParameters?: string; // UTM parameters
  }): Promise<{ id: string }> {
    // If imageUrl provided but no hash, upload first
    let finalImageHash = params.imageHash;
    if (!finalImageHash && params.imageUrl) {
      const uploaded = await this.uploadImage(params.imageUrl);
      finalImageHash = uploaded.hash;
    }

    const linkData: Record<string, unknown> = {
      link: params.link,
      message: params.message,
      name: params.headline,
    };

    if (params.description) {
      linkData.description = params.description;
    }

    if (finalImageHash) {
      linkData.image_hash = finalImageHash;
    }

    if (params.callToAction) {
      linkData.call_to_action = {
        type: params.callToAction,
        value: { link: params.link },
      };
    }

    // Add URL parameters for tracking
    if (params.urlParameters) {
      linkData.url_tags = params.urlParameters;
    }

    const body = {
      name: params.name,
      object_story_spec: {
        page_id: params.pageId || this.pageId,
        link_data: linkData,
      },
    };

    return this.request(`/${this.adAccountId}/adcreatives`, 'POST', body);
  }

  // ===================
  // CATALOG ADS (Advantage+ Dynamic Product Ads)
  // ===================

  /**
   * Create a Product Set inside a Catalog. Filters which catalog items appear
   * in dynamic ads. We typically scope by retailer_id (=== service slug).
   */
  async createCatalogProductSet(params: {
    catalogId: string;
    name: string;
    /** Service slugs to include (matches retailer_id in items_batch upsert). */
    retailerIds: string[];
  }): Promise<{ id: string }> {
    const filter = {
      retailer_id: { is_any: params.retailerIds },
    };
    return this.request(`/${params.catalogId}/product_sets`, 'POST', {
      name: params.name,
      filter: JSON.stringify(filter),
    });
  }

  /**
   * Create a dynamic catalog ad creative. Uses template placeholders
   * ({{product.name}}, {{product.description}}) bound to a product_set_id.
   */
  async createDynamicCatalogAdCreative(params: {
    name: string;
    pageId: string;
    productSetId: string;
    /** Primary text template — supports {{product.name}}, {{product.description}}, {{product.price}}. */
    messageTemplate: string;
    /** Headline template (≤ 40 chars). */
    headlineTemplate: string;
    descriptionTemplate?: string;
    /** Link template — defaults to the catalog item's link. */
    linkTemplate?: string;
    callToAction?: typeof CTA_TYPES[number];
    urlParameters?: string;
  }): Promise<{ id: string }> {
    const link = params.linkTemplate ?? '{{product.url | permalink}}';

    const linkData: Record<string, unknown> = {
      link,
      message: params.messageTemplate,
      name: params.headlineTemplate,
    };
    if (params.descriptionTemplate) linkData.description = params.descriptionTemplate;
    if (params.callToAction) {
      linkData.call_to_action = {
        type: params.callToAction,
        value: { link },
      };
    }
    if (params.urlParameters) linkData.url_tags = params.urlParameters;

    const body: Record<string, unknown> = {
      name: params.name,
      object_story_spec: {
        page_id: params.pageId || this.pageId,
        template_data: linkData,
      },
      product_set_id: params.productSetId,
    };

    return this.request(`/${this.adAccountId}/adcreatives`, 'POST', body);
  }

  // ===================
  // ADS
  // ===================

  async createAd(params: {
    adSetId: string;
    creativeId: string;
    name: string;
    status?: 'ACTIVE' | 'PAUSED';
    trackingPixelId?: string;
  }): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      name: params.name,
      status: params.status || 'PAUSED',
    };

    // Add pixel tracking
    const pixelId = params.trackingPixelId || this.pixelId;
    if (pixelId) {
      body.tracking_specs = [
        {
          'action.type': ['offsite_conversion'],
          fb_pixel: [pixelId],
        },
      ];
    }

    return this.request(`/${this.adAccountId}/ads`, 'POST', body);
  }

  async getAds(adSetId?: string): Promise<{ data: MetaAd[] }> {
    const params: Record<string, unknown> = {
      fields: 'id,name,status,adset_id,creative{id},tracking_specs',
    };
    if (adSetId) {
      params.filtering = JSON.stringify([{ field: 'adset_id', operator: 'EQUAL', value: adSetId }]);
    }
    return this.request(`/${this.adAccountId}/ads`, 'GET', params);
  }

  async updateAd(
    adId: string,
    params: Partial<{
      name: string;
      status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    }>
  ): Promise<{ success: boolean }> {
    return this.request(`/${adId}`, 'POST', params);
  }

  // ===================
  // INSIGHTS / ANALYTICS
  // ===================

  async getCampaignInsights(
    campaignId: string,
    dateRange?: { since: string; until: string }
  ): Promise<{ data: MetaInsights[] }> {
    const params: Record<string, unknown> = {
      fields: 'impressions,clicks,spend,ctr,cpc,cpm,actions,conversions',
    };
    if (dateRange) {
      params.time_range = JSON.stringify(dateRange);
    }
    return this.request(`/${campaignId}/insights`, 'GET', params);
  }

  async getAdSetInsights(
    adSetId: string,
    dateRange?: { since: string; until: string }
  ): Promise<{ data: MetaInsights[] }> {
    const params: Record<string, unknown> = {
      fields: 'impressions,clicks,spend,ctr,cpc,cpm,actions,conversions',
    };
    if (dateRange) {
      params.time_range = JSON.stringify(dateRange);
    }
    return this.request(`/${adSetId}/insights`, 'GET', params);
  }

  async getAdInsights(
    adId: string,
    dateRange?: { since: string; until: string }
  ): Promise<{ data: MetaInsights[] }> {
    const params: Record<string, unknown> = {
      fields: 'impressions,clicks,spend,ctr,cpc,cpm,actions,conversions',
    };
    if (dateRange) {
      params.time_range = JSON.stringify(dateRange);
    }
    return this.request(`/${adId}/insights`, 'GET', params);
  }

  async getAccountInsights(
    dateRange?: { since: string; until: string }
  ): Promise<{ data: MetaInsights[] }> {
    const params: Record<string, unknown> = {
      fields: 'impressions,clicks,spend,ctr,cpc,cpm,actions',
      level: 'account',
    };
    if (dateRange) {
      params.time_range = JSON.stringify(dateRange);
    }
    return this.request(`/${this.adAccountId}/insights`, 'GET', params);
  }

  // ===================
  // AUDIENCES
  // ===================

  async createCustomAudience(params: {
    name: string;
    description?: string;
    subtype: 'WEBSITE' | 'CUSTOMER_LIST' | 'ENGAGEMENT';
    pixelId?: string;
    retentionDays?: number;
    rule?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      name: params.name,
      description: params.description,
      subtype: params.subtype,
    };

    if (params.subtype === 'WEBSITE') {
      body.rule = params.rule || {
        inclusions: {
          operator: 'or',
          rules: [
            {
              event_sources: [{ type: 'pixel', id: params.pixelId || this.pixelId }],
              retention_seconds: (params.retentionDays || 30) * 86400,
            },
          ],
        },
      };
    }

    return this.request(`/${this.adAccountId}/customaudiences`, 'POST', body);
  }

  async createLookalikeAudience(params: {
    name: string;
    sourceAudienceId: string;
    country: string;
    ratio: number; // 0.01 to 0.20 (1% to 20%)
  }): Promise<{ id: string }> {
    return this.request(`/${this.adAccountId}/customaudiences`, 'POST', {
      name: params.name,
      subtype: 'LOOKALIKE',
      origin_audience_id: params.sourceAudienceId,
      lookalike_spec: JSON.stringify({
        type: 'similarity',
        country: params.country,
        ratio: params.ratio,
      }),
    });
  }

  async getCustomAudiences(): Promise<{ data: Array<{ id: string; name: string; subtype: string; approximate_count: number }> }> {
    return this.request(`/${this.adAccountId}/customaudiences`, 'GET', {
      fields: 'id,name,subtype,approximate_count,description',
    });
  }

  // ===================
  // INTEREST TARGETING
  // ===================

  async searchInterests(query: string): Promise<{ data: Array<{ id: string; name: string; audience_size: number }> }> {
    return this.request('/search', 'GET', {
      type: 'adinterest',
      q: query,
    });
  }

  async searchBehaviors(query: string): Promise<{ data: Array<{ id: string; name: string }> }> {
    return this.request('/search', 'GET', {
      type: 'adTargetingCategory',
      class: 'behaviors',
      q: query,
    });
  }

  async getTargetingSuggestions(interestIds: string[]): Promise<{ data: Array<{ id: string; name: string }> }> {
    return this.request(`/${this.adAccountId}/targetingsuggestions`, 'GET', {
      targeting_list: JSON.stringify(interestIds.map(id => ({ id, type: 'interest' }))),
    });
  }

  // ===================
  // UTM & TRACKING HELPERS
  // ===================

  generateTrackingUrl(params: {
    baseUrl: string;
    campaignName: string;
    adName: string;
    source?: string;
    medium?: string;
  }): string {
    const url = new URL(params.baseUrl);

    // Add UTM parameters
    url.searchParams.set('utm_source', params.source || 'facebook');
    url.searchParams.set('utm_medium', params.medium || 'paid');
    url.searchParams.set('utm_campaign', this.slugify(params.campaignName));
    url.searchParams.set('utm_content', this.slugify(params.adName));

    // Add timestamp for uniqueness
    url.searchParams.set('utm_term', Date.now().toString(36));

    return url.toString();
  }

  generateUrlTags(params: {
    campaignName: string;
    adName: string;
    source?: string;
    medium?: string;
  }): string {
    const tags = [
      `utm_source=${params.source || 'facebook'}`,
      `utm_medium=${params.medium || 'paid'}`,
      `utm_campaign=${this.slugify(params.campaignName)}`,
      `utm_content=${this.slugify(params.adName)}`,
    ];
    return tags.join('&');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

// Error class
export class MetaAPIError extends Error {
  code?: number;
  type?: string;
  fbTraceId?: string;

  constructor(message: string, errorData?: {
    code?: number;
    type?: string;
    fbtrace_id?: string;
  }) {
    super(message);
    this.name = 'MetaAPIError';
    this.code = errorData?.code;
    this.type = errorData?.type;
    this.fbTraceId = errorData?.fbtrace_id;
  }
}

// Factory function with environment variables
export function createMetaClient(): MetaMarketingClient | null {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const appSecret = process.env.META_APP_SECRET;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pageId = process.env.META_PAGE_ID;

  // Debug logging
  console.log('[Meta Client] Creating client with config:', {
    hasAccessToken: !!accessToken,
    accessTokenLength: accessToken?.length,
    adAccountId,
    hasAppSecret: !!appSecret,
    appSecretLength: appSecret?.length,
    pixelId,
    pageId,
  });

  if (!accessToken || !adAccountId) {
    console.warn('Meta Marketing API not configured: Missing access token or ad account ID');
    return null;
  }

  if (!appSecret) {
    console.warn('[Meta Client] WARNING: META_APP_SECRET not configured - appsecret_proof will not be sent!');
  }

  return new MetaMarketingClient({
    accessToken,
    adAccountId,
    appSecret,
    pixelId,
    pageId,
  });
}

// ===================
// CONVERSIONS API HELPERS
// ===================

export interface ConversionsAPIEvent {
  event_name: string;
  event_time: number;
  event_id?: string;
  event_source_url?: string;
  action_source: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  user_data: {
    em?: string[]; // Hashed emails
    ph?: string[]; // Hashed phones
    fn?: string[]; // Hashed first names
    ln?: string[]; // Hashed last names
    ct?: string[]; // Hashed cities
    st?: string[]; // Hashed states
    zp?: string[]; // Hashed zip codes
    country?: string[]; // Hashed country codes
    external_id?: string[]; // External IDs
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
    num_items?: number;
  };
}

export async function sendConversionsAPIEvent(
  pixelId: string,
  accessToken: string,
  events: ConversionsAPIEvent[],
  appSecret?: string
): Promise<{ events_received: number; fbtrace_id: string }> {
  let url = `${META_BASE_URL}/${pixelId}/events?access_token=${accessToken}`;

  // Add appsecret_proof if appSecret is provided
  if (appSecret) {
    const appsecret_proof = createHmac('sha256', appSecret)
      .update(accessToken)
      .digest('hex');
    url += `&appsecret_proof=${appsecret_proof}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: events,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new MetaAPIError(data.error?.message || 'Conversions API error', data.error);
  }

  return data;
}

// Hash helper for PII
export function hashForMeta(value: string): string {
  // SHA-256 hash using Node.js crypto module
  return createHash("sha256")
    .update(value.toLowerCase().trim())
    .digest("hex");
}
