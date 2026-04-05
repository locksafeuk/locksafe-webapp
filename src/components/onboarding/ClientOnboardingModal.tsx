"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Phone,
  MapPin,
  Loader2,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";

interface ClientOnboardingModalProps {
  customerId: string;
  customerName: string;
  onComplete: () => void;
}

export function ClientOnboardingModal({
  customerId,
  customerName,
  onComplete,
}: ClientOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { id: "welcome", title: "Welcome" },
    { id: "how-it-works", title: "How It Works" },
    { id: "assessment-fee", title: "Assessment Fee" },
    { id: "refunds", title: "Refund Policy" },
    { id: "terms", title: "Accept Terms" },
  ];

  const handleAcceptTerms = async () => {
    if (!termsAccepted) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/customer/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();
      if (data.success) {
        onComplete();
      } else {
        alert(data.error || "Failed to accept terms. Please try again.");
      }
    } catch (error) {
      console.error("Error accepting terms:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center py-4 sm:py-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Welcome to LockSafe, {customerName.split(" ")[0]}!
            </h2>
            <p className="text-slate-600 text-base sm:text-lg max-w-md mx-auto">
              The UK's first anti-fraud locksmith platform. Before you start, let us explain how our service works.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Verified Locksmiths
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Transparent Pricing
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Full Documentation
              </span>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="py-4 sm:py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center">
              How LockSafe Works
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">1. Submit Your Request</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Describe your lock problem and location. Multiple verified locksmiths will apply to help you.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">2. Choose & Pay Assessment Fee</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Select a locksmith based on price, rating, and ETA. Pay the assessment fee upfront.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">3. Locksmith Arrives & Quotes</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    The locksmith diagnoses the problem and provides a transparent quote for the actual work.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">4. Accept or Decline</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    You choose whether to proceed with the work. Sign digitally when complete.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Phone className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              What is the Assessment Fee?
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
              <p className="text-slate-700 leading-relaxed">
                The <strong>Assessment Fee</strong> (also called "call-out fee") covers the locksmith's travel
                to your location and their time to diagnose your lock problem. This is paid <strong>upfront</strong> when
                you confirm a booking.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  <strong>Separate from work quote</strong> — The assessment fee is NOT the total cost. You'll receive a separate quote for the actual repair.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  <strong>You choose the price</strong> — Different locksmiths apply with different assessment fees. You pick what works for you.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  <strong>Transparent upfront</strong> — No hidden charges. You know exactly what you're paying before confirming.
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <RefreshCcw className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              Refund Policy
            </h2>

            <div className="space-y-4">
              {/* Refund eligible scenario */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">When You Can Get a Refund</h3>
                </div>
                <p className="text-sm text-green-700">
                  If a locksmith <strong>fails to arrive</strong> within the agreed ETA plus a 30-minute grace period,
                  you are entitled to a <strong>full refund</strong> of your assessment fee.
                </p>
                <div className="mt-3 p-3 bg-white/50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">
                    Example: If ETA is 20 minutes, you can claim a refund after 50 minutes (20 + 30) if no one arrives.
                  </p>
                </div>
              </div>

              {/* Non-refundable scenarios */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-800">Non-Refundable Situations</h3>
                </div>
                <div className="space-y-2 text-sm text-amber-700">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>
                      <strong>Once the locksmith arrives</strong> — The assessment fee is earned upon arrival.
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>
                      <strong>If you decline the work quote</strong> — You keep your right to decline, but the assessment fee is non-refundable.
                      This compensates the locksmith for their travel and diagnosis time.
                    </span>
                  </p>
                </div>
              </div>

              {/* Important note */}
              <div className="bg-slate-100 rounded-xl p-4 text-sm">
                <p className="text-slate-600">
                  <strong>Important:</strong> If you accept the assessment and the locksmith sends a quote which you decline,
                  no refund will be given for the assessment fee. You are only paying for the diagnosis and travel —
                  not committing to the full repair.
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              Accept Terms & Conditions
            </h2>
            <p className="text-slate-600 text-center mb-6">
              To use LockSafe, please read and accept our terms of service.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto text-sm text-slate-600 border">
              <h4 className="font-semibold text-slate-900 mb-2">Summary of Key Terms:</h4>
              <ul className="space-y-2 list-disc pl-5">
                <li>LockSafe is a marketplace connecting you with independent, verified locksmiths.</li>
                <li>The assessment fee covers travel and diagnosis and is paid upfront.</li>
                <li>You have the right to decline any work quote without additional obligation.</li>
                <li>Refunds are available if the locksmith doesn't arrive within ETA + 30 minutes.</li>
                <li>Once a locksmith arrives, the assessment fee is non-refundable.</li>
                <li>Digital signatures create legally-binding records of completed work.</li>
                <li>All payments are processed securely through Stripe.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 p-4 bg-white border-2 border-slate-200 rounded-xl cursor-pointer hover:border-orange-300 transition-colors">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 mt-0.5"
              />
              <span className="text-sm text-slate-700">
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" className="text-orange-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/refund-policy" target="_blank" className="text-orange-600 hover:underline">
                  Refund Policy
                </Link>
                . I understand how the assessment fee and refund process works.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Progress bar */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-1 mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? "bg-orange-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 text-center">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50">
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 sm:flex-none"
              >
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleAcceptTerms}
                disabled={!termsAccepted || isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept & Continue
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
