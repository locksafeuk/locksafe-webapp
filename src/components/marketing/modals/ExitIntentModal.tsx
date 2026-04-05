"use client";

import { useState } from "react";
import {
  X,
  FileText,
  Check,
  Lock,
  Shield,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface ExitIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, name?: string) => Promise<void>;
  variant?: "lead_magnet" | "urgency";
}

export function ExitIntentModal({
  isOpen,
  onClose,
  onSubmit,
  variant = "lead_magnet",
}: ExitIntentModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(email, name);
      setIsSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Check your inbox!</h3>
          <p className="text-sm text-gray-600">Your free guide is on its way.</p>
        </div>
      </div>
    );
  }

  // Lead magnet variant - compact
  if (variant === "lead_magnet") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex">
            {/* Left - Offer */}
            <div className="bg-slate-900 p-5 w-2/5 text-white">
              <div className="flex items-center gap-1 text-amber-400 text-xs font-medium mb-2">
                <FileText className="w-3 h-3" />
                FREE GUIDE
              </div>
              <h3 className="text-sm font-bold mb-3 leading-tight">
                7 Signs Your Locks Need Replacing
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">Pro locksmith tips</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">Spot weak points</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">15% off first service</span>
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="p-5 w-3/5">
              <h2 className="text-base font-bold text-gray-900 mb-1">Wait! Before you go...</h2>
              <p className="text-gray-600 text-xs mb-4">Get your free guide + discount.</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address *"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Send My Free Guide <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <p className="text-[10px] text-center text-gray-400 flex items-center justify-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> No spam. Unsubscribe anytime.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Urgency variant - compact
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-slate-900 px-4 py-5 text-center">
          <h2 className="text-base font-bold text-white mb-1">Still looking?</h2>
          <p className="text-slate-300 text-xs">We're here to help.</p>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">15 min avg response</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">All locksmiths verified</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">Quote before work</div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <a
            href="/request"
            className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg text-sm text-center"
          >
            Get Free Quote
          </a>
        </div>
      </div>
    </div>
  );
}
