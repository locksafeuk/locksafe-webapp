/**
 * Unit tests for src/lib/google-ads-learnings.ts
 */

import { extractLearningsForClient } from "@/lib/google-ads-learnings";
import type { GoogleAdsClient } from "@/lib/google-ads";

describe("extractLearningsForClient", () => {
  it("computes keyword CTR as clicks/impressions after aggregation", async () => {
    const client = {
      customerIdPlain: "1234567890",
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM keyword_view")) {
          return [
            {
              adGroupCriterion: { keyword: { text: "emergency locksmith", matchType: "PHRASE" } },
              metrics: { clicks: 4, conversions: 1, costMicros: 4_000_000, impressions: 40 },
            },
            {
              adGroupCriterion: { keyword: { text: "emergency locksmith", matchType: "PHRASE" } },
              metrics: { clicks: 6, conversions: 2, costMicros: 6_000_000, impressions: 60 },
            },
          ];
        }
        if (sql.includes("FROM search_term_view")) return [];
        if (sql.includes("FROM ad_group_ad")) return [];
        if (sql.includes("FROM geographic_view")) return [];
        return [];
      }),
    } as unknown as GoogleAdsClient;

    const learnings = await extractLearningsForClient(client, { minClicks: 1, topN: 10 });

    expect(learnings.topConvertingKeywords).toHaveLength(1);
    expect(learnings.topConvertingKeywords[0].text).toBe("emergency locksmith");
    expect(learnings.topConvertingKeywords[0].clicks).toBe(10);
    expect(learnings.topConvertingKeywords[0].ctr).toBeCloseTo(0.1, 8);
  });

  it("sets CTR to 0 when impressions are missing/zero", async () => {
    const client = {
      customerIdPlain: "1234567890",
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM keyword_view")) {
          return [
            {
              adGroupCriterion: { keyword: { text: "lock change", matchType: "EXACT" } },
              metrics: { clicks: 5, conversions: 1, costMicros: 5_000_000, impressions: 0 },
            },
          ];
        }
        if (sql.includes("FROM search_term_view")) return [];
        if (sql.includes("FROM ad_group_ad")) return [];
        if (sql.includes("FROM geographic_view")) return [];
        return [];
      }),
    } as unknown as GoogleAdsClient;

    const learnings = await extractLearningsForClient(client, { minClicks: 1, topN: 10 });

    expect(learnings.topConvertingKeywords).toHaveLength(1);
    expect(learnings.topConvertingKeywords[0].ctr).toBe(0);
  });
});
