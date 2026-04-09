/**
 * Retell AI Webhook Signature Verification
 */

import crypto from "crypto";

const RETELL_API_KEY = process.env.RETELL_API_KEY || "";
const SIGNATURE_PATTERN = /v=(\d+),d=(.*)/;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null
): VerificationResult {
  if (!RETELL_API_KEY) {
    console.error("[Retell Auth] Missing RETELL_API_KEY");
    return { valid: false, error: "Server configuration error: missing API key" };
  }

  if (!signatureHeader) {
    return { valid: false, error: "Missing x-retell-signature header" };
  }

  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) {
    return { valid: false, error: "Invalid signature format" };
  }

  const timestamp = parseInt(match[1] ?? "0", 10);
  const providedDigest = match[2] ?? "";

  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: "Signature timestamp expired" };
  }

  const payload = `${rawBody}${timestamp}`;
  const expectedDigest = crypto
    .createHmac("sha256", RETELL_API_KEY)
    .update(payload)
    .digest("hex");

  try {
    const expected = Buffer.from(expectedDigest, "hex");
    const provided = Buffer.from(providedDigest, "hex");
    if (expected.length !== provided.length) {
      return { valid: false, error: "Signature mismatch" };
    }
    if (!crypto.timingSafeEqual(expected, provided)) {
      return { valid: false, error: "Signature mismatch" };
    }
  } catch {
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
    "Authorization": `Bearer ${RETELL_API_KEY}`,
  };
}

export const RETELL_ALLOWED_IP = "100.20.5.228";
