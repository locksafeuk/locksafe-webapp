"use client";

/**
 * Client-side attribution capture for booking forms.
 *
 * Returns the visitor's persistent visitorId (localStorage) plus every
 * marketing attribution value visible on the current page (URL UTMs +
 * gclid + fbclid). The job-create POST handler stamps these onto the
 * Job so the Google Ads Conversions API uploader can credit the
 * originating click when the job completes + pays.
 *
 * Use this from ANY booking form (the customer request flow, the
 * register-with-pending-request flow, future call-back forms, etc.).
 * Drops harmlessly to nulls during SSR.
 */

const VISITOR_KEY = "ls_visitor_id";

/**
 * Get-or-create the persistent visitor ID. Same key + format as
 * `useUserTracking.ts`'s getOrCreateVisitorId() so the value lines up
 * with the UserSession this visitor created on landing.
 *
 * SSR-safe: returns "" on the server.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export interface ClientAttribution {
  visitorId:    string;
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
  utmContent?:  string;
  utmTerm?:     string;
  gclid?:       string;
  fbclid?:      string;
  msclkid?:     string; // Microsoft Click ID — Bing/Yahoo/DuckDuckGo
  landingPage?: string;
}

/**
 * Collect everything the client knows about this visitor's marketing
 * provenance: visitorId from localStorage, UTM + gclid + fbclid from
 * the current URL. SSR-safe (returns empty when window is undefined).
 *
 * Server-side, the API handler falls back to looking up the visitorId's
 * latest UserSession to recover the original landing UTM — useful when
 * the visitor lands on /?gclid=… then navigates to /request before
 * submitting (the URL no longer has the gclid by then, but the session
 * captured it on landing).
 */
export function getClientAttribution(): ClientAttribution {
  if (typeof window === "undefined") return { visitorId: "" };

  const visitorId = getOrCreateVisitorId();
  const params    = new URLSearchParams(window.location.search);

  const pick = (key: string): string | undefined => {
    const v = params.get(key);
    return v && v.trim() !== "" ? v : undefined;
  };

  return {
    visitorId,
    utmSource:   pick("utm_source"),
    utmMedium:   pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmContent:  pick("utm_content"),
    utmTerm:     pick("utm_term"),
    gclid:       pick("gclid"),
    fbclid:      pick("fbclid"),
    msclkid:     pick("msclkid"),
    landingPage: window.location.pathname,
  };
}
