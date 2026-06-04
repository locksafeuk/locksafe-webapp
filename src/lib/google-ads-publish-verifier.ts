/**
 * Post-publish structural verification for Google Ads campaigns.
 *
 * Why this exists
 * ───────────────
 * On 2026-06-02, four campaigns were published via `publishGoogleAdsDraft`.
 * The publish API returned success, the draft model showed
 * status=PUBLISHED, the `live-status` endpoint reported SERVING / ENABLED,
 * and the optimisation score was 99.9%. Despite all of that, 3 of 5
 * themed ad groups in each campaign had ZERO keywords and one had ZERO
 * ads. The campaigns ran for 48 hours producing no impressions before a
 * manual deep-inspection discovered the gap.
 *
 * Root cause: Google's Local Services Ads policy silently dropped
 * "locksmith" keywords on submit. The webapp generator had no awareness
 * of this and persisted empty ad-group keyword arrays. Status-level
 * signals (SERVING, ENABLED, optimisation score) reflect campaign
 * metadata validity, not ad-group-level structural integrity.
 *
 * Strategy
 * ────────
 * Query Google directly via GAQL for the ground truth. For each ad group
 * in the campaign, count:
 *   - keywords (ad_group_criterion of type KEYWORD, status != REMOVED)
 *   - ads (ad_group_ad, status != REMOVED)
 *
 * Compare against the playbook minimums (MIN_KEYWORDS_PER_AD_GROUP = 10,
 * MIN_ADS_PER_AD_GROUP = 1). If any ad group is below the floor, the
 * campaign is structurally broken regardless of what its Eligible /
 * SERVING status says. We auto-pause the campaign + Telegram alert.
 *
 * Trust model
 * ───────────
 * Don't trust:
 *   - the draft model's cached state (could be stale)
 *   - the publish API response (returns success on metadata-valid bodies
 *     even when ad groups are empty)
 *   - the optimisation score (the 2026-06-02 campaigns scored 99.9%)
 *
 * Do trust:
 *   - direct GAQL counts of ad_group_criterion and ad_group_ad rows
 *
 * See google-ads-campaign-playbook.md §12.
 */

import prisma from "@/lib/db";
import {
  getGoogleAdsClientForAccount,
  buildResourceName,
  type GoogleAdsClient,
} from "@/lib/google-ads";
import { sendAdminAlert } from "@/lib/telegram";
import { PLAYBOOK_GUARDRAILS } from "@/lib/google-ads-draft-enforcement";

const MIN_KW_PER_AD_GROUP = PLAYBOOK_GUARDRAILS.MIN_KEYWORDS_PER_AD_GROUP;
const MIN_ADS_PER_AD_GROUP = PLAYBOOK_GUARDRAILS.MIN_ADS_PER_AD_GROUP;

// ─── Result types ─────────────────────────────────────────────────────────

export type VerificationStatus =
  | "ok"                  // all ad groups meet structural floors
  | "structural_failure"  // at least one ad group below floor
  | "google_pending"      // Google hasn't finished review yet (retry later)
  | "api_error";          // GAQL query failed or campaign not found

export interface AdGroupVerificationDetail {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  keywordCount: number;
  adCount: number;
  issues: string[];
}

export interface VerificationResult {
  status: VerificationStatus;
  campaignResourceName: string;
  campaignName: string;
  campaignStatus: string;
  adGroups: AdGroupVerificationDetail[];
  /** Top-level human-readable issue summaries for alerts. */
  issues: string[];
  verifiedAt: Date;
  error?: string;
}

// ─── Internal GAQL row shapes ─────────────────────────────────────────────
// google-ads-api converts API field names to camelCase in JS responses
// (e.g. `resource_name` → `resourceName`).

interface CampaignRow {
  campaign: {
    id: string;
    name: string;
    status: string;
    resourceName: string;
  };
}

interface AdGroupRow {
  adGroup: {
    id: string;
    name: string;
    status: string;
    resourceName: string;
  };
}

interface AdGroupCriterionRow {
  adGroupCriterion: {
    criterionId: string;
    status: string;
    type?: string;
  };
}

interface AdGroupAdRow {
  adGroupAd: {
    status: string;
    ad: { id: string };
  };
}

// ─── Read-only verifier ───────────────────────────────────────────────────

/**
 * Query Google directly for the campaign's structural integrity. Returns
 * a structured verification result. Does NOT take any action.
 *
 * @param accountId  The internal GoogleAdsAccount.id (used to load credentials)
 * @param googleCampaignId  The numeric Google Ads campaign ID
 */
export async function verifyPublishedCampaign(
  accountId: string,
  googleCampaignId: string,
): Promise<VerificationResult> {
  const verifiedAt = new Date();
  const empty: VerificationResult = {
    status: "api_error",
    campaignResourceName: "",
    campaignName: "",
    campaignStatus: "",
    adGroups: [],
    issues: [],
    verifiedAt,
  };

  const client = await getGoogleAdsClientForAccount(accountId);
  if (!client) {
    return {
      ...empty,
      issues: ["no Google Ads client available for account " + accountId],
      error: "no_google_ads_client",
    };
  }

  try {
    // 1. Campaign metadata
    const campaignRows = await client.query<CampaignRow>(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.resource_name
      FROM campaign
      WHERE campaign.id = ${asInt(googleCampaignId)}
      LIMIT 1
    `);
    if (!campaignRows || campaignRows.length === 0) {
      return {
        ...empty,
        issues: [`campaign ${googleCampaignId} not found in Google Ads`],
        error: "campaign_not_found",
      };
    }
    const campaign = campaignRows[0].campaign;

    // 2. Ad groups (non-removed)
    const adGroupRows = await client.query<AdGroupRow>(`
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.resource_name
      FROM ad_group
      WHERE campaign.id = ${asInt(googleCampaignId)}
        AND ad_group.status != 'REMOVED'
    `);

    if (!adGroupRows || adGroupRows.length === 0) {
      // Campaign exists but has zero ad groups at all — structural failure.
      return {
        status: "structural_failure",
        campaignResourceName: campaign.resourceName,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        adGroups: [],
        issues: ["campaign has zero ad groups"],
        verifiedAt,
      };
    }

    // 3. Per-ad-group: count keywords + ads
    const detailedAdGroups: AdGroupVerificationDetail[] = [];
    const topIssues: string[] = [];

    for (const row of adGroupRows) {
      const ag = row.adGroup;
      const issues: string[] = [];

      // Keywords
      const kwRows = await client.query<AdGroupCriterionRow>(`
        SELECT
          ad_group_criterion.criterion_id,
          ad_group_criterion.status,
          ad_group_criterion.type
        FROM ad_group_criterion
        WHERE ad_group.id = ${asInt(ag.id)}
          AND ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
      `);
      const keywordCount = kwRows?.length ?? 0;
      if (keywordCount < MIN_KW_PER_AD_GROUP) {
        issues.push(
          `${keywordCount} keywords (min ${MIN_KW_PER_AD_GROUP})`,
        );
        topIssues.push(
          `ad group "${ag.name}" has ${keywordCount} keywords (min ${MIN_KW_PER_AD_GROUP})`,
        );
      }

      // Ads
      const adRows = await client.query<AdGroupAdRow>(`
        SELECT
          ad_group_ad.status,
          ad_group_ad.ad.id
        FROM ad_group_ad
        WHERE ad_group.id = ${asInt(ag.id)}
          AND ad_group_ad.status != 'REMOVED'
      `);
      const adCount = adRows?.length ?? 0;
      if (adCount < MIN_ADS_PER_AD_GROUP) {
        issues.push(`${adCount} ads (min ${MIN_ADS_PER_AD_GROUP})`);
        topIssues.push(
          `ad group "${ag.name}" has ${adCount} ads (min ${MIN_ADS_PER_AD_GROUP})`,
        );
      }

      detailedAdGroups.push({
        resourceName: ag.resourceName,
        id: String(ag.id),
        name: ag.name ?? `ad group ${ag.id}`,
        status: ag.status ?? "UNKNOWN",
        keywordCount,
        adCount,
        issues,
      });
    }

    const status: VerificationStatus =
      topIssues.length > 0 ? "structural_failure" : "ok";

    return {
      status,
      campaignResourceName: campaign.resourceName,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      adGroups: detailedAdGroups,
      issues: topIssues,
      verifiedAt,
    };
  } catch (err) {
    return {
      ...empty,
      issues: [
        `verification query failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Read + write (auto-pause + Telegram alert) ──────────────────────────

/**
 * Verify a draft's published campaign and act on the result:
 *   - structural_failure → pause campaign + Telegram alert + persist
 *   - ok                 → persist success
 *   - api_error          → persist for retry on next cron run
 *
 * @param draftId  GoogleAdsCampaignDraft.id (must already be published)
 */
export async function verifyAndActOnDraft(
  draftId: string,
): Promise<VerificationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draft = await (prisma.googleAdsCampaignDraft as any).findUnique({
    where: { id: draftId },
    select: {
      id: true,
      name: true,
      accountId: true,
      googleCampaignId: true,
      status: true,
      verificationStatus: true,
    },
  });
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }
  if (!draft.googleCampaignId) {
    throw new Error(
      `Draft ${draftId} has no googleCampaignId — not published yet`,
    );
  }

  const result = await verifyPublishedCampaign(
    draft.accountId,
    draft.googleCampaignId,
  );

  // Persist verification result on the draft (cast Json field)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.googleAdsCampaignDraft as any).update({
    where: { id: draftId },
    data: {
      lastVerifiedAt: result.verifiedAt,
      verificationStatus: result.status,
      verificationDetails: serializeForJson(result),
    },
  });

  if (result.status === "structural_failure") {
    // 1. Auto-pause (best-effort — alert still fires if pause fails)
    let pauseError: string | null = null;
    try {
      await pauseGoogleCampaign(draft.accountId, draft.googleCampaignId);
      // Update draft status to PAUSED so it stops showing as PUBLISHED
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.googleAdsCampaignDraft as any).update({
        where: { id: draftId },
        data: { status: "PAUSED", pausedAt: new Date() },
      });
    } catch (err) {
      pauseError = err instanceof Error ? err.message : String(err);
      console.error(
        `[publish-verifier] auto-pause failed for draft ${draftId}:`,
        pauseError,
      );
    }

    // 2. Telegram alert
    const dedupeKey = `verify-fail:${draft.googleCampaignId}`;
    try {
      await sendAdminAlert({
        title: pauseError
          ? "🚨 Google Ads — verification failed (PAUSE ALSO FAILED)"
          : "🚨 Google Ads — campaign auto-paused after publish",
        message:
          `Campaign: "${draft.name}" (Google ID ${draft.googleCampaignId})\n\n` +
          `Structural issues:\n` +
          result.issues.map((i) => `• ${i}`).join("\n") +
          `\n\n` +
          (pauseError
            ? `Auto-pause failed: ${pauseError}\nMANUAL PAUSE REQUIRED.\n\n`
            : `Campaign auto-paused. `) +
          `Review: /admin/integrations/google-ads/drafts/${draftId}`,
        severity: "error",
        dedupeKey,
      });
    } catch (alertErr) {
      console.error(
        `[publish-verifier] Telegram alert failed for draft ${draftId}:`,
        alertErr,
      );
    }
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Pause a Google Ads campaign by ID. Mirrors the existing pause pattern
 * in `google-ads-publish.ts` so behaviour is consistent across the codebase.
 */
async function pauseGoogleCampaign(
  accountId: string,
  googleCampaignId: string,
): Promise<void> {
  const client = await getGoogleAdsClientForAccount(accountId);
  if (!client) {
    throw new Error(`no Google Ads client for account ${accountId}`);
  }
  const resourceName = buildResourceName(
    (client as GoogleAdsClient & { customerIdPlain: string }).customerIdPlain,
    "campaigns",
    googleCampaignId,
  );
  await client.mutate("campaigns", [
    {
      update: { resourceName, status: "PAUSED" },
      updateMask: "status",
    },
  ]);
}

/** Defensive integer cast for use inside GAQL string templates. */
function asInt(v: string | number): string {
  const n = Number(String(v).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid campaign/ad_group id: ${v}`);
  }
  return String(n);
}

/** Strip non-JSON values (functions, dates → ISO) for Prisma Json field. */
function serializeForJson(result: VerificationResult): object {
  return {
    ...result,
    verifiedAt: result.verifiedAt.toISOString(),
  };
}
