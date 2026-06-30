import { getOrCreateVisitorId } from "@/lib/marketing/client-attribution";

/**
 * Client-side funnel event. Sends one event to /api/tracking/event (which
 * writes an AnalyticsEvent). `keepalive` so it survives a route change. Never
 * throws — tracking must not break the page.
 */
export function trackEvent(type: string, data: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const visitorId = getOrCreateVisitorId();
    const body = JSON.stringify({
      type,
      visitorId,
      sessionId: visitorId,
      data: { ...data, path: window.location.pathname },
    });
    void fetch("/api/tracking/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — analytics must never break the page */
  }
}
