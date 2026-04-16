/**
 * Retell AI Webhook & Custom Function Signature Verification
 *
 * Uses the official retell-sdk Retell.verify() method to validate
 * the X-Retell-Signature header on incoming webhook/custom-function requests.
 *
 * See: https://docs.retellai.com/features/secure-webhook
 */

import { Retell } from "retell-sdk";

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify the X-Retell-Signature header on incoming requests.
 * Uses the official Retell SDK for reliable signature verification.
 * Works for both webhooks and custom function calls from Retell AI.
 */
export async function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<VerificationResult> {
  // Read API key at call time (not module load) so env is always fresh
  // For webhook signature verification, use the dedicated webhook secret key.
  // Falls back to RETELL_API_KEY if RETELL_WEBHOOK_SECRET is not set.
  const apiKey = process.env.RETELL_WEBHOOK_SECRET || process.env.RETELL_API_KEY || "";

  if (!apiKey) {
    console.error("[Retell Auth] Missing RETELL_WEBHOOK_SECRET / RETELL_API_KEY environment variable");
    return { valid: false, error: "Server configuration error: missing API key" };
  }

  if (!signatureHeader) {
    console.warn("[Retell Auth] No x-retell-signature header present");
    // Log debug info
    console.log("[Retell Auth] Debug: API key starts with:", apiKey.substring(0, 10) + "...");
    console.log("[Retell Auth] Debug: Body length:", rawBody.length);
    return { valid: false, error: "Missing x-retell-signature header" };
  }

  const trimmedSignature = signatureHeader.trim();

  try {
    // Use official Retell SDK verify — this is async and returns a Promise<boolean>
    const isValid = await Retell.verify(rawBody, apiKey, trimmedSignature);

    if (!isValid) {
      console.warn("[Retell Auth] Signature verification failed (SDK)");
      console.log("[Retell Auth] Debug: API key starts with:", apiKey.substring(0, 10) + "...");
      console.log("[Retell Auth] Debug: Signature starts with:", trimmedSignature.substring(0, 30) + "...");
      console.log("[Retell Auth] Debug: Body length:", rawBody.length);
      console.log("[Retell Auth] Debug: Body starts with:", rawBody.substring(0, 100) + "...");
      return { valid: false, error: "Signature mismatch" };
    }

    return { valid: true };
  } catch (err: any) {
    console.error("[Retell Auth] SDK verify threw an error:", err?.message || err);
    console.log("[Retell Auth] Debug: API key starts with:", apiKey.substring(0, 10) + "...");
    console.log("[Retell Auth] Debug: Signature:", trimmedSignature);
    console.log("[Retell Auth] Debug: Body length:", rawBody.length);
    return { valid: false, error: `Signature verification error: ${err?.message || "unknown"}` };
  }
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
