/**
 * Extract well-known cross-platform identifiers from request/response
 * payloads. These power the dashboard's "did we send gclid=X to vendor
 * Y today?" lookup.
 *
 * Conservative — only pulls fields we know are identifiers. Unknown
 * fields are ignored; the field catalog handles classification.
 */

const ID_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "fbp",
  "fbc",
  "msclkid",        // Microsoft Click ID — Bing/Yahoo/DuckDuckGo offline conversions
  "muid",           // Microsoft Universal ID (UET cookie)
  "_uetsid",
  "_uetvid",
  "ga_client_id",
  "client_id",
  "user_id",
  "external_id",
  "lead_id",
  "stripeCustomerId",
  "stripe_customer_id",
  "customer_id",
  "customer",
  "payment_intent",
  "session_id",
  "event_id",
  "msg_id",
  "message_id",
  "transcription_id",
  "call_id",
  "ad_id",
  "campaign_id",
  "adset_id",
  "ad_account_id",
  "visitorId",
  "visitor_id",
] as const;

const ID_KEY_SET = new Set(ID_KEYS.map((k) => k.toLowerCase()));

/**
 * Walk an object (up to maxDepth) and pluck values for any key in the
 * identifier list. Stops at the first match per key to keep results
 * small.
 */
export function extractIdentifiers(
  payload: unknown,
  maxDepth = 5,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (payload == null) return out;

  const walk = (node: unknown, depth: number): void => {
    if (depth > maxDepth || node == null) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 20)) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      if (ID_KEY_SET.has(lk) && !(k in out)) {
        if (typeof v === "string" && v.length > 0 && v.length < 200) {
          out[k] = v;
        } else if (typeof v === "number") {
          out[k] = String(v);
        }
      }
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };

  walk(payload, 0);
  return out;
}

/**
 * Best-effort parse of a request/response body string into JSON, falling
 * back to URL-encoded forms (common for ad-platform conversion APIs).
 */
export function tryParseBody(body: string | null | undefined): unknown {
  if (!body) return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  if (trimmed.includes("=") && trimmed.includes("&")) {
    try {
      const params = new URLSearchParams(trimmed);
      return Object.fromEntries(params.entries());
    } catch { /* ignore */ }
  }
  return null;
}
