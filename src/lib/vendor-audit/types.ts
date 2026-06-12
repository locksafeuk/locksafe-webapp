/**
 * Vendor-audit types — shared across capture, classify, store, and the
 * admin dashboard. Keep this small; it's imported all over the place.
 */

export type VendorId =
  | "google-ads"
  | "google-ga4"
  | "google-oauth"
  | "google-search-console"
  | "google-merchant"
  | "meta"
  | "stripe"
  | "resend"
  | "twilio"
  | "zadarma"
  | "retell"
  | "mapbox"
  | "openai"
  | "ollama"
  | "telegram"
  | "vercel-blob"
  | "other";

export type Direction = "outbound" | "inbound";

export type FieldCategory =
  | "PII"          // email, phone, name, address
  | "behavioral"   // pageviews, clicks, dwell, scroll
  | "aggregate"    // counts, sums, no per-user attribution
  | "identifier"   // gclid, fbclid, ga_client_id, fbp, stripe_customer_id
  | "monetary"     // amounts, currencies, prices
  | "geo"          // postcode, lat/lng, city
  | "other";

export interface VendorEventCapture {
  vendor:        VendorId;
  direction:     Direction;
  endpoint:      string;   // canonical endpoint path (no querystring)
  method:        string;
  status?:       number;
  requestBytes?: number;
  responseBytes?: number;
  latencyMs?:    number;

  fieldsShared?:        Record<string, FieldCategory>;
  fieldsReceived?:      Record<string, FieldCategory>;
  identifiersShared?:   Record<string, string>;
  identifiersReceived?: Record<string, string>;

  requestSample?:  string;
  responseSample?: string;

  callerRoute?: string;
  jobId?:       string;
  customerId?:  string;
  errorMessage?: string;
}
