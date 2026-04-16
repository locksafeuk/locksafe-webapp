"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePathname } from "next/navigation";

interface TrackingSession {
  id: string;
  visitorId: string;
  segment: string[];
  engagementScore: number;
  intentScore: number;
  modalsShown: string[];
  modalsDismissed: string[];
  modalsConverted: string[];
  funnelStage: string;
}

interface UseUserTrackingOptions {
  enabled?: boolean;
  onSessionReady?: (session: TrackingSession) => void;
}

// Generate visitor ID (persistent across sessions)
function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";

  const storageKey = "ls_visitor_id";
  let visitorId = localStorage.getItem(storageKey);

  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, visitorId);
  }

  return visitorId;
}

// Get visit count
function incrementVisitCount(): number {
  if (typeof window === "undefined") return 1;

  const storageKey = "ls_visit_count";
  const lastVisit = localStorage.getItem("ls_last_visit");
  const today = new Date().toDateString();

  let count = parseInt(localStorage.getItem(storageKey) || "0");

  // Only count as new visit if last visit was on a different day
  if (lastVisit !== today) {
    count += 1;
    localStorage.setItem(storageKey, count.toString());
    localStorage.setItem("ls_last_visit", today);
  }

  return count;
}

export function useUserTracking(options: UseUserTrackingOptions = {}) {
  const { enabled = true, onSessionReady } = options;

  const pathname = usePathname();
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [visitCount, setVisitCount] = useState(1);

  const pageViewIdRef = useRef<string | null>(null);
  const pageStartTimeRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const lastScrollUpdateRef = useRef<number>(0);

  // Initialize session
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const initSession = async () => {
      const visitorId = getOrCreateVisitorId();
      const count = incrementVisitCount();
      setVisitCount(count);
      setIsFirstVisit(count === 1);

      // Get URL params
      const params = new URLSearchParams(window.location.search);

      try {
        const res = await fetch("/api/marketing/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            utmSource: params.get("utm_source"),
            utmMedium: params.get("utm_medium"),
            utmCampaign: params.get("utm_campaign"),
            landingPage: pathname,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          onSessionReady?.(data.session);
        }
      } catch (err) {
        console.error("Failed to init tracking session:", err);
      }
    };

    initSession();
  }, [enabled, pathname, onSessionReady]);

  // Track page view on route change
  useEffect(() => {
    if (!enabled || !session) return;

    const trackPage = async () => {
      // Update previous page view with time and scroll
      if (pageViewIdRef.current) {
        const timeOnPage = Math.floor(
          (Date.now() - pageStartTimeRef.current) / 1000
        );
        await fetch("/api/marketing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "update_page_view",
            sessionId: session.id,
            pageViewId: pageViewIdRef.current,
            timeOnPage,
            scrollDepth: maxScrollDepthRef.current,
          }),
        }).catch(() => {});
      }

      // Reset for new page
      pageStartTimeRef.current = Date.now();
      maxScrollDepthRef.current = 0;

      // Track new page view
      try {
        const res = await fetch("/api/marketing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "page_view",
            sessionId: session.id,
            path: pathname,
            title: document.title,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          pageViewIdRef.current = data.pageView?.id;
        }
      } catch (err) {
        console.error("Failed to track page view:", err);
      }
    };

    trackPage();
  }, [enabled, session, pathname]);

  // Track scroll depth
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent = Math.round(
        (scrollTop / (docHeight - winHeight)) * 100
      );

      if (scrollPercent > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = Math.min(scrollPercent, 100);
      }

      // Debounced update to server (every 10 seconds max)
      const now = Date.now();
      if (
        pageViewIdRef.current &&
        session &&
        now - lastScrollUpdateRef.current > 10000
      ) {
        lastScrollUpdateRef.current = now;
        fetch("/api/marketing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "update_page_view",
            sessionId: session.id,
            pageViewId: pageViewIdRef.current,
            scrollDepth: maxScrollDepthRef.current,
          }),
        }).catch(() => {});
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled, session]);

  // Track event
  const trackEvent = useCallback(
    async (eventType: string, element?: string, data?: Record<string, unknown>) => {
      if (!enabled || !session) return;

      try {
        await fetch("/api/marketing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "event",
            sessionId: session.id,
            eventType,
            element,
            eventData: data,
          }),
        });
      } catch (err) {
        console.error("Failed to track event:", err);
      }
    },
    [enabled, session]
  );

  // Update segment
  const updateSegment = useCallback(
    async (segments: string[]) => {
      if (!enabled || !session) return;

      try {
        await fetch("/api/marketing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "update_segment",
            sessionId: session.id,
            segments,
          }),
        });
      } catch (err) {
        console.error("Failed to update segment:", err);
      }
    },
    [enabled, session]
  );

  // Get current scroll depth
  const getScrollDepth = useCallback(() => maxScrollDepthRef.current, []);

  // Get time on current page
  const getTimeOnPage = useCallback(
    () => Math.floor((Date.now() - pageStartTimeRef.current) / 1000),
    []
  );

  return {
    session,
    visitorId: session?.visitorId || getOrCreateVisitorId(),
    isFirstVisit,
    visitCount,
    trackEvent,
    updateSegment,
    getScrollDepth,
    getTimeOnPage,
  };
}
