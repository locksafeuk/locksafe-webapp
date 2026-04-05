"use client";

import { useCallback } from "react";
import { useMetaPixel } from "@/components/analytics/MetaPixel";
import { useGoogleAds } from "@/components/analytics/GoogleAdsTracking";
import { useMicrosoftAds } from "@/components/analytics/MicrosoftAds";
import { useGoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

// Unified event types for LockSafe
export type TrackingEventType =
  | "page_view"
  | "lead"
  | "form_started"
  | "form_abandoned"
  | "postcode_entered"
  | "quote_received"
  | "quote_accepted"
  | "quote_declined"
  | "assessment_paid"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "job_completed"
  | "job_cancelled"
  | "locksmith_signup"
  | "customer_signup"
  | "locksmith_applied"
  | "review_submitted"
  | "phone_click"
  | "exit_intent"
  | "lead_magnet_download";

export interface TrackingEventData {
  // Common fields
  value?: number;
  currency?: string;
  // Job related
  jobId?: string;
  jobNumber?: string;
  postcode?: string;
  serviceType?: string;
  // User related
  userType?: "customer" | "locksmith";
  userId?: string;
  // Form related
  formName?: string;
  formStep?: string;
  // Quote related
  quoteValue?: number;
  assessmentFee?: number;
  // Attribution
  source?: string;
  medium?: string;
  campaign?: string;
  // Custom data
  [key: string]: unknown;
}

interface TrackingConfig {
  enableMeta?: boolean;
  enableGoogle?: boolean;
  enableMicrosoft?: boolean;
  enableServerSide?: boolean;
}

const defaultConfig: TrackingConfig = {
  enableMeta: true,
  enableGoogle: true,
  enableMicrosoft: true,
  enableServerSide: true,
};

// Check if user has consented to marketing cookies
function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) return false;

    const parsed = JSON.parse(consent);
    return parsed.marketing === true;
  } catch {
    return false;
  }
}

// Generate unique event ID for deduplication
function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function useTrackingEvents(config: TrackingConfig = defaultConfig) {
  const metaPixel = useMetaPixel();
  const googleAds = useGoogleAds();
  const microsoftAds = useMicrosoftAds();
  const googleAnalytics = useGoogleAnalytics();

  // Send server-side event for Conversions API
  const sendServerEvent = useCallback(
    async (eventName: string, eventData: TrackingEventData, eventId: string) => {
      if (!config.enableServerSide) return;

      try {
        await fetch("/api/tracking/conversions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName,
            eventData,
            eventId,
            sourceUrl: window.location.href,
            userAgent: navigator.userAgent,
          }),
        });
      } catch (error) {
        console.error("Server-side tracking error:", error);
      }
    },
    [config.enableServerSide]
  );

  // Main tracking function
  const track = useCallback(
    async (eventType: TrackingEventType, data: TrackingEventData = {}) => {
      const eventId = generateEventId();
      const hasConsent = hasMarketingConsent();
      const value = data.value || 0;

      // Only fire browser-side pixels if user consented to marketing
      if (hasConsent) {
        // META PIXEL
        if (config.enableMeta) {
          switch (eventType) {
            case "lead":
            case "postcode_entered":
              metaPixel.trackLead(data.value || 50, data.postcode);
              break;
            case "form_started":
              metaPixel.trackFormStarted(data.formName || "unknown");
              break;
            case "form_abandoned":
              metaPixel.trackFormAbandoned(data.formName || "unknown", data.formStep);
              break;
            case "quote_received":
              metaPixel.trackQuoteReceived(data.quoteValue || value, data.jobId || "");
              metaPixel.trackAddToCart(data.quoteValue || value, data.jobId || "");
              break;
            case "quote_accepted":
              metaPixel.trackQuoteAccepted(data.quoteValue || value, data.jobId || "");
              break;
            case "quote_declined":
              metaPixel.trackQuoteDeclined(data.quoteValue || value, data.jobId || "");
              break;
            case "assessment_paid":
            case "begin_checkout":
              metaPixel.trackInitiateCheckout(
                data.assessmentFee || data.value || 29,
                data.jobId || ""
              );
              break;
            case "add_to_cart":
              metaPixel.trackAddToCart(value, data.jobId || "");
              break;
            case "purchase":
            case "job_completed":
              metaPixel.trackPurchase(value, data.jobId || "", data.jobNumber);
              break;
            case "customer_signup":
              metaPixel.trackCompleteRegistration("customer");
              break;
            case "locksmith_signup":
              metaPixel.trackCompleteRegistration("locksmith");
              break;
            default:
              metaPixel.trackCustom(eventType, data, eventId);
          }
        }

        // GOOGLE ADS / GA4
        if (config.enableGoogle) {
          const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
          const leadConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_LEAD_CONVERSION_LABEL;
          const purchaseConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_PURCHASE_CONVERSION_LABEL;

          switch (eventType) {
            case "lead":
            case "postcode_entered":
              googleAds.trackGenerateLead(data.value || 50, data.source);
              if (googleAdsId && leadConversionLabel) {
                googleAds.trackLeadConversion(leadConversionLabel, data.value || 50, data.jobId);
              }
              break;
            case "quote_received":
            case "add_to_cart":
              googleAds.trackAddToCart(data.jobId || "", "Locksmith Quote", value);
              break;
            case "begin_checkout":
            case "assessment_paid":
              googleAds.trackBeginCheckout(data.assessmentFee || value, [
                { id: data.jobId || "", name: "Assessment Fee", price: data.assessmentFee || 29 },
              ]);
              googleAds.trackAddPaymentInfo(data.assessmentFee || value);
              break;
            case "purchase":
            case "job_completed":
              googleAds.trackPurchase(data.jobNumber || data.jobId || "", value, [
                { id: data.jobId || "", name: "Locksmith Service", price: value },
              ]);
              if (googleAdsId && purchaseConversionLabel) {
                googleAds.trackPurchaseConversion(
                  purchaseConversionLabel,
                  value,
                  data.jobNumber || data.jobId || ""
                );
              }
              break;
            case "customer_signup":
            case "locksmith_signup":
              googleAds.trackSignUp(data.userType);
              break;
            case "phone_click":
              googleAds.trackPhoneClick(data.phoneNumber as string || "");
              break;
            default:
              googleAds.trackEvent(eventType, data);
          }

          // Also track to Google Analytics
          googleAnalytics.trackEvent(eventType, "conversion", data.jobId, value);
        }

        // MICROSOFT ADS
        if (config.enableMicrosoft) {
          switch (eventType) {
            case "lead":
            case "postcode_entered":
              microsoftAds.trackLead(data.value || 50);
              break;
            case "add_to_cart":
            case "quote_received":
              microsoftAds.trackAddToCart(value);
              break;
            case "begin_checkout":
            case "assessment_paid":
              microsoftAds.trackBeginCheckout(data.assessmentFee || value);
              break;
            case "purchase":
            case "job_completed":
              microsoftAds.trackPurchase(value, data.jobNumber);
              break;
            case "customer_signup":
            case "locksmith_signup":
              microsoftAds.trackSignUp(data.userType);
              break;
            default:
              microsoftAds.trackEvent(eventType);
          }
        }
      }

      // Server-side tracking (always fires for important conversions)
      // This handles iOS 14.5+ tracking gaps and contract-based legal basis
      if (config.enableServerSide) {
        const serverSideEvents = [
          "lead",
          "assessment_paid",
          "purchase",
          "job_completed",
          "customer_signup",
          "locksmith_signup",
          "quote_accepted",
          "quote_declined",
        ];

        if (serverSideEvents.includes(eventType)) {
          await sendServerEvent(eventType, data, eventId);
        }
      }

      return eventId;
    },
    [config, metaPixel, googleAds, microsoftAds, googleAnalytics, sendServerEvent]
  );

  // Convenience methods
  const trackLead = useCallback(
    (postcode?: string, value?: number) =>
      track("lead", { postcode, value: value || 50 }),
    [track]
  );

  const trackFormStarted = useCallback(
    (formName: string) => track("form_started", { formName }),
    [track]
  );

  const trackFormAbandoned = useCallback(
    (formName: string, step?: string) => track("form_abandoned", { formName, formStep: step }),
    [track]
  );

  const trackQuoteReceived = useCallback(
    (jobId: string, quoteValue: number) =>
      track("quote_received", { jobId, quoteValue, value: quoteValue }),
    [track]
  );

  const trackQuoteAccepted = useCallback(
    (jobId: string, quoteValue: number) =>
      track("quote_accepted", { jobId, quoteValue, value: quoteValue }),
    [track]
  );

  const trackQuoteDeclined = useCallback(
    (jobId: string, quoteValue: number) =>
      track("quote_declined", { jobId, quoteValue, value: quoteValue }),
    [track]
  );

  const trackAssessmentPaid = useCallback(
    (jobId: string, assessmentFee: number) =>
      track("assessment_paid", { jobId, assessmentFee, value: assessmentFee }),
    [track]
  );

  const trackPurchase = useCallback(
    (jobId: string, jobNumber: string, value: number) =>
      track("purchase", { jobId, jobNumber, value }),
    [track]
  );

  const trackSignup = useCallback(
    (userType: "customer" | "locksmith", userId?: string) =>
      track(userType === "locksmith" ? "locksmith_signup" : "customer_signup", {
        userType,
        userId,
      }),
    [track]
  );

  const trackPhoneClick = useCallback(
    (phoneNumber: string) => track("phone_click", { phoneNumber }),
    [track]
  );

  return {
    track,
    trackLead,
    trackFormStarted,
    trackFormAbandoned,
    trackQuoteReceived,
    trackQuoteAccepted,
    trackQuoteDeclined,
    trackAssessmentPaid,
    trackPurchase,
    trackSignup,
    trackPhoneClick,
    hasMarketingConsent,
  };
}

// Export type for use in other components
export type UseTrackingEventsReturn = ReturnType<typeof useTrackingEvents>;
