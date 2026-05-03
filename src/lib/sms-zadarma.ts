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

function buildQueryString(params: Record<string, string>): string {
  // Zadarma signs the params in alphabetical order, joined as a regular
  // urlencoded query string (without leading "?").
  const sorted = Object.keys(params).sort();
  return sorted
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function signRequest(
  method: string,
  queryString: string,
  apiSecret: string,
): string {
  // Per Zadarma spec: signature = base64( hmac_sha1( method + queryString + md5(queryString) ) )
  const md5Body = createHash("md5").update(queryString).digest("hex");
  const payload = method + queryString + md5Body;
  return createHmac("sha1", apiSecret).update(payload).digest("base64");
}

/**
 * Make an authenticated request to a Zadarma API method.
 * Exported for diagnostic use (e.g. /v1/info/balance/).
 */
export async function zadarmaRequest<T = unknown>(
  method: string, // e.g. "/v1/sms/send/"
  params: Record<string, string> = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { userKey, apiSecret } = getCredentials();
  if (!userKey || !apiSecret) {
    return { ok: false, error: "Zadarma credentials not configured" };
  }

  const queryString = buildQueryString(params);
  const signature = signRequest(method, queryString, apiSecret);
  const url = `${ZADARMA_API_BASE}${method}${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `${userKey}:${signature}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // Body is empty — we send params via querystring (matches signature).
    });

    const data = (await response.json()) as T;
    return { ok: response.ok, data };
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
    message,
  };
  const callerId = options?.callerId ?? defaultCallerId;
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
