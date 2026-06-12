/**
 * Vendor-audit / Data Ownership Layer — public exports.
 *
 * Three call patterns:
 *
 *   import { vendorFetch } from "@/lib/vendor-audit";
 *   await vendorFetch(url, init, { callerRoute: "lib/google-ads.ts:query" });
 *
 *   import { recordSdkCall } from "@/lib/vendor-audit";
 *   recordSdkCall("stripe", "outbound", "stripe:paymentIntents.create", { ... });
 *
 *   import { withVendorAudit } from "@/lib/vendor-audit";
 *   export const POST = withVendorAudit("stripe", async (req) => { ... });
 */

export { vendorFetch, recordSdkCall, withVendorAudit } from "./capture";
export { classifyVendor, canonicalEndpoint }          from "./classify";
export { extractIdentifiers, tryParseBody }           from "./identifiers";
export { classifyField, classifyPayload }             from "./field-catalog";
export type { VendorId, Direction, FieldCategory, VendorEventCapture } from "./types";
