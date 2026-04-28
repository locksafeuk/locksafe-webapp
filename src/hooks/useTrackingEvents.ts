"use client";

import { useCallback } from "react";
import { useMetaPixel } from "@/components/analytics/MetaPixel";
import { pushDataLayerEvent } from "@/components/analytics/GoogleTagManager";

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
  enableGTM?: boolean;
  enableServerSide?: boolean;
}

const defaultConfig: TrackingConfig = {
  enableMeta: true,
  enableGTM: true,
  enableServerSide: true,
};

const COOKIE_CONSENT_KEY = "locksafe_cookie_consent";

// Check if user has consented to marketing cookies (single source of truth).
function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.marketing === true;
  } catch {
    return false;
  }
}

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

// Generate unique event ID for browser/server dedup (Meta CAPI).
function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function useTrackingEvents(config: TrackingConfig = defaultConfig) {
  const metaPixel = useMetaPixel();

  // Send server-side event for Meta Conversions API.
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

  // Main tracking function.
  const track = useCallback(
    async (eventType: TrackingEventType, data: TrackingEventData = {}) => {
      const eventId = generateEventId();
      const marketingConsent = hasMarketingConsent();
      const analyticsConsent = hasAnalyticsConsent();
      const value = data.value || 0;

      // GTM dataLayer push — fires for every event regardless of consent.
      // GTM tags themselves are gated by Consent Mode v2 (analytics_storage,
      // ad_storage), so denied users won't have GA4/Ads/UET fire.
      if (config.enableGTM) {
        pushDataLayerEvent(`ls_${eventType}`, {
          ...data,
          event_id: eventId,
          value,
          currency: data.currency || "GBP",
        });
      }

      // META PIXEL (browser-side) — only if marketing consent granted.
      if (config.enableMeta && marketingConsent) {
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

      // Server-side tracking (always fires for important conversions).
      // Handles iOS 14.5+ tracking gaps; deduplicated browser-side via eventId.
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

      // Reference analyticsConsent so unused-var lints don't trip; reserved
      // for future direct GA4 calls if we ever bypass GTM for a hot path.
      void analyticsConsent;

      return eventId;
    },
    [config, metaPixel, sendServerEvent]
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
