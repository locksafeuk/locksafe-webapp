"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const userType = searchParams.get("type"); // "customer" or "locksmith"

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          userType: userType || undefined
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loginLink = userType === "locksmith" ? "/locksmith/login" : "/login";
  const title = userType === "locksmith" ? "Locksmith Password Reset" : "Forgot Your Password?";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 flex flex-col">
      {/* Header */}
      <header className="py-6">
        <div className="section-container">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              Lock<span className="text-orange-500">Safe</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8">
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Check Your Email
                </h1>
                <p className="text-slate-600 mb-6">
                  If an account exists for <strong>{email}</strong>, we&apos;ve sent password reset instructions.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Didn&apos;t receive the email? Check your spam folder or try again.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      setSuccess(false);
                      setEmail("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Try Different Email
                  </Button>
                  <Link href={loginLink}>
                    <Button className="w-full btn-primary">
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href={loginLink}
                  className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>

                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  {title}
                </h1>
                <p className="text-slate-600 mb-6">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-shadow"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-primary justify-center py-6 text-base"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Remember your password?{" "}
              <Link href={loginLink} className="text-orange-600 hover:text-orange-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
