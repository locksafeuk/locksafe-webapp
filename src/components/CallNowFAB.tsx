"use client";

/**
 * Sticky "Call now" floating action button — mobile only.
 *
 * Lives at the bottom-right of every public page so the call path is always
 * one tap away, no matter how far the user has scrolled. Hidden on screens
 * ≥ lg (1024px) — the desktop header already shows the phone prominently.
 * Hidden inside authenticated dashboards (admin / locksmith / customer) where
 * a marketing CTA is out of context.
 *
 * Animation is a 1.8s subtle expanding-ring pulse (animate-pulse-subtle,
 * defined in tailwind.config.ts). Well under the 3Hz WCAG flash threshold
 * and respects prefers-reduced-motion.
 */

import { Phone } from "lucide-react";
import { usePathname } from "next/navigation";
import { SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/config";

const HIDDEN_PREFIXES = [
  "/admin",
  "/locksmith/dashboard",
  "/locksmith/settings",
  "/customer/dashboard",
  "/login",
  "/register",
  "/request",
  "/quote",
];

export function CallNowFAB() {
  const pathname = usePathname() ?? "/";

  // Suppress on authenticated/dashboard surfaces and on flows where the
  // user is already mid-action (request/quote forms have their own CTAs).
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <a
      href={`tel:${SUPPORT_PHONE_TEL}`}
      data-call-cta="fab"
      aria-label={`Call ${SUPPORT_PHONE} — 24/7 emergency locksmith`}
      className="lg:hidden fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white pl-3 pr-4 py-3 rounded-full shadow-lg shadow-orange-500/40 font-semibold text-sm transition-colors"
    >
      <span className="relative inline-flex items-center justify-center w-7 h-7">
        <span
          className="absolute inset-0 rounded-full bg-white/40 animate-pulse-subtle"
          aria-hidden="true"
        />
        <Phone className="w-4 h-4 relative" aria-hidden="true" />
      </span>
      <span className="leading-none">Call now</span>
    </a>
  );
}

export default CallNowFAB;
