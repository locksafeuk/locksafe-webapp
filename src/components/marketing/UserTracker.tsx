"use client";

import { useEffect, useCallback, createContext, useContext, useState, type ReactNode } from "react";
import { useUserTracking } from "@/hooks/useUserTracking";
import { useExitIntent } from "@/hooks/useExitIntent";
import { useModalTrigger } from "@/hooks/useModalTrigger";
import { usePathname } from "next/navigation";

// Context for sharing tracking data across the app
interface TrackingContextValue {
  visitorId: string;
  sessionId: string | null;
  segment: string[];
  isFirstVisit: boolean;
  visitCount: number;
  exitIntentDetected: boolean;
  trackEvent: (type: string, element?: string, data?: Record<string, unknown>) => void;
  updateSegment: (segments: string[]) => void;
  getScrollDepth: () => number;
  getTimeOnPage: () => number;
  canShowModal: (modalType: string) => Promise<boolean>;
  trackModalShown: (modalType: string) => void;
  trackModalDismissed: (modalType: string) => void;
  trackModalConverted: (modalType: string, data?: Record<string, unknown>) => void;
  saveLead: (data: { email: string; name?: string; source: string; segment?: string[] }) => Promise<unknown>;
  resetExitIntent: () => void;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error("useTracking must be used within UserTracker");
  }
  return context;
}

interface UserTrackerProps {
  children: ReactNode;
  enabled?: boolean;
}

export function UserTracker({ children, enabled = true }: UserTrackerProps) {
  const pathname = usePathname();
  const [segment, setSegment] = useState<string[]>([]);

  const {
    session,
    visitorId,
    isFirstVisit,
    visitCount,
    trackEvent,
    updateSegment: updateSessionSegment,
    getScrollDepth,
    getTimeOnPage,
  } = useUserTracking({ enabled });

  const { exitIntentDetected, resetExitIntent } = useExitIntent({
    disabled: !enabled,
    delayMs: 5000, // Wait 5 seconds before detecting exit intent
  });

  const {
    canShowModal,
    trackModalShown,
    trackModalDismissed,
    trackModalConverted,
    saveLead,
  } = useModalTrigger({
    visitorId,
    sessionId: session?.id || "",
  });

  // Update local segment when session changes
  useEffect(() => {
    if (session?.segment) {
      setSegment(session.segment);
    }
  }, [session?.segment]);

  // Wrapper for updateSegment that also updates local state
  const updateSegment = useCallback(
    (newSegments: string[]) => {
      setSegment((prev) => [...new Set([...prev, ...newSegments])]);
      updateSessionSegment(newSegments);
    },
    [updateSessionSegment]
  );

  // Track common events
  useEffect(() => {
    if (!enabled || !session) return;

    // Track CTA clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest("button, a");

      if (button) {
        const id = button.id || button.getAttribute("data-track");
        const text = button.textContent?.trim().slice(0, 50);

        if (id || text?.toLowerCase().includes("quote") || text?.toLowerCase().includes("request")) {
          trackEvent("click", id || "cta", { text, href: (button as HTMLAnchorElement).href });
        }
      }
    };

    // Track form interactions
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        const form = target.closest("form");
        if (form) {
          trackEvent("form_start", form.id || "unknown_form");
        }
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("focusin", handleFocus);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("focusin", handleFocus);
    };
  }, [enabled, session, trackEvent]);

  // Track page-specific events
  useEffect(() => {
    if (!enabled || !session) return;

    // Emergency page intent
    if (pathname === "/request") {
      updateSegment(["emergency"]);
    }

    // Locksmith signup intent
    if (pathname?.includes("locksmith-signup")) {
      updateSegment(["locksmith_prospect"]);
    }
  }, [enabled, session, pathname, updateSegment]);

  const contextValue: TrackingContextValue = {
    visitorId,
    sessionId: session?.id || null,
    segment,
    isFirstVisit,
    visitCount,
    exitIntentDetected,
    trackEvent,
    updateSegment,
    getScrollDepth,
    getTimeOnPage,
    canShowModal,
    trackModalShown,
    trackModalDismissed,
    trackModalConverted,
    saveLead,
    resetExitIntent,
  };

  return (
    <TrackingContext.Provider value={contextValue}>
      {children}
    </TrackingContext.Provider>
  );
}
