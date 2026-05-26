"use client";

/**
 * Click-to-Call attribution helper for the website's Call CTA.
 *
 * The visitor clicks a Call button → this helper fires a CallIntent
 * POST (capturing visitorId + gclid + UTMs) → tel: opens. When the
 * inbound call reaches Retell, the matcher in
 * `src/lib/marketing/call-intent-matcher.ts` ties it back to this
 * intent so the eventual paid job credits the right Google Ads click.
 *
 * USAGE
 * ─────
 *   import { trackAndCall } from "@/lib/marketing/click-to-call";
 *
 *   <button onClick={() => trackAndCall("+442045771989", "hero-cta")}>
 *     Call Now
 *   </button>
 *
 * OR for a plain anchor:
 *
 *   <a href="tel:+442045771989"
 *      onClick={(e) => trackAndCall("+442045771989", "footer-link", e)}>
 *     +44 20 4577 1989
 *   </a>
 *
 * The helper uses `navigator.sendBeacon` when available — that's the
 * one API designed to survive the page navigating away (which is
 * exactly what happens when the OS hands off to the dialler app on
 * mobile). Falls back to a fire-and-forget fetch otherwise.
 *
 * Never throws — a tracking failure must not block the dial.
 */

import {
  getClientAttribution,
  type ClientAttribution,
} from "@/lib/marketing/client-attribution";

const ENDPOINT = "/api/marketing/call-intent";

export interface CallIntentPayload extends ClientAttribution {
  source:    string;
  buttonId?: string;
  pagePath?: string;
}

/**
 * Send a CallIntent payload to the API. Uses sendBeacon when
 * available (more reliable across page navigation) and falls back to
 * keepalive fetch otherwise.
 *
 * Returns immediately — the caller should not await the result before
 * dialling. Errors are swallowed silently (logged in dev only).
 */
export function sendCallIntent(payload: CallIntentPayload): void {
  if (typeof window === "undefined") return;

  const json = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
      // sendBeacon returned false (queue full or browser refused) — try fetch.
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[click-to-call] sendBeacon failed:", err);
    }
  }

  // Fallback: keepalive fetch. keepalive=true lets the request finish
  // even if the page is unloading (within a 64KB cap, which is fine
  // for our small JSON payload).
  try {
    fetch(ENDPOINT, {
      method:    "POST",
      headers:   { "content-type": "application/json" },
      body:      json,
      keepalive: true,
    }).catch(() => { /* swallow */ });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[click-to-call] fetch fallback failed:", err);
    }
  }
}

/**
 * Build the CallIntent payload from the current client state, then
 * fire it. Returns the payload it sent (useful for tests + telemetry
 * — does NOT block).
 */
export function recordCallIntent(
  buttonId?: string,
  source:    string = "website_call_button",
): CallIntentPayload {
  const attribution = getClientAttribution();
  const payload: CallIntentPayload = {
    ...attribution,
    source,
    buttonId,
    pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
  sendCallIntent(payload);
  return payload;
}

/**
 * One-call helper: record the intent, then open the dialler.
 *
 * If an event is passed (e.g. anchor onClick), we do NOT
 * preventDefault — the browser's native tel: handling is left alone.
 * We just slip the intent POST in alongside.
 *
 * If no event is passed (called from a <button>), we set
 * window.location.href to the tel: URL after firing the beacon.
 */
export function trackAndCall(
  phoneE164: string,
  buttonId?: string,
  event?:    { preventDefault?: () => void } | null,
): void {
  recordCallIntent(buttonId);

  if (event) {
    // Anchor onClick path — the browser handles tel: natively after
    // this returns. We've already fired the beacon synchronously.
    return;
  }

  // Button path — open the dialler ourselves. Routed through
  // _internal.openDialer so tests can spy on it; jsdom's
  // window.location.assign is read-only and not spy-able directly.
  if (typeof window !== "undefined") {
    _internal.openDialer(phoneE164);
  }
}

/**
 * @internal Indirection layer so tests can mock the dialler call.
 * Re-exported as an object whose properties ARE replaceable
 * (Location.assign in jsdom is not — it's read-only on the prototype).
 *
 * Production code goes through here too — no extra runtime cost.
 */
export const _internal = {
  openDialer(phoneE164: string): void {
    if (typeof window !== "undefined") {
      window.location.assign(`tel:${phoneE164}`);
    }
  },
};
