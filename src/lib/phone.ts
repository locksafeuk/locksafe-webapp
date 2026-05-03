/**
 * Shared phone-number utilities for LockSafe UK.
 * Used by both the Twilio SMS client (`src/lib/sms.ts`) and the
 * Zadarma SMS client (`src/lib/sms-zadarma.ts`).
 */

/**
 * Normalize a phone number to E.164 format.
 * Handles UK numbers (07...) and international numbers (+XX...).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove whitespace and any non-digit characters except +
  let normalized = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  if (normalized.startsWith("+")) return normalized;

  if (normalized.startsWith("07") && normalized.length === 11) {
    normalized = `+44${normalized.slice(1)}`;
  } else if (normalized.startsWith("447")) {
    normalized = `+${normalized}`;
  } else if (normalized.startsWith("0044")) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized.length >= 10 && !normalized.startsWith("0")) {
    normalized = `+${normalized}`;
  }

  return normalized;
}

/**
 * Strip the leading "+" — Zadarma's REST API expects numbers in
 * international format **without** the + prefix.
 */
export function toZadarmaNumber(phone: string): string {
  const e164 = normalizePhoneNumber(phone);
  return e164.replace(/^\+/, "");
}
