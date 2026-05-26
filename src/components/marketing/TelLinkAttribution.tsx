"use client";

/**
 * Global Call-Attribution Listener
 *
 * Mounts a single capture-phase click listener on document.body that
 * intercepts every <a href="tel:..."> click anywhere on the page and
 * fires a CallIntent BEFORE the dialler opens. Zero changes needed
 * to the dozens of tel: anchors already scattered across the site.
 *
 * MOUNT ONCE at the root layout (inside <UserTracker> so the
 * visitorId is set up first).
 *
 * BUTTON IDs:
 *   To label which CTA drove the call, set `data-call-id="hero"` etc.
 *   on the anchor (or its containing button). The listener walks the
 *   ancestor chain looking for the nearest data-call-id and uses it
 *   as the buttonId. When absent, falls back to the element's `id`
 *   attribute. Both are optional — attribution still works without.
 *
 * Use capture phase so we run BEFORE any inline onClick the anchor
 * might define. Browser-native tel: handling proceeds normally
 * after — we never preventDefault.
 */

import { useEffect } from "react";
import { recordCallIntent } from "@/lib/marketing/click-to-call";

function nearestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  let node = target as HTMLElement | null;
  while (node && node.nodeType === 1) {
    if (node.tagName === "A") return node as HTMLAnchorElement;
    node = node.parentElement;
  }
  return null;
}

function nearestCallId(anchor: HTMLAnchorElement): string | undefined {
  let node: HTMLElement | null = anchor;
  while (node) {
    const tag = node.dataset?.callId;
    if (tag) return tag;
    node = node.parentElement;
  }
  return anchor.id || undefined;
}

export function TelLinkAttribution() {
  useEffect(() => {
    function onClick(event: Event) {
      const anchor = nearestAnchor(event.target);
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.toLowerCase().startsWith("tel:")) return;

      // Fire the intent beacon — never preventDefault, let the
      // browser open the dialler natively.
      try {
        recordCallIntent(nearestCallId(anchor), "website_call_button");
      } catch {
        // recordCallIntent never throws, but defence-in-depth.
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
