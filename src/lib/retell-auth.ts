/**
 * Retell AI Webhook & Custom Function Signature Verification
 *
 * Retell sends an X-Retell-Signature header in the format:
 *   v={unix_timestamp_ms},d={hmac_sha256_hex_digest}
 *
 * The digest is HMAC-SHA256 of (rawBody + timestamp) using the Retell API Key.
 * See: https://docs.retellai.com/features/secure-webhook
 */

import crypto from "crypto";

const SIGNATURE_PATTERN = /^v=(\d+),d=(.+)$/;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify the X-Retell-Signature header on incoming requests.
 * Works for both webhooks and custom function calls from Retell AI.
 */
export function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null
): VerificationResult {
  // Read API key at call time (not module load) so env is always fresh
  const apiKey = process.env.RETELL_API_KEY || "";

  if (!apiKey) {
    console.error("[Retell Auth] Missing RETELL_API_KEY environment variable");
    return { valid: false, error: "Server configuration error: missing API key" };
  }

  if (!signatureHeader) {
    console.warn("[Retell Auth] No x-retell-signature header present");
    return { valid: false, error: "Missing x-retell-signature header" };
  }

  // Trim the header value to avoid whitespace issues
  const trimmedHeader = signatureHeader.trim();
  const match = SIGNATURE_PATTERN.exec(trimmedHeader);
  if (!match) {
    console.warn(`[Retell Auth] Invalid signature format: "${trimmedHeader}"`);
    return { valid: false, error: "Invalid signature format" };
  }

  const timestamp = match[1] ?? "0";
  const providedDigest = match[2] ?? "";
  const timestampMs = parseInt(timestamp, 10);

  // Check timestamp is within tolerance (prevents replay attacks)
  const now = Date.now();
  if (Math.abs(now - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    console.warn(
      `[Retell Auth] Signature timestamp expired. Now: ${now}, Signature: ${timestampMs}, Diff: ${Math.abs(now - timestampMs)}ms`
    );
    return { valid: false, error: "Signature timestamp expired" };
  }

  // Compute expected digest: HMAC-SHA256(rawBody + timestamp, apiKey)
  // IMPORTANT: Use the raw timestamp string from the header, not the parsed integer
  const payload = `${rawBody}${timestamp}`;
  const expectedDigest = crypto
    .createHmac("sha256", apiKey)
    .update(payload)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  try {
    const expected = Buffer.from(expectedDigest, "hex");
    const provided = Buffer.from(providedDigest, "hex");
    if (expected.length !== provided.length) {
      console.warn("[Retell Auth] Signature length mismatch");
      return { valid: false, error: "Signature mismatch" };
    }
    if (!crypto.timingSafeEqual(expected, provided)) {
      console.warn("[Retell Auth] Signature digest mismatch");
      return { valid: false, error: "Signature mismatch" };
    }
  } catch (err) {
    console.warn("[Retell Auth] Signature comparison error:", err);
    return { valid: false, error: "Signature comparison failed" };
  }

  return { valid: true };
}

export function isBlockedNumber(phone: string, blockedNumbers: string[]): boolean {
  if (!phone || !blockedNumbers?.length) return false;
  const normalized = phone?.replace(/[\s\-\(\)]/g, "") ?? "";
  return (blockedNumbers ?? []).some((blocked: string) => {
    const nb = blocked?.replace(/[\s\-\(\)]/g, "") ?? "";
    return normalized === nb || normalized?.endsWith?.(nb) || nb?.endsWith?.(normalized);
  });
}

export function getRetellHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.RETELL_API_KEY || ""}`,
  };
}

export const RETELL_ALLOWED_IP = "100.20.5.228";
