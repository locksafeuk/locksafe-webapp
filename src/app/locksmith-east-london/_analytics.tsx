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
 *  - `time_on_page`       at 15s, 30s, 60s, 180s of foreground-tab time
 *                         (each threshold fires at most once per page load;
 *                         hidden-tab time is not counted)
 *  - `session_quality`    composite engagement score (0-100) emitted when the
 *                         visitor crosses a quality tier (low<30, medium<70,
 *                         high>=70) and a final summary on page hide. Drives
 *                         Google Ads enhanced bidding / GA4 quality audiences.
 *
 * Score breakdown (max 100):
 *   time_on_page  : up to 40  (15s=10, 30s=20, 60s=30, 180s=40)
 *   scroll_depth  : up to 30  (25%=8, 50%=15, 75%=22, 100%=30)
 *   phone_click   : 20
 *   quote_click   : 25
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

    // -------------------------------------------------------------------- //
    // Session-quality scoring state                                        //
    // -------------------------------------------------------------------- //
    const score = { time: 0, scroll: 0, phone: 0, quote: 0 };
    let currentTier: "none" | "low" | "medium" | "high" = "none";
    let qualityFinalised = false;

    const tierFor = (total: number): "low" | "medium" | "high" => {
      if (total >= 70) return "high";
      if (total >= 30) return "medium";
      return "low";
    };

    const emitQuality = (reason: string) => {
      const total = Math.min(100, score.time + score.scroll + score.phone + score.quote);
      const nextTier = tierFor(total);
      // Emit only when crossing into a new tier (avoids dataLayer spam).
      // The final `pagehide` always emits regardless so GTM has a summary.
      if (reason === "final" || nextTier !== currentTier) {
        currentTier = nextTier;
        pushDataLayerEvent("session_quality", {
          landing_variant: LANDING_VARIANT,
          page_path: PAGE_PATH,
          city: CITY,
          source,
          score: total,
          tier: nextTier,
          reason,
          breakdown: { ...score },
        });
      }
    };

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

      if (kind === "phone-click" && score.phone === 0) score.phone = 20;
      if (kind === "quote-click" && score.quote === 0) score.quote = 25;
      emitQuality(`${kind.replace("-", "_")}`);
    };

    document.addEventListener("click", onClick, { capture: true });

    // Scroll-depth tracking: fire once per threshold (25/50/75/100).
    const thresholds = [25, 50, 75, 100] as const;
    const scrollPoints: Record<number, number> = { 25: 8, 50: 15, 75: 22, 100: 30 };
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
          score.scroll = Math.max(score.scroll, scrollPoints[t] ?? 0);
          emitQuality(`scroll_${t}`);
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

    // Time-on-page tracking: fire once each as foreground-tab time crosses
    // 15s, 30s, 60s and 180s. We accumulate only while the tab is visible so
    // background tabs (or backgrounded mobile browsers) don't inflate numbers.
    const timeThresholds = [15, 30, 60, 180] as const;
    const timePoints: Record<number, number> = { 15: 10, 30: 20, 60: 30, 180: 40 };
    const timeFired = new Set<number>();
    let foregroundMs = 0;
    let lastTick = document.visibilityState === "visible" ? Date.now() : 0;

    const flushTime = () => {
      if (lastTick) {
        foregroundMs += Date.now() - lastTick;
        lastTick = document.visibilityState === "visible" ? Date.now() : 0;
      }
      const seconds = Math.floor(foregroundMs / 1000);
      for (const t of timeThresholds) {
        if (seconds >= t && !timeFired.has(t)) {
          timeFired.add(t);
          pushDataLayerEvent("time_on_page", {
            landing_variant: LANDING_VARIANT,
            page_path: PAGE_PATH,
            city: CITY,
            source,
            seconds: t,
          });
          score.time = Math.max(score.time, timePoints[t] ?? 0);
          emitQuality(`time_${t}s`);
        }
      }
    };

    const timeInterval = window.setInterval(() => {
      flushTime();
      if (timeFired.size === timeThresholds.length) {
        window.clearInterval(timeInterval);
      }
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastTick = Date.now();
      } else {
        flushTime();
        lastTick = 0;
        if (!qualityFinalised) {
          qualityFinalised = true;
          emitQuality("final");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => {
      flushTime();
      if (!qualityFinalised) {
        qualityFinalised = true;
        emitQuality("final");
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearInterval(timeInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
