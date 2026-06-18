/**
 * GET /api/admin/google-ads/preflight
 *
 * One call, one verdict — runs every "are we actually ready to spend
 * money on Google Ads" check the playbook requires:
 *
 *   1. Env vars present (4 conversion-action resources + 2 NEXT_PUBLIC_* + MAX_DAILY_ACCOUNT_SPEND_GBP)
 *   2. All 4 conversion actions exist + ENABLED in Google Ads
 *   3. Both call conversion actions are PRIMARY (primary_for_goal=true)
 *   4. Master negatives SharedSet exists + attached to every ENABLED campaign
 *   5. Every ENABLED campaign targets PRESENCE_ONLY (not presence-and-interest)
 *   6. Every ENABLED campaign has at least one CALL asset attached
 *   7. Coverage: at least 1 eligible city under the §16 floor
 *   8. Spend cap headroom available
 *
 * Optional: ?draftId=… runs the per-draft enforcers (coverage gate, spend
 * cap, structural guardrails) against a specific draft as if it were
 * being persisted now.
 *
 * Returns { ok: boolean, checks: [{ name, pass, message, details? }] }.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import {
  enforceAccountSpendCap,
  enforceCoverageGate,
  enforceDraftGuardrails,
} from "@/lib/google-ads-draft-enforcement";
import { computeCoverageMap } from "@/lib/campaign-coverage-builder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

const SHARED_SET_NAME = "LockSafe Master Negatives";

interface Check {
  name:     string;
  pass:     boolean;
  message:  string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const draftId = url.searchParams.get("draftId");
  const checks: Check[] = [];

  // ── 1. ENV VARS ─────────────────────────────────────────────────────
  const envRequired = [
    "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE",
    "GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE",
    "GOOGLE_ADS_AD_CALL_CONVERSION_ACTION_RESOURCE",
    "GOOGLE_ADS_WEBSITE_CALL_CONVERSION_ACTION_RESOURCE",
    "NEXT_PUBLIC_GOOGLE_ADS_ID",
    "NEXT_PUBLIC_GOOGLE_ADS_CALL_CONVERSION_LABEL",
    "MAX_DAILY_ACCOUNT_SPEND_GBP",
  ];
  const envMissing = envRequired.filter((k) => !process.env[k]);
  checks.push({
    name:    "1. Env vars (Vercel)",
    pass:    envMissing.length === 0,
    message: envMissing.length === 0
      ? `All ${envRequired.length} required env vars set.`
      : `Missing in Vercel: ${envMissing.join(", ")}`,
    details: envRequired.map((k) => ({ key: k, set: Boolean(process.env[k]) })),
  });

  // ── Connect to Google Ads ──────────────────────────────────────────
  let ctx: Awaited<ReturnType<typeof getDefaultGoogleAdsClient>>;
  try {
    ctx = await getDefaultGoogleAdsClient();
  } catch (err) {
    checks.push({
      name:    "Google Ads API client",
      pass:    false,
      message: `Client unavailable: ${err instanceof Error ? err.message : String(err)}`,
    });
    return NextResponse.json({ ok: false, checks });
  }
  if (!ctx) {
    checks.push({
      name:    "Google Ads API client",
      pass:    false,
      message: "No active GoogleAdsAccount in DB",
    });
    return NextResponse.json({ ok: false, checks });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountId = (ctx as any).accountId;

  // ── 2. CONVERSION ACTIONS EXIST + ENABLED ──────────────────────────
  interface ConvActionRow {
    conversionAction?: {
      resourceName?: string;
      name?:         string;
      status?:       string;
      type?:         string;
      primaryForGoal?: boolean;
      phoneCallDurationSeconds?: string | number;
    };
  }
  let convActions: ConvActionRow[] = [];
  try {
    convActions = (await client.query(`
      SELECT conversion_action.resource_name,
             conversion_action.name,
             conversion_action.status,
             conversion_action.type,
             conversion_action.primary_for_goal,
             conversion_action.phone_call_duration_seconds
        FROM conversion_action
       WHERE conversion_action.status = 'ENABLED'
    `)) as ConvActionRow[];
  } catch (err) {
    checks.push({
      name:    "2. Conversion actions exist",
      pass:    false,
      message: `GAQL lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  const byResource = new Map<string, ConvActionRow["conversionAction"]>();
  for (const r of convActions) {
    if (r.conversionAction?.resourceName) {
      byResource.set(r.conversionAction.resourceName, r.conversionAction);
    }
  }
  const trackedActions = [
    { env: "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE",             label: "Job Completed" },
    { env: "GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE", label: "Assessment Fee" },
    { env: "GOOGLE_ADS_AD_CALL_CONVERSION_ACTION_RESOURCE",      label: "Phone Call (AD_CALL)" },
    { env: "GOOGLE_ADS_WEBSITE_CALL_CONVERSION_ACTION_RESOURCE", label: "Website Call" },
  ];
  const actionDetails = trackedActions.map(({ env, label }) => {
    const res = process.env[env];
    if (!res) return { env, label, status: "env_missing" };
    const a = byResource.get(res);
    if (!a) return { env, label, status: "not_found_or_disabled", resource: res };
    return {
      env, label,
      status:  "found",
      enabled: a.status === "ENABLED",
      primary: a.primaryForGoal === true,
      type:    a.type,
      phoneCallDurationSeconds: a.phoneCallDurationSeconds ?? null,
    };
  });
  const allActionsFound = actionDetails.every(
    (a) => a.status === "found" && (a as { enabled?: boolean }).enabled,
  );
  checks.push({
    name:    "2. All 4 conversion actions exist + ENABLED",
    pass:    allActionsFound,
    message: allActionsFound
      ? "All 4 conversion actions are ENABLED in Google Ads."
      : `Missing / disabled: ${actionDetails.filter((a) => a.status !== "found" || !(a as { enabled?: boolean }).enabled).map((a) => a.label).join(", ")}`,
    details: actionDetails,
  });

  // ── 3. CALL CONVERSION ACTIONS MARKED PRIMARY ──────────────────────
  const callActions = actionDetails.filter(
    (a) => a.env.includes("CALL") && a.status === "found",
  );
  const callPrimary = callActions.length > 0 && callActions.every(
    (a) => (a as { primary?: boolean }).primary === true,
  );
  checks.push({
    name:    "3. Call conversion actions are PRIMARY",
    pass:    callPrimary,
    message: callPrimary
      ? "Both call actions (AD_CALL + WEBSITE_CALL) are PRIMARY — Smart Bidding will optimise for them."
      : "At least one call action is not PRIMARY. Go to Google Ads → Goals → Conversions and set both to Primary.",
    details: callActions,
  });

  // ── 4. MASTER NEGATIVES SHAREDSET — exists + attached to every ENABLED campaign
  interface SharedSetRow {
    sharedSet?: { resourceName?: string; name?: string; type?: string; status?: string; memberCount?: string };
  }
  let masterSetRes: string | null = null;
  let masterSetMemberCount = 0;
  try {
    const ss = (await client.query(`
      SELECT shared_set.resource_name, shared_set.name, shared_set.type,
             shared_set.status, shared_set.member_count
        FROM shared_set
       WHERE shared_set.status = 'ENABLED'
    `)) as SharedSetRow[];
    for (const r of ss) {
      if (r.sharedSet?.name === SHARED_SET_NAME) {
        masterSetRes = r.sharedSet.resourceName ?? null;
        masterSetMemberCount = Number(r.sharedSet.memberCount ?? 0);
        break;
      }
    }
  } catch (err) {
    checks.push({
      name:    "4a. Master negatives SharedSet exists",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  checks.push({
    name:    "4a. Master negatives SharedSet exists",
    pass:    masterSetRes !== null && masterSetMemberCount > 500,
    message: masterSetRes
      ? `SharedSet "${SHARED_SET_NAME}" exists with ${masterSetMemberCount} entries.`
      : `SharedSet "${SHARED_SET_NAME}" not found — run POST /api/admin/google-ads/sync-master-negatives.`,
    details: { resource: masterSetRes, members: masterSetMemberCount },
  });

  // Pull ENABLED campaigns + their attached shared sets in one go.
  interface CampaignRow {
    campaign?: {
      id?:    string;
      name?:  string;
      status?: string;
      resourceName?: string;
      geoTargetTypeSetting?: { positiveGeoTargetType?: string };
    };
  }
  interface CampaignSharedSetRow {
    campaign?:  { resourceName?: string; name?: string };
    sharedSet?: { resourceName?: string; name?: string };
    campaignSharedSet?: { status?: string };
  }
  interface CampaignAssetRow {
    campaign?:      { resourceName?: string; name?: string };
    campaignAsset?: { fieldType?: string };
    asset?:         { type?: string };
  }

  let enabledCampaigns: CampaignRow[] = [];
  let campaignSets:     CampaignSharedSetRow[] = [];
  let campaignAssets:   CampaignAssetRow[] = [];
  try {
    enabledCampaigns = (await client.query(`
      SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name,
             campaign.geo_target_type_setting.positive_geo_target_type
        FROM campaign
       WHERE campaign.status = 'ENABLED'
    `)) as CampaignRow[];
  } catch (err) {
    checks.push({
      name:    "Campaign listing",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  try {
    // NB: every field referenced in WHERE must also appear in SELECT,
    // hence campaign.status is in both clauses even though we don't
    // read its value back.
    campaignSets = (await client.query(`
      SELECT campaign.resource_name, campaign.name, campaign.status,
             shared_set.resource_name, shared_set.name,
             campaign_shared_set.status
        FROM campaign_shared_set
       WHERE campaign.status = 'ENABLED'
         AND campaign_shared_set.status = 'ENABLED'
    `)) as CampaignSharedSetRow[];
  } catch (err) {
    checks.push({
      name:    "Campaign SharedSet listing",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  try {
    // NB: Google Ads enum literals in GAQL are unquoted (CALL, ENABLED,
    // PAUSED). Quoting them produces 400 INVALID_ARGUMENT.
    // GAQL also requires every field referenced in WHERE to appear in
    // SELECT — `campaign.status` must be present even if we don't use
    // its value, or the request 400s with EXPECTED_REFERENCED_FIELD_IN_SELECT_CLAUSE.
    campaignAssets = (await client.query(`
      SELECT campaign.resource_name, campaign.name, campaign.status,
             campaign_asset.field_type, asset.type
        FROM campaign_asset
       WHERE campaign.status = ENABLED
         AND campaign_asset.field_type = CALL
    `)) as CampaignAssetRow[];
  } catch (err) {
    checks.push({
      name:    "Campaign call asset listing",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4b — every ENABLED campaign has the master SharedSet attached
  const campaignsWithMaster = new Set<string>();
  for (const r of campaignSets) {
    if (
      r.sharedSet?.resourceName === masterSetRes &&
      r.campaign?.resourceName
    ) campaignsWithMaster.add(r.campaign.resourceName);
  }
  const campaignsMissingMaster = enabledCampaigns
    .map((c) => c.campaign)
    .filter((c) => c?.resourceName && !campaignsWithMaster.has(c.resourceName))
    .map((c) => ({ name: c?.name, id: c?.id }));
  checks.push({
    name:    "4b. Master negatives attached to every ENABLED campaign",
    pass:    masterSetRes !== null && campaignsMissingMaster.length === 0,
    message: campaignsMissingMaster.length === 0
      ? `Attached to all ${enabledCampaigns.length} ENABLED campaigns.`
      : `${campaignsMissingMaster.length} campaigns missing the master SharedSet — re-run sync.`,
    details: { missing: campaignsMissingMaster },
  });

  // ── 5. PRESENCE_ONLY targeting ──────────────────────────────────────
  const presenceOffenders = enabledCampaigns
    .map((c) => c.campaign)
    .filter(
      (c) => c?.geoTargetTypeSetting?.positiveGeoTargetType !== "PRESENCE",
    )
    .map((c) => ({
      name: c?.name,
      id:   c?.id,
      currentValue: c?.geoTargetTypeSetting?.positiveGeoTargetType ?? "DONT_CARE (default = presence_and_interest)",
    }));
  checks.push({
    name:    "5. PRESENCE_ONLY targeting on every ENABLED campaign",
    pass:    presenceOffenders.length === 0,
    message: presenceOffenders.length === 0
      ? "Every campaign targets only people physically present in the geo. No bleed from non-UK searchers."
      : `${presenceOffenders.length} campaigns use presence-and-interest. In Google Ads → Settings → Locations → People → choose 'Presence only'.`,
    details: { offenders: presenceOffenders },
  });

  // ── 6. CALL ASSET on every ENABLED campaign ────────────────────────
  const campaignsWithCall = new Set<string>();
  for (const r of campaignAssets) {
    if (r.campaign?.resourceName) campaignsWithCall.add(r.campaign.resourceName);
  }
  const campaignsMissingCall = enabledCampaigns
    .map((c) => c.campaign)
    .filter((c) => c?.resourceName && !campaignsWithCall.has(c.resourceName))
    .map((c) => ({ name: c?.name, id: c?.id }));
  checks.push({
    name:    "6. Every ENABLED campaign has a CALL asset (§21)",
    pass:    campaignsMissingCall.length === 0,
    message: campaignsMissingCall.length === 0
      ? "Every campaign exposes a call extension — AD_CALL conversion can fire."
      : `${campaignsMissingCall.length} campaigns missing CALL assets — AD_CALL conversion will never fire for them.`,
    details: { missing: campaignsMissingCall },
  });

  // ── 7. COVERAGE (§16) — at least one eligible city ─────────────────
  let coverageDetails: { eligibleCount: number; sample: string[]; total: number } = { eligibleCount: 0, sample: [], total: 0 };
  try {
    const cov = await computeCoverageMap();
    const eligible = cov.entries.filter((c) => c.eligible);
    coverageDetails = {
      eligibleCount: eligible.length,
      sample:        eligible.slice(0, 8).map((c) => c.cityName),
      total:         cov.entries.length,
    };
  } catch (err) {
    checks.push({
      name:    "7. Coverage gate has eligible cities",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  checks.push({
    name:    "7. Coverage gate has eligible cities (≥2 locksmiths × 10mi)",
    pass:    coverageDetails.eligibleCount > 0,
    message: coverageDetails.eligibleCount > 0
      ? `${coverageDetails.eligibleCount} cities eligible (e.g. ${coverageDetails.sample.join(", ")}). New drafts can target any of them.`
      : "Zero eligible cities. You can't legally publish a new campaign that satisfies §16.",
    details: coverageDetails,
  });

  // ── 8. SPEND CAP HEADROOM ──────────────────────────────────────────
  try {
    // Ask for a £1 probe — returns ok+headroom when there's any room left.
    const cap = await enforceAccountSpendCap(accountId, 1);
    if (cap.ok) {
      checks.push({
        name:    "8. Spend cap headroom (§17)",
        pass:    true,
        message: `£${cap.currentSpend.toFixed(0)} of £${cap.cap} daily-budget cap in use — headroom £${cap.headroom.toFixed(0)}/day.`,
        details: cap,
      });
    } else {
      checks.push({
        name:    "8. Spend cap headroom (§17)",
        pass:    false,
        message: cap.violations.map((v) => v.expected ?? v.field).join("; "),
        details: cap,
      });
    }
  } catch (err) {
    checks.push({
      name:    "8. Spend cap headroom",
      pass:    false,
      message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // ── 9. OPTIONAL: per-draft enforcement ─────────────────────────────
  if (draftId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    const draft = await p.googleAdsCampaignDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      checks.push({
        name:    "9. Per-draft enforcement",
        pass:    false,
        message: `Draft ${draftId} not found`,
      });
    } else {
      // Coverage on the draft's geoTargets
      try {
        const cov = await enforceCoverageGate(draft.geoTargets);
        checks.push({
          name:    `9a. Draft coverage (§16): "${draft.name}"`,
          pass:    cov.ok,
          message: cov.ok
            ? `Every geoTarget has ≥2 active locksmiths within 10mi (${cov.eligibleGeoIds.length} verified).`
            : cov.violations.map((v) => v.expected ?? v.field).join("; "),
          details: cov,
        });
      } catch (err) {
        checks.push({
          name:    "9a. Draft coverage",
          pass:    false,
          message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      // Spend cap with this draft's daily budget
      try {
        const cap = await enforceAccountSpendCap(draft.accountId, draft.dailyBudget ?? 0);
        checks.push({
          name:    `9b. Draft spend cap (§17)`,
          pass:    cap.ok,
          message: cap.ok
            ? `£${draft.dailyBudget} fits within £${cap.headroom.toFixed(0)} remaining headroom.`
            : cap.violations.map((v) => v.expected ?? v.field).join("; "),
          details: cap,
        });
      } catch (err) {
        checks.push({
          name:    "9b. Draft spend cap",
          pass:    false,
          message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      // Structural guardrails — RSA counts, keyword floors, call asset, etc.
      try {
        enforceDraftGuardrails(draft);
        checks.push({
          name:    "9c. Draft structural guardrails (§20/§21/§41)",
          pass:    true,
          message: "RSA copy, keyword floor, negatives floor, call asset all pass.",
        });
      } catch (err) {
        checks.push({
          name:    "9c. Draft structural guardrails",
          pass:    false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ── 10. MICROSOFT ADVERTISING (informational; passes when intentionally OFF)
  // Either fully wired or fully off. Half-wired = fail.
  const msVars = [
    "MICROSOFT_ADS_CUSTOMER_ID",
    "MICROSOFT_ADS_ACCOUNT_ID",
    "MICROSOFT_ADS_DEVELOPER_TOKEN",
    "MICROSOFT_ADS_CLIENT_ID",
    "MICROSOFT_ADS_CLIENT_SECRET",
    "MICROSOFT_ADS_REFRESH_TOKEN",
  ];
  const msSet     = msVars.filter((k) => Boolean(process.env[k])).length;
  const msPresent = msSet === msVars.length;
  const msAbsent  = msSet === 0;
  checks.push({
    name:    "10. Microsoft Advertising (Bing/Yahoo/DuckDuckGo)",
    pass:    msPresent || msAbsent,
    message: msPresent
      ? "Microsoft Ads fully configured — Stripe webhook will upload offline conversions on Bing-sourced jobs."
      : msAbsent
        ? "Microsoft Ads OFF (not configured) — system runs Google-only. Set the 6 MICROSOFT_ADS_* env vars to enable."
        : `Microsoft Ads HALF-CONFIGURED (${msSet}/${msVars.length} env vars set). Either complete the config or unset them all.`,
    details: { setCount: msSet, total: msVars.length, vars: msVars.map((k) => ({ key: k, set: Boolean(process.env[k]) })) },
  });


  // ── 11. NEVER PERFORMANCE MAX (§27) — Google-pushed PMax violates §10/§16/§22
  // Any campaign whose advertising_channel_type is not SEARCH is a footgun:
  // PMax / Display / YouTube / Discovery cannot respect the locksmith-token
  // ban (§10), the coverage gate (§16), or the master negatives discipline
  // (§22) because none of those features are per-keyword. They optimise on
  // Google's terms, not ours, and historically bankrupt locksmith accounts.
  try {
    type ChannelRow = { campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string } };
    const nonSearch = (await client.query(`
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
        FROM campaign
       WHERE campaign.status IN (ENABLED, PAUSED)
         AND campaign.advertising_channel_type != SEARCH
    `)) as ChannelRow[];
    const offenders = nonSearch
      .map((r) => r.campaign)
      .filter((c) => c !== undefined)
      .map((c) => ({ id: c!.id, name: c!.name, status: c!.status, channel: c!.advertisingChannelType }));
    checks.push({
      name:    "11. Never Performance Max / non-Search (§27)",
      pass:    offenders.length === 0,
      message: offenders.length === 0
        ? "All campaigns are SEARCH only. No PMax, Display, YouTube or Discovery."
        : `${offenders.length} non-Search campaign(s) found — discard or remove them. PMax cannot respect §10/§16/§22 and bankrupts locksmith accounts.`,
      details: { offenders },
    });
  } catch (err) {
    checks.push({
      name:    "11. Never Performance Max / non-Search (§27)",
      pass:    false,
      message: `Failed to query: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // ── 12. §31 PRESENCE-only geo targeting (ENABLED + PAUSED) ──────────
  // §31 (2026-06-17, GODMODE) hardens what check #5 verifies for ENABLED
  // campaigns: ANY ENABLED *or* PAUSED campaign whose
  // geo_target_type_setting.positive_geo_target_type is not exactly
  // "PRESENCE" is a footgun. The previous "DONT_CARE" default behaviour
  // (presence-AND-interest) leaks spend on people searching about the city
  // from somewhere else (Milton-Keynes traveller pattern, GODMODE plan
  // Cause 1). A PAUSED campaign that's resumed without anyone noticing
  // would burn money on the same leak — hence we cover PAUSED too.
  //
  // The fix when this fails: edit the campaign's Locations setting to
  // "People in or regularly in your targeted locations" — that is the UI
  // label for the PRESENCE enum on the API side.
  try {
    type PresenceRow = {
      campaign?: {
        id?: string;
        name?: string;
        status?: string;
        geoTargetTypeSetting?: { positiveGeoTargetType?: string };
      };
    };
    const presenceRows = (await client.query(`
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.geo_target_type_setting.positive_geo_target_type
        FROM campaign
       WHERE campaign.status IN (ENABLED, PAUSED)
    `)) as PresenceRow[];
    const presence12Offenders = presenceRows
      .map((r) => r.campaign)
      .filter((c) => c !== undefined)
      .filter((c) => c!.geoTargetTypeSetting?.positiveGeoTargetType !== "PRESENCE")
      .map((c) => ({
        id:        c!.id,
        name:      c!.name,
        status:    c!.status,
        positive:  c!.geoTargetTypeSetting?.positiveGeoTargetType
                     ?? "DONT_CARE (default = presence_and_interest)",
      }));
    checks.push({
      name:    "12. §31 PRESENCE-only on every ENABLED + PAUSED campaign (2026-06-17)",
      pass:    presence12Offenders.length === 0,
      message: presence12Offenders.length === 0
        ? "Every ENABLED + PAUSED campaign targets PRESENCE only. No Milton-Keynes-style traveller leak even if a paused campaign is resumed."
        : `${presence12Offenders.length} campaign(s) on something other than PRESENCE — fix in UI: Settings → Locations → People → "Presence: People in or regularly in your targeted locations".`,
      details: { offenders: presence12Offenders },
    });
  } catch (err) {
    checks.push({
      name:    "12. §31 PRESENCE-only on every ENABLED + PAUSED campaign (2026-06-17)",
      pass:    false,
      message: `Failed to query: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // ── 13. §36 SITELINKS + CALLOUTS on every ENABLED + PAUSED campaign ──
  // 2026-06-18: competitor LBS SECURITY LTD's "locked out tw20" ad showed 4
  // sitelinks giving it 5× our vertical space — our TW20 + Newcastle had
  // none. Sitelinks + callouts cost nothing and improve Quality Score; not
  // having them is leaving CTR on the table. Same query shape as check #6
  // (CALL asset) but filters on field_type IN (SITELINK, CALLOUT). Account-
  // level assets count too — Google joins them onto every campaign at serve
  // time, so a campaign with 0 campaign-level sitelinks STILL passes if the
  // account has ≥4 attached at customer level (queried via customer_asset).
  try {
    type AssetCountRow = {
      campaign?:      { resourceName?: string; name?: string; status?: string };
      campaignAsset?: { fieldType?: string };
    };
    type CustomerAssetRow = {
      customerAsset?: { fieldType?: string };
    };
    const campaignSitelinkCalloutRows = (await client.query(`
      SELECT campaign.resource_name, campaign.name, campaign.status,
             campaign_asset.field_type
        FROM campaign_asset
       WHERE campaign.status IN (ENABLED, PAUSED)
         AND campaign_asset.field_type IN (SITELINK, CALLOUT)
    `)) as AssetCountRow[];
    const customerSitelinkCalloutRows = (await client.query(`
      SELECT customer_asset.field_type
        FROM customer_asset
       WHERE customer_asset.field_type IN (SITELINK, CALLOUT)
    `)) as CustomerAssetRow[];

    // Count account-level (customer_asset) sitelinks/callouts — these
    // implicitly attach to every campaign that doesn't override.
    let accountSitelinks = 0;
    let accountCallouts  = 0;
    for (const r of customerSitelinkCalloutRows) {
      if (r.customerAsset?.fieldType === "SITELINK") accountSitelinks++;
      else if (r.customerAsset?.fieldType === "CALLOUT") accountCallouts++;
    }

    // Build per-campaign count map for campaign-level overrides.
    const perCampaign = new Map<string, { name: string; status?: string; sitelinks: number; callouts: number }>();
    for (const c of enabledCampaigns) {
      if (c.campaign?.resourceName) {
        perCampaign.set(c.campaign.resourceName, {
          name: c.campaign.name ?? "(unknown)",
          status: c.campaign.status,
          sitelinks: 0,
          callouts: 0,
        });
      }
    }
    for (const r of campaignSitelinkCalloutRows) {
      const rn = r.campaign?.resourceName;
      if (!rn) continue;
      let entry = perCampaign.get(rn);
      if (!entry) {
        entry = {
          name: r.campaign?.name ?? "(unknown)",
          status: r.campaign?.status,
          sitelinks: 0,
          callouts: 0,
        };
        perCampaign.set(rn, entry);
      }
      if (r.campaignAsset?.fieldType === "SITELINK") entry.sitelinks++;
      else if (r.campaignAsset?.fieldType === "CALLOUT") entry.callouts++;
    }

    // A campaign passes §36 if (campaign-level sitelinks + account-level
    // sitelinks) ≥ 4 AND (campaign-level callouts + account-level callouts) ≥ 4.
    const MIN_SITELINKS = 4;
    const MIN_CALLOUTS  = 4;
    const offenders: Array<{ name: string; status?: string; sitelinks: number; callouts: number; effectiveSitelinks: number; effectiveCallouts: number }> = [];
    for (const entry of perCampaign.values()) {
      const effSitelinks = entry.sitelinks + accountSitelinks;
      const effCallouts  = entry.callouts + accountCallouts;
      if (effSitelinks < MIN_SITELINKS || effCallouts < MIN_CALLOUTS) {
        offenders.push({
          name: entry.name,
          status: entry.status,
          sitelinks: entry.sitelinks,
          callouts: entry.callouts,
          effectiveSitelinks: effSitelinks,
          effectiveCallouts: effCallouts,
        });
      }
    }
    checks.push({
      name:    "13. §36 Mandatory sitelinks (≥4) + callouts (≥4) on every campaign (2026-06-18)",
      pass:    offenders.length === 0,
      message: offenders.length === 0
        ? `Every campaign has ≥${MIN_SITELINKS} sitelinks + ≥${MIN_CALLOUTS} callouts (campaign+account level combined). Account default: ${accountSitelinks} sitelinks / ${accountCallouts} callouts.`
        : `${offenders.length} campaign(s) below the §36 floor (need ≥${MIN_SITELINKS} sitelinks + ≥${MIN_CALLOUTS} callouts). Fix: attach GODMODE_RECOMMENDED_SITELINKS + GODMODE_RECOMMENDED_CALLOUTS via Google Ads UI (Assets → +Sitelink / +Callout) or republish the draft (auto-injects).`,
      details: { offenders, accountDefault: { sitelinks: accountSitelinks, callouts: accountCallouts } },
    });
  } catch (err) {
    checks.push({
      name:    "13. §36 Mandatory sitelinks (≥4) + callouts (≥4) on every campaign (2026-06-18)",
      pass:    false,
      message: `Failed to query: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const ok = checks.every((c) => c.pass);
  return NextResponse.json({
    ok,
    summary: ok
      ? `✅ All ${checks.length} checks pass — system is ready to spend.`
      : `❌ ${checks.filter((c) => !c.pass).length} of ${checks.length} checks failed — see details before launching.`,
    checks,
    runAt: new Date().toISOString(),
  });
}
