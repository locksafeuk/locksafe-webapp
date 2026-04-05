"use client";

import { useState, useEffect } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle2, CreditCard } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface SaveCardFormProps {
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  jobId?: string;
  onSuccess: (paymentMethodId: string, stripeCustomerId: string) => void;
  onError: (error: string) => void;
}

export function SaveCardForm({
  customerId,
  customerEmail,
  customerName,
  customerPhone,
  jobId,
  onSuccess,
  onError,
}: SaveCardFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create SetupIntent on mount
    fetch("/api/payments/setup-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
        jobId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setSetupIntentId(data.setupIntentId);
          setStripeCustomerId(data.stripeCustomerId);
        } else {
          onError(data.error || "Failed to initialize card setup");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error creating setup intent:", err);
        onError("Failed to initialize card setup");
        setIsLoading(false);
      });
  }, [customerId, customerEmail, customerName, customerPhone, jobId, onError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to initialize card setup. Please try again.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#f97316",
            colorBackground: "#ffffff",
            colorText: "#1e293b",
            colorDanger: "#ef4444",
            fontFamily: "system-ui, sans-serif",
            borderRadius: "12px",
          },
        },
      }}
    >
      <SaveCardCheckoutForm
        setupIntentId={setupIntentId!}
        stripeCustomerId={stripeCustomerId!}
        customerId={customerId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

function SaveCardCheckoutForm({
  setupIntentId,
  stripeCustomerId,
  customerId,
  onSuccess,
  onError,
}: {
  setupIntentId: string;
  stripeCustomerId: string;
  customerId?: string;
  onSuccess: (paymentMethodId: string, stripeCustomerId: string) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/card-saved`,
      },
      redirect: "if_required",
    });

    if (error) {
      console.error("Setup error:", error);
      onError(error.message || "Failed to save card");
      setIsProcessing(false);
    } else if (setupIntent?.status === "succeeded") {
      // Confirm card was saved in backend
      try {
        const response = await fetch("/api/payments/setup-card", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setupIntentId,
            customerId,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setCardSaved(true);
          setTimeout(() => {
            onSuccess(data.paymentMethodId, stripeCustomerId);
          }, 1500);
        } else {
          onError(data.error || "Failed to confirm card setup");
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Error confirming setup:", err);
        onError("Failed to confirm card setup");
        setIsProcessing(false);
      }
    }
  };

  if (cardSaved) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Card Saved Successfully!</h3>
        <p className="text-slate-600">Your card has been securely saved for future payments.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-700 mb-2">
          <CreditCard className="w-5 h-5" />
          <span className="font-semibold">Save Your Card</span>
        </div>
        <p className="text-sm text-blue-600">
          Save your card securely for convenient payment of the assessment fee and final work payment.
        </p>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Your card details are securely stored by Stripe</span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Saving Card...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            Save Card
          </>
        )}
      </Button>
    </form>
  );
}
