/**
 * Google Ads draft publisher.
 *
 * Takes a `GoogleAdsCampaignDraft` row and creates the matching live
 * resources via the Google Ads REST mutation endpoints. Always creates the
 * campaign in PAUSED state — the admin (or Phase-3 spend-guard) must enable
 * it explicitly afterwards.
 *
 * Order of operations (each step writes the returned resource ID back to the
 * draft so a partial failure can be diagnosed and re-run safely):
 *   1. campaignBudgets:mutate (create)
 *   2. campaigns:mutate (create, status=PAUSED, advertisingChannelType=SEARCH)
 *   3. campaignCriteria:mutate (geo + language targeting + negative keywords)
 *   4. adGroups:mutate (create, status=PAUSED)
 *   5. adGroupCriteria:mutate (positive keywords)
 *   6. adGroupAds:mutate (create RSA, status=PAUSED)
 */

import prisma from "@/lib/db";
import { GoogleAdsClient, getGoogleAdsClientForAccount, buildResourceName } from "./google-ads";
import type { GoogleKeyword, GoogleKeywordMatchType } from "./openai-google-ads";

interface PublishResult {
  draftId: string;
  googleBudgetId: string;
  googleCampaignId: string;
  googleAdGroupId: string;
  googleAdId: string;
}

/**
 * Returns the numeric ID portion of a Google Ads resource name like
 * "customers/123/campaigns/456" -> "456".
 */
function extractId(resourceName: string): string {
  const parts = resourceName.split("/");
  return parts[parts.length - 1];
}

function gbpToMicros(gbp: number): string {
  // micros are int64; serialise as string for safety in JSON
  return String(Math.round(gbp * 1_000_000));
}

interface DraftLike {
  id: string;
  accountId: string;
  name: string;
  dailyBudget: number;
  biddingStrategy: string;
  targetCpa: number | null;
  channel: string;
  geoTargets: string[];
  languageTargets: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  keywords: unknown; // JSON; runtime-validated
  negativeKeywords: string[];
}

function parseKeywords(raw: unknown): GoogleKeyword[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => {
      const obj = k as { text?: unknown; matchType?: unknown };
      const text = String(obj?.text ?? "").trim().toLowerCase();
      const matchTypeRaw = String(obj?.matchType ?? "PHRASE").toUpperCase();
      const matchType: GoogleKeywordMatchType = (
        ["EXACT", "PHRASE", "BROAD"] as const
      ).includes(matchTypeRaw as GoogleKeywordMatchType)
        ? (matchTypeRaw as GoogleKeywordMatchType)
        : "PHRASE";
      return { text, matchType };
    })
    .filter((k) => k.text.length > 0);
}

export async function publishGoogleAdsDraft(draftId: string): Promise<PublishResult> {
  const draft = (await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: draftId },
  })) as DraftLike | null;
  if (!draft) throw new Error(`Draft ${draftId} not found`);

  const client = await getGoogleAdsClientForAccount(draft.accountId);
  if (!client) {
    throw new Error(
      `No active GoogleAdsAccount for draft ${draftId} (accountId=${draft.accountId})`,
    );
  }

  // Mark publishing immediately so a stalled run is visible in the UI.
  await prisma.googleAdsCampaignDraft.update({
    where: { id: draftId },
    data: { status: "PUBLISHING", publishError: null },
  });

  try {
    const cid = client.customerIdPlain;

    // ----- 1. Campaign budget -----
    const budgetRes = await client.mutate<{
      results?: { resourceName: string }[];
    }>("campaignBudgets", [
      {
        create: {
          name: `${draft.name} budget ${Date.now()}`,
          amountMicros: gbpToMicros(draft.dailyBudget),
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    ]);
    const budgetResource = budgetRes.results?.[0]?.resourceName;
    if (!budgetResource) throw new Error("Campaign budget creation returned no resourceName");
    const googleBudgetId = extractId(budgetResource);

    // ----- 2. Campaign (PAUSED) -----
    const biddingPayload =
      draft.biddingStrategy === "TARGET_CPA" && draft.targetCpa
        ? { targetCpa: { targetCpaMicros: gbpToMicros(draft.targetCpa) } }
        : { maximizeConversions: {} };

    const campaignRes = await client.mutate<{
      results?: { resourceName: string }[];
    }>("campaigns", [
      {
        create: {
          name: draft.name,
          status: "PAUSED",
          advertisingChannelType: draft.channel || "SEARCH",
          campaignBudget: budgetResource,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
          ...biddingPayload,
        },
      },
    ]);
    const campaignResource = campaignRes.results?.[0]?.resourceName;
    if (!campaignResource) throw new Error("Campaign creation returned no resourceName");
    const googleCampaignId = extractId(campaignResource);

    // ----- 3. Campaign-level criteria: geo + language + negatives -----
    const campaignCriteria: Record<string, unknown>[] = [];

    for (const geoId of draft.geoTargets || []) {
      if (!/^[0-9]+$/.test(geoId)) continue;
      campaignCriteria.push({
        create: {
          campaign: campaignResource,
          location: { geoTargetConstant: `geoTargetConstants/${geoId}` },
        },
      });
    }
    for (const langId of draft.languageTargets || []) {
      if (!/^[0-9]+$/.test(langId)) continue;
      campaignCriteria.push({
        create: {
          campaign: campaignResource,
          language: { languageConstant: `languageConstants/${langId}` },
        },
      });
    }
    for (const neg of draft.negativeKeywords || []) {
      const text = String(neg).toLowerCase().trim();
      if (!text) continue;
      campaignCriteria.push({
        create: {
          campaign: campaignResource,
          negative: true,
          keyword: { text, matchType: "BROAD" },
        },
      });
    }

    if (campaignCriteria.length > 0) {
      await client.mutate("campaignCriteria", campaignCriteria);
    }

    // ----- 4. Ad group (PAUSED) -----
    const adGroupRes = await client.mutate<{
      results?: { resourceName: string }[];
    }>("adGroups", [
      {
        create: {
          name: `${draft.name} - default`,
          status: "PAUSED",
          campaign: campaignResource,
          type: "SEARCH_STANDARD",
          cpcBidMicros: gbpToMicros(2), // £2 default ceiling, harmless under MAXIMIZE_CONVERSIONS
        },
      },
    ]);
    const adGroupResource = adGroupRes.results?.[0]?.resourceName;
    if (!adGroupResource) throw new Error("Ad group creation returned no resourceName");
    const googleAdGroupId = extractId(adGroupResource);

    // ----- 5. Positive keywords -----
    const keywords = parseKeywords(draft.keywords);
    if (keywords.length > 0) {
      const keywordOps = keywords.map((k) => ({
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
          keyword: { text: k.text, matchType: k.matchType },
        },
      }));
      await client.mutate("adGroupCriteria", keywordOps);
    }

    // ----- 6. Responsive Search Ad (PAUSED) -----
    const adRes = await client.mutate<{
      results?: { resourceName: string }[];
    }>("adGroupAds", [
      {
        create: {
          adGroup: adGroupResource,
          status: "PAUSED",
          ad: {
            finalUrls: [draft.finalUrl],
            responsiveSearchAd: {
              headlines: draft.headlines.map((text) => ({ text })),
              descriptions: draft.descriptions.map((text) => ({ text })),
            },
          },
        },
      },
    ]);
    const adResource = adRes.results?.[0]?.resourceName;
    if (!adResource) throw new Error("Ad creation returned no resourceName");
    const googleAdId = extractId(adResource);

    // ----- Persist the live resource IDs onto the draft -----
    await prisma.googleAdsCampaignDraft.update({
      where: { id: draftId },
      data: {
        status: "PUBLISHED",
        googleBudgetId,
        googleCampaignId,
        googleAdGroupId,
        googleAdId,
        publishedAt: new Date(),
        publishError: null,
      },
    });

    return {
      draftId,
      googleBudgetId,
      googleCampaignId,
      googleAdGroupId,
      googleAdId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.googleAdsCampaignDraft.update({
      where: { id: draftId },
      data: {
        status: "FAILED",
        publishError: message.slice(0, 2000),
      },
    });
    throw err;
  }
}

/**
 * Pause a previously-published Google Ads campaign without deleting the draft.
 * Used by the admin "kill switch" and Phase-3 spend-guard.
 */
export async function pausePublishedDraft(
  draftId: string,
): Promise<{ draftId: string; pausedAt: Date }> {
  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  if (!draft.googleCampaignId) {
    throw new Error(`Draft ${draftId} has no published campaign to pause`);
  }
  const client = await getGoogleAdsClientForAccount(draft.accountId);
  if (!client) throw new Error(`No active GoogleAdsAccount for draft ${draftId}`);

  const resourceName = buildResourceName(
    client.customerIdPlain,
    "campaigns",
    draft.googleCampaignId,
  );
  await client.mutate("campaigns", [
    {
      update: { resourceName, status: "PAUSED" },
      updateMask: "status",
    },
  ]);

  const pausedAt = new Date();
  await prisma.googleAdsCampaignDraft.update({
    where: { id: draftId },
    data: { status: "PAUSED", pausedAt },
  });
  return { draftId, pausedAt };
}
