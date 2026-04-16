"use client";

import { useState, useEffect } from "react";
import { X, Gift, Clock, Tag, ArrowRight, Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface SpecialOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCTAClick?: () => void;
  discountCode?: string;
  discountPercent?: number;
  expiryMinutes?: number;
}

export function SpecialOfferModal({
  isOpen,
  onClose,
  onCTAClick,
  discountCode = "WELCOME10",
  discountPercent = 10,
  expiryMinutes = 30,
}: SpecialOfferModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(expiryMinutes * 60);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(discountCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="pt-5 pb-3 px-4 text-center">
          <span className="text-amber-600 text-xs font-medium">Welcome Back!</span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Special Offer</h2>
        </div>

        {/* Offer Box */}
        <div className="mx-4 mb-4">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-4 text-white text-center">
            <Gift className="w-8 h-8 mx-auto mb-2" />
            <div className="text-3xl font-bold">{discountPercent}% OFF</div>
            <p className="text-amber-100 text-xs mt-1">Your first service</p>

            {/* Coupon Code */}
            <div className="bg-white/20 rounded-lg p-2.5 mt-3 flex items-center justify-between gap-2">
              <div className="text-left">
                <div className="text-[10px] text-amber-100">Code:</div>
                <div className="text-sm font-bold tracking-wider font-mono">{discountCode}</div>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 bg-white text-amber-600 px-2.5 py-1.5 rounded text-xs font-medium hover:bg-amber-50"
              >
                {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="mx-4 mb-4">
          <div className="bg-slate-900 rounded-lg p-2.5 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400 text-xs">Expires in:</span>
            <span className="font-mono font-bold text-amber-400">{formatTime(timeRemaining)}</span>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-4 space-y-1.5 mb-4">
          {["Valid on all services", "Applies at checkout", "One use per customer"].map((benefit) => (
            <div key={benefit} className="flex items-center gap-1.5 text-xs text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {benefit}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-4 pb-4">
          <Link
            href="/request"
            onClick={() => { onCTAClick?.(); onClose(); }}
            className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg text-sm text-center"
          >
            <Tag className="w-4 h-4 inline mr-1" /> Claim Discount <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
          <button
            onClick={onClose}
            className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 mt-2"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
