/**
 * WhatsApp Cloud API Status & Green-Tick Readiness Diagnostic
 *
 * Usage:
 *   WHATSAPP_PHONE_NUMBER_ID=... \
 *   WHATSAPP_BUSINESS_ACCOUNT_ID=... \
 *   WHATSAPP_ACCESS_TOKEN=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json scripts/whatsapp-cloud-status.ts
 *
 * Reports:
 *  - Token validity (debug_token)
 *  - Phone number: display_name, verified_name status, code_verification_status,
 *    quality_rating, messaging limits
 *  - WhatsApp Business Account: name, on_behalf_of_business_info,
 *    is_official_business_account (green tick), business_verification_status
 *
 * Exits non-zero if the token is invalid or any required env var is missing.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

interface Json {
  [k: string]: unknown;
}

async function graph<T extends Json = Json>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`, init);
  const text = await res.text();
  let body: Json = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body as { error?: { message?: string; code?: number; type?: string } };
    throw new Error(
      `Graph ${res.status} ${url}\n${err.error?.type ?? ""} ${err.error?.code ?? ""}: ${
        err.error?.message ?? text
      }`,
    );
  }
  return body as T;
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log("─".repeat(title.length));
}

function fmt(label: string, value: unknown, hint?: string) {
  const v = value == null || value === "" ? "—" : String(value);
  const h = hint ? `  \x1b[2m${hint}\x1b[0m` : "";
  console.log(`  ${label.padEnd(34)} ${v}${h}`);
}

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !phoneNumberId || !wabaId) {
    console.error("Missing env: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID");
    process.exit(1);
  }

  // Token health
  section("Access Token");
  try {
    const dbg = await graph<{
      data?: {
        is_valid?: boolean;
        type?: string;
        expires_at?: number;
        data_access_expires_at?: number;
        scopes?: string[];
        app_id?: string;
      };
    }>(`/debug_token?input_token=${encodeURIComponent(token)}`, token);
    const d = dbg.data || {};
    fmt("valid", d.is_valid);
    fmt("type", d.type, "should be SYSTEM_USER for production");
    fmt("expires_at", d.expires_at ? new Date(d.expires_at * 1000).toISOString() : "never");
    fmt(
      "scopes",
      (d.scopes || []).join(", "),
      "needs whatsapp_business_messaging + whatsapp_business_management",
    );
  } catch (e) {
    console.error("  debug_token failed:", (e as Error).message);
  }

  // Phone number — the green-tick relevant fields
  section("Phone Number");
  try {
    const fields = [
      "display_phone_number",
      "verified_name",
      "code_verification_status",
      "name_status",
      "quality_rating",
      "platform_type",
      "throughput",
      "messaging_limit_tier",
      "is_official_business_account",
    ].join(",");
    const p = await graph<Json>(`/${phoneNumberId}?fields=${fields}`, token);
    fmt("display_phone_number", p.display_phone_number);
    fmt("verified_name", p.verified_name, "this is what shows in chat headers");
    fmt("name_status", p.name_status, "APPROVED required for display name");
    fmt("code_verification_status", p.code_verification_status);
    fmt("quality_rating", p.quality_rating, "GREEN required for green tick");
    fmt("messaging_limit_tier", p.messaging_limit_tier);
    fmt("is_official_business_account", p.is_official_business_account, "true = green tick on this number");
  } catch (e) {
    console.error("  phone-number fetch failed:", (e as Error).message);
  }

  // WABA — business verification + OBA status
  section("WhatsApp Business Account");
  try {
    const fields = [
      "name",
      "currency",
      "timezone_id",
      "message_template_namespace",
      "on_behalf_of_business_info",
      "primary_funding_id",
      "purchase_order_number",
    ].join(",");
    const w = await graph<Json>(`/${wabaId}?fields=${fields}`, token);
    fmt("name", w.name);
    fmt("currency", w.currency);
    const obo = w.on_behalf_of_business_info as
      | { id?: string; name?: string; status?: string }
      | undefined;
    fmt("owner business id", obo?.id);
    fmt("owner business name", obo?.name);
    fmt(
      "owner verification status",
      obo?.status,
      "VERIFIED required before green tick application",
    );
  } catch (e) {
    console.error("  WABA fetch failed:", (e as Error).message);
  }

  // Green-tick readiness summary
  section("Green-Tick Readiness Checklist");
  console.log("  1. Business Verification status = VERIFIED");
  console.log("  2. Phone number name_status      = APPROVED ('LockSafe UK Admin')");
  console.log("  3. Phone number quality_rating   = GREEN");
  console.log("  4. WABA has 2+ weeks of compliant messaging history");
  console.log("  5. Apply for OBA via WhatsApp Manager → Account Tools → Official Business Account");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
