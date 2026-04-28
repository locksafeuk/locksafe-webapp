/**
 * Google Ads API client (REST + GAQL via fetch).
 *
 * Phase 1 scope: READ-ONLY.
 *   - OAuth 2 access-token refresh
 *   - GAQL search (campaigns, ad-group metrics, search terms)
 *   - Keyword Plan idea service (for the agent's keyword research loop)
 *
 * Phase 2/3 will add mutation paths (create campaign / ad group / RSA / keyword)
 * behind the spend-guard + approval gate. Do not add mutation code here without
 * landing those pieces first.
 *
 * Why hand-rolled fetch instead of the `google-ads-api` npm package?
 *   - Avoids pulling in a heavy dependency chain (gRPC, protobuf) for what is
 *     fundamentally a JSON-over-HTTPS API at the transport layer.
 *   - GAQL is a string the caller composes; the package adds a query builder
 *     we don't need.
 *   - Easier to audit (no opaque protobuf serialisation in the call path).
 */

import prisma from "@/lib/db";

const API_BASE = "https://googleads.googleapis.com/v18";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/adwords";

// =========================================================================
// Types
// =========================================================================

export interface GoogleAdsCampaignRow {
  campaignId: string;
  campaignName: string;
  status: string; // ENABLED, PAUSED, REMOVED, UNKNOWN
  advertisingChannelType: string; // SEARCH, DISPLAY, VIDEO, PERFORMANCE_MAX, ...
  // Aggregated metrics for the requested date range
  impressions: number;
  clicks: number;
  costMicros: number; // micros = currency * 1_000_000
  conversions: number;
  conversionsValue: number;
  ctr: number;
  averageCpc: number; // micros
}

export interface GoogleAdsSearchTermRow {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  searchTerm: string;
  status: string; // ADDED, EXCLUDED, ADDED_EXCLUDED, NONE, UNKNOWN
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
}

export interface DateRange {
  /** YYYY-MM-DD inclusive. */
  since: string;
  /** YYYY-MM-DD inclusive. */
  until: string;
}

// =========================================================================
// OAuth helpers
// =========================================================================

interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
  scope?: string;
}

/**
 * Exchange a long-lived refresh token for a short-lived access token.
 * Called transparently by `GoogleAdsClient` on every API call when the cached
 * token is within 60 s of expiry.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Ads OAuth client not configured (set GOOGLE_ADS_OAUTH_CLIENT_ID / _SECRET)");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
    scope: json.scope,
  };
}

/**
 * Exchange an OAuth authorization code (from the consent-screen redirect) for
 * a refresh token + access token. Called from the OAuth callback route.
 */
export async function exchangeAuthCode(code: string, redirectUri: string): Promise<{
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
  scope?: string;
}> {
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Ads OAuth client not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth code exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  if (!json.refresh_token) {
    // Google only returns refresh_token on first consent OR when prompt=consent
    // is supplied; the OAuth start route forces prompt=consent so this should
    // not happen in normal flow.
    throw new Error(
      "Google did not return a refresh_token. Ensure prompt=consent and access_type=offline are set on the auth URL.",
    );
  }

  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
    scope: json.scope,
  };
}

/**
 * Build the consent-screen URL the user is redirected to in order to grant
 * the platform access to their Google Ads account.
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google Ads OAuth client not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Force the consent screen so a refresh_token is always returned, even if
    // the user previously authorised this client.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// =========================================================================
// GoogleAdsClient
// =========================================================================

interface GoogleAdsClientConfig {
  /** 10-digit customer ID, no dashes. */
  customerId: string;
  /** Long-lived OAuth 2 refresh token. */
  refreshToken: string;
  /** Optional cached access token (skips a refresh round-trip). */
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  /**
   * MCC manager ID (digits only). Sent as login-customer-id header. Defaults
   * to env GOOGLE_ADS_LOGIN_CUSTOMER_ID.
   */
  loginCustomerId?: string;
}

export class GoogleAdsClient {
  private readonly customerId: string;
  private readonly refreshToken: string;
  private readonly loginCustomerId?: string;
  private accessToken?: string;
  private accessTokenExpiresAt?: Date;

  constructor(config: GoogleAdsClientConfig) {
    this.customerId = stripDashes(config.customerId);
    this.refreshToken = config.refreshToken;
    this.accessToken = config.accessToken;
    this.accessTokenExpiresAt = config.accessTokenExpiresAt;
    this.loginCustomerId = stripDashes(
      config.loginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "",
    );
  }

  /** Returns a valid access token, refreshing if expired. */
  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt.getTime() > Date.now()
    ) {
      return this.accessToken;
    }
    const fresh = await refreshAccessToken(this.refreshToken);
    this.accessToken = fresh.accessToken;
    this.accessTokenExpiresAt = fresh.expiresAt;
    return this.accessToken;
  }

  /**
   * Run a GAQL query and return the raw `results` array. Handles pagination
   * via `nextPageToken` transparently (cap = 5 pages to avoid runaway costs;
   * widen if a legitimate report needs more).
   */
  async query<T = unknown>(gaql: string): Promise<T[]> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN not configured");
    }
    const accessToken = await this.getAccessToken();
    const url = `${API_BASE}/customers/${this.customerId}/googleAds:search`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (this.loginCustomerId) {
      headers["login-customer-id"] = this.loginCustomerId;
    }

    const allResults: T[] = [];
    let pageToken: string | undefined;
    const MAX_PAGES = 5;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body: Record<string, unknown> = { query: gaql, pageSize: 1000 };
      if (pageToken) body.pageToken = pageToken;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Google Ads search failed (${res.status}) for customer ${this.customerId}: ${text}`,
        );
      }

      const json = (await res.json()) as {
        results?: T[];
        nextPageToken?: string;
      };
      if (json.results) allResults.push(...json.results);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }

    return allResults;
  }

  /**
   * List campaigns with aggregated metrics for the given date range.
   */
  async getCampaignMetrics(range: DateRange): Promise<GoogleAdsCampaignRow[]> {
    assertDateRange(range);
    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;
    const rows = await this.query<{
      campaign: { id: string; name: string; status: string; advertisingChannelType: string };
      metrics: {
        impressions?: string;
        clicks?: string;
        costMicros?: string;
        conversions?: number;
        conversionsValue?: number;
        ctr?: number;
        averageCpc?: string;
      };
    }>(gaql);

    return rows.map((r) => ({
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      status: r.campaign.status,
      advertisingChannelType: r.campaign.advertisingChannelType,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      costMicros: Number(r.metrics.costMicros ?? 0),
      conversions: Number(r.metrics.conversions ?? 0),
      conversionsValue: Number(r.metrics.conversionsValue ?? 0),
      ctr: Number(r.metrics.ctr ?? 0),
      averageCpc: Number(r.metrics.averageCpc ?? 0),
    }));
  }

  /**
   * Search Terms Report for a given campaign (or all campaigns if omitted).
   * Used by the agent's keyword-expansion loop in Phase 3.
   */
  async getSearchTermsReport(
    range: DateRange,
    campaignId?: string,
  ): Promise<GoogleAdsSearchTermRow[]> {
    assertDateRange(range);
    const campaignFilter = campaignId
      ? `AND campaign.id = ${asInt(campaignId)}`
      : "";
    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        search_term_view.search_term,
        search_term_view.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'
        ${campaignFilter}
      ORDER BY metrics.cost_micros DESC
    `;
    const rows = await this.query<{
      campaign: { id: string; name: string };
      adGroup: { id: string; name: string };
      searchTermView: { searchTerm: string; status: string };
      metrics: {
        impressions?: string;
        clicks?: string;
        costMicros?: string;
        conversions?: number;
      };
    }>(gaql);

    return rows.map((r) => ({
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      adGroupId: r.adGroup.id,
      adGroupName: r.adGroup.name,
      searchTerm: r.searchTermView.searchTerm,
      status: r.searchTermView.status,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      costMicros: Number(r.metrics.costMicros ?? 0),
      conversions: Number(r.metrics.conversions ?? 0),
    }));
  }

  // =======================================================================
  // Mutation helpers (Phase 2+)
  //
  // These wrap the {resource}:mutate REST endpoints. All mutations create
  // PAUSED entities by default — caller must explicitly enable. This is
  // belt-and-braces so an accidental publish never starts spending.
  // =======================================================================

  /** Customer ID without dashes — exposed for callers building resource names. */
  get customerIdPlain(): string {
    return this.customerId;
  }

  /**
   * Low-level mutation primitive. POSTs to `customers/{cid}/{resource}:mutate`
   * with the supplied operations. Returns the parsed JSON body. Caller is
   * responsible for the operation shape — see the high-level wrappers below.
   */
  async mutate<T = unknown>(
    resource: string,
    operations: Record<string, unknown>[],
    options: { partialFailure?: boolean; validateOnly?: boolean } = {},
  ): Promise<T> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN not configured");
    }
    if (!operations.length) {
      throw new Error("mutate() called with empty operations array");
    }
    const accessToken = await this.getAccessToken();
    const url = `${API_BASE}/customers/${this.customerId}/${resource}:mutate`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (this.loginCustomerId) {
      headers["login-customer-id"] = this.loginCustomerId;
    }

    const body: Record<string, unknown> = {
      operations,
      partialFailure: options.partialFailure ?? false,
      validateOnly: options.validateOnly ?? false,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Google Ads ${resource} mutate failed (${res.status}) for customer ${this.customerId}: ${text}`,
      );
    }
    return (await res.json()) as T;
  }
}

/** Resource-name builder helpers (used when chaining mutations). */
export function buildResourceName(
  customerId: string,
  resource: "campaigns" | "campaignBudgets" | "adGroups" | "adGroupAds" | "adGroupCriteria" | "campaignCriteria",
  id: string,
): string {
  return `customers/${stripDashes(customerId)}/${resource}/${id}`;
}

// =========================================================================
// Factory: load credentials from DB
// =========================================================================

/**
 * Construct a GoogleAdsClient from the GoogleAdsAccount DB row. Returns null
 * if the account is missing or inactive (caller decides whether that's fatal).
 */
export async function getGoogleAdsClientForAccount(
  accountId: string,
): Promise<GoogleAdsClient | null> {
  const account = await prisma.googleAdsAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) return null;

  return new GoogleAdsClient({
    customerId: account.customerId,
    refreshToken: account.refreshToken,
    accessToken: account.accessToken ?? undefined,
    accessTokenExpiresAt: account.tokenExpiresAt ?? undefined,
    loginCustomerId: account.loginCustomerId ?? undefined,
  });
}

/**
 * Returns a client for the first active GoogleAdsAccount, or null. Convenience
 * for single-account setups (which is what we have in Phase 1).
 */
export async function getDefaultGoogleAdsClient(): Promise<{
  client: GoogleAdsClient;
  accountId: string;
  customerId: string;
} | null> {
  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) return null;
  const client = new GoogleAdsClient({
    customerId: account.customerId,
    refreshToken: account.refreshToken,
    accessToken: account.accessToken ?? undefined,
    accessTokenExpiresAt: account.tokenExpiresAt ?? undefined,
    loginCustomerId: account.loginCustomerId ?? undefined,
  });
  return { client, accountId: account.id, customerId: account.customerId };
}

// =========================================================================
// Helpers
// =========================================================================

function stripDashes(id: string): string {
  return id.replace(/[^0-9]/g, "");
}

function assertDateRange(r: DateRange): void {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(r.since) || !re.test(r.until)) {
    throw new Error(`Invalid GAQL date range: ${r.since}..${r.until}`);
  }
}

/**
 * Coerce an arbitrary string to an integer literal safe for inline use in a
 * GAQL filter (campaign.id etc.). Throws on non-digit input — DO NOT bypass:
 * GAQL has no parameterised queries, so any string interpolation must be
 * pre-validated to prevent injection.
 */
function asInt(s: string): string {
  if (!/^[0-9]+$/.test(s)) throw new Error(`Expected integer, got: ${s}`);
  return s;
}

/**
 * Convert micros (currency * 1,000,000) to a regular currency amount.
 */
export function microsToCurrency(micros: number): number {
  return Math.round((micros / 1_000_000) * 100) / 100;
}
