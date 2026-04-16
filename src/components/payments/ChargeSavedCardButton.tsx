"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, CreditCard, AlertCircle } from "lucide-react";

interface ChargeSavedCardButtonProps {
  type: "assessment_fee" | "work_quote";
  amount: number;
  jobId: string;
  customerId: string;
  locksmithId: string;
  applicationId?: string;
  quoteId?: string;
  onSuccess: (result: ChargeResult) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ChargeResult {
  paymentIntentId: string;
  paymentId: string;
  status: string;
  amount: number;
  platformFee: number;
  locksmithShare: number;
}

export function ChargeSavedCardButton({
  type,
  amount,
  jobId,
  customerId,
  locksmithId,
  applicationId,
  quoteId,
  onSuccess,
  onError,
  disabled,
  className,
  children,
}: ChargeSavedCardButtonProps) {
  const [isCharging, setIsCharging] = useState(false);
  const [chargeSuccess, setChargeSuccess] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  const handleCharge = async () => {
    setIsCharging(true);
    setChargeError(null);

    try {
      const response = await fetch("/api/payments/charge-saved-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount,
          jobId,
          customerId,
          locksmithId,
          applicationId,
          quoteId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setChargeSuccess(true);
        onSuccess(data);
      } else {
        const errorMsg = data.error || "Failed to charge card";
        setChargeError(errorMsg);
        onError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to process payment";
      setChargeError(errorMsg);
      onError(errorMsg);
    } finally {
      setIsCharging(false);
    }
  };

  if (chargeSuccess) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="w-5 h-5" />
        <span>Payment Successful!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleCharge}
        disabled={disabled || isCharging}
        className={className || "w-full bg-orange-500 hover:bg-orange-600 text-white"}
      >
        {isCharging ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Charging...
          </>
        ) : (
          children || (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Pay £{amount.toFixed(2)} with Saved Card
            </>
          )
        )}
      </Button>

      {chargeError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{chargeError}</span>
        </div>
      )}
    </div>
  );
}

// Display component showing saved card info
interface SavedCardDisplayProps {
  lastFourDigits?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export function SavedCardDisplay({
  lastFourDigits = "****",
  cardBrand = "Card",
  expiryMonth,
  expiryYear,
}: SavedCardDisplayProps) {
  const brandIcons: Record<string, string> = {
    visa: "💳",
    mastercard: "💳",
    amex: "💳",
    discover: "💳",
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
        <CreditCard className="w-5 h-5 text-slate-600" />
      </div>
      <div>
        <div className="font-medium text-slate-900">
          {brandIcons[cardBrand.toLowerCase()] || "💳"} {cardBrand} ending in {lastFourDigits}
        </div>
        {expiryMonth && expiryYear && (
          <div className="text-sm text-slate-500">
            Expires {String(expiryMonth).padStart(2, "0")}/{String(expiryYear).slice(-2)}
          </div>
        )}
      </div>
    </div>
  );
}
