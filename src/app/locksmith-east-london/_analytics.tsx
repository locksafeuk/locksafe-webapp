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
 *  - `rage_click`         3+ clicks within 1s inside a ~40px radius
 *  - `repeated_click`     2+ rapid clicks (<400ms) on the exact same element
 *  - `ultra_fast_bounce`  visitor leaves with <2s of foreground time
 *  - `no_mouse_movement`  visitor had >1.5s on page but never moved a pointer
 *                         (touch starts also count as movement)
 *  - `impossible_scroll`  reached 100% scroll in <1500ms after mount (bot-ish)
 *  - `session_fingerprint`stable device id + visit count (sent once on mount;
 *                         pair with a server route to correlate IP patterns)
 *  - `call_attempt_duration` seconds the tab spent backgrounded after a
 *                         phone-click (proxy for call length). Real call
 *                         duration must come from the telephony provider
 *                         (Bland / Zadarma webhook), not the browser.
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
    // Device fingerprint + repeat-visit count (best-effort; falls back     //
    // gracefully when storage is blocked by private mode / ITP).           //
    // -------------------------------------------------------------------- //
    let fingerprint = "";
    let visitCount = 1;
    try {
      fingerprint = window.localStorage.getItem("ls_fp_id") || "";
      if (!fingerprint) {
        fingerprint =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem("ls_fp_id", fingerprint);
      }
      const prior = parseInt(window.localStorage.getItem("ls_fp_visits") || "0", 10);
      visitCount = (Number.isFinite(prior) ? prior : 0) + 1;
      window.localStorage.setItem("ls_fp_visits", String(visitCount));
    } catch {
      // Storage blocked - keep defaults.
    }

    // -------------------------------------------------------------------- //
    // Bot / fraud signal state                                             //
    // -------------------------------------------------------------------- //
    const mountedAt = Date.now();
    let mouseMoveCount = 0;
    let firstScrollAt = 0;
    let impossibleScrollFired = false;
    let noMouseFired = false;
    let ultraFastBounceFired = false;
    let pendingCallStartedAt = 0;
    let pendingCallHiddenAt = 0;
    let callDurationFired = false;
    const clickWindow: Array<{ t: number; x: number; y: number; el: Element | null }> = [];
    const repeatedClickEls = new Map<Element, number>();
    const rageFiredFor = new Set<number>();

    const onPointerMove = () => {
      mouseMoveCount++;
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("touchstart", onPointerMove, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

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
      fingerprint,
      visit_count: visitCount,
    });

    pushDataLayerEvent("session_fingerprint", {
      landing_variant: LANDING_VARIANT,
      page_path: PAGE_PATH,
      city: CITY,
      source,
      fingerprint,
      visit_count: visitCount,
      user_agent: navigator.userAgent,
      language: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      // Repeat-visit signal: visiting >5 times in the same browser before
      // ever calling/quoting is a common fraud pattern; surface as a flag.
      repeat_visitor: visitCount > 1,
    });

    // -------------------------------------------------------------------- //
    // Click handler: tracked CTAs + rage / repeated-click detection.       //
    // -------------------------------------------------------------------- //
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // -- Rage-click detection (any click anywhere on the page) -- //
      const now = Date.now();
      clickWindow.push({ t: now, x: e.clientX, y: e.clientY, el: target });
      // Drop entries older than 1s.
      while (clickWindow.length && now - clickWindow[0].t > 1000) clickWindow.shift();
      // 3+ clicks within 40px in <=1s => rage click (fire at most once per cluster second).
      if (clickWindow.length >= 3) {
        const recent = clickWindow.slice(-3);
        const dx = Math.max(...recent.map((c) => c.x)) - Math.min(...recent.map((c) => c.x));
        const dy = Math.max(...recent.map((c) => c.y)) - Math.min(...recent.map((c) => c.y));
        const bucket = Math.floor(now / 1000);
        if (dx <= 40 && dy <= 40 && !rageFiredFor.has(bucket)) {
          rageFiredFor.add(bucket);
          pushDataLayerEvent("rage_click", {
            landing_variant: LANDING_VARIANT,
            page_path: PAGE_PATH,
            city: CITY,
            source,
            fingerprint,
            click_count: clickWindow.length,
            target: (target?.tagName || "").toLowerCase(),
            target_data_track: target?.closest?.("[data-track]")?.getAttribute("data-track") || null,
          });
        }
      }
      // -- Repeated-click on identical element in <400ms -- //
      if (target) {
        const lastAt = repeatedClickEls.get(target) || 0;
        if (lastAt && now - lastAt < 400) {
          pushDataLayerEvent("repeated_click", {
            landing_variant: LANDING_VARIANT,
            page_path: PAGE_PATH,
            city: CITY,
            source,
            fingerprint,
            target: target.tagName.toLowerCase(),
            target_data_track: target.closest?.("[data-track]")?.getAttribute("data-track") || null,
            delta_ms: now - lastAt,
          });
        }
        repeatedClickEls.set(target, now);
      }

      // -- Tracked CTA handling -- //
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
        fingerprint,
      });

      if (kind === "phone-click") {
        if (score.phone === 0) score.phone = 20;
        // Start the call-attempt-duration proxy: record click time so we can
        // measure how long the tab is backgrounded after the tel: handoff.
        pendingCallStartedAt = now;
        callDurationFired = false;
      }
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
      if (pct > 0 && firstScrollAt === 0) firstScrollAt = Date.now();
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
          // Impossible-scroll: hit 100% in <1500ms from mount AND scrollable
          // height is non-trivial (>1.5 viewports) => almost certainly a bot.
          if (t === 100 && !impossibleScrollFired) {
            const elapsed = Date.now() - mountedAt;
            if (elapsed < 1500 && scrollable > window.innerHeight * 1.5) {
              impossibleScrollFired = true;
              pushDataLayerEvent("impossible_scroll", {
                landing_variant: LANDING_VARIANT,
                page_path: PAGE_PATH,
                city: CITY,
                source,
                fingerprint,
                elapsed_ms: elapsed,
                scrollable_px: scrollable,
              });
            }
          }
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

    // Emits fraud/bot signals that only make sense when the visitor leaves.
    const emitExitSignals = () => {
      // ultra-fast bounce: <2s of foreground time before exit.
      if (!ultraFastBounceFired && foregroundMs < 2000) {
        ultraFastBounceFired = true;
        pushDataLayerEvent("ultra_fast_bounce", {
          landing_variant: LANDING_VARIANT,
          page_path: PAGE_PATH,
          city: CITY,
          source,
          fingerprint,
          foreground_ms: foregroundMs,
        });
      }
      // no-mouse-movement: meaningful only after a reasonable dwell time.
      if (!noMouseFired && mouseMoveCount === 0 && foregroundMs > 1500) {
        noMouseFired = true;
        pushDataLayerEvent("no_mouse_movement", {
          landing_variant: LANDING_VARIANT,
          page_path: PAGE_PATH,
          city: CITY,
          source,
          fingerprint,
          foreground_ms: foregroundMs,
        });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastTick = Date.now();
        // If we backgrounded after a phone-click, the time spent hidden is
        // our best in-browser proxy for call duration.
        if (pendingCallHiddenAt && !callDurationFired) {
          const backgroundMs = Date.now() - pendingCallHiddenAt;
          // Only emit if backgrounded for >=3s (filters out app-switch noise).
          if (backgroundMs >= 3000) {
            callDurationFired = true;
            pushDataLayerEvent("call_attempt_duration", {
              landing_variant: LANDING_VARIANT,
              page_path: PAGE_PATH,
              city: CITY,
              source,
              fingerprint,
              seconds: Math.round(backgroundMs / 1000),
              // Note: this is tab-backgrounded time after a tel: click, not
              // the real call duration. Wire the telephony provider webhook
              // for ground truth.
              proxy: true,
            });
          }
          pendingCallHiddenAt = 0;
          pendingCallStartedAt = 0;
        }
      } else {
        flushTime();
        lastTick = 0;
        if (pendingCallStartedAt && !pendingCallHiddenAt) {
          pendingCallHiddenAt = Date.now();
        }
        emitExitSignals();
        if (!qualityFinalised) {
          qualityFinalised = true;
          emitQuality("final");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => {
      flushTime();
      emitExitSignals();
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
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchstart", onPointerMove);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return null;
}
