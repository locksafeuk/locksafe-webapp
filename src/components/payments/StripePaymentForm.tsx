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
import { Loader2, Shield, CheckCircle2, Info } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface StripePaymentFormProps {
  amount: number;
  type: "assessment_fee" | "work_quote";
  jobId: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  locksmithId?: string;
  locksmithStripeAccountId?: string;
  applicationId?: string;
  quoteId?: string;
  onSuccess: (paymentDetails?: PaymentDetails) => void;
  onError: (error: string) => void;
}

interface PaymentDetails {
  paymentIntentId: string;
  amount: number;
  platformFee: number;
  locksmithShare: number;
  stripeCustomerId?: string;
}

interface PaymentIntentResponse {
  clientSecret?: string;
  paymentIntentId?: string;
  finalAmount?: number;
  originalAmount?: number;
  platformFee?: number;
  locksmithShare?: number;
  stripeCustomerId?: string;
  transfersToLocksmith?: boolean;
  error?: string;
}

export function StripePaymentForm({
  amount,
  type,
  jobId,
  customerId,
  customerEmail,
  customerName,
  customerPhone,
  locksmithId,
  locksmithStripeAccountId,
  applicationId,
  quoteId,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [finalAmount, setFinalAmount] = useState(amount);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    // Create PaymentIntent on mount
    fetch("/api/payments/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        amount,
        jobId,
        customerId,
        customerEmail,
        customerName,
        customerPhone,
        locksmithId,
        locksmithStripeAccountId,
        applicationId,
        quoteId,
      }),
    })
      .then((res) => res.json())
      .then((data: PaymentIntentResponse) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setFinalAmount(data.finalAmount || amount);
          // Store payment details for success callback
          setPaymentDetails({
            paymentIntentId: data.paymentIntentId || "",
            amount: data.finalAmount || amount,
            platformFee: data.platformFee || 0,
            locksmithShare: data.locksmithShare || 0,
            stripeCustomerId: data.stripeCustomerId,
          });
        } else {
          onError(data.error || "Failed to initialize payment");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error creating payment intent:", err);
        onError("Failed to initialize payment");
        setIsLoading(false);
      });
  }, [amount, type, jobId, customerId, customerEmail, locksmithId, locksmithStripeAccountId, applicationId, quoteId, onError, onSuccess]);

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
        Failed to initialize payment. Please try again.
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
      <CheckoutForm
        amount={finalAmount}
        type={type}
        paymentDetails={paymentDetails}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

function CheckoutForm({
  amount,
  type,
  paymentDetails,
  onSuccess,
  onError,
}: {
  amount: number;
  type: "assessment_fee" | "work_quote";
  paymentDetails: PaymentDetails | null;
  onSuccess: (paymentDetails?: PaymentDetails) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: "if_required",
    });

    if (error) {
      console.error("Payment error:", error);
      onError(error.message || "Payment failed");
      setIsProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      setPaymentSuccess(true);
      setTimeout(() => {
        onSuccess(paymentDetails || undefined);
      }, 1500);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Successful!</h3>
        <p className="text-slate-600">Redirecting...</p>
      </div>
    );
  }

  // Commission info based on payment type
  const commissionRate = type === "assessment_fee" ? 15 : 25;
  const typeLabel = type === "assessment_fee" ? "Assessment Fee" : "Work Payment";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">{typeLabel}</p>
            <p className="text-blue-700 mt-1">
              {type === "assessment_fee"
                ? "This covers the locksmith's assessment visit. Work payment is separate."
                : "This covers the work completed. The assessment fee was paid separately."}
            </p>
          </div>
        </div>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Secure payment powered by Stripe</span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          `Pay £${amount.toFixed(2)}`
        )}
      </Button>
    </form>
  );
}

// Fallback component when Stripe is not configured
export function StripePaymentFormFallback({
  amount,
  type,
  onSuccess,
}: {
  amount: number;
  type?: "assessment_fee" | "work_quote";
  onSuccess: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMockPayment = async () => {
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
    onSuccess();
  };

  const typeLabel = type === "assessment_fee" ? "Assessment Fee" : type === "work_quote" ? "Work Payment" : "Payment";

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>Demo Mode:</strong> Stripe is not configured. Using simulated payment.
      </div>

      {/* Payment info box */}
      {type && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">{typeLabel}</p>
              <p className="text-blue-700 mt-1">
                {type === "assessment_fee"
                  ? "This covers the locksmith's assessment visit. Work payment is separate."
                  : "This covers the work completed. The assessment fee was paid separately."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Card Number
          </label>
          <input
            type="text"
            placeholder="4242 4242 4242 4242"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Expiry
            </label>
            <input
              type="text"
              placeholder="MM/YY"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CVC
            </label>
            <input
              type="text"
              placeholder="123"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Demo payment (no real charge)</span>
      </div>

      <Button
        onClick={handleMockPayment}
        disabled={isProcessing}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          `Pay £${amount.toFixed(2)}`
        )}
      </Button>
    </div>
  );
}
