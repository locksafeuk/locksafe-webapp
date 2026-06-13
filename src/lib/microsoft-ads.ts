/**
 * Microsoft Advertising (Bing/Yahoo/DuckDuckGo) client + offline
 * conversion uploader.
 *
 * Status (2026-06-12): STUB. The OAuth refresh flow + Offline Conversion
 * API call shapes are correct per Microsoft's docs, but actual
 * end-to-end testing is gated on Piky creating the Microsoft Advertising
 * account, generating a developer token, and completing OAuth consent.
 *
 * Until those env vars are set, every entry point returns `null` /
 * `{skipped: true}` so the call sites can ship today and start
 * uploading the moment credentials arrive — no code changes required.
 *
 * Env vars required (set in Vercel when Piky is ready):
 *   MICROSOFT_ADS_CUSTOMER_ID         — customer ID (the account)
 *   MICROSOFT_ADS_ACCOUNT_ID          — sub-account ID
 *   MICROSOFT_ADS_DEVELOPER_TOKEN     — from ads.microsoft.com/Account/Tools
 *   MICROSOFT_ADS_CLIENT_ID           — Azure app registration
 *   MICROSOFT_ADS_CLIENT_SECRET       — Azure app secret
 *   MICROSOFT_ADS_REFRESH_TOKEN       — refresh token from OAuth consent
 *   MICROSOFT_ADS_CONVERSION_GOAL_ID  — UPLOAD goal created in MS Ads UI
 *
 * Docs: https://learn.microsoft.com/en-us/advertising/guides/offline-conversions
 */

import { vendorFetch } from "@/lib/vendor-audit";

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

interface MicrosoftAdsClientCtx {
  customerId:         string;
  accountId:          string;
  developerToken:     string;
  accessToken:        string;
  conversionGoalId?:  string;
}

/**
 * Returns a configured client ctx if every required env var is present,
 * otherwise null. Refresh token → access token via OAuth.
 */
export async function getDefaultMicrosoftAdsClient(): Promise<MicrosoftAdsClientCtx | null> {
  const customerId     = process.env.MICROSOFT_ADS_CUSTOMER_ID;
  const accountId      = process.env.MICROSOFT_ADS_ACCOUNT_ID;
  const developerToken = process.env.MICROSOFT_ADS_DEVELOPER_TOKEN;
  const clientId       = process.env.MICROSOFT_ADS_CLIENT_ID;
  const clientSecret   = process.env.MICROSOFT_ADS_CLIENT_SECRET;
  const refreshToken   = process.env.MICROSOFT_ADS_REFRESH_TOKEN;
  if (!customerId || !accountId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    return null;
  }

  // OAuth token refresh via vendorFetch so the Data Ownership log
  // captures the exchange.
  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type:    "refresh_token",
    scope:         "https://ads.microsoft.com/msads.manage offline_access",
  });
  const res = await vendorFetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  }, { vendor: "microsoft-ads", callerRoute: "lib/microsoft-ads.ts:getDefaultMicrosoftAdsClient (OAuth)" });
  if (!res.ok) {
    console.warn("[microsoft-ads] OAuth refresh failed:", res.status, await res.text());
    return null;
  }
  const json = await res.json() as { access_token?: string; error?: string };
  if (!json.access_token) return null;

  return {
    customerId,
    accountId,
    developerToken,
    accessToken: json.access_token,
    conversionGoalId: process.env.MICROSOFT_ADS_CONVERSION_GOAL_ID,
  };
}

interface OfflineConversionInput {
  /** Microsoft Click ID from the original click — required. */
  msclkid:         string;
  /** Display time of the conversion. Must be in the click attribution window. */
  conversionTime:  Date;
  /** Conversion value in account currency (GBP for UK). */
  conversionValue: number;
  /** Currency code. Default "GBP". */
  conversionCurrencyCode?: string;
  /** Optional Microsoft Click ID-style label override. */
  conversionName?: string;
}

interface OfflineConversionResult {
  ok:      boolean;
  skipped?: boolean;
  reason?: string;
  raw?:    unknown;
}

/**
 * Upload one offline conversion. Returns `{skipped:true}` if Microsoft
 * Ads isn't configured yet — safe to call unconditionally from the
 * Stripe webhook.
 *
 * NB: untested end-to-end until credentials are wired. Treat as a
 * forward-compatible scaffold rather than a production path until Piky
 * confirms the first real conversion lands in the MS Ads UI.
 */
export async function uploadOfflineConversionToMicrosoft(
  input: OfflineConversionInput,
): Promise<OfflineConversionResult> {
  const ctx = await getDefaultMicrosoftAdsClient();
  if (!ctx) return { ok: false, skipped: true, reason: "microsoft-ads-not-configured" };
  if (!input.msclkid) return { ok: false, skipped: true, reason: "no-msclkid" };

  // Microsoft uses SOAP for the Offline Conversion API on the
  // CampaignManagement service. They also expose a REST equivalent via
  // the Bulk endpoint. We prefer REST/JSON when available to stay
  // consistent with the rest of the stack.
  //
  // Endpoint: POST https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/OfflineConversions
  // Body: { "OfflineConversions": [{ MicrosoftClickId, ConversionName, ConversionTime, ConversionValue, ConversionCurrencyCode }] }
  const endpoint = "https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/OfflineConversions";
  const payload  = {
    OfflineConversions: [
      {
        MicrosoftClickId:       input.msclkid,
        ConversionName:         input.conversionName ?? "Job Completed",
        ConversionTime:         input.conversionTime.toISOString(),
        ConversionValue:        input.conversionValue,
        ConversionCurrencyCode: input.conversionCurrencyCode ?? "GBP",
      },
    ],
  };

  try {
    const res = await vendorFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":              "application/json",
        "Authorization":             `Bearer ${ctx.accessToken}`,
        "DeveloperToken":            ctx.developerToken,
        "CustomerId":                ctx.customerId,
        "CustomerAccountId":         ctx.accountId,
      },
      body: JSON.stringify(payload),
    }, { vendor: "microsoft-ads", callerRoute: "lib/microsoft-ads.ts:uploadOfflineConversionToMicrosoft" });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, reason: `status_${res.status}`, raw };
    }
    return { ok: true, raw };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Conditional upload — looks up the job, finds msclkid, fires the
 * conversion if all conditions are met. Mirrors
 * `uploadJobConversionIfEligible` for Google.
 *
 * Safe to call from the Stripe webhook unconditionally. Bails out
 * silently when:
 *   - Microsoft Ads creds not set (most installs, today)
 *   - Job has no msclkid (Google-sourced or direct traffic)
 *   - Job already uploaded to MS (idempotency — TODO bookkeeping column)
 */
export async function uploadJobConversionToMicrosoftIfEligible(
  jobId: string,
  opts: { conversionValue?: number; conversionName?: string } = {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<OfflineConversionResult> {
  const { default: prisma } = await import("@/lib/db");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const job = await p.job.findUnique({
    where:  { id: jobId },
    select: { id: true, msclkid: true, completedAt: true, quote: { select: { total: true } } },
  });
  if (!job)            return { ok: false, skipped: true, reason: "job_not_found" };
  if (!job.msclkid)    return { ok: false, skipped: true, reason: "no_msclkid" };

  return uploadOfflineConversionToMicrosoft({
    msclkid:         job.msclkid,
    conversionTime:  job.completedAt ?? new Date(),
    conversionValue: opts.conversionValue ?? (job.quote?.total ?? 0),
    conversionName:  opts.conversionName ?? "Job Completed",
  });
}
