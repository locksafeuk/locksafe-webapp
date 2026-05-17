"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

// Pages where modals must never appear
const BLOCKED_PATHS = [
  "/request",
  "/checkout",
  "/signin",
  "/signup",
  "/admin",
  "/locksmith",
  "/api",
  "/dashboard",
  "/jobs",
  "/verify",
  "/reset-password",
];

const STORAGE_KEY = "locksafe_modal_dismissed";
// Show at most once per 7 days
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;
// Minimum time on page before showing: 3 minutes
const DELAY_MS = 3 * 60 * 1000;
// Minimum scroll depth: 40% of page
const SCROLL_THRESHOLD = 0.4;

interface ModalSystemProps {
  disabled?: boolean;
}

export function ModalSystem({ disabled = false }: ModalSystemProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const metConditions = useRef({ timer: false, scroll: false });

  const shouldBlock =
    disabled ||
    BLOCKED_PATHS.some((p) => pathname.startsWith(p));

  function maybeShow() {
    if (!metConditions.current.timer || !metConditions.current.scroll) return;
    // Check session suppression
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && Date.now() - parseInt(stored, 10) < SUPPRESS_MS) return;
    } catch {
      // Private browsing — proceed anyway
    }
    setVisible(true);
  }

  useEffect(() => {
    if (shouldBlock) return;

    // Timer condition: 3 minutes on page
    const timer = setTimeout(() => {
      metConditions.current.timer = true;
      maybeShow();
    }, DELAY_MS);

    // Scroll condition: reached 40% of page
    function onScroll() {
      const depth = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
      if (depth >= SCROLL_THRESHOLD) {
        metConditions.current.scroll = true;
        maybeShow();
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, shouldBlock]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LockSafe offer"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-4xl mb-3">🔐</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Locked out? We&apos;re 24/7.
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          Our vetted locksmiths arrive in under 30 minutes — any time, any lock.
        </p>
        <a
          href="/request"
          onClick={dismiss}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Get a Free Quote →
        </a>
        <button
          onClick={dismiss}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600"
        >
          No thanks, I&apos;ll manage
        </button>
      </div>
    </div>
  );
}

