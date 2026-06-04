/**
 * WhatsApp click-to-chat link helpers.
 *
 * Pure utility — no React, no I/O. Used by `<WhatsAppButton>` to construct
 * `https://web.whatsapp.com/send?phone=<intlphone>&text=<message>` URLs.
 *
 * We prefer explicit WhatsApp Web URLs for admin flows so clicks stay in the
 * browser session that is logged into the LockSafe Business account.
 *
 * Outbound identity is the LockSafe business number (+447818333989), enforced
 * operationally by the admin device being logged into WhatsApp Business
 * with that number. The link itself only encodes the recipient.
 */

/**
 * Normalise a phone number into the digits-only international form that
 * WhatsApp chat links expect (no `+`, no leading zero, no spaces, no punctuation).
 *
 * Rules (applied in order):
 *  1. Strip spaces and any non-digit / non-`+` characters.
 *  2. If it starts with `+` → strip it (already international).
 *  3. If it starts with `07` and is 11 digits → UK mobile, replace leading `0` with `44`.
 *  4. If it starts with `44` → already international UK.
 *  5. Otherwise → return as-is (digits only) so non-UK numbers still work
 *     when stored in international format without the `+`.
 *
 * Returns `null` if the input is empty, whitespace, or contains no digits.
 */
export function normalisePhoneForWa(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;

  const stripped = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (!stripped) return null;

  let normalised = stripped.startsWith("+") ? stripped.slice(1) : stripped;

  if (normalised.startsWith("07") && normalised.length === 11) {
    normalised = `44${normalised.slice(1)}`;
  }

  // Must be all digits and at least an E.164-ish length (min 7).
  if (!/^\d{7,15}$/.test(normalised)) return null;

  return normalised;
}

/**
 * Build a `https://web.whatsapp.com/send?...` URL with an optional pre-filled
 * message.
 * Returns `null` if the phone cannot be normalised.
 */
export function buildWhatsAppWebUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const normalised = normalisePhoneForWa(phone);
  if (!normalised) return null;

  const query = new URLSearchParams({ phone: normalised });
  if (message) query.set("text", message);

  return `https://web.whatsapp.com/send?${query.toString()}`;
}

/**
 * Backward-compatible alias used by existing callsites.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  return buildWhatsAppWebUrl(phone, message);
}
