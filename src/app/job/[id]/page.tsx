"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Key, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Smart Job Redirect Page
 *
 * This page handles the /job/[id] route which is commonly sent in SMS/emails.
 * It detects the user's role (locksmith or customer) and redirects them to
 * the appropriate page:
 *
 * - Locksmiths → /locksmith/job/[id]/work
 * - Customers → /customer/job/[id]
 * - Unknown → Shows options to choose their role
 */
export default function JobRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"locksmith" | "customer" | "admin" | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  useEffect(() => {
    async function checkSessionAndRedirect() {
      try {
        // Check the current user session
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (data.user) {
          const role = data.user.role?.toLowerCase();
          setUserRole(role);

          // Redirect based on role
          if (role === "locksmith") {
            router.replace(`/locksmith/job/${jobId}/work`);
            return;
          } else if (role === "customer") {
            router.replace(`/customer/job/${jobId}`);
            return;
          } else if (role === "admin") {
            // Admin can view jobs too - redirect to admin view or customer view
            router.replace(`/admin/jobs?id=${jobId}`);
            return;
          }
        }

        // No session or unknown role - show role selector
        setShowRoleSelector(true);
        setLoading(false);
      } catch (err) {
        console.error("Error checking session:", err);
        // On error, show the role selector as fallback
        setShowRoleSelector(true);
        setLoading(false);
      }
    }

    if (jobId) {
      checkSessionAndRedirect();
    }
  }, [jobId, router]);

  // Loading state
  if (loading && !showRoleSelector) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Loading Job</h1>
          <p className="text-slate-600">Please wait while we redirect you...</p>
        </div>
      </div>
    );
  }

  // Show role selector when we can't determine the user's role
  if (showRoleSelector) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">LockSafe</span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-2">
              View Job Details
            </h1>
            <p className="text-slate-600 text-center mb-6">
              Please select your role to continue to the job page.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              {/* Customer Option */}
              <Link
                href={`/customer/job/${jobId}`}
                className="block w-full"
              >
                <Button
                  className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white text-base"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🏠</span>
                    <span>
                      <span className="block font-semibold">I'm a Customer</span>
                      <span className="block text-sm opacity-90">View my job status</span>
                    </span>
                  </span>
                </Button>
              </Link>

              {/* Locksmith Option */}
              <Link
                href={`/locksmith/job/${jobId}/work`}
                className="block w-full"
              >
                <Button
                  variant="outline"
                  className="w-full py-6 border-2 border-slate-200 hover:border-orange-200 hover:bg-orange-50 text-base"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🔧</span>
                    <span>
                      <span className="block font-semibold text-slate-900">I'm a Locksmith</span>
                      <span className="block text-sm text-slate-600">View job & manage work</span>
                    </span>
                  </span>
                </Button>
              </Link>
            </div>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Job Reference: <span className="font-mono">{jobId.slice(0, 8)}...</span>
              </p>
              <p className="text-xs text-slate-500 text-center mt-2">
                Having trouble?{" "}
                <a href="/help" className="text-orange-600 hover:underline">
                  Contact Support
                </a>
              </p>
            </div>
          </div>

          {/* Additional help */}
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-slate-600 hover:text-orange-600"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - should not reach here
  return null;
}
