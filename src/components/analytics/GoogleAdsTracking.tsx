"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Window interface for gtag is declared in GoogleAnalytics.tsx

interface GoogleAdsTrackingProps {
  adsId: string; // AW-XXXXXXXXX format
  gaId?: string; // G-XXXXXXXXX format (GA4)
}

function GoogleAdsTrackingInner({ adsId, gaId }: GoogleAdsTrackingProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    if (typeof window !== "undefined" && window.gtag) {
      // Track to Google Ads
      if (adsId) {
        window.gtag("config", adsId, {
          page_path: pathname,
        });
      }
      // Track to GA4
      if (gaId) {
        window.gtag("config", gaId, {
          page_path: pathname,
        });
      }
    }
  }, [pathname, searchParams, adsId, gaId]);

  // Don't render in development or if no IDs
  if ((!adsId && !gaId) || process.env.NODE_ENV !== "production") {
    return null;
  }

  const primaryId = adsId || gaId;

  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="lazyOnload"
      />
      <Script id="google-ads-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${adsId ? `gtag('config', '${adsId}');` : ""}
          ${gaId ? `gtag('config', '${gaId}');` : ""}
        `}
      </Script>
    </>
  );
}

export function GoogleAdsTracking({ adsId, gaId }: GoogleAdsTrackingProps) {
  return (
    <Suspense fallback={null}>
      <GoogleAdsTrackingInner adsId={adsId} gaId={gaId} />
    </Suspense>
  );
}

// Hook for tracking Google Ads conversions
export function useGoogleAds() {
  const trackConversion = (
    conversionId: string,
    conversionLabel: string,
    value?: number,
    currency?: string,
    transactionId?: string
  ) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "conversion", {
        send_to: `${conversionId}/${conversionLabel}`,
        value: value,
        currency: currency || "GBP",
        transaction_id: transactionId,
      });
    }
  };

  const trackEvent = (
    eventName: string,
    params?: Record<string, unknown>
  ) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", eventName, params);
    }
  };

  // Pre-built tracking methods for LockSafe
  const trackLeadConversion = (
    conversionLabel: string,
    value?: number,
    transactionId?: string
  ) => {
    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
    trackConversion(adsId, conversionLabel, value || 50, "GBP", transactionId);
  };

  const trackPurchaseConversion = (
    conversionLabel: string,
    value: number,
    transactionId: string
  ) => {
    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
    trackConversion(adsId, conversionLabel, value, "GBP", transactionId);
  };

  // Enhanced E-commerce events for GA4
  const trackGenerateLead = (value?: number, leadSource?: string) => {
    trackEvent("generate_lead", {
      value: value || 50,
      currency: "GBP",
      lead_source: leadSource,
    });
  };

  const trackBeginCheckout = (value: number, items: Array<{ id: string; name: string; price: number }>) => {
    trackEvent("begin_checkout", {
      value,
      currency: "GBP",
      items: items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: 1,
      })),
    });
  };

  const trackAddPaymentInfo = (value: number, paymentType?: string) => {
    trackEvent("add_payment_info", {
      value,
      currency: "GBP",
      payment_type: paymentType || "card",
    });
  };

  const trackPurchase = (
    transactionId: string,
    value: number,
    items: Array<{ id: string; name: string; price: number }>
  ) => {
    trackEvent("purchase", {
      transaction_id: transactionId,
      value,
      currency: "GBP",
      items: items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: 1,
      })),
    });
  };

  const trackViewItem = (itemId: string, itemName: string, category?: string) => {
    trackEvent("view_item", {
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          item_category: category,
        },
      ],
    });
  };

  const trackAddToCart = (itemId: string, itemName: string, value: number) => {
    trackEvent("add_to_cart", {
      value,
      currency: "GBP",
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          price: value,
          quantity: 1,
        },
      ],
    });
  };

  const trackSignUp = (method?: string) => {
    trackEvent("sign_up", {
      method: method || "website",
    });
  };

  // Phone call click tracking
  const trackPhoneClick = (phoneNumber: string) => {
    trackEvent("click_to_call", {
      phone_number: phoneNumber,
      event_category: "engagement",
      event_label: "Phone Click",
    });
  };

  return {
    trackConversion,
    trackEvent,
    trackLeadConversion,
    trackPurchaseConversion,
    trackGenerateLead,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackViewItem,
    trackAddToCart,
    trackSignUp,
    trackPhoneClick,
  };
}
