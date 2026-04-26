"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Extend Window interface for Microsoft UET
declare global {
  interface Window {
    uetq?: unknown[];
  }
}

interface MicrosoftAdsProps {
  uetTagId: string;
}

function MicrosoftAdsInner({ uetTagId }: MicrosoftAdsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    if (typeof window !== "undefined" && window.uetq) {
      window.uetq.push("event", "page_view", {
        page_path: pathname,
      });
    }
  }, [pathname, searchParams]);

  // Don't render in development or if no tag ID
  if (!uetTagId || process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      {/* Microsoft UET Tag */}
      <Script id="microsoft-uet-init" strategy="lazyOnload">
        {`
          (function(w,d,t,r,u){
            var f,n,i;
            w[u]=w[u]||[];
            f=function(){
              var o={ti:"${uetTagId}", enableAutoSpaTracking: true};
              o.q=w[u];
              w[u]=new UET(o);
              w[u].push("pageLoad");
            };
            n=d.createElement(t);
            n.src=r;
            n.async=1;
            n.onload=n.onreadystatechange=function(){
              var s=this.readyState;
              if(s&&s!=="loaded"&&s!=="complete")return;
              f();
              n.onload=n.onreadystatechange=null;
            };
            i=d.getElementsByTagName(t)[0];
            i.parentNode.insertBefore(n,i);
          })(window,document,"script","//bat.bing.com/bat.js","uetq");
        `}
      </Script>
    </>
  );
}

export function MicrosoftAds({ uetTagId }: MicrosoftAdsProps) {
  return (
    <Suspense fallback={null}>
      <MicrosoftAdsInner uetTagId={uetTagId} />
    </Suspense>
  );
}

// Hook for tracking Microsoft Ads conversions
export function useMicrosoftAds() {
  const trackEvent = (
    eventType: string,
    eventCategory?: string,
    eventLabel?: string,
    eventValue?: number,
    revenue?: number,
    currency?: string
  ) => {
    if (typeof window !== "undefined" && window.uetq) {
      window.uetq.push("event", eventType, {
        event_category: eventCategory,
        event_label: eventLabel,
        event_value: eventValue,
        revenue_value: revenue,
        currency: currency || "GBP",
      });
    }
  };

  const trackPageView = (pagePath?: string, pageTitle?: string) => {
    if (typeof window !== "undefined" && window.uetq) {
      window.uetq.push("event", "page_view", {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
  };

  // Pre-built tracking methods for LockSafe
  const trackLead = (value?: number) => {
    trackEvent("submit_lead_form", "conversion", "Lead", undefined, value || 50, "GBP");
  };

  const trackPurchase = (value: number, transactionId?: string) => {
    if (typeof window !== "undefined" && window.uetq) {
      window.uetq.push("event", "purchase", {
        revenue_value: value,
        currency: "GBP",
        transaction_id: transactionId,
      });
    }
  };

  const trackSignUp = (userType?: string) => {
    trackEvent("sign_up", "conversion", userType || "customer");
  };

  const trackAddToCart = (value: number) => {
    trackEvent("add_to_cart", "ecommerce", undefined, undefined, value, "GBP");
  };

  const trackBeginCheckout = (value: number) => {
    trackEvent("begin_checkout", "ecommerce", undefined, undefined, value, "GBP");
  };

  return {
    trackEvent,
    trackPageView,
    trackLead,
    trackPurchase,
    trackSignUp,
    trackAddToCart,
    trackBeginCheckout,
  };
}
