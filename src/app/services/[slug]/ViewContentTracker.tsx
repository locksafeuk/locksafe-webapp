"use client";

/**
 * Fires Pixel + CAPI `ViewContent` for a service catalog page so the
 * `content_id` matches the Meta catalog feed (required for dynamic ads).
 *
 * Single event, deduplicated browser↔server via a shared `event_id`.
 */

import { useEffect, useRef } from "react";
import { useMetaPixel } from "@/components/analytics/MetaPixel";
import type { ServiceSlug } from "@/lib/services-catalog";

interface Props {
  slug: ServiceSlug;
  title: string;
}

const COOKIE_CONSENT_KEY = "locksafe_cookie_consent";

function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw).marketing === true;
  } catch {
    return false;
  }
}

export function ViewContentTracker({ slug, title }: Props) {
  const fired = useRef(false);
  const metaPixel = useMetaPixel();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (!hasMarketingConsent()) return;

    const eventId = metaPixel.generateEventId();
    const pixelData = {
      content_ids: [slug],
      content_type: "product",
      content_name: title,
      content_category: "locksmith-service",
      value: 0,
      currency: "GBP",
    } as const;

    // Browser-side Pixel ViewContent.
    metaPixel.trackStandard("ViewContent", pixelData, eventId);

    // Server-side CAPI ViewContent (deduped via shared event_id).
    fetch("/api/tracking/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "view_content",
        eventData: {
          contentIds: [slug],
          contentType: "product",
          contentName: title,
          contentCategory: "locksmith-service",
          value: 0,
          currency: "GBP",
        },
        eventId,
        sourceUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    }).catch(() => {
      /* swallow — tracking is best-effort */
    });
  }, [slug, title, metaPixel]);

  return null;
}
