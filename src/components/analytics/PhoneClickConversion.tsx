"use client";

import { useEffect } from "react";

/**
 * PhoneClickConversion — fires a Google Ads "Call Click" lead conversion the
 * moment a visitor taps ANY tel: link anywhere on the site.
 *
 * Why this exists (2026-06-12):
 *   LockSafe is an emergency-locksmith dispatch service — demand is
 *   overwhelmingly phone-call driven, so a tap on the call button is the
 *   highest-volume, highest-intent action a visitor takes. Until now that tap
 *   sent NO signal to Google Ads (the landing pages are server components with
 *   plain <a href="tel:..."> links and `trackPhoneClick` was never wired up).
 *   That left MAXIMIZE_CONVERSIONS with only deep-funnel signals (a paid
 *   completed job, or a 30s+ measured call) — far too sparse for a new account
 *   to escape the cold-start phase, so it burned budget with nothing to learn
 *   from. This component supplies the missing upper-funnel signal.
 *
 * Design:
 *   - Event delegation on document → covers every tel: link on every page
 *     (server- or client-rendered) without touching each component.
 *   - Respects marketing consent (same key as the rest of our tracking).
 *   - Throttled so an accidental double-tap doesn't double-count.
 *   - Renders nothing and does nothing unless BOTH env vars are present, so it
 *     is safe to ship before the Google Ads conversion action exists.
 *
 * Required env (both NEXT_PUBLIC_*, safe to expose):
 *   NEXT_PUBLIC_GOOGLE_ADS_ID                  = "AW-XXXXXXXXXX"
 *   NEXT_PUBLIC_GOOGLE_LEAD_CONVERSION_LABEL   = "<label>" — the label of the
 *     "Call Click — Lead" conversion action created in
 *     Google Ads → Goals → Conversions → New conversion action (Manual / clicks).
 */

const CONSENT_KEY = "locksafe_cookie_consent";
const THROTTLE_MS = 2_000;

function hasMarketingConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.marketing === true;
  } catch {
    return false;
  }
}

export function PhoneClickConversion() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const leadLabel = process.env.NEXT_PUBLIC_GOOGLE_LEAD_CONVERSION_LABEL;

  useEffect(() => {
    if (!adsId || !leadLabel) return;

    let lastFired = 0;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (!link) return;
      if (!hasMarketingConsent()) return;

      const now = Date.now();
      if (now - lastFired < THROTTLE_MS) return;
      lastFired = now;

      if (typeof window.gtag === "function") {
        window.gtag("event", "conversion", {
          send_to: `${adsId}/${leadLabel}`,
          value: 50,
          currency: "GBP",
          transaction_id: `callclick_${now}_${Math.random().toString(36).slice(2, 8)}`,
        });
      }

      // Mirror into the GTM dataLayer so any server-side / Meta tags can pick
      // up the same call-intent event without extra wiring.
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "phone_click", phone_href: link.getAttribute("href") });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [adsId, leadLabel]);

  return null;
}

export default PhoneClickConversion;
