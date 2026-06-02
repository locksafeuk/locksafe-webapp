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
import { captureAndStoreSnapshot } from "./google-ads-snapshot";
import { assertLandingPageReady } from "./google-ads-landing-preflight";
import { assertAdCopyClean } from "./google-ads-copy-guard";

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

interface AdGroupDraft {
  name: string;
  keywords: Array<{ text: string; matchType: string }>;
  headlines: string[];
  descriptions: string[];
}

interface AssetDraft {
  type: "CALLOUT" | "SITELINK" | "CALL" | "STRUCTURED_SNIPPET" | "PRICE";
  // CALLOUT
  text?: string;
  // SITELINK
  linkText?: string;
  finalUrl?: string;
  description1?: string;
  description2?: string;
  // CALL
  phoneNumber?: string;
  countryCode?: string;
  // STRUCTURED_SNIPPET
  header?: string;
  values?: string[];
  // PRICE
  priceQualifier?: string;
  items?: Array<{ header: string; description: string; finalUrl: string; price: { amountMicros: string; currencyCode: string } }>;
}

interface DeviceBidAdjustments {
  mobile?: number;   // percentage modifier e.g. 25 = +25%
  tablet?: number;
  desktop?: number;
}

interface AdScheduleAdjustment {
  dayOfWeek: string;  // "MONDAY" | "TUESDAY" | ...
  hourStart: number;  // 0-23
  hourEnd: number;    // 0-23
  bidModifier: number; // percentage e.g. 20 = +20%
}

interface DraftLike {
  id: string;
  accountId: string;
  name: string;
  dailyBudget: number;
  biddingStrategy: string;
  targetCpa: number | null;
  targetRoas?: number | null;
  channel: string;
  geoTargets: string[];
  geoExclusions?: string[];
  locationMatchType?: string;
  languageTargets: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  keywords: unknown; // JSON; runtime-validated
  negativeKeywords: string[];
  adGroups?: unknown; // JSON; AdGroupDraft[]
  assets?: unknown;   // JSON; AssetDraft[]
  deviceBidAdjustments?: unknown;  // JSON; DeviceBidAdjustments
  adScheduleAdjustments?: unknown; // JSON; AdScheduleAdjustment[]
  startDate?: Date | null;
  endDate?: Date | null;
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

/**
 * Parses a Google Ads API error and returns the exemptible policy violation keys
 * (policyName + violatingText) if ALL errors in the response are exemptible policy
 * violations. Returns null if there are non-exemptible errors or the error cannot
 * be parsed.
 */
function extractExemptiblePolicyViolationKeys(
  err: unknown,
): Array<{ policyName: string; violatingText: string }> | null {
  const msg = err instanceof Error ? err.message : String(err);
  const jsonMatch = msg.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const body = JSON.parse(jsonMatch[0]) as {
      error?: {
        details?: Array<{
          errors?: Array<{
            errorCode?: { policyViolationError?: string };
            details?: {
              policyViolationDetails?: {
                key?: { policyName?: string; violatingText?: string };
                isExemptible?: boolean;
              };
            };
          }>;
        }>;
      };
    };
    const errors = body?.error?.details?.[0]?.errors ?? [];
    if (errors.length === 0) return null;
    const allExemptible = errors.every(
      (e) =>
        e.errorCode?.policyViolationError === "POLICY_ERROR" &&
        e.details?.policyViolationDetails?.isExemptible === true,
    );
    if (!allExemptible) return null;
    return errors
      .map((e) => ({
        policyName: e.details?.policyViolationDetails?.key?.policyName ?? "",
        violatingText: e.details?.policyViolationDetails?.key?.violatingText ?? "",
      }))
      .filter((k) => k.policyName && k.violatingText);
  } catch {
    return null;
  }
}

export async function publishGoogleAdsDraft(draftId: string): Promise<PublishResult> {
  const draft = (await prisma.googleAdsCampaignDraft.findUnique({
    where: { id: draftId },
  })) as DraftLike | null;
  if (!draft) throw new Error(`Draft ${draftId} not found`);

  // ── PRE-FLIGHT GATE ──────────────────────────────────────────────────────
  // Hard condition: the landing page must exist, be published, content-clean,
  // and return HTTP 200 BEFORE we hand the Final URL to Google. Otherwise the
  // campaign gets disapproved for a broken/policy-violating destination.
  // Runs before the PUBLISHING status flip so a not-ready page leaves the draft
  // untouched (still APPROVED) with a clear error.
  await assertLandingPageReady(draft.finalUrl);

  // Ad-copy compliance: never hand Google (or customers) a false "no call-out
  // fee" / "no fees" claim or an unprovable price superlative. Throws
  // AdCopyPreflightError (publish route → 422) before any Google mutation.
  assertAdCopyClean(draft.headlines ?? [], draft.descriptions ?? []);

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
        : draft.biddingStrategy === "TARGET_ROAS" && draft.targetRoas
          ? { targetRoas: { targetRoas: draft.targetRoas / 100 } }
          : { maximizeConversions: {} };

    // Location match type: PRESENCE_ONLY prevents serving to people searching
    // ABOUT a location from elsewhere. Critical for coverage-based campaigns.
    const locationMatchType = draft.locationMatchType ?? "PRESENCE_ONLY";
    const geoTargetTypeSetting = {
      positiveGeoTargetType: locationMatchType === "PRESENCE_ONLY"
        ? "PRESENCE_ONLY"
        : "PRESENCE_OR_INTEREST",
      negativeGeoTargetType: "PRESENCE",
    };

    const campaignRes = await client.mutate<{
      results?: { resourceName: string }[];
    }>("campaigns", [
      {
        create: {
          name: draft.name,
          status: "PAUSED",
          advertisingChannelType: draft.channel || "SEARCH",
          campaignBudget: budgetResource,
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          geoTargetTypeSetting,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
          ...(draft.startDate ? { startDate: formatGoogleDate(draft.startDate) } : {}),
          ...(draft.endDate ? { endDate: formatGoogleDate(draft.endDate) } : {}),
          ...biddingPayload,
        },
      },
    ]);
    const campaignResource = campaignRes.results?.[0]?.resourceName;
    if (!campaignResource) throw new Error("Campaign creation returned no resourceName");
    const googleCampaignId = extractId(campaignResource);

    // ----- 3. Campaign-level criteria: geo inclusions + exclusions + language + negatives -----
    const campaignCriteria: Record<string, unknown>[] = [];

    // Geo inclusions — only the areas we have locksmiths
    for (const geoId of draft.geoTargets || []) {
      if (!/^[0-9]+$/.test(geoId)) continue;
      campaignCriteria.push({
        create: {
          campaign: campaignResource,
          location: { geoTargetConstant: `geoTargetConstants/${geoId}` },
        },
      });
    }

    // Geo EXCLUSIONS — explicitly block areas with no locksmith coverage
    for (const geoId of draft.geoExclusions || []) {
      if (!/^[0-9]+$/.test(geoId)) continue;
      campaignCriteria.push({
        create: {
          campaign: campaignResource,
          negative: true,
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

    // ----- 3b. Device bid adjustments -----
    const deviceAdj = draft.deviceBidAdjustments as DeviceBidAdjustments | undefined;
    if (deviceAdj && Object.keys(deviceAdj).length > 0) {
      const DEVICE_MAP: Record<string, string> = {
        mobile: "MOBILE",
        tablet: "TABLET",
        desktop: "DESKTOP",
      };
      const bidModOps: Record<string, unknown>[] = [];
      for (const [key, pct] of Object.entries(deviceAdj)) {
        if (!pct || pct === 0) continue;
        const deviceType = DEVICE_MAP[key];
        if (!deviceType) continue;
        bidModOps.push({
          create: {
            campaign: campaignResource,
            device: { type: deviceType },
            bidModifier: 1 + (pct / 100),
          },
        });
      }
      if (bidModOps.length > 0) {
        await client.mutate("campaignBidModifiers", bidModOps).catch((e) => {
          console.warn("[publish] Device bid adjustments failed (non-fatal):", e);
        });
      }
    }

    // ----- 3c. Ad schedule bid adjustments -----
    const scheduleAdj = Array.isArray(draft.adScheduleAdjustments)
      ? (draft.adScheduleAdjustments as AdScheduleAdjustment[])
      : [];
    if (scheduleAdj.length > 0) {
      const schedOps = scheduleAdj.map((s) => ({
        create: {
          campaign: campaignResource,
          adSchedule: {
            dayOfWeek: s.dayOfWeek.toUpperCase(),
            startHour: s.hourStart,
            endHour: s.hourEnd,
            startMinute: "ZERO",
            endMinute: "ZERO",
          },
          bidModifier: 1 + (s.bidModifier / 100),
        },
      }));
      await client.mutate("campaignBidModifiers", schedOps).catch((e) => {
        console.warn("[publish] Ad schedule bid adjustments failed (non-fatal):", e);
      });
    }

    // ----- 3d. Ad assets (callouts, sitelinks, call extension, structured snippets) -----
    const assetDrafts = Array.isArray(draft.assets)
      ? (draft.assets as AssetDraft[])
      : [];
    if (assetDrafts.length > 0) {
      await publishAssets(client, campaignResource, cid, assetDrafts);
    }

    // ----- 4. Ad group(s) -----
    // If adGroups is set, create multiple themed groups. Otherwise one default group.
    const adGroupDrafts = Array.isArray(draft.adGroups)
      ? (draft.adGroups as AdGroupDraft[])
      : [];

    let googleAdGroupId: string;
    let googleAdId: string;

    if (adGroupDrafts.length > 0) {
      // Multi-group: create each group with its own keywords and RSA
      const firstGroupId = await publishAdGroups(
        client,
        campaignResource,
        adGroupDrafts,
        draft.finalUrl,
      );
      googleAdGroupId = firstGroupId.adGroupId;
      googleAdId = firstGroupId.adId;
    } else {
      // Single default group (legacy path)
      const adGroupRes = await client.mutate<{
        results?: { resourceName: string }[];
      }>("adGroups", [
        {
          create: {
            name: `${draft.name} — All Keywords`,
            status: "PAUSED",
            campaign: campaignResource,
            type: "SEARCH_STANDARD",
            cpcBidMicros: gbpToMicros(2),
          },
        },
      ]);
      const adGroupResource = adGroupRes.results?.[0]?.resourceName;
      if (!adGroupResource) throw new Error("Ad group creation returned no resourceName");
      googleAdGroupId = extractId(adGroupResource);

      // ----- 5. Positive keywords (single group path) -----
      const keywords = parseKeywords(draft.keywords);
      if (keywords.length > 0) {
        const keywordOps = keywords.map((k) => ({
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            keyword: { text: k.text, matchType: k.matchType },
          },
        }));
        try {
          await client.mutate("adGroupCriteria", keywordOps);
        } catch (kwErr) {
          const exemptions = extractExemptiblePolicyViolationKeys(kwErr);
          if (exemptions && exemptions.length > 0) {
            const exemptionMap = new Map(exemptions.map((e) => [e.violatingText, e.policyName]));
            const keywordOpsWithExemptions = keywords.map((k) => {
              const policyName = exemptionMap.get(k.text);
              const op: Record<string, unknown> = {
                create: {
                  adGroup: adGroupResource,
                  status: "ENABLED",
                  keyword: { text: k.text, matchType: k.matchType },
                },
              };
              if (policyName) {
                op.exemptPolicyViolationKeys = [{ policyName, violatingText: k.text }];
              }
              return op;
            });
            await client.mutate("adGroupCriteria", keywordOpsWithExemptions);
          } else {
            throw kwErr;
          }
        }
      }

      // ----- 6. RSA ad (single group path) -----
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
      googleAdId = extractId(adResource);
    } // end else (single group path)

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

    // ----- Best-effort: pull a full live snapshot for future automations.
    // Never throw — snapshot failure must not roll back a successful publish.
    await captureAndStoreSnapshot(draftId).catch((err) => {
      console.warn(
        `[google-ads-publish/${draftId}] snapshot capture failed:`,
        err instanceof Error ? err.message : String(err),
      );
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a Date as YYYYMMDD for Google Ads API. */
function formatGoogleDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Publish ad assets (callouts, sitelinks, call extension, structured snippets)
 * to a campaign. Assets are created first, then linked via campaignAssets.
 * Non-fatal — asset failures are warned but do not abort the publish.
 */
async function publishAssets(
  client: { mutate: <T>(resource: string, ops: Record<string, unknown>[]) => Promise<T>; customerIdPlain: string },
  campaignResource: string,
  _cid: string,
  assets: AssetDraft[],
): Promise<void> {
  for (const asset of assets) {
    try {
      let assetPayload: Record<string, unknown> = {};
      let fieldType = "";

      switch (asset.type) {
        case "CALLOUT":
          if (!asset.text) continue;
          assetPayload = { calloutAsset: { calloutText: asset.text } };
          fieldType = "CALLOUT";
          break;
        case "SITELINK":
          if (!asset.linkText || !asset.finalUrl) continue;
          assetPayload = {
            sitelinkAsset: {
              linkText: asset.linkText,
              finalUrls: [asset.finalUrl],
              ...(asset.description1 ? { description1: asset.description1 } : {}),
              ...(asset.description2 ? { description2: asset.description2 } : {}),
            },
          };
          fieldType = "SITELINK";
          break;
        case "CALL":
          if (!asset.phoneNumber) continue;
          assetPayload = {
            callAsset: {
              phoneNumber: asset.phoneNumber,
              countryCode: asset.countryCode ?? "GB",
              callConversionReportingState: "USE_ACCOUNT_LEVEL_CALL_CONVERSION_ACTION",
            },
          };
          fieldType = "CALL";
          break;
        case "STRUCTURED_SNIPPET":
          if (!asset.header || !asset.values?.length) continue;
          assetPayload = {
            structuredSnippetAsset: {
              header: asset.header,
              values: asset.values,
            },
          };
          fieldType = "STRUCTURED_SNIPPET";
          break;
        default:
          continue;
      }

      // Create the asset resource
      const assetRes = await client.mutate<{ results?: { resourceName: string }[] }>(
        "assets",
        [{ create: assetPayload }],
      );
      const assetResource = assetRes.results?.[0]?.resourceName;
      if (!assetResource) continue;

      // Link to campaign
      await client.mutate("campaignAssets", [
        {
          create: {
            campaign: campaignResource,
            asset: assetResource,
            fieldType,
            status: "ENABLED",
          },
        },
      ]);
    } catch (err) {
      console.warn(`[publish] Asset type ${asset.type} failed (non-fatal):`, err);
    }
  }
}

/**
 * Create multiple themed ad groups for a campaign.
 * Returns the first group's IDs for backwards compatibility with the draft record.
 */
async function publishAdGroups(
  client: { mutate: <T>(resource: string, ops: Record<string, unknown>[]) => Promise<T>; customerIdPlain: string },
  campaignResource: string,
  adGroups: AdGroupDraft[],
  campaignFinalUrl: string,
): Promise<{ adGroupId: string; adId: string }> {
  let firstAdGroupId = "";
  let firstAdId = "";

  for (const group of adGroups) {
    // Create ad group
    const agRes = await client.mutate<{ results?: { resourceName: string }[] }>(
      "adGroups",
      [{
        create: {
          name: group.name,
          status: "PAUSED",
          campaign: campaignResource,
          type: "SEARCH_STANDARD",
          cpcBidMicros: gbpToMicros(2),
        },
      }],
    );
    const agResource = agRes.results?.[0]?.resourceName;
    if (!agResource) continue;
    const agId = extractId(agResource);
    if (!firstAdGroupId) firstAdGroupId = agId;

    // Add keywords for this group
    if (group.keywords?.length) {
      const kwOps = group.keywords.map((k) => ({
        create: {
          adGroup: agResource,
          status: "ENABLED",
          keyword: { text: k.text.toLowerCase().trim(), matchType: k.matchType },
        },
      }));
      await client.mutate("adGroupCriteria", kwOps).catch((e) =>
        console.warn(`[publish] Keywords for group "${group.name}" failed:`, e),
      );
    }

    // Create RSA for this group
    const headlines = group.headlines?.length ? group.headlines : [];
    const descriptions = group.descriptions?.length ? group.descriptions : [];
    if (headlines.length >= 3 && descriptions.length >= 2) {
      const adRes = await client.mutate<{ results?: { resourceName: string }[] }>(
        "adGroupAds",
        [{
          create: {
            adGroup: agResource,
            status: "PAUSED",
            ad: {
              finalUrls: [campaignFinalUrl],
              responsiveSearchAd: {
                headlines: headlines.map((text) => ({ text })),
                descriptions: descriptions.map((text) => ({ text })),
              },
            },
          },
        }],
      );
      const adResource = adRes.results?.[0]?.resourceName;
      if (adResource && !firstAdId) firstAdId = extractId(adResource);
    }
  }

  return { adGroupId: firstAdGroupId, adId: firstAdId };
}
