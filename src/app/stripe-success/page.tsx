"use client";

import { useEffect } from "react";
import { Lock } from "lucide-react";

/**
 * /stripe-success
 *
 * Landing page after Stripe Connect onboarding completes (mobile app flow).
 * This route is intentionally NOT under /locksmith/* so iOS universal-link
 * rules don't intercept it and open an un-routable deep link.
 *
 * The page immediately tries to open the LockSafe app via the custom URL
 * scheme, then shows a manual fallback button.
 */
export default function StripeSuccessPage() {
  useEffect(() => {
    // Give the page 300 ms to paint before redirecting, so the user sees
    // the confirmation message briefly rather than a blank flash.
    const t = setTimeout(() => {
      window.location.href = "locksafe:///";
    }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-white" />
        </div>

        {/* Stripe badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg viewBox="0 0 60 25" fill="none" className="h-6" aria-label="Stripe">
            <path
              d="M5.5 10.6c0-1.7 1.4-2.4 3.6-2.4 3.2 0 7.3 1 10.5 2.7V4.4C16.4 2.7 12.6 2 8.8 2 3.5 2 0 4.8 0 11c0 8.3 11.4 7 11.4 10.5 0 2-1.7 2.6-4 2.6-3.5 0-7.9-1.4-11.4-3.4V27c3.7 1.6 7.4 2.3 11.4 2.3 6.7 0 11.2-3.3 11.2-9.6 0-9-11.1-7.4-11.1-10.7v.6zM36 2.5l-4.5 1-.1.7C29.9 1.9 28.1 1 26 1c-5.2 0-9.6 4.2-9.6 11s4.3 11 9.6 11c2.3 0 4.2-1 5.5-2.5v2H36V2.5zm-9.3 16c-3 0-5.1-2.5-5.1-6.5s2-6.5 5.1-6.5c3 0 5 2.5 5 6.5s-2 6.5-5 6.5zm18-16l-4.9 1.2V2h-5v21h5v-11c0-3 1.5-4.5 4-4.5h1l.1-5H44.7zM48 0c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3zm-2.5 23h5V6h-5v17zm13-17.3c1.3 0 2.1.8 2.4 2.3H55c.2-1.5 1-2.3 2.4-2.3.3 0 .5 0 .8.1l.3-5c-.4 0-.8-.1-1.2-.1-5.3 0-8.3 3.8-8.3 9.3v.5c0 5.3 3 8.5 8 8.5.4 0 .8 0 1.3-.1l.3-4.7c-.5.1-.9.1-1.4.1-2.6 0-3.4-1.5-3.4-3.9V9.5c0-2.3.8-3.8 3.4-3.8z"
              fill="#635BFF"
            />
          </svg>
          <span className="text-slate-500 text-sm">Connected</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Stripe setup complete
        </h1>
        <p className="text-slate-500 mb-6">
          Your payout account is ready. Opening LockSafe…
        </p>

        <a
          href="locksafe:///"
          className="block w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl text-center hover:bg-slate-800 transition-colors"
        >
          Open LockSafe
        </a>

        <p className="text-slate-400 text-xs mt-4">
          If the app doesn&apos;t open automatically, tap the button above.
        </p>
      </div>
    </div>
  );
}
