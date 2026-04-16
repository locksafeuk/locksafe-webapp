"use client";

import { useState } from "react";
import { X, Check, Lock, ArrowRight, Loader2, Home, Key, Shield, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface LeadMagnetCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, name?: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function LeadMagnetCapture({
  isOpen,
  onClose,
  onSubmit,
  title = "Free Security Checklist",
  description = "Check your home in 5 minutes",
}: LeadMagnetCaptureProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartChecklist = () => {
    onClose();
    router.push("/security-checklist");
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          {/* Green header */}
          <div className="bg-emerald-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You're All Set!</h3>
            <p className="text-emerald-100 text-sm">Your checklist is ready to complete</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Home className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">7 Door Security Checks</p>
                  <p className="text-xs text-gray-500">Entry points & vulnerabilities</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Key className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">7 Lock Quality Checks</p>
                  <p className="text-xs text-gray-500">Standards & protection levels</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">7 Risk Assessment Checks</p>
                  <p className="text-xs text-gray-500">Overall security evaluation</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartChecklist}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              Start Your Security Check <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-xs text-center text-gray-400 mt-4">
              Takes approximately 5 minutes to complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-emerald-600 px-4 py-4">
          <h2 className="text-base font-bold text-white text-center">{title}</h2>
          <p className="text-emerald-100 text-xs text-center mt-1">{description}</p>

          <div className="flex justify-center gap-4 mt-3">
            {[
              { icon: Home, label: "Doors" },
              { icon: Key, label: "Locks" },
              { icon: Shield, label: "Risks" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <item.icon className="w-5 h-5 text-white mx-auto" />
                <div className="text-[10px] text-emerald-100 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email *"
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Get My Checklist <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-[10px] text-center text-gray-400 flex items-center justify-center gap-1">
              <Lock className="w-2.5 h-2.5" /> 2,847 downloads this month
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
