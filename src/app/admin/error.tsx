"use client";

/**
 * Admin segment error boundary.
 *
 * Without this, an uncaught error in any /admin/* server component bubbles
 * up and the user lands on the global not-found page — a misleading
 * "Page Not Found" 404 for what is really a runtime/DB error. This boundary
 * catches those failures and shows an actionable error screen with the
 * message and a retry, so admin pages fail loudly and recoverably.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Something went wrong on this admin page
        </h1>
        <p className="text-sm text-slate-600 mb-1">
          This is a runtime error — not a missing page. The most common cause is a
          temporary database read failure.
        </p>
        {error?.message && (
          <p className="text-xs font-mono text-red-700 bg-red-100/60 rounded-lg px-3 py-2 my-3 break-words">
            {error.message}
          </p>
        )}
        {error?.digest && (
          <p className="text-[11px] text-slate-500 mb-4">
            Error ref: <code>{error.digest}</code>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
