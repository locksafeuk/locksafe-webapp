"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Mail,
} from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. Please request a new one.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("Failed to connect. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Verifying Your Email...
        </h1>
        <p className="text-slate-600">
          Please wait while we verify your email address.
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Email Verified!
        </h1>
        <p className="text-slate-600 mb-6">
          {message}
        </p>
        <Link href="/customer/dashboard">
          <Button className="btn-primary">
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-10 h-10 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Verification Failed
      </h1>
      <p className="text-slate-600 mb-6">
        {message}
      </p>
      <div className="space-y-3">
        <Link href="/customer/settings">
          <Button className="btn-primary w-full">
            <Mail className="w-4 h-4" />
            Resend Verification Email
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
            <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
              <VerifyEmailContent />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
