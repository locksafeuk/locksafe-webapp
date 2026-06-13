/**
 * URL → VendorId classifier. Used by the universal vendorFetch wrapper
 * so callers don't have to pass the vendor id explicitly — we infer it
 * from the request hostname. Falls back to "other" when unknown.
 */

import type { VendorId } from "./types";

const HOST_PATTERNS: Array<[RegExp, VendorId]> = [
  [/\bgoogleads\.googleapis\.com$/i,           "google-ads"],
  [/\boauth2\.googleapis\.com$/i,              "google-oauth"],
  [/\boauth\.googleapis\.com$/i,               "google-oauth"],
  [/\baccounts\.google\.com$/i,                "google-oauth"],
  [/\bgoogle-analytics\.com$/i,                "google-ga4"],
  [/\bgooglesyndication\.com$/i,               "google-ga4"],
  [/\banalyticsadmin\.googleapis\.com$/i,      "google-ga4"],
  [/\bsearchconsole\.googleapis\.com$/i,       "google-search-console"],
  [/\bshoppingcontent\.googleapis\.com$/i,     "google-merchant"],
  [/\bgraph\.facebook\.com$/i,                 "meta"],
  [/\bgraph-video\.facebook\.com$/i,           "meta"],
  [/\bbusiness\.facebook\.com$/i,              "meta"],
  [/\bbingads\.microsoft\.com$/i,              "microsoft-ads"],
  [/\bads\.microsoft\.com$/i,                  "microsoft-ads"],
  [/\b(?:[a-z]+\.)?api\.ads\.microsoft\.com$/i,"microsoft-ads"],
  [/\bbat\.bing\.com$/i,                       "microsoft-ads"],
  [/\bclarity\.ms$/i,                          "microsoft-clarity"],
  [/\bwww\.clarity\.ms$/i,                     "microsoft-clarity"],
  [/\bssl\.bing\.com$/i,                       "bing-webmaster"],
  [/\bwww\.bing\.com\/webmasters/i,            "bing-webmaster"],
  [/\bapi\.stripe\.com$/i,                     "stripe"],
  [/\bfiles\.stripe\.com$/i,                   "stripe"],
  [/\bapi\.resend\.com$/i,                     "resend"],
  [/\bapi\.twilio\.com$/i,                     "twilio"],
  [/\bapi\.zadarma\.com$/i,                    "zadarma"],
  [/\bapi\.retellai\.com$/i,                   "retell"],
  [/\bapi\.mapbox\.com$/i,                     "mapbox"],
  [/\bapi\.openai\.com$/i,                     "openai"],
  [/\blocalhost(?::\d+)?$/i,                   "ollama"],
  [/\b127\.0\.0\.1(?::\d+)?$/i,                "ollama"],
  [/\bapi\.telegram\.org$/i,                   "telegram"],
  [/\bvercel-storage\.com$/i,                  "vercel-blob"],
  [/\bblob\.vercel-storage\.com$/i,            "vercel-blob"],
];

export function classifyVendor(url: string | URL): VendorId {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const host = u.hostname;
    for (const [pattern, vendor] of HOST_PATTERNS) {
      if (pattern.test(host)) return vendor;
    }
    return "other";
  } catch {
    return "other";
  }
}

/**
 * Canonicalise an endpoint identifier — strip querystring, mask numeric
 * IDs in the path so similar requests group together in the dashboard.
 * `/v24/customers/1234567890/googleAds:search` → `/v24/customers/{id}/googleAds:search`
 */
export function canonicalEndpoint(url: string | URL): string {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const path = u.pathname
      .replace(/\/\d{6,}/g, "/{id}")
      .replace(/\/[a-f0-9]{24}/gi, "/{oid}")
      .replace(/\/cus_[A-Za-z0-9]+/g, "/cus_{id}")
      .replace(/\/pi_[A-Za-z0-9]+/g, "/pi_{id}")
      .replace(/\/evt_[A-Za-z0-9]+/g, "/evt_{id}");
    return `${u.hostname}${path}`;
  } catch {
    return String(url);
  }
}
