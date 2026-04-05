"use client";

import { useState } from "react";
import { SaveCardForm } from "./SaveCardForm";
import { ChargeSavedCardButton, SavedCardDisplay } from "./ChargeSavedCardButton";
import { StripePaymentForm } from "./StripePaymentForm";
import { CheckCircle2, CreditCard, Banknote, Shield } from "lucide-react";
import { useTrackingEvents } from "@/hooks/useTrackingEvents";

interface CompletePaymentFlowProps {
  // Job details
  jobId: string;
  jobNumber: string;

  // Customer details
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  hasSavedCard?: boolean;
  savedCardLast4?: string;
  savedCardBrand?: string;

  // Locksmith details
  locksmithId: string;
  locksmithStripeAccountId?: string;
  locksmithName?: string;

  // Payment amounts
  assessmentFee: number;
  workQuoteTotal?: number;

  // Application/Quote IDs
  applicationId?: string;
  quoteId?: string;

  // Callbacks
  onAssessmentPaid?: () => void;
  onWorkQuotePaid?: () => void;
  onComplete?: () => void;
}

type FlowStep = "save_card" | "charge_assessment" | "assessment_paid" | "charge_work" | "complete";

export function CompletePaymentFlow({
  jobId,
  jobNumber,
  customerId,
  customerEmail,
  customerName,
  customerPhone,
  hasSavedCard = false,
  savedCardLast4,
  savedCardBrand,
  locksmithId,
  locksmithStripeAccountId,
  locksmithName,
  assessmentFee,
  workQuoteTotal,
  applicationId,
  quoteId,
  onAssessmentPaid,
  onWorkQuotePaid,
  onComplete,
}: CompletePaymentFlowProps) {
  const { trackAssessmentPaid, trackPurchase, track } = useTrackingEvents();
  const [currentStep, setCurrentStep] = useState<FlowStep>(
    hasSavedCard ? "charge_assessment" : "save_card"
  );
  const [savedPaymentMethodId, setSavedPaymentMethodId] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate platform fees
  // Assessment fee: 15% commission
  const assessmentFeePercent = 0.15;
  const assessmentPlatformFee = assessmentFee * assessmentFeePercent;
  const assessmentLocksmithShare = assessmentFee - assessmentPlatformFee;

  // Work quote: 25% commission
  const workFeePercent = 0.25;
  const workPlatformFee = workQuoteTotal ? workQuoteTotal * workFeePercent : 0;
  const workLocksmithShare = workQuoteTotal ? workQuoteTotal - workPlatformFee : 0;

  const handleCardSaved = (paymentMethodId: string, custId: string) => {
    setSavedPaymentMethodId(paymentMethodId);
    setStripeCustomerId(custId);
    setCurrentStep("charge_assessment");
  };

  const handleAssessmentCharged = () => {
    setCurrentStep("assessment_paid");
    onAssessmentPaid?.();

    // Track assessment payment (InitiateCheckout conversion)
    trackAssessmentPaid(jobId, assessmentFee);

    // If there's a work quote, move to that step
    if (workQuoteTotal && workQuoteTotal > 0) {
      setTimeout(() => {
        setCurrentStep("charge_work");
      }, 2000);
    } else {
      setCurrentStep("complete");
      onComplete?.();
    }
  };

  const handleWorkQuoteCharged = () => {
    setCurrentStep("complete");
    onWorkQuotePaid?.();
    onComplete?.();

    // Track final payment (Purchase conversion)
    const totalValue = (workQuoteTotal || 0) + assessmentFee;
    trackPurchase(jobId, jobNumber, totalValue);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        <StepIndicator
          step={1}
          label="Save Card"
          active={currentStep === "save_card"}
          completed={currentStep !== "save_card"}
        />
        <div className="flex-1 h-1 bg-slate-200 mx-2">
          <div
            className={`h-full bg-orange-500 transition-all ${
              currentStep === "save_card" ? "w-0" : "w-full"
            }`}
          />
        </div>
        <StepIndicator
          step={2}
          label="Assessment Fee"
          active={currentStep === "charge_assessment"}
          completed={["assessment_paid", "charge_work", "complete"].includes(currentStep)}
        />
        <div className="flex-1 h-1 bg-slate-200 mx-2">
          <div
            className={`h-full bg-orange-500 transition-all ${
              ["charge_work", "complete"].includes(currentStep) ? "w-full" : "w-0"
            }`}
          />
        </div>
        <StepIndicator
          step={3}
          label="Final Payment"
          active={currentStep === "charge_work"}
          completed={currentStep === "complete"}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Save Card */}
      {currentStep === "save_card" && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Save Your Payment Card</h2>
              <p className="text-slate-600">Your card will be used for secure payments</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Payment Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Assessment Fee (charged now):</span>
                <span className="font-semibold text-blue-900">£{assessmentFee.toFixed(2)}</span>
              </div>
              {workQuoteTotal && (
                <div className="flex justify-between">
                  <span className="text-blue-700">Work Quote (charged after completion):</span>
                  <span className="font-semibold text-blue-900">£{workQuoteTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <SaveCardForm
            customerId={customerId}
            customerEmail={customerEmail}
            customerName={customerName}
            customerPhone={customerPhone}
            jobId={jobId}
            onSuccess={handleCardSaved}
            onError={setError}
          />
        </div>
      )}

      {/* Step 2: Charge Assessment Fee */}
      {currentStep === "charge_assessment" && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Banknote className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Assessment Fee Payment</h2>
              <p className="text-slate-600">Job #{jobNumber}</p>
            </div>
          </div>

          {/* Saved Card Display */}
          {(savedCardLast4 || hasSavedCard) && (
            <div className="mb-6">
              <SavedCardDisplay
                lastFourDigits={savedCardLast4 || "****"}
                cardBrand={savedCardBrand || "Card"}
              />
            </div>
          )}

          {/* Fee Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">Fee Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Assessment Fee:</span>
                <span>£{assessmentFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Platform Fee (15% on assessment):</span>
                <span>-£{assessmentPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t">
                <span>Locksmith receives:</span>
                <span>£{assessmentLocksmithShare.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Use saved card or show payment form */}
          {hasSavedCard || savedPaymentMethodId ? (
            <ChargeSavedCardButton
              type="assessment_fee"
              amount={assessmentFee}
              jobId={jobId}
              customerId={customerId}
              locksmithId={locksmithId}
              applicationId={applicationId}
              onSuccess={() => handleAssessmentCharged()}
              onError={setError}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
            >
              <Banknote className="w-5 h-5 mr-2" />
              Pay Assessment Fee £{assessmentFee.toFixed(2)}
            </ChargeSavedCardButton>
          ) : (
            <StripePaymentForm
              type="assessment_fee"
              amount={assessmentFee}
              jobId={jobId}
              customerId={customerId}
              locksmithId={locksmithId}
              locksmithStripeAccountId={locksmithStripeAccountId}
              applicationId={applicationId}
              onSuccess={() => handleAssessmentCharged()}
              onError={setError}
            />
          )}
        </div>
      )}

      {/* Assessment Paid Success */}
      {currentStep === "assessment_paid" && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Assessment Fee Paid!</h2>
          <p className="text-slate-600 mb-4">
            £{assessmentFee.toFixed(2)} has been charged to your card.
          </p>
          {locksmithName && (
            <p className="text-sm text-slate-500">
              {locksmithName} will receive £{assessmentLocksmithShare.toFixed(2)} after platform fees.
            </p>
          )}
          {workQuoteTotal && (
            <p className="text-slate-600 mt-4">
              Preparing final payment...
            </p>
          )}
        </div>
      )}

      {/* Step 3: Charge Work Quote */}
      {currentStep === "charge_work" && workQuoteTotal && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Banknote className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Final Work Payment</h2>
              <p className="text-slate-600">Job #{jobNumber}</p>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">Payment Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Work Quote Total:</span>
                <span>£{workQuoteTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Platform Fee (25% on work):</span>
                <span>-£{workPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t">
                <span>Locksmith receives:</span>
                <span>£{workLocksmithShare.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <ChargeSavedCardButton
            type="work_quote"
            amount={workQuoteTotal}
            jobId={jobId}
            customerId={customerId}
            locksmithId={locksmithId}
            quoteId={quoteId}
            onSuccess={() => handleWorkQuoteCharged()}
            onError={setError}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
          >
            <Banknote className="w-5 h-5 mr-2" />
            Pay Final Amount £{workQuoteTotal.toFixed(2)}
          </ChargeSavedCardButton>
        </div>
      )}

      {/* Complete */}
      {currentStep === "complete" && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Complete!</h2>
          <p className="text-slate-600 mb-6">
            All payments have been processed successfully.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <h3 className="font-semibold text-slate-900 mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Assessment Fee:</span>
                <span className="font-medium">£{assessmentFee.toFixed(2)}</span>
              </div>
              {workQuoteTotal && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Work Payment:</span>
                  <span className="font-medium">£{workQuoteTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t">
                <span>Total Paid:</span>
                <span>£{(assessmentFee + (workQuoteTotal || 0)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-6">
            <Shield className="w-4 h-4 text-green-600" />
            <span>All payments are securely processed by Stripe</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
          completed
            ? "bg-green-500 text-white"
            : active
              ? "bg-orange-500 text-white"
              : "bg-slate-200 text-slate-500"
        }`}
      >
        {completed ? <CheckCircle2 className="w-5 h-5" /> : step}
      </div>
      <span
        className={`text-xs mt-1 ${
          active || completed ? "text-slate-900 font-medium" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
