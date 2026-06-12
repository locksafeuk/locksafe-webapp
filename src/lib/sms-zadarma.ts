/**
 * Zadarma SMS client for LockSafe UK.
 *
 * Uses Zadarma's signed REST API to send SMS:
 *   POST https://api.zadarma.com/v1/sms/send/
 *
 * Auth scheme (per Zadarma docs):
 *   1. Build query string of params sorted by key.
 *   2. md5_body = md5(queryString)
 *   3. signature = base64( hmac_sha1( queryString + md5_body, API_SECRET ) )
 *   4. Header: Authorization: USER_KEY:signature
 *
 * Required env:
 *   - ZADARMA_USER_KEY
 *   - ZADARMA_API_SECRET
 *   - ZADARMA_SMS_CALLER_ID (optional sender ID — falls back to undefined)
 */

import { createHash, createHmac } from "node:crypto";
import { toZadarmaNumber } from "@/lib/phone";
import type { SMSResult } from "@/lib/sms";

const ZADARMA_API_BASE = "https://api.zadarma.com";

interface ZadarmaSendParams {
  number: string; // recipient, no +
  message: string;
  caller_id?: string; // sender ID
  language?: string;
}

interface ZadarmaResponse {
  status: "success" | "error";
  messages?: number;
  cost?: number;
  currency?: string;
  message?: string; // error description
}

function getCredentials() {
  return {
    userKey: process.env.ZADARMA_USER_KEY,
    apiSecret: process.env.ZADARMA_API_SECRET,
    callerId: process.env.ZADARMA_SMS_CALLER_ID,
  };
}

function resolveSender(callerId?: string): string | undefined {
  if (!callerId) return undefined;

  const trimmed = callerId.trim();
  if (!trimmed) return undefined;

  // "Default" should mean "let Zadarma choose account default sender".
  if (trimmed.toLowerCase() === "default") return undefined;

  return trimmed;
}

function sanitizeZadarmaMessage(message: string): string {
  // Some destinations reject SMS containing URLs for Zadarma sender routes.
  // Strip "Label: URL" patterns first to avoid dangling "Pay to confirm:", "Complete here:", etc.
  // Then strip any remaining bare URLs.
  return message
    .replace(/\b\w[^:\n]{0,33}:\s*https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildQueryString(params: Record<string, string>): string {
  // Zadarma signs the params in alphabetical order, joined as a regular
  // urlencoded query string (without leading "?").
  // Must match PHP_QUERY_RFC1738 semantics from Zadarma docs.
  const sorted = Object.keys(params).sort();
  const searchParams = new URLSearchParams();
  for (const key of sorted) {
    searchParams.append(key, params[key]);
  }
  // Match Zadarma official TS client behavior.
  return searchParams.toString().replace(/%20/g, "+");
}

function signRequest(
  method: string,
  queryString: string,
  apiSecret: string,
): string {
  // Match official zadarma/user-api-typescript client behavior:
  // base64(hex(hmac_sha1(method + query + md5(query), secret)))
  const md5Body = createHash("md5").update(queryString).digest("hex");
  const payload = method + queryString + md5Body;
  const sha1Hex = createHmac("sha1", apiSecret).update(payload).digest("hex");
  return Buffer.from(sha1Hex).toString("base64");
}

/**
 * Make an authenticated request to a Zadarma API method.
 * Exported for diagnostic use (e.g. /v1/info/balance/).
 */
export async function zadarmaRequest<T = unknown>(
  method: string, // e.g. "/v1/sms/send/"
  params: Record<string, string> = {},
): Promise<{ ok: boolean; data?: T; error?: string; statusCode?: number }> {
  const { userKey, apiSecret } = getCredentials();
  if (!userKey || !apiSecret) {
    return { ok: false, error: "Zadarma credentials not configured" };
  }

  const paramsWithFormat = {
    ...params,
    format: "json",
  };

  const queryString = buildQueryString(paramsWithFormat);
  const signature = signRequest(method, queryString, apiSecret);
  const url = `${ZADARMA_API_BASE}${method}`;

  try {
    // Data Ownership Layer: route Zadarma calls through vendorFetch.
    const _vf: typeof fetch = await (async () => {
      try { return (await import("@/lib/vendor-audit")).vendorFetch as unknown as typeof fetch; }
      catch { return fetch; }
    })();
    const response = await (_vf as (u: string, i?: RequestInit, o?: unknown) => Promise<Response>)(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `${userKey}:${signature}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: queryString,
      },
      { vendor: "zadarma", callerRoute: "lib/sms-zadarma.ts:callZadarma" },
    );

    const raw = await response.text();
    let data: T | undefined;

    try {
      data = JSON.parse(raw) as T;
    } catch {
      data = undefined;
    }

    if (!response.ok) {
      const apiMessage =
        typeof data === "object" && data !== null && "message" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).message)
          : raw.slice(0, 500);

      return {
        ok: false,
        data,
        statusCode: response.status,
        error: `HTTP ${response.status}${apiMessage ? `: ${apiMessage}` : ""}`,
      };
    }

    return { ok: true, data, statusCode: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an SMS via Zadarma.
 *
 * NOTE: Zadarma's REST API expects the destination number in international
 * format **without** the leading "+".
 */
export async function sendZadarmaSMS(
  to: string,
  message: string,
  options?: { callerId?: string; logContext?: string },
): Promise<SMSResult> {
  const { userKey, apiSecret, callerId: defaultCallerId } = getCredentials();

  if (!userKey || !apiSecret) {
    console.warn("[Zadarma SMS] Not configured - SMS not sent");
    return { success: false, error: "Zadarma not configured" };
  }

  const number = toZadarmaNumber(to);
  if (!number) {
    return { success: false, error: "Invalid recipient phone number" };
  }

  const params: ZadarmaSendParams = {
    number,
    message: sanitizeZadarmaMessage(message),
  };
  const callerId = resolveSender(options?.callerId ?? defaultCallerId);
  if (callerId) params.caller_id = callerId;

  const result = await zadarmaRequest<ZadarmaResponse>(
    "/v1/sms/send/",
    params as unknown as Record<string, string>,
  );

  const ctx = options?.logContext ? ` [${options.logContext}]` : "";

  if (!result.ok || !result.data) {
    console.error(`[Zadarma SMS]${ctx} HTTP error:`, result.error);
    return { success: false, error: result.error || "Zadarma request failed" };
  }

  if (result.data.status !== "success") {
    console.error(
      `[Zadarma SMS]${ctx} API error:`,
      result.data.message,
      "to=",
      number,
    );
    return {
      success: false,
      error: result.data.message || "Zadarma API error",
    };
  }

  console.log(
    `[Zadarma SMS]${ctx} sent to=${number} segments=${result.data.messages ?? "?"} cost=${result.data.cost ?? "?"}${result.data.currency ?? ""}`,
  );

  return { success: true };
}
