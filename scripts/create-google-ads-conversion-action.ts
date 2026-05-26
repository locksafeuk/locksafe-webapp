/**
 * Create the LockSafe Job Completed conversion action via the Google Ads
 * REST API. Skips Google's UI wizard entirely — uses the stored OAuth
 * tokens from GoogleAdsAccount.
 *
 * Run once. Prints the resource name to set as
 * GOOGLE_ADS_CONVERSION_ACTION_RESOURCE in Vercel.
 *
 * Run with:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/create-google-ads-conversion-action.ts
 */

import path from "path";
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";

// ── Spec ────────────────────────────────────────────────────────────────────
// Settings encoded in code so they're reproducible and audit-trail clear.
// Matches what the UI wizard would have set, minus the data-source gating.

const CONVERSION_NAME = "LockSafe Job Completed";
// UPLOAD_CLICKS = the type used for offline click conversions uploaded via API.
// This is the conversion type our google-ads-conversions.ts uploader fires.
const CONVERSION_TYPE = "UPLOAD_CLICKS";
const CATEGORY        = "PURCHASE";
// USE_EVENT_VALUE = "use a different value for each conversion that we record"
// (vs USE_DEFAULT_VALUE which would override every upload with default value)
const VALUE_TYPE      = "USE_EVENT_VALUE" as const;
const DEFAULT_VALUE   = 150;    // GBP fallback when an upload has no value
const CURRENCY        = "GBP";
const COUNTING_TYPE   = "ONE_PER_CLICK"; // each completed-job = one conversion
const CLICK_WINDOW_DAYS = 30;    // standard
const VIEW_WINDOW_DAYS  = 1;
const ATTRIBUTION_MODEL = "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN" as const;
// (Falls back to last-click if data-driven not yet available; Google accepts
// and auto-promotes when enough data exists.)

async function main(): Promise<void> {
  console.log("→ resolving OAuth from stored GoogleAdsAccount...");
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    throw new Error(
      "No active GoogleAdsAccount found in the database. " +
      "Make sure you've connected Google Ads OAuth in the admin UI first.",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = ctx.client as any;
  const customerId = ctx.customerId;
  console.log(`→ using customer ${customerId}`);

  // Build the ConversionAction operation. Field names mirror the v24 API
  // (https://developers.google.com/google-ads/api/reference/rpc/v24/ConversionAction).
  const operation = {
    create: {
      name:               CONVERSION_NAME,
      type:               CONVERSION_TYPE,
      category:           CATEGORY,
      status:             "ENABLED",
      countingType:       COUNTING_TYPE,
      clickThroughLookbackWindowDays: CLICK_WINDOW_DAYS,
      viewThroughLookbackWindowDays:  VIEW_WINDOW_DAYS,
      attributionModelSettings: {
        attributionModel: ATTRIBUTION_MODEL,
      },
      valueSettings: {
        defaultValue:           DEFAULT_VALUE,
        defaultCurrencyCode:    CURRENCY,
        // "Use a different value for each conversion" — DO NOT override.
        alwaysUseDefaultValue:  false,
      },
      // includeInConversionsMetric defaults to true; we want this counted in
      // the "Conversions" column of campaign reports so it shows up alongside
      // existing leads/calls but ALSO fuels bidding.
    },
  };

  console.log("→ creating conversion action...");
  // mutate(resource, operations[], options) — the helper handles the URL
  // wrapping (prepends /customers/X/, appends :mutate) and the request
  // body shape (wraps operations[] in { operations, partialFailure, validateOnly }).
  const response = await client.mutate(
    "conversionActions",
    [operation],
    { partialFailure: false, validateOnly: false },
  );

  console.log("");
  console.log("──────────────────────────────────────");
  console.log("✓ created");
  console.log("──────────────────────────────────────");
  console.log("");
  console.log("Response:", JSON.stringify(response, null, 2));

  // Extract the resource name. Response shape:
  // { results: [ { resourceName: "customers/X/conversionActions/Y" } ] }
  const resourceName =
    response?.results?.[0]?.resourceName ||
    response?.mutateOperationResponses?.[0]?.conversionActionResult?.resourceName;

  if (!resourceName) {
    console.error("Could not extract resource name from response. " +
      "Inspect the raw JSON above and pull the customers/.../conversionActions/... value manually.");
    process.exit(2);
  }

  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("RESOURCE NAME (set this as GOOGLE_ADS_CONVERSION_ACTION_RESOURCE)");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`  ${resourceName}`);
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Copy the resource name above");
  console.log("  2. Vercel → project → Settings → Environment Variables");
  console.log("  3. Add GOOGLE_ADS_CONVERSION_ACTION_RESOURCE = " + resourceName);
  console.log("     to Production, Preview, AND Development scopes");
  console.log("  4. Deployments → ••• → Redeploy (use main, no cache)");
  console.log("  5. Once redeploy is green, re-run smoketest.command");
}

main().catch((err) => {
  console.error("");
  console.error("✗ failed to create conversion action:");
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error("");
    console.error(err.stack.split("\n").slice(0, 5).join("\n"));
  }
  process.exit(1);
});
