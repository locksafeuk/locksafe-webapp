"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics/track-event";

/**
 * Fires a `page_view` event on every route change (and the initial load), so
 * the top of the funnel is finally measurable. Mounted once, globally. Uses
 * only usePathname (no useSearchParams) to avoid a Suspense boundary.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastRef.current === pathname) return;
    lastRef.current = pathname;
    trackEvent("page_view", {
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
  }, [pathname]);

  return null;
}
