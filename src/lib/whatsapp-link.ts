/**
 * WhatsApp click-to-chat link helpers.
 *
 * Pure utility — no React, no I/O. Used by `<WhatsAppButton>` to construct
 * `whatsapp://send?phone=<intlphone>&text=<message>` deep links.
 *
 * We prefer app-protocol deep links so desktop clicks hand off directly to the
 * installed WhatsApp app instead of opening a browser-based WhatsApp Web view.
 *
 * Outbound identity is the LockSafe WhatsApp sender (+447446588587 — the Twilio
 * number running the locksmith assistant bot + admin inbox). The link itself
 * only encodes the recipient; the admin number comes from config
 * (LOCKSMITH_ADMIN_WHATSAPP).
 */

/**
 * Normalise a phone number into the digits-only international form that
 * WhatsApp chat links expect (no `+`, no leading zero, no spaces, no punctuation).
 *
 * Rules (applied in order):
 *  1. Strip spaces and any non-digit / non-`+` characters.
 *  2. If it starts with `+` → strip it (already international).
 *  3. If it starts with `0` (UK national format):
 *     - `07` + exactly 11 digits → UK mobile, replace leading `0` with `44`.
 *     - Anything else with leading `0` → REJECT. WhatsApp deep links cannot
 *       send to UK landlines and a wrong-length `07...` (e.g. 10 digits, missing
 *       a digit) is malformed data — better to render a disabled button than
 *       produce a dead `whatsapp://` link that errors with
 *       "This link couldn't be opened."
 *  4. Otherwise (no leading 0) → keep digits as international form (e.g. `447…`
 *     for UK that's already E.164, or `1…`, `33…` for other countries).
 *
 * Returns `null` if the input is empty, whitespace, has no digits, has the wrong
 * shape (UK invalid as above), or falls outside the 7–15 digit E.164 range.
 */
export function normalisePhoneForWa(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;

  const stripped = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (!stripped) return null;

  let normalised = stripped.startsWith("+") ? stripped.slice(1) : stripped;

  // UK national format starts with 0. Only 11-digit mobiles (07…) are valid
  // for WhatsApp. Reject anything else with a leading 0 so the calling UI can
  // render a disabled button instead of producing a dead WhatsApp link.
  if (normalised.startsWith("0")) {
    if (normalised.startsWith("07") && normalised.length === 11) {
      normalised = `44${normalised.slice(1)}`;
    } else {
      return null;
    }
  }

  // Must be all digits and within E.164 length bounds.
  if (!/^\d{7,15}$/.test(normalised)) return null;

  return normalised;
}

/**
 * Build a `whatsapp://send?...` deep link with an optional pre-filled
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
  return `whatsapp://send?${query.toString()}`;
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
