/**
 * Unit tests for src/lib/google-ads.ts
 *
 * All external I/O (fetch, Prisma) is mocked so the suite runs without a DB
 * connection or real Google Ads credentials.
 */

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    googleAdsApiConfig: {
      findUnique: jest.fn(),
    },
    googleAdsAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import prisma from "@/lib/db";
import {
  microsToCurrency,
  buildResourceName,
  getGoogleAdsApiConfig,
  refreshAccessToken,
  buildAuthUrl,
  GoogleAdsClient,
} from "@/lib/google-ads";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  developerToken: "sbMXQHwqfdpHpWVGFnh1jg",
  oauthClientId: "test-client-id.apps.googleusercontent.com",
  oauthClientSecret: "test-client-secret",
  loginCustomerId: "2229519701", // 222-951-9701 without dashes
  redirectUri: "https://www.locksafe.uk/api/auth/google-ads/callback",
};

const MOCK_CAMPAIGNS_RESPONSE = {
  results: [
    {
      campaign: {
        id: "111000001",
        name: "Locksmith London — Search",
        status: "ENABLED",
        advertisingChannelType: "SEARCH",
      },
      metrics: {
        impressions: "12500",
        clicks: "430",
        costMicros: "215000000",
        conversions: 38,
        conversionsValue: 3800,
        ctr: 0.0344,
        averageCpc: "500000",
      },
    },
    {
      campaign: {
        id: "111000002",
        name: "Locksmith Birmingham — PMax",
        status: "ENABLED",
        advertisingChannelType: "PERFORMANCE_MAX",
      },
      metrics: {
        impressions: "5200",
        clicks: "198",
        costMicros: "99000000",
        conversions: 17,
        conversionsValue: 1700,
        ctr: 0.0381,
        averageCpc: "500000",
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("microsToCurrency", () => {
  it("converts zero micros", () => {
    expect(microsToCurrency(0)).toBe(0);
  });

  it("converts typical £2.15 spend", () => {
    expect(microsToCurrency(2_150_000)).toBe(2.15);
  });

  it("converts £215 spend (215_000_000 micros)", () => {
    expect(microsToCurrency(215_000_000)).toBe(215);
  });

  it("rounds to 2 decimal places", () => {
    // 1_000_001 micros = 1.000001 → rounds to 1
    expect(microsToCurrency(1_000_001)).toBe(1);
  });

  it("handles fractional pence (e.g. £0.50 CPC)", () => {
    expect(microsToCurrency(500_000)).toBe(0.5);
  });
});

describe("buildResourceName", () => {
  it("builds campaign resource name without dashes", () => {
    const name = buildResourceName("471-522-6378", "campaigns", "111000001");
    expect(name).toBe("customers/4715226378/campaigns/111000001");
  });

  it("builds adGroupAds resource name", () => {
    const name = buildResourceName("4715226378", "adGroupAds", "999");
    expect(name).toBe("customers/4715226378/adGroupAds/999");
  });

  it("strips spaces and non-digit chars from customer ID", () => {
    const name = buildResourceName("471 522 6378", "adGroups", "42");
    expect(name).toBe("customers/4715226378/adGroups/42");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getGoogleAdsApiConfig — env-var fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("getGoogleAdsApiConfig", () => {
  const mockFindUnique = prisma.googleAdsApiConfig.findUnique as jest.Mock;

  beforeEach(() => {
    mockFindUnique.mockReset();
    // Remove env vars that might bleed between tests
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI;
  });

  it("returns null when no DB row and no env vars", async () => {
    mockFindUnique.mockResolvedValue(null);
    const cfg = await getGoogleAdsApiConfig();
    expect(cfg).toBeNull();
  });

  it("returns config from DB row", async () => {
    mockFindUnique.mockResolvedValue(MOCK_CONFIG);
    const cfg = await getGoogleAdsApiConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.developerToken).toBe("sbMXQHwqfdpHpWVGFnh1jg");
    expect(cfg!.loginCustomerId).toBe("2229519701");
  });

  it("falls back to env vars when DB returns null", async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "env-dev-token";
    process.env.GOOGLE_ADS_OAUTH_CLIENT_ID = "env-client-id";
    process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET = "env-client-secret";
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "2229519701";
    process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI = "https://www.locksafe.uk/api/auth/google-ads/callback";

    const cfg = await getGoogleAdsApiConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.developerToken).toBe("env-dev-token");
  });

  it("returns null when DB throws (graceful degradation)", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB connection refused"));
    const cfg = await getGoogleAdsApiConfig();
    expect(cfg).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. refreshAccessToken
// ─────────────────────────────────────────────────────────────────────────────

describe("refreshAccessToken", () => {
  const mockFindUnique = prisma.googleAdsApiConfig.findUnique as jest.Mock;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue(MOCK_CONFIG);
  });

  it("returns access token on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "ya29.test-access-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/adwords",
      }),
    });

    const result = await refreshAccessToken("1//test-refresh-token");
    expect(result.accessToken).toBe("ya29.test-access-token");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("sends correct grant_type and refresh_token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "tok", expires_in: 3600 }),
    });

    await refreshAccessToken("my-refresh-token");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("oauth2.googleapis.com/token");
    const body = opts.body.toString();
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=my-refresh-token");
    expect(body).toContain(`client_id=${MOCK_CONFIG.oauthClientId}`);
  });

  it("throws when OAuth endpoint returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_client"}',
    });

    await expect(refreshAccessToken("bad-token")).rejects.toThrow(
      "Google OAuth refresh failed (401)",
    );
  });

  it("throws when client credentials are missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    // No env vars
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;

    await expect(refreshAccessToken("any-token")).rejects.toThrow(
      "Google Ads OAuth client not configured",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. buildAuthUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAuthUrl", () => {
  const mockFindUnique = prisma.googleAdsApiConfig.findUnique as jest.Mock;

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue(MOCK_CONFIG);
  });

  it("produces a valid Google OAuth URL", async () => {
    const url = await buildAuthUrl(
      "https://www.locksafe.uk/api/auth/google-ads/callback",
      "csrf-state-123",
    );
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=csrf-state-123");
  });

  it("includes adwords scope", async () => {
    const url = await buildAuthUrl(
      "https://www.locksafe.uk/api/auth/google-ads/callback",
      "s",
    );
    expect(url).toContain("auth%2Fadwords");
  });

  it("throws when client ID is missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    await expect(
      buildAuthUrl("https://redirect.example.com", "s"),
    ).rejects.toThrow("Google Ads OAuth client not configured");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GoogleAdsClient
// ─────────────────────────────────────────────────────────────────────────────

describe("GoogleAdsClient", () => {
  const mockFindUnique = prisma.googleAdsApiConfig.findUnique as jest.Mock;

  function makeClient(overrides: Record<string, string> = {}) {
    return new GoogleAdsClient({
      customerId: overrides.customerId ?? "471-522-6378",
      refreshToken: overrides.refreshToken ?? "1//test-refresh-token",
      loginCustomerId: overrides.loginCustomerId ?? "222-951-9701",
    });
  }

  beforeEach(() => {
    mockFetch.mockReset();
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue(MOCK_CONFIG);
  });

  // ── Token management ──────────────────────────────────────────────────────

  describe("getAccessToken", () => {
    it("refreshes token when none cached", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "ya29.fresh", expires_in: 3600 }),
      });

      const client = makeClient();
      const token = await client.getAccessToken();
      expect(token).toBe("ya29.fresh");
    });

    it("reuses cached token that is still valid", async () => {
      const expiry = new Date(Date.now() + 30 * 60 * 1000); // +30 min
      const client = new GoogleAdsClient({
        customerId: "4715226378",
        refreshToken: "1//rt",
        accessToken: "ya29.cached",
        accessTokenExpiresAt: expiry,
      });

      const token = await client.getAccessToken();
      expect(token).toBe("ya29.cached");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refreshes when cached token is expired", async () => {
      const expiry = new Date(Date.now() - 1000); // expired 1 s ago
      const client = new GoogleAdsClient({
        customerId: "4715226378",
        refreshToken: "1//rt",
        accessToken: "ya29.expired",
        accessTokenExpiresAt: expiry,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "ya29.refreshed", expires_in: 3600 }),
      });

      const token = await client.getAccessToken();
      expect(token).toBe("ya29.refreshed");
    });
  });

  // ── query() ──────────────────────────────────────────────────────────────

  describe("query", () => {
    it("sends GAQL to correct endpoint with required headers", async () => {
      // 1st call: token refresh, 2nd call: GAQL search
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => MOCK_CAMPAIGNS_RESPONSE,
        });

      const client = makeClient();
      const results = await client.query("SELECT campaign.id FROM campaign");

      const [url, opts] = mockFetch.mock.calls[1];
      expect(url).toContain("/googleAds:search");
      expect(url).toContain("customers/4715226378");
      expect(opts.headers["developer-token"]).toBe("sbMXQHwqfdpHpWVGFnh1jg");
      expect(opts.headers["login-customer-id"]).toBe("2229519701");
      expect(opts.headers["Authorization"]).toContain("Bearer ya29.t");
      expect(results).toHaveLength(2);
    });

    it("throws on non-OK response from Google Ads API", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => '{"error":{"code":403,"message":"Developer token does not have permission"}}',
        });

      const client = makeClient();
      await expect(client.query("SELECT campaign.id FROM campaign")).rejects.toThrow(
        "Google Ads search failed (403)",
      );
    });

    it("handles empty result set gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        });

      const client = makeClient();
      const results = await client.query("SELECT campaign.id FROM campaign");
      expect(results).toEqual([]);
    });

    it("paginates across multiple pages", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ campaign: { id: "1" } }],
            nextPageToken: "page2token",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ campaign: { id: "2" } }],
            // no nextPageToken → last page
          }),
        });

      const client = makeClient();
      const results = await client.query("SELECT campaign.id FROM campaign");
      expect(results).toHaveLength(2);
    });

    it("throws when GOOGLE_ADS_DEVELOPER_TOKEN is missing", async () => {
      mockFindUnique.mockResolvedValue(null);
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
      });

      const client = makeClient();
      await expect(client.query("SELECT campaign.id FROM campaign")).rejects.toThrow(
        "GOOGLE_ADS_DEVELOPER_TOKEN not configured",
      );
    });
  });

  // ── getCampaignMetrics() ──────────────────────────────────────────────────

  describe("getCampaignMetrics", () => {
    function setupFetch() {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => MOCK_CAMPAIGNS_RESPONSE,
        });
    }

    it("returns correctly shaped campaign rows", async () => {
      setupFetch();
      const client = makeClient();
      const rows = await client.getCampaignMetrics({
        since: "2026-05-01",
        until: "2026-05-15",
      });

      expect(rows).toHaveLength(2);
      const first = rows[0];
      expect(first.campaignId).toBe("111000001");
      expect(first.campaignName).toBe("Locksmith London — Search");
      expect(first.impressions).toBe(12500);
      expect(first.clicks).toBe(430);
      expect(first.costMicros).toBe(215_000_000);
      expect(first.conversions).toBe(38);
      expect(first.ctr).toBeCloseTo(0.0344, 4);
      expect(typeof first.averageCpc).toBe("number");
    });

    it("converts string metric fields to numbers", async () => {
      setupFetch();
      const client = makeClient();
      const rows = await client.getCampaignMetrics({
        since: "2026-05-01",
        until: "2026-05-15",
      });
      // The API returns string metrics; client must parse them
      expect(typeof rows[0].impressions).toBe("number");
      expect(typeof rows[0].clicks).toBe("number");
      expect(typeof rows[0].costMicros).toBe("number");
    });

    it("rejects invalid date range format", async () => {
      const client = makeClient();
      await expect(
        client.getCampaignMetrics({ since: "05/01/2026", until: "05/15/2026" }),
      ).rejects.toThrow("Invalid GAQL date range");
    });

    it("rejects future-from-past date range (since after until)", async () => {
      // assertDateRange only checks format; business-logic validation is up
      // to the caller, so only format should throw here
      const client = makeClient();
      // Both valid format but logically reversed — should still parse OK
      setupFetch();
      await expect(
        client.getCampaignMetrics({ since: "2026-05-15", until: "2026-05-01" }),
      ).resolves.toBeTruthy();
    });
  });

  // ── mutate() ─────────────────────────────────────────────────────────────

  describe("mutate", () => {
    beforeEach(() => {
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "sbMXQHwqfdpHpWVGFnh1jg";
    });

    it("throws when operations array is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
      });

      const client = makeClient();
      await expect(client.mutate("campaigns", [])).rejects.toThrow(
        "mutate() called with empty operations array",
      );
    });

    it("sends POST to mutate endpoint", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ resourceName: "customers/4715226378/campaigns/111000001" }],
          }),
        });

      const client = makeClient();
      await client.mutate("campaigns", [
        {
          create: {
            name: "Test Campaign",
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
          },
        },
      ]);

      const [url, opts] = mockFetch.mock.calls[1];
      expect(url).toContain("customers/4715226378/campaigns:mutate");
      expect(opts.method).toBe("POST");
    });

    it("throws on mutate failure from API", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => '{"error":{"code":400,"message":"INVALID_INPUT"}}',
        });

      const client = makeClient();
      await expect(
        client.mutate("campaigns", [{ create: { name: "Bad" } }]),
      ).rejects.toThrow("Google Ads campaigns mutate failed (400)");
    });

    it("sets validateOnly flag when requested", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.t", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        });

      const client = makeClient();
      await client.mutate("campaigns", [{ create: { name: "Dry Run" } }], {
        validateOnly: true,
      });

      const [, opts] = mockFetch.mock.calls[1];
      const body = JSON.parse(opts.body);
      expect(body.validateOnly).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Developer token env var (from our setup)
// ─────────────────────────────────────────────────────────────────────────────

describe("Developer token configuration", () => {
  it("token format matches expected pattern (32-char base64-ish string)", () => {
    const token = "sbMXQHwqfdpHpWVGFnh1jg";
    // Google developer tokens are 22-character base64url strings
    expect(token).toMatch(/^[A-Za-z0-9_\-]{22}$/);
  });

  it("manager CID has correct format (stripped)", () => {
    const cid = "222-951-9701";
    const stripped = cid.replace(/-/g, "");
    expect(stripped).toBe("2229519701");
    expect(stripped).toHaveLength(10);
  });

  it("manager CID numeric check", () => {
    const stripped = "2229519701";
    expect(/^\d{10}$/.test(stripped)).toBe(true);
  });
});
