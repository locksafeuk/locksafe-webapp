/**
 * GET /api/admin/google-ads/conversions/check
 *
 * Diagnostic endpoint that verifies the Google Ads offline conversion
 * upload configuration is correct.
 *
 * Implementation note (2026-06-10): previously this route fired two
 * `uploadClickConversions` calls with `validateOnly: true` to confirm
 * each conversion action was reachable. Google Ads still counts
 * validateOnly mutations toward the per-token operations quota — so
 * each diagnostic run burned 2 ops. With 4-6 checks per day across
 * dev + monitoring that easily eats hundreds of ops/week from a quota
 * that's already tight on Basic access.
 *
 * The route now performs a single GAQL search of conversion_action
 * (1 operation total) and verifies each configured env var's
 * resource_name exists in the result set. Same validation, 1/4 the ops.
 *
 * Called after deploying or updating conversion env vars to confirm
 * resources are wired up before real jobs fire.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

// Map of "env var name" → "human label" for each tracked resource.
// Adding a new conversion action? Add an entry here.
const TRACKED_CONVERSION_ENV_VARS: Array<{ env: string; label: string }> = [
  { env: "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE", label: "Job Completed (UPLOAD_CLICKS)" },
  { env: "GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE", label: "Assessment Fee (UPLOAD_CLICKS)" },
  { env: "GOOGLE_ADS_AD_CALL_CONVERSION_ACTION_RESOURCE", label: "Phone Call Lead 30s+ (AD_CALL)" },
  { env: "GOOGLE_ADS_WEBSITE_CALL_CONVERSION_ACTION_RESOURCE", label: "Website Call 30s+ (WEBSITE_CALL)" },
];

// Public env vars used by the gtag call-tracking snippet on landings.
const TRACKED_PUBLIC_ENV_VARS = [
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_CALL_CONVERSION_LABEL",
];

interface ConversionActionRow {
  conversionAction?: {
    resourceName?: string;
    name?: string;
    status?: string;
    type?: string;
    category?: string;
    primaryForGoal?: boolean;
    phoneCallDurationSeconds?: string | number;
  };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envVars: Record<string, string> = {};
  for (const { env } of TRACKED_CONVERSION_ENV_VARS) {
    const val = process.env[env];
    envVars[env] = val ? `✅ Set — ${val}` : "❌ Missing — set in Vercel env vars";
  }
  for (const env of TRACKED_PUBLIC_ENV_VARS) {
    const val = process.env[env];
    envVars[env] = val ? "✅ Set" : "❌ Missing — set in Vercel env vars";
  }

  // Connect to Google Ads.
  let ctx;
  try {
    ctx = await getDefaultGoogleAdsClient();
  } catch (err) {
    return NextResponse.json({
      ok: false,
      results: {
        envVars,
        apiClient: `❌ Client unavailable: ${err instanceof Error ? err.message : String(err)}`,
      },
    });
  }
  if (!ctx) {
    return NextResponse.json({
      ok: false,
      results: { envVars, apiClient: "❌ No active GoogleAdsAccount" },
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  // Single GAQL query — fetches every enabled conversion action in the
  // account. Costs 1 operation regardless of how many actions we track.
  let rows: ConversionActionRow[] = [];
  try {
    rows = (await client.query(`
      SELECT
        conversion_action.resource_name,
        conversion_action.name,
        conversion_action.status,
        conversion_action.type,
        conversion_action.category,
        conversion_action.primary_for_goal,
        conversion_action.phone_call_duration_seconds
      FROM conversion_action
      WHERE conversion_action.status = 'ENABLED'
    `)) as ConversionActionRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      results: {
        envVars,
        apiClient: "✅ Google Ads client connected",
        gaqlQuery: `❌ Conversion action lookup failed: ${msg}`,
      },
    });
  }

  // Index rows by resource name.
  const byResourceName = new Map<string, ConversionActionRow["conversionAction"]>();
  for (const r of rows) {
    if (r.conversionAction?.resourceName) {
      byResourceName.set(r.conversionAction.resourceName, r.conversionAction);
    }
  }

  // Per-env validation — does the resource_name resolve to a real ENABLED action?
  const actionValidation: Record<string, unknown> = {};
  for (const { env, label } of TRACKED_CONVERSION_ENV_VARS) {
    const resource = process.env[env];
    if (!resource) {
      actionValidation[env] = "⏭ Skipped — env var not set";
      continue;
    }
    const action = byResourceName.get(resource);
    if (!action) {
      actionValidation[env] = {
        status: `❌ ${label}: resource not found in account (or not ENABLED)`,
        resource,
      };
    } else {
      const minDuration = action.phoneCallDurationSeconds
        ? `${action.phoneCallDurationSeconds}s`
        : "n/a";
      actionValidation[env] = {
        status: `✅ ${label} — ENABLED`,
        name: action.name,
        type: action.type,
        category: action.category,
        primary: action.primaryForGoal === true ? "PRIMARY ✓" : "Secondary",
        minPhoneCallDuration: minDuration,
      };
    }
  }

  const allEnabled = rows
    .map((r) => r.conversionAction)
    .filter(Boolean)
    .map((a) => ({
      name: a?.name,
      type: a?.type,
      primary: a?.primaryForGoal === true,
      resource: a?.resourceName,
    }));

  const hasError = Object.values({ ...envVars, ...actionValidation }).some((v) =>
    JSON.stringify(v).includes("❌"),
  );

  return NextResponse.json({
    ok: !hasError,
    results: {
      envVars,
      apiClient: "✅ Google Ads client connected",
      actionValidation,
      allEnabledConversionActionsInAccount: allEnabled,
    },
  });
}
