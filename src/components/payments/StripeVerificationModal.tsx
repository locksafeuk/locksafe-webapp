"use client";

import { useState } from "react";
import {
  AlertTriangle,
  X,
  CreditCard,
  ArrowRight,
  Shield,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface StripeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locksmithId: string;
  stripeStatus?: {
    connected: boolean;
    onboarded: boolean;
    verified: boolean;
    payoutsEnabled: boolean;
  };
}

export function StripeVerificationModal({
  isOpen,
  onClose,
  locksmithId,
  stripeStatus,
}: StripeVerificationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConnectStripe = async () => {
    setIsLoading(true);
    setError("");

    try {
      // If they have a connected account but not onboarded, get a new onboarding link
      const endpoint = stripeStatus?.connected
        ? "/api/stripe-connect/onboard"
        : "/api/stripe-connect";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start Stripe Connect. Please try again.");
      }
    } catch (err) {
      console.error("Stripe Connect error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Determine the message based on status
  const getMessage = () => {
    if (!stripeStatus?.connected) {
      return {
        title: "Set Up Payment Account",
        description:
          "Before you can apply for jobs, you need to connect your bank account to receive payments.",
      };
    }
    if (!stripeStatus?.onboarded) {
      return {
        title: "Complete Your Setup",
        description:
          "You've started setting up payments, but haven't finished. Complete the setup to start earning.",
      };
    }
    if (!stripeStatus?.payoutsEnabled) {
      return {
        title: "Verification Pending",
        description:
          "Your account is being verified by Stripe. This usually takes 1-2 business days. You can check your status or provide additional information.",
      };
    }
    return {
      title: "Payment Setup Required",
      description: "Please complete your payment setup to apply for jobs.",
    };
  };

  const { title, description } = getMessage();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning header */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-amber-100 text-sm">{description}</p>
        </div>

        {/* Status checklist */}
        <div className="px-6 py-6 space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Your setup status:
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stripeStatus?.connected
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {stripeStatus?.connected ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              )}
            </div>
            <span
              className={
                stripeStatus?.connected ? "text-gray-900" : "text-gray-500"
              }
            >
              Stripe account created
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stripeStatus?.onboarded
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {stripeStatus?.onboarded ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              )}
            </div>
            <span
              className={
                stripeStatus?.onboarded ? "text-gray-900" : "text-gray-500"
              }
            >
              Bank details added
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stripeStatus?.payoutsEnabled
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {stripeStatus?.payoutsEnabled ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              )}
            </div>
            <span
              className={
                stripeStatus?.payoutsEnabled ? "text-gray-900" : "text-gray-500"
              }
            >
              Payouts enabled
            </span>
          </div>
        </div>

        {/* Info box */}
        <div className="px-6 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Secure payments:</strong> Stripe handles all payments
              securely. Your bank details are never stored on our servers.
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handleConnectStripe}
            disabled={isLoading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                {stripeStatus?.connected
                  ? "Complete Setup"
                  : "Connect Bank Account"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
