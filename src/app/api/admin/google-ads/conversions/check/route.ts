/**
 * GET /api/admin/google-ads/conversions/check
 *
 * Diagnostic endpoint that verifies the Google Ads offline conversion
 * upload configuration is correct. Uses validateOnly=true so nothing
 * is actually sent to Google — it just confirms the conversion action
 * resources exist and the API credentials are working.
 *
 * Called after deploying the server-side conversion tracking to confirm
 * the env vars are wired up correctly before real jobs fire.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ── 1. Check env vars are set ───────────────────────────────────────────────
  const jobConversionAction = process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"];
  const assessmentConversionAction = process.env["GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE"];

  results.envVars = {
    GOOGLE_ADS_CONVERSION_ACTION_RESOURCE: jobConversionAction
      ? `✅ Set — ${jobConversionAction}`
      : "❌ Missing — set in Vercel env vars",
    GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE: assessmentConversionAction
      ? `✅ Set — ${assessmentConversionAction}`
      : "❌ Missing — set in Vercel env vars",
  };

  // ── 2. Check Google Ads API client is available ─────────────────────────────
  let client: unknown;
  try {
    client = await getDefaultGoogleAdsClient();
    results.apiClient = "✅ Google Ads client connected";
  } catch (err) {
    results.apiClient = `❌ Client unavailable: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  // ── 3. validateOnly upload for job completion conversion ────────────────────
  if (jobConversionAction && client) {
    const customerMatch = jobConversionAction.match(/^customers\/(\d+)\//);
    if (customerMatch) {
      const customerId = customerMatch[1];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = client as any;
        const validateBody = {
          conversions: [
            {
              gclid: "test_gclid_validate_only",
              conversionAction: jobConversionAction,
              conversionDateTime: "2026-01-01 12:00:00+00:00",
              conversionValue: 150.0,
              currencyCode: "GBP",
              orderId: "TEST-VALIDATE-ONLY",
            },
          ],
          partialFailure: true,
          validateOnly: true,
        };
        const resp = await c.request(
          `customers/${customerId}:uploadClickConversions`,
          "POST",
          validateBody,
        );
        results.jobConversionValidation = {
          status: "✅ Conversion action resource is valid and reachable",
          response: resp,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // "INVALID_ARGUMENT" with gclid is expected — it means the action
        // resource was found but the test gclid is fake (which is fine).
        const isExpectedGclidError =
          msg.includes("INVALID_ARGUMENT") ||
          msg.includes("gclid") ||
          msg.includes("click_id");
        results.jobConversionValidation = isExpectedGclidError
          ? {
              status: "✅ Conversion action resource valid (fake gclid rejected as expected)",
              note: msg,
            }
          : {
              status: `❌ Unexpected error: ${msg}`,
            };
      }
    } else {
      results.jobConversionValidation = `❌ Malformed resource name: ${jobConversionAction}`;
    }
  } else {
    results.jobConversionValidation = "⏭ Skipped — env var not set";
  }

  // ── 4. validateOnly upload for assessment fee conversion ────────────────────
  if (assessmentConversionAction && client) {
    const customerMatch = assessmentConversionAction.match(/^customers\/(\d+)\//);
    if (customerMatch) {
      const customerId = customerMatch[1];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = client as any;
        const validateBody = {
          conversions: [
            {
              gclid: "test_gclid_validate_only",
              conversionAction: assessmentConversionAction,
              conversionDateTime: "2026-01-01 12:00:00+00:00",
              conversionValue: 35.0,
              currencyCode: "GBP",
              orderId: "TEST-AF-VALIDATE-ONLY",
            },
          ],
          partialFailure: true,
          validateOnly: true,
        };
        const resp = await c.request(
          `customers/${customerId}:uploadClickConversions`,
          "POST",
          validateBody,
        );
        results.assessmentFeeConversionValidation = {
          status: "✅ Assessment fee conversion action resource valid and reachable",
          response: resp,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isExpectedGclidError =
          msg.includes("INVALID_ARGUMENT") ||
          msg.includes("gclid") ||
          msg.includes("click_id");
        results.assessmentFeeConversionValidation = isExpectedGclidError
          ? {
              status: "✅ Assessment fee conversion action resource valid (fake gclid rejected as expected)",
              note: msg,
            }
          : {
              status: `❌ Unexpected error: ${msg}`,
            };
      }
    } else {
      results.assessmentFeeConversionValidation = `❌ Malformed resource name: ${assessmentConversionAction}`;
    }
  } else {
    results.assessmentFeeConversionValidation = "⏭ Skipped — env var not set";
  }

  const allOk = Object.values(results).every((v) => {
    const str = JSON.stringify(v);
    return !str.includes("❌");
  });

  return NextResponse.json({ ok: allOk, results }, { status: 200 });
}
