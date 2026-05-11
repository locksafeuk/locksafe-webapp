"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

interface Props {
  slug: string;
  pillarKeyword: string | null;
  intentTags: string[];
  variant: "A" | "B";
  isAbTestRunning: boolean;
}

/**
 * Fires GTM events for intent landings:
 *   - intent_view (always)
 *   - intent_hook_impression (when A/B test active)
 * Conversion is fired downstream from the /request post-submit handler.
 */
export function IntentTracker({ slug, pillarKeyword, intentTags, variant, isAbTestRunning }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "intent_view",
      intent_slug: slug,
      intent_pillar: pillarKeyword || undefined,
      intent_tags: intentTags,
    });
    if (isAbTestRunning) {
      window.dataLayer.push({
        event: "intent_hook_impression",
        intent_slug: slug,
        intent_ab_variant: variant,
      });
    }
  }, [slug, pillarKeyword, intentTags, variant, isAbTestRunning]);
  return null;
}
