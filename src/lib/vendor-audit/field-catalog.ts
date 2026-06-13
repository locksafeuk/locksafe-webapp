/**
 * Field catalog — maps known field names to a FieldCategory.
 *
 * Used by capture.ts to annotate every VendorEvent with the *kind* of
 * data we shared with (or received from) the vendor, beyond just byte
 * counts. The Sankey field-flow view in /admin/data-ownership reads
 * these annotations to answer "which categories of data are we sending
 * to Google vs Meta vs Stripe?"
 *
 * Lookup is case-insensitive, with an optional per-vendor override
 * table for fields that mean different things on different APIs (e.g.
 * `user_id` is a generic identifier, but Meta's `em` is hashed PII).
 *
 * Anything not in the catalog defaults to "other" — which is itself a
 * signal worth surfacing (it means "we're sending the vendor something
 * we haven't classified yet").
 */

import type { FieldCategory, VendorId } from "./types";

// ── Generic field-name → category mapping ─────────────────────────────
// Lowercase keys; capture.ts lowercases incoming field names before
// looking them up.
const GENERIC_FIELDS: Record<string, FieldCategory> = {
  // PII — directly identifies a person
  email:           "PII",
  emailaddress:    "PII",
  phone:           "PII",
  phonenumber:     "PII",
  mobile:          "PII",
  name:            "PII",
  firstname:       "PII",
  lastname:        "PII",
  fullname:        "PII",
  address:         "PII",
  addressline1:    "PII",
  addressline2:    "PII",
  ip:              "PII",
  ipaddress:       "PII",
  client_ip_address: "PII",
  client_user_agent: "PII",
  useragent:       "PII",
  user_agent:      "PII",
  passwordhash:    "PII",
  password:        "PII",
  dob:             "PII",
  dateofbirth:     "PII",
  // Hashed PII (still PII for our purposes — vendor can correlate)
  em:              "PII",
  ph:              "PII",
  fn:              "PII",
  ln:              "PII",
  ge:              "PII",
  zp:              "PII",

  // Identifier — links to a person/session but isn't directly PII
  gclid:           "identifier",
  gbraid:          "identifier",
  wbraid:          "identifier",
  fbclid:          "identifier",
  fbp:             "identifier",
  fbc:             "identifier",
  msclkid:         "identifier",
  muid:            "identifier",
  _uetsid:         "identifier",
  _uetvid:         "identifier",
  ga_client_id:    "identifier",
  client_id:       "identifier",
  user_id:         "identifier",
  external_id:     "identifier",
  customer:        "identifier",
  customer_id:     "identifier",
  customerid:      "identifier",
  visitorid:       "identifier",
  visitor_id:      "identifier",
  session_id:      "identifier",
  sessionid:       "identifier",
  event_id:        "identifier",
  msg_id:          "identifier",
  message_id:      "identifier",
  msid:            "identifier",
  campaign_id:     "identifier",
  ad_id:           "identifier",
  adset_id:        "identifier",
  ad_account_id:   "identifier",
  payment_intent:  "identifier",
  payment_method:  "identifier",
  source:          "identifier",
  utm_source:      "identifier",
  utm_medium:      "identifier",
  utm_campaign:    "identifier",
  utm_content:     "identifier",
  utm_term:        "identifier",
  call_id:         "identifier",
  jobid:           "identifier",
  job_id:          "identifier",
  jobnumber:       "identifier",

  // Monetary
  amount:          "monetary",
  amount_total:    "monetary",
  amounttotal:     "monetary",
  amount_received: "monetary",
  amount_due:      "monetary",
  amount_refunded: "monetary",
  value:           "monetary",
  price:           "monetary",
  total:           "monetary",
  subtotal:        "monetary",
  fee:             "monetary",
  fees:            "monetary",
  payout:          "monetary",
  balance:         "monetary",
  cost:            "monetary",
  spend:           "monetary",
  cpc:             "monetary",
  bid:             "monetary",
  budget:          "monetary",
  currency:        "monetary",

  // Geo
  lat:             "geo",
  latitude:        "geo",
  lng:             "geo",
  lon:             "geo",
  longitude:       "geo",
  postcode:        "geo",
  postal_code:     "geo",
  postalcode:      "geo",
  zip:             "geo",
  zip_code:        "geo",
  city:            "geo",
  region:          "geo",
  state:           "geo",
  country:         "geo",
  country_code:    "geo",
  locale:          "geo",

  // Behavioral — actions, intent signals, user-driven events
  event_name:      "behavioral",
  event_type:      "behavioral",
  action:          "behavioral",
  action_source:   "behavioral",
  status:          "behavioral",
  type:            "behavioral",
  page:            "behavioral",
  pageview:        "behavioral",
  scroll:          "behavioral",
  scrolldepth:     "behavioral",
  dwell:           "behavioral",
  dwelltime:       "behavioral",
  button:          "behavioral",
  buttontext:      "behavioral",
  buttonpayload:   "behavioral",
  body:            "behavioral",
  content_ids:     "behavioral",
  content_type:    "behavioral",
  content_name:    "behavioral",
  search_string:   "behavioral",
  call_status:     "behavioral",
  message_status:  "behavioral",

  // Aggregate — pre-computed metrics with no per-user attribution
  count:           "aggregate",
  total_count:     "aggregate",
  conversions:     "aggregate",
  impressions:     "aggregate",
  clicks:          "aggregate",
  ctr:             "aggregate",
  cpa:             "aggregate",
  roas:            "aggregate",
  reach:           "aggregate",
  frequency:       "aggregate",
};

// ── Per-vendor overrides ──────────────────────────────────────────────
// e.g. Stripe's `customer` is the customer object, not a generic id.
const VENDOR_OVERRIDES: Partial<Record<VendorId, Record<string, FieldCategory>>> = {
  stripe: {
    receipt_email:  "PII",
    billing_email:  "PII",
    name:           "PII",
    statement_descriptor: "behavioral",
    description:    "behavioral",
  },
  meta: {
    em:             "PII", // hashed email
    ph:             "PII", // hashed phone
    external_id:    "identifier",
  },
  "google-ads": {
    conversion_value: "monetary",
    user_identifiers: "PII",
    hashed_email:    "PII",
    hashed_phone_number: "PII",
  },
  "microsoft-ads": {
    // Microsoft Offline Conversions API + UET tag — hashed PII matchers.
    HashedEmail:          "PII",
    HashedPhone:          "PII",
    MicrosoftClickId:     "identifier",
    ConversionValue:      "monetary",
    ConversionCurrencyCode: "monetary",
  },
};

/** Look up a single field's category, case-insensitive, with vendor overrides. */
export function classifyField(name: string, vendor?: VendorId): FieldCategory {
  const lower = name.toLowerCase();
  if (vendor && VENDOR_OVERRIDES[vendor]?.[lower]) return VENDOR_OVERRIDES[vendor]![lower];
  return GENERIC_FIELDS[lower] ?? "other";
}

/**
 * Walk a payload (up to maxDepth) and build a {fieldName: category} map
 * of every leaf field we see. De-dupes by name — only the first
 * encounter wins. Returns null for empty/non-object payloads.
 */
export function classifyPayload(
  payload: unknown,
  vendor?: VendorId,
  maxDepth = 6,
): Record<string, FieldCategory> | null {
  if (payload == null || typeof payload !== "object") return null;
  const out: Record<string, FieldCategory> = {};

  const walk = (node: unknown, depth: number): void => {
    if (depth > maxDepth || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 50)) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!(k in out)) out[k] = classifyField(k, vendor);
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };

  walk(payload, 0);
  return Object.keys(out).length > 0 ? out : null;
}
