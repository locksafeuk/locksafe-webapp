"use client";

import Script from "next/script";
import { SUPPORT_PHONE } from "@/lib/config";

/**
 * GoogleAdsCallTracking — gtag.js snippet that lets Google Ads measure
 * phone calls placed FROM our website (not from a call extension on the
 * ad itself).
 *
 * Wire:
 *   1. Visitor clicks a Google Ad → lands on us
 *   2. gtag.js loads and rewrites every visible occurrence of
 *      SUPPORT_PHONE to a Google forwarding number, scoped to that
 *      visitor's session
 *   3. Visitor taps the tel: link → call goes via Google's forwarding
 *      number → Google measures duration
 *   4. If duration ≥ 30 seconds → Google fires the WEBSITE_CALL
 *      conversion against the configured action
 *
 * Two env vars required (both NEXT_PUBLIC_*, safe to expose):
 *   NEXT_PUBLIC_GOOGLE_ADS_ID                  = "AW-1234567890"
 *   NEXT_PUBLIC_GOOGLE_ADS_CALL_CONVERSION_LABEL = "AbCdEfGhIjKl" (the
 *     short label from the conversion action created by
 *     /api/admin/google-ads/setup-call-conversion — the part AFTER the
 *     last slash of customers/{x}/conversionActions/{this}).
 *
 * If either env is missing the component renders nothing — safe to
 * mount unconditionally.
 *
 * This is the user-side half of the "only pay when a real call happens"
 * pattern. The other half is the AD_CALL conversion action (created on
 * the Google Ads side via setup-call-conversion). Both use the same
 * 30-second duration floor.
 */
export function GoogleAdsCallTracking() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const callLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CALL_CONVERSION_LABEL;
  if (!adsId || !callLabel) return null;

  // The conversion_id passed to gtag('config', ...) for call tracking
  // is the form AW-XXX/LABEL.
  const callTrackingTag = `${adsId}/${callLabel}`;

  return (
    <>
      <Script
        id="gtag-ads-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
      />
      <Script id="gtag-ads-call-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());

          // Configure Google Ads with phone-conversion tracking. The
          // 'phone_conversion_number' string must match the visible
          // number on the page exactly — otherwise the swap fails.
          gtag('config', '${callTrackingTag}', {
            'phone_conversion_number': '${SUPPORT_PHONE}'
          });
        `}
      </Script>
    </>
  );
}

export default GoogleAdsCallTracking;
