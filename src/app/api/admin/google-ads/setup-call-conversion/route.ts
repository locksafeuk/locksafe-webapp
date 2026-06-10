/**
 * POST /api/admin/google-ads/setup-call-conversion
 *
 * One-time setup: create the call conversion actions in Google Ads.
 *
 * Creates two conversion actions:
 *   1. "LockSafe Phone Call Lead (30s+)" — type AD_CALL,
 *      category PHONE_CALL_LEAD, min duration 30 seconds.
 *      Fires when someone clicks the call button on a Google Ads call
 *      extension and stays on the line ≥30s (Google measures natively
 *      via their forwarding number).
 *
 *   2. "LockSafe Website Call (30s+)" — type WEBSITE_CALL,
 *      category PHONE_CALL_LEAD, min duration 30 seconds.
 *      Fires when someone lands on our site from an ad and taps the
 *      tel: link, IF gtag is loaded with phone_conversion_number. Needs
 *      the gtag snippet on landing pages (deployed separately).
 *
 * The 30-second floor stops Google from counting accidental misclicks,
 * pocket dials, or instant hang-ups as "leads". Calls under 30s = no
 * conversion = no bid signal in that direction. This is the closest
 * thing Google Ads offers to "only pay when a real call happens".
 *
 * Idempotent on the API side — Google rejects duplicate names per
 * customer, so re-running returns the existing resource. We also check
 * before creating.
 *
 * Auth: admin JWT cookie.
 *
 * Response (success):
 *   {
 *     created: { adCall, websiteCall },
 *     envInstructions: [...],
 *     primaryConversionAdvice: "..."
 *   }
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

const AD_CALL_NAME = "LockSafe Phone Call Lead (30s+)";
const WEBSITE_CALL_NAME = "LockSafe Website Call (30s+)";
const MIN_DURATION_SECONDS = 30;
const DEFAULT_VALUE = 50; // GBP — proxy value for a real 30s+ call
const CURRENCY = "GBP";

interface CreatedAction {
  resourceName: string;
  name: string;
  type: string;
  phoneCallDurationSeconds: number;
  alreadyExisted: boolean;
}

async function findExistingByName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  name: string,
): Promise<string | null> {
  const rows = await client.query(`
    SELECT conversion_action.resource_name, conversion_action.name
    FROM conversion_action
    WHERE conversion_action.status = 'ENABLED'
  `);
  for (const r of rows) {
    if (r.conversionAction?.name === name) {
      return r.conversionAction.resourceName as string;
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createOrFind(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  spec: {
    name: string;
    type: "AD_CALL" | "WEBSITE_CALL";
  },
): Promise<CreatedAction> {
  const existing = await findExistingByName(client, spec.name);
  if (existing) {
    return {
      resourceName: existing,
      name: spec.name,
      type: spec.type,
      phoneCallDurationSeconds: MIN_DURATION_SECONDS,
      alreadyExisted: true,
    };
  }

  const operation = {
    create: {
      name: spec.name,
      type: spec.type,
      category: "PHONE_CALL_LEAD",
      status: "ENABLED",
      countingType: "ONE_PER_CLICK",
      clickThroughLookbackWindowDays: 30,
      // viewThroughLookbackWindowDays — INTENTIONALLY OMITTED.
      // PHONE_CALL_LEAD category rejects this field (VALUE_MUST_BE_UNSET)
      // because phone calls have no "view-through" equivalent. Setting it
      // for UPLOAD_CLICKS / PURCHASE is allowed; setting it here is not.
      //
      // The 30-second floor. Calls under this don't count as conversions
      // and therefore don't influence Google's auction bidding.
      phoneCallDurationSeconds: MIN_DURATION_SECONDS,
      attributionModelSettings: {
        attributionModel: "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN",
      },
      valueSettings: {
        defaultValue: DEFAULT_VALUE,
        defaultCurrencyCode: CURRENCY,
        alwaysUseDefaultValue: true, // call leads all worth the same proxy value
      },
      includeInConversionsMetric: true,
    },
  };

  const response = await client.mutate("conversionActions", [operation], {
    partialFailure: false,
    validateOnly: false,
  });

  const resourceName =
    response?.results?.[0]?.resourceName ||
    response?.mutateOperationResponses?.[0]?.conversionActionResult?.resourceName;

  if (!resourceName) {
    throw new Error(`Could not extract resourceName from response: ${JSON.stringify(response)}`);
  }

  return {
    resourceName,
    name: spec.name,
    type: spec.type,
    phoneCallDurationSeconds: MIN_DURATION_SECONDS,
    alreadyExisted: false,
  };
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return NextResponse.json({ error: "No active GoogleAdsAccount" }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  try {
    const adCall = await createOrFind(client, {
      name: AD_CALL_NAME,
      type: "AD_CALL",
    });
    const websiteCall = await createOrFind(client, {
      name: WEBSITE_CALL_NAME,
      type: "WEBSITE_CALL",
    });

    return NextResponse.json({
      success: true,
      created: { adCall, websiteCall },
      envInstructions: [
        `Set GOOGLE_ADS_AD_CALL_CONVERSION_ACTION_RESOURCE = ${adCall.resourceName}`,
        `Set GOOGLE_ADS_WEBSITE_CALL_CONVERSION_ACTION_RESOURCE = ${websiteCall.resourceName}`,
      ],
      primaryConversionAdvice:
        "In Google Ads UI → Goals → Conversions → set both new actions as PRIMARY for the account. " +
        "Demote the broken UPLOAD_CLICKS action to secondary until gclid plumbing is fixed.",
      gtagSnippet: {
        forWebsiteCall: websiteCall.resourceName.split("/").slice(-1)[0],
        note:
          "Use the WEBSITE_CALL conversion label in the gtag config_phone snippet on landing pages.",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Setup failed", details: message },
      { status: 500 },
    );
  }
}
