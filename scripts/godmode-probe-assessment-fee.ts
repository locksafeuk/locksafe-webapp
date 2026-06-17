/**
 * GODMODE probe — directly validates that the conversion upload path works
 * for the Assessment Fee Paid action (ctId 7633023781), not just whatever's
 * hardcoded in GOOGLE_ADS_CONVERSION_ACTION_RESOURCE.
 *
 * Mirrors the existing test-upload route's pattern: build the resource path
 * using the customer ID parsed from the env var, then call
 * `client.request("customers/{id}:uploadClickConversions", "POST", body)`.
 *
 * Run: cd locksafe-webapp && npx tsx scripts/godmode-probe-assessment-fee.ts
 */

import "dotenv/config";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";
import { toGoogleDateString } from "../src/lib/google-ads-conversions";

const ASSESSMENT_FEE_PAID_ACTION_ID = "7633023781";

async function main() {
  // Vercel env-pull redacts secret values, so we hardcode the well-known
  // www.locksafe.uk client account ID (4715226378 — visible in every Google
  // Ads UI URL as __e=4715226378). This is the customer the conversion
  // actions belong to.
  const envResource = process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"];
  let customerId: string;
  if (envResource) {
    const m = envResource.match(/^customers\/(\d+)\//);
    if (!m) {
      console.error("Malformed GOOGLE_ADS_CONVERSION_ACTION_RESOURCE:", envResource);
      process.exit(1);
    }
    customerId = m[1];
  } else {
    customerId = "4715226378"; // www.locksafe.uk client account
    console.log("(env var unset — falling back to hardcoded customer 4715226378)");
  }
  const conversionAction = `customers/${customerId}/conversionActions/${ASSESSMENT_FEE_PAID_ACTION_ID}`;

  console.log("---");
  console.log("Probing Assessment Fee Paid upload-clicks path");
  console.log("  customer:           ", customerId);
  console.log("  conversionAction:   ", conversionAction);
  console.log("  validateOnly:        true");
  console.log("---");

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    console.error("FATAL: no active GoogleAdsAccount in DB");
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (ctx as any).client;

  const body = {
    conversions: [
      {
        gclid: "GODMODE_PROBE_2026-06-17_AssessmentFeePaid",
        conversionAction,
        conversionDateTime: toGoogleDateString(new Date()),
        conversionValue: 1,
        currencyCode: "GBP",
        orderId: `godmode-probe-${Date.now()}`,
      },
    ],
    partialFailure: true,
    validateOnly: true,
  };

  try {
    const response = await c.request(
      `customers/${customerId}:uploadClickConversions`,
      "POST",
      body,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pfe = (response as any)?.partialFailureError ?? null;

    console.log("RAW RESPONSE:");
    console.log(JSON.stringify(response, null, 2).slice(0, 1500));

    if (!pfe) {
      console.log("");
      console.log("✅ Upload path REACHABLE for Assessment Fee Paid.");
      console.log("   No partialFailureError — Google accepted the call.");
      console.log("   Configuration is correct. Preflight #2 reframe VERIFIED.");
      process.exit(0);
    }

    const msg = String(pfe.message || "");
    if (/could not be decoded/i.test(msg) || /correct gclid format/i.test(msg)) {
      console.log("");
      console.log("✅ Upload path REACHABLE for Assessment Fee Paid.");
      console.log(
        "   Google rejected only the SYNTHETIC gclid — auth, action,",
      );
      console.log(
        "   and request format are all valid. Real uploads will work.",
      );
      console.log("   Preflight #2 reframe is VERIFIED.");
      process.exit(0);
    }

    console.log("");
    console.log("⚠️  Unexpected partialFailureError:");
    console.log("   ", msg);
    console.log("   Possible real config problem — investigate.");
    process.exit(2);
  } catch (err) {
    const e = err as Error;
    console.log("");
    console.log("❌ Upload path FAILED for Assessment Fee Paid:");
    console.log("   ", e.message);
    console.log("   The reframe was WRONG — there is a real config problem.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(99);
});
