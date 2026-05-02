"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

// Extend Window interface for Facebook Pixel
declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom" | "trackSingle" | "trackSingleCustom" | "consent",
      eventNameOrPixelId: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
    _fbq?: typeof window.fbq;
  }
}

interface MetaPixelProps {
  pixelId: string;
}

// Standard Meta Pixel events
export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "AddToWishlist"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Lead"
  | "CompleteRegistration"
  | "Contact"
  | "CustomizeProduct"
  | "Donate"
  | "FindLocation"
  | "Schedule"
  | "StartTrial"
  | "SubmitApplication"
  | "Subscribe";

// Custom events for LockSafe
export type LockSafeCustomEvent =
  | "FormStarted"
  | "FormAbandoned"
  | "PostcodeEntered"
  | "QuoteReceived"
  | "QuoteAccepted"
  | "QuoteDeclined"
  | "AssessmentPaid"
  | "JobCompleted"
  | "JobCancelled"
  | "LocksmithApplied"
  | "LocksmithSignup"
  | "ReviewSubmitted"
  | "ExitIntentShown"
  | "LeadMagnetDownload";

const COOKIE_CONSENT_KEY = "locksafe_cookie_consent";

function readMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw).marketing === true;
  } catch {
    return false;
  }
}

function MetaPixelInner({ pixelId }: MetaPixelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Read initial consent + subscribe to changes from CookieConsent banner.
  useEffect(() => {
    setMarketingConsent(readMarketingConsent());

    const onConsentChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ marketing?: boolean }>).detail;
      const granted = !!detail?.marketing;
      setMarketingConsent(granted);
      // If user revokes after grant, tell Meta to stop persisting cookies.
      if (!granted && typeof window !== "undefined" && window.fbq) {
        window.fbq("consent", "revoke");
      }
    };

    window.addEventListener("locksafe:consent-changed", onConsentChanged);
    return () => {
      window.removeEventListener("locksafe:consent-changed", onConsentChanged);
    };
  }, []);

  // Track page views on route change (only after consent + pixel loaded).
  useEffect(() => {
    if (!marketingConsent) return;
    if (typeof window !== "undefined" && window.fbq && pixelId) {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams, pixelId, marketingConsent]);

  // Don't render in development, without a pixel ID, or before consent.
  if (!pixelId || process.env.NODE_ENV !== "production" || !marketingConsent) {
    return null;
  }

  return (
    <>
      {/* Meta Pixel Base Code */}
      <Script id="meta-pixel-init" strategy="lazyOnload">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      {/* NoScript fallback */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  return (
    <Suspense fallback={null}>
      <MetaPixelInner pixelId={pixelId} />
    </Suspense>
  );
}

// Hook for tracking Meta Pixel events
export function useMetaPixel() {
  const generateEventId = () => {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  };

  const trackStandard = (
    eventName: MetaStandardEvent,
    params?: Record<string, unknown>,
    eventId?: string
  ) => {
    const id = eventId || generateEventId();
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", eventName, params, { eventID: id });
    }
    return id;
  };

  const trackCustom = (
    eventName: LockSafeCustomEvent | string,
    params?: Record<string, unknown>,
    eventId?: string
  ) => {
    const id = eventId || generateEventId();
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("trackCustom", eventName, params, { eventID: id });
    }
    return id;
  };

  // Pre-built tracking methods for common LockSafe events
  const trackLead = (value?: number, postcode?: string) => {
    return trackStandard("Lead", {
      value: value || 50,
      currency: "GBP",
      content_name: "Job Request",
      content_category: "locksmith",
      postcode,
    });
  };

  const trackViewContent = (contentType: string, contentName: string) => {
    return trackStandard("ViewContent", {
      content_type: contentType,
      content_name: contentName,
    });
  };

  const trackAddToCart = (quoteValue: number, jobId: string, contentId?: string) => {
    return trackStandard("AddToCart", {
      value: quoteValue,
      currency: "GBP",
      content_ids: contentId ? [contentId] : [jobId],
      content_type: "product",
      content_name: "Locksmith Quote",
      job_id: jobId,
    });
  };

  const trackInitiateCheckout = (assessmentFee: number, jobId: string, contentId?: string) => {
    return trackStandard("InitiateCheckout", {
      value: assessmentFee,
      currency: "GBP",
      content_ids: contentId ? [contentId] : [jobId],
      content_type: "product",
      content_name: "Assessment Fee",
      num_items: 1,
      job_id: jobId,
    });
  };

  const trackPurchase = (value: number, jobId: string, jobNumber?: string, contentId?: string) => {
    return trackStandard("Purchase", {
      value,
      currency: "GBP",
      content_ids: contentId ? [contentId] : [jobId],
      content_type: "product",
      content_name: "Locksmith Service",
      order_id: jobNumber,
      job_id: jobId,
    });
  };

  const trackCompleteRegistration = (userType: "customer" | "locksmith") => {
    return trackStandard("CompleteRegistration", {
      content_name: userType === "locksmith" ? "Locksmith Signup" : "Customer Signup",
      status: "completed",
    });
  };

  const trackFormStarted = (formName: string) => {
    return trackCustom("FormStarted", {
      form_name: formName,
    });
  };

  const trackFormAbandoned = (formName: string, step?: string) => {
    return trackCustom("FormAbandoned", {
      form_name: formName,
      step,
    });
  };

  const trackQuoteReceived = (quoteValue: number, jobId: string) => {
    return trackCustom("QuoteReceived", {
      value: quoteValue,
      currency: "GBP",
      job_id: jobId,
    });
  };

  const trackQuoteAccepted = (quoteValue: number, jobId: string) => {
    return trackCustom("QuoteAccepted", {
      value: quoteValue,
      currency: "GBP",
      job_id: jobId,
    });
  };

  const trackQuoteDeclined = (quoteValue: number, jobId: string) => {
    return trackCustom("QuoteDeclined", {
      value: quoteValue,
      currency: "GBP",
      job_id: jobId,
    });
  };

  return {
    trackStandard,
    trackCustom,
    trackLead,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackPurchase,
    trackCompleteRegistration,
    trackFormStarted,
    trackFormAbandoned,
    trackQuoteReceived,
    trackQuoteAccepted,
    trackQuoteDeclined,
    generateEventId,
  };
}
