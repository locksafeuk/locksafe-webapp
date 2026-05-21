"use client";

import { useEffect } from "react";
import { pushDataLayerEvent } from "@/components/analytics/GoogleTagManager";

/**
 * Page-level GTM/Google Ads instrumentation for the East London landing page.
 *
 * Fires three event types into `window.dataLayer` so they can be wired up to
 * Google Ads conversions, GA4 events, or GA4 audiences inside the GTM UI
 * (no further code changes needed when conversion IDs become available):
 *
 *  - `landing_page_view`  on mount (once per page load)
 *  - `phone_click`        when any element with `data-track="phone-click"` is clicked
 *  - `quote_click`        when any element with `data-track="quote-click"` is clicked
 *  - `scroll_depth`       at 25%, 50%, 75%, 100% of viewport-adjusted page height
 *                         (each threshold fires at most once per page load)
 *
 * Each event carries:
 *   landing_variant : "east-london"
 *   page_path       : "/locksmith-east-london"
 *   city            : "East London"
 *   source          : "google_ads" if a Google click identifier is present
 *
 * The component renders nothing.
 */
const LANDING_VARIANT = "east-london";
const PAGE_PATH = "/locksmith-east-london";
const CITY = "East London";

function inferSource(): string {
  if (typeof window === "undefined") return "direct";
  const params = new URLSearchParams(window.location.search);
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "google_ads";
  const utm = params.get("utm_source");
  if (utm) return utm.toLowerCase();
  return "direct";
}

export function EastLondonAnalytics() {
  useEffect(() => {
    const source = inferSource();

    pushDataLayerEvent("landing_page_view", {
      landing_variant: LANDING_VARIANT,
      page_path: PAGE_PATH,
      city: CITY,
      source,
    });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const kind = el.dataset.track;
      if (kind !== "phone-click" && kind !== "quote-click") return;

      pushDataLayerEvent(kind.replace("-", "_"), {
        landing_variant: LANDING_VARIANT,
        page_path: PAGE_PATH,
        city: CITY,
        source,
      });
    };

    document.addEventListener("click", onClick, { capture: true });

    // Scroll-depth tracking: fire once per threshold (25/50/75/100).
    const thresholds = [25, 50, 75, 100] as const;
    const fired = new Set<number>();
    let raf = 0;

    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      const scrolled = window.scrollY || doc.scrollTop || 0;
      const pct = Math.min(100, Math.round((scrolled / scrollable) * 100));
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          pushDataLayerEvent("scroll_depth", {
            landing_variant: LANDING_VARIANT,
            page_path: PAGE_PATH,
            city: CITY,
            source,
            percent: t,
          });
        }
      }
      if (fired.size === thresholds.length) {
        window.removeEventListener("scroll", onScroll);
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Run once in case the page is already scrolled (e.g. anchor link / refresh).
    measure();

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
