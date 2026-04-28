"use client";

import Script from "next/script";

// Extend Window interface for GTM dataLayer + gtag (Consent Mode v2).
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface GoogleTagManagerProps {
  gtmId?: string;
}

/**
 * Google Tag Manager loader with Consent Mode v2 deny-by-default.
 *
 * Renders two scripts that MUST execute in this order:
 *   1. `gtm-consent-default` (beforeInteractive) — sets the default consent
 *      state to denied for all non-essential storage. This MUST run before
 *      any tag (GA4/Ads/Pixel) is loaded so initial events respect consent.
 *   2. `gtm-loader` (afterInteractive) — the standard GTM container snippet.
 *
 * Render `<GTMNoScript />` separately as the first child of <body>.
 *
 * Consent is later updated by the cookie banner via:
 *   window.dataLayer.push(["consent", "update", { analytics_storage: "granted", ... }])
 */
export function GoogleTagManager({ gtmId }: GoogleTagManagerProps) {
  const id = gtmId || process.env.NEXT_PUBLIC_GTM_ID || "";
  if (!id) return null;

  return (
    <>
      <Script id="gtm-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'granted',
            personalization_storage: 'denied',
            security_storage: 'granted',
            wait_for_update: 500
          });
          gtag('set', 'url_passthrough', true);
          gtag('set', 'ads_data_redaction', true);
        `}
      </Script>
      <Script id="gtm-loader" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${id}');
        `}
      </Script>
    </>
  );
}

/**
 * NoScript iframe fallback for GTM. Render as the first child of `<body>`.
 */
export function GTMNoScript({ gtmId }: GoogleTagManagerProps) {
  const id = gtmId || process.env.NEXT_PUBLIC_GTM_ID || "";
  if (!id) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}

/**
 * Push a typed event into `window.dataLayer`. Safe to call before GTM loads —
 * GTM replays the queue once it initialises.
 */
export function pushDataLayerEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}
