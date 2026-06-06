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
  | "ok"                  // no issues, no warnings — everything matches intent
  | "structural_failure"  // hard issue (empty ad group, banned settings) → auto-pause
  | "drift_warning"       // drift from publishedSnapshot — admin decision required, NO auto-pause
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

export interface CampaignNetworkSettings {
  targetGoogleSearch: boolean | null;
  targetSearchNetwork: boolean | null;        // false = no Search Partners
  targetContentNetwork: boolean | null;       // false = no Display
  targetPartnerSearchNetwork: boolean | null; // false = no YouTube partners
}

export interface CampaignGeoSettings {
  positiveGeoTargetType: string | null; // "PRESENCE" only
  negativeGeoTargetType: string | null; // "PRESENCE" only
  /** All location criteria currently live on the campaign (geo target IDs). */
  liveGeoTargets: string[];
}

export interface VerificationResult {
  status: VerificationStatus;
  campaignResourceName: string;
  campaignName: string;
  campaignStatus: string;
  adGroups: AdGroupVerificationDetail[];
  /** Live network settings — must match forensic-validation rules. */
  networkSettings: CampaignNetworkSettings;
  /** Live geo settings — includes the per-campaign live geo target list. */
  geoSettings: CampaignGeoSettings;
  /**
   * @deprecated Always null. The Google Ads field `url_expansion_opt_out`
   * was PERFORMANCE_MAX only and has been removed from current API. For
   * SEARCH campaigns we keep AI Max OFF (default) which is the equivalent
   * control. Kept on the type to avoid breaking persisted verification
   * records; new verifications always write null.
   */
  urlExpansionOptOut: null;
  /** HARD issues — empty ad groups, Search Partners on, banned settings.
   * These trigger structural_failure + auto-pause + critical Telegram alert. */
  issues: string[];
  /** SOFT warnings — drift from publishedSnapshot. These trigger drift_warning
   * + WARNING Telegram alert + admin decision required (revert vs accept).
   * Never auto-pause. The publishedSnapshot stays immutable until an admin
   * explicitly accepts the new live state as a new baseline. */
  warnings: string[];
  /** Structured drift details for the admin UI to drive revert/accept actions. */
  drift?: {
    geoTargetsAdded: string[];   // in live, not in publishedSnapshot
    geoTargetsRemoved: string[]; // in publishedSnapshot, not in live
  };
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
    networkSettings?: {
      targetGoogleSearch?: boolean | null;
      targetSearchNetwork?: boolean | null;
      targetContentNetwork?: boolean | null;
      targetPartnerSearchNetwork?: boolean | null;
    };
    geoTargetTypeSetting?: {
      positiveGeoTargetType?: string | null;
      negativeGeoTargetType?: string | null;
    };
  };
}

interface CampaignLocationCriterionRow {
  campaignCriterion: {
    criterionId: string;
    status: string;
    type?: string;
    location?: {
      geoTargetConstant?: string; // "geoTargetConstants/2826"
    };
    negative?: boolean;
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

export interface VerifyOptions {
  /**
   * The geo target IDs the draft was published with. When provided, the
   * verifier flags any live geo ID NOT in this set ("geo_drift_added") and
   * any draft ID missing from live ("geo_drift_removed"). This is the
   * per-campaign precision check from playbook §15.
   *
   * Source-of-truth selection (in order of preference):
   *   1. draft.publishedSnapshot.geoTargets  (immutable record at publish)
   *   2. draft.geoTargets                    (current draft state — may be stale)
   * `verifyAndActOnDraft` handles this selection automatically.
   */
  expectedGeoTargets?: string[];
}

/**
 * Query Google directly for the campaign's structural integrity. Returns
 * a structured verification result. Does NOT take any action.
 *
 * @param accountId  The internal GoogleAdsAccount.id (used to load credentials)
 * @param googleCampaignId  The numeric Google Ads campaign ID
 * @param opts  Optional expected geo targets for per-campaign drift detection
 */
export async function verifyPublishedCampaign(
  accountId: string,
  googleCampaignId: string,
  opts: VerifyOptions = {},
): Promise<VerificationResult> {
  const verifiedAt = new Date();
  const empty: VerificationResult = {
    status: "api_error",
    campaignResourceName: "",
    campaignName: "",
    campaignStatus: "",
    adGroups: [],
    networkSettings: {
      targetGoogleSearch: null,
      targetSearchNetwork: null,
      targetContentNetwork: null,
      targetPartnerSearchNetwork: null,
    },
    geoSettings: {
      positiveGeoTargetType: null,
      negativeGeoTargetType: null,
      liveGeoTargets: [],
    },
    urlExpansionOptOut: null,
    issues: [],
    warnings: [],
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
    // 1. Campaign metadata — including the forensic-validation settings.
    const campaignRows = await client.query<CampaignRow>(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.resource_name,
        campaign.network_settings.target_google_search,
        campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network,
        campaign.network_settings.target_partner_search_network,
        campaign.geo_target_type_setting.positive_geo_target_type,
        campaign.geo_target_type_setting.negative_geo_target_type
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
        ...empty,
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

    // 4. Forensic-validation checks: network settings + URL expansion. ──
    // Hard-coded expectations from playbook §15. Any deviation is a
    // structural_failure regardless of how the campaign is performing.
    const ns = campaign.networkSettings ?? {};
    const networkSettings: CampaignNetworkSettings = {
      targetGoogleSearch: ns.targetGoogleSearch ?? null,
      targetSearchNetwork: ns.targetSearchNetwork ?? null,
      targetContentNetwork: ns.targetContentNetwork ?? null,
      targetPartnerSearchNetwork: ns.targetPartnerSearchNetwork ?? null,
    };
    if (networkSettings.targetSearchNetwork === true) {
      topIssues.push(
        "Search Partners is ENABLED on campaign (must be off per §15)",
      );
    }
    if (networkSettings.targetContentNetwork === true) {
      topIssues.push(
        "Display Network is ENABLED on campaign (must be off per §15)",
      );
    }
    if (networkSettings.targetPartnerSearchNetwork === true) {
      topIssues.push(
        "Partner Search Network is ENABLED on campaign (must be off per §15)",
      );
    }
    // URL EXPANSION — playbook §15. The PMax-only field
    // `url_expansion_opt_out` was removed from current API. For SEARCH
    // campaigns the equivalent control is AI Max being OFF, which is
    // the default. We never opt SEARCH campaigns INTO AI Max from the
    // publish path, so URL expansion is structurally impossible here.
    // The verifier records null on this field for parity with the
    // VerificationResult shape.
    const urlExpansionOptOut = null;

    // 5. Geo presence-only check. ────────────────────────────────────────
    const gts = campaign.geoTargetTypeSetting ?? {};
    if (gts.positiveGeoTargetType && gts.positiveGeoTargetType !== "PRESENCE") {
      topIssues.push(
        `Positive geo targeting is "${gts.positiveGeoTargetType}" (must be PRESENCE per §15)`,
      );
    }

    // 6. Per-campaign geo drift check. ───────────────────────────────────
    // Pull live LOCATION criteria and compare against the draft's
    // expected geoTargets. This is the precise per-campaign check from
    // playbook §15: "no area outside what we're targeting gets in".
    const locationRows = await client.query<CampaignLocationCriterionRow>(`
      SELECT
        campaign_criterion.criterion_id,
        campaign_criterion.status,
        campaign_criterion.type,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.negative
      FROM campaign_criterion
      WHERE campaign.id = ${asInt(googleCampaignId)}
        AND campaign_criterion.type = 'LOCATION'
        AND campaign_criterion.status != 'REMOVED'
    `);
    const liveGeoTargets: string[] = (locationRows ?? [])
      .filter((r) => r.campaignCriterion?.negative !== true) // only positive
      .map((r) => {
        // Extract numeric ID from "geoTargetConstants/2826"
        const ref = r.campaignCriterion?.location?.geoTargetConstant ?? "";
        const parts = ref.split("/");
        return parts[parts.length - 1];
      })
      .filter((id) => /^\d+$/.test(id));

    const geoSettings: CampaignGeoSettings = {
      positiveGeoTargetType: gts.positiveGeoTargetType ?? null,
      negativeGeoTargetType: gts.negativeGeoTargetType ?? null,
      liveGeoTargets,
    };

    // Geo drift is a WARNING, not a hard issue. publishedSnapshot stays
    // immutable until an admin explicitly accepts via the reconcile action.
    // No auto-pause — admin makes the call.
    const warnings: string[] = [];
    let driftDetail: VerificationResult["drift"];
    if (opts.expectedGeoTargets && opts.expectedGeoTargets.length > 0) {
      const expectedSet = new Set(opts.expectedGeoTargets.map(String));
      const liveSet = new Set(liveGeoTargets);
      const added = liveGeoTargets.filter((id) => !expectedSet.has(id));
      const removed = opts.expectedGeoTargets.filter(
        (id) => !liveSet.has(String(id)),
      );
      if (added.length > 0 || removed.length > 0) {
        driftDetail = { geoTargetsAdded: added, geoTargetsRemoved: removed };
      }
      if (added.length > 0) {
        warnings.push(
          `Geo drift: campaign is targeting locations NOT in the published baseline — added: ${added.join(", ")}`,
        );
      }
      if (removed.length > 0) {
        warnings.push(
          `Geo drift: campaign is missing locations from the published baseline — removed: ${removed.join(", ")}`,
        );
      }
    }

    // Status precedence: hard issue (auto-pause) > drift warning > ok.
    const status: VerificationStatus =
      topIssues.length > 0
        ? "structural_failure"
        : warnings.length > 0
          ? "drift_warning"
          : "ok";

    return {
      status,
      campaignResourceName: campaign.resourceName,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      adGroups: detailedAdGroups,
      networkSettings,
      geoSettings,
      urlExpansionOptOut,
      issues: topIssues,
      warnings,
      ...(driftDetail ? { drift: driftDetail } : {}),
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
 *   - structural_failure → auto-pause campaign + critical Telegram alert + persist
 *   - drift_warning      → NO auto-pause. Warning Telegram alert. Record audit
 *                          entry. Admin chooses revert vs reconcile via:
 *                          - POST /api/admin/google-ads/drafts/[id]/geo-revert
 *                          - POST /api/admin/google-ads/drafts/[id]/geo-accept
 *   - ok                 → persist success
 *   - api_error          → persist for retry on next cron run
 *
 * Geo-drift source-of-truth: `draft.publishedSnapshot.geoTargets` (immutable
 * at publish time). Falls back to `draft.geoTargets` for legacy drafts that
 * predate snapshot capture. The publishedSnapshot is never silently rewritten
 * by this function — only the admin reconcile action mutates it.
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
      geoTargets: true,
      publishedSnapshot: true,
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

  // Resolve the expected geo targets for the drift check.
  // Priority: publishedSnapshot.geoTargets > draft.geoTargets.
  const expectedGeoTargets = extractExpectedGeoTargets(draft);

  const result = await verifyPublishedCampaign(
    draft.accountId,
    draft.googleCampaignId,
    { expectedGeoTargets },
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
    await handleStructuralFailure(draft, result);
  } else if (result.status === "drift_warning") {
    await handleDriftWarning(draft, result, expectedGeoTargets);
  }

  return result;
}

// ─── Status handlers ──────────────────────────────────────────────────────

interface MinimalDraft {
  id: string;
  name: string;
  accountId: string;
  googleCampaignId: string;
}

async function handleStructuralFailure(
  draft: MinimalDraft,
  result: VerificationResult,
): Promise<void> {
  // 1. Auto-pause (best-effort — alert still fires if pause fails)
  let pauseError: string | null = null;
  try {
    await pauseGoogleCampaign(draft.accountId, draft.googleCampaignId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.googleAdsCampaignDraft as any).update({
      where: { id: draft.id },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
  } catch (err) {
    pauseError = err instanceof Error ? err.message : String(err);
    console.error(
      `[publish-verifier] auto-pause failed for draft ${draft.id}:`,
      pauseError,
    );
  }

  // 2. Telegram alert (severity=error)
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
        `Review: /admin/integrations/google-ads/drafts/${draft.id}`,
      severity: "error",
      dedupeKey: `verify-fail:${draft.googleCampaignId}`,
    });
  } catch (alertErr) {
    console.error(
      `[publish-verifier] Telegram alert failed for draft ${draft.id}:`,
      alertErr,
    );
  }
}

async function handleDriftWarning(
  draft: MinimalDraft,
  result: VerificationResult,
  expectedGeoTargets: string[],
): Promise<void> {
  // NO auto-pause for drift. publishedSnapshot stays immutable.
  // Admin must explicitly revert or reconcile.

  // 1. Audit log — record this drift detection with the full before/after.
  const detail = result.drift ?? { geoTargetsAdded: [], geoTargetsRemoved: [] };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).googleAdsGeoAuditEntry.create({
      data: {
        draftId: draft.id,
        action: "drift_detected",
        detectedAt: result.verifiedAt,
        baselineSnapshot: expectedGeoTargets,
        liveGeoTargets: result.geoSettings.liveGeoTargets,
        geoTargetsAdded: detail.geoTargetsAdded,
        geoTargetsRemoved: detail.geoTargetsRemoved,
        actedBy: "cron",
      },
    });
  } catch (auditErr) {
    // Audit failures must not silently swallow the drift signal.
    console.error(
      `[publish-verifier] audit log write failed for draft ${draft.id}:`,
      auditErr,
    );
  }

  // 2. Telegram alert (severity=warning) — admin decision required.
  try {
    await sendAdminAlert({
      title: "⚠️ Google Ads — geo target drift detected",
      message:
        `Campaign: "${draft.name}" (Google ID ${draft.googleCampaignId})\n\n` +
        `Geo drift from publishedSnapshot baseline (campaign NOT auto-paused):\n` +
        result.warnings.map((w) => `• ${w}`).join("\n") +
        `\n\n` +
        `Admin decision required — pick one:\n` +
        `1. REVERT: push the original baseline back to Google\n` +
        `   POST /api/admin/google-ads/drafts/${draft.id}/geo-revert\n` +
        `2. ACCEPT: set the current live state as the new baseline\n` +
        `   POST /api/admin/google-ads/drafts/${draft.id}/geo-accept\n\n` +
        `Audit trail: /admin/integrations/google-ads/drafts/${draft.id}/audit`,
      severity: "warning",
      dedupeKey: `geo-drift:${draft.googleCampaignId}`,
    });
  } catch (alertErr) {
    console.error(
      `[publish-verifier] drift alert failed for draft ${draft.id}:`,
      alertErr,
    );
  }
}

/**
 * Resolves the geo targets used as the drift-detection baseline.
 * Priority: publishedSnapshot.geoTargets > draft.geoTargets > [].
 * Returns an empty array if neither has any — caller skips drift check.
 */
function extractExpectedGeoTargets(draft: {
  geoTargets?: string[] | null;
  publishedSnapshot?: unknown;
}): string[] {
  const snapshot = draft.publishedSnapshot;
  if (snapshot && typeof snapshot === "object" && "geoTargets" in snapshot) {
    const arr = (snapshot as { geoTargets?: unknown }).geoTargets;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map(String);
    }
  }
  return Array.isArray(draft.geoTargets) ? draft.geoTargets.map(String) : [];
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
